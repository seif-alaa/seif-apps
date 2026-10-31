#!/usr/bin/env python3
"""
Prepare configurator layers and product photos from raw AI-generated images.

    python3 scripts/prepare-parts.py            # reads incoming-images/watches, writes public/parts + public/products

Requires: Pillow (with WebP), numpy, scipy.   pip install pillow numpy scipy

Every simulator layer is exported on a 1024x1024 transparent canvas at 1 mm = 19.5 px with
its true centre (dial axis / hand pivot) at (512, 512). Edges are measured from the
image alpha, never guessed. All measurements are written to public/parts/layers.json.
"""
from __future__ import annotations

import json
import shutil
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "incoming-images" / "watches"
UNSORTED = ROOT / "incoming-images" / "unsorted"
PARTS = ROOT / "public" / "parts"
PRODUCTS = ROOT / "public" / "products"

CANVAS = 1024
C = CANVAS / 2  # 512
PX_PER_MM = 19.5

# ── Spec (all in canvas pixels) ──────────────────────────────────────────────
SPEC = {
    "case_body_width": 819,       # 42 mm
    "dial_diameter": 556,         # 28.5 mm
    "ring_outer": 595,            # 30.5 mm
    "bezel_outer": 819,           # 42 mm
    "bezel_inner": 605,           # 31 mm
    "hour_tip": 166,
    "minute_tip": 244,
    "second_tip": 254,
    "strap_width": 429,           # 22 mm
    "strap_gap": (322, 702),
}

# source file  ->  output name  (and how to treat it)
FILES = {
    "case_C01": "skx_42mm_stainless_case_1024.png",
    "dial_D01": "Seiko-Style Black Diver Watch Dial.png",
    "dial_D02": "Navy Blue Seiko Diver Watch Dial.png",
    "dial_D03": "Emerald Seiko Diver Dial.png",
    "dial_D04": "Seiko Silver Sunburst Watch Dial.png",
    "hands_H01_hour": "Centered Mercedes-Style Watch Hand.png",
    "hands_H01_minute": "Centered Silver Watch Hand with Luminous Inlay.png",
    "hands_H01_second": "Centered Polished Watch Seconds Hand.png",
    "ring_R01": "Brushed Steel Watch Minute Track Ring.png",
    "insert_B01": "Bare Steel Dive Watch Case and Bezel.png",   # right-hand object only
    "bracelet_S02": "Stainless Steel Watch Bracelet Cutout.png",
    "bracelet_S01": "Stainless Steel Jubilee Bracelet Split View.png",
    "strap_S08": "Disassembled Black Dive Watch Strap.png",
    "strap_S09": "Vintage Brown Leather Watch Strap Set.png",
}
# Duplicates / alternates that were not chosen (copied, not moved, to incoming-images/unsorted)
ALTERNATES = [
    "Empty Stainless Steel Diver Watch Case.png",
    "Isolated Stainless Steel Watch Bracelet.png",
    "Mercedes-Style Luminous Watch Hand.png",
    "Isolated Luminous Sword Watch Hand.png",
]
PRODUCT_FILES = {
    "product_red-black-gmt": "Seiko GMT on the Watchmaker#U2019s Bench.png",
    "product_baby-blue": "Seiko Watch on a Watchmaker#U2019s Workbench.png",
}

report: dict = {"canvas": CANVAS, "pxPerMm": PX_PER_MM, "spec": {k: v for k, v in SPEC.items()}, "parts": {}, "notes": []}


# ── Helpers ──────────────────────────────────────────────────────────────────
def load(name: str) -> Image.Image:
    return Image.open(SRC / name).convert("RGBA")


def alpha_mask(im: Image.Image, t: int = 128) -> np.ndarray:
    return np.asarray(im)[..., 3] >= t


def clean(im: Image.Image) -> tuple[Image.Image, dict]:
    """Remove stray specks and decontaminate edge colours (no white/black halos)."""
    a = np.asarray(im).copy()
    alpha = a[..., 3]
    stats = {"specksRemoved": 0, "edgePixelsRecoloured": 0}
    lab, n = ndi.label(alpha > 8, structure=np.ones((3, 3)))
    if n > 1:
        sizes = ndi.sum(alpha > 8, lab, range(1, n + 1))
        keep = sizes >= max(60, 0.002 * sizes.max())
        for i, k in enumerate(keep, start=1):
            if not k:
                stats["specksRemoved"] += int(sizes[i - 1])
                alpha[lab == i] = 0
    opaque = alpha >= 250
    if opaque.any():
        dist, (iy, ix) = ndi.distance_transform_edt(~opaque, return_indices=True)
        edge = (alpha < 250) & (alpha > 0) & (dist <= 4)
        a[..., :3][edge] = a[iy[edge], ix[edge], :3]
        stats["edgePixelsRecoloured"] = int(edge.sum())
    a[..., 3] = alpha
    a[alpha == 0, :3] = 0
    return Image.fromarray(a, "RGBA"), stats


def fit_circle(points_xy: np.ndarray) -> tuple[float, float, float]:
    """Least-squares (Kåsa) circle fit. Returns cx, cy, r."""
    x, y = points_xy[:, 0], points_xy[:, 1]
    A = np.c_[2 * x, 2 * y, np.ones_like(x)]
    b = x**2 + y**2
    (cx, cy, c), *_ = np.linalg.lstsq(A, b, rcond=None)
    return float(cx), float(cy), float(np.sqrt(c + cx**2 + cy**2))


def outer_boundary(mask: np.ndarray) -> np.ndarray:
    filled = ndi.binary_fill_holes(mask)
    edge = filled & ~ndi.binary_erosion(filled)
    ys, xs = np.nonzero(edge)
    return np.c_[xs, ys].astype(float)


def inner_holes(mask: np.ndarray, min_area: int = 150) -> list[dict]:
    lab, n = ndi.label(~mask)
    border = set(np.unique(np.r_[lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    out = []
    for i in range(1, n + 1):
        if i in border:
            continue
        m = lab == i
        area = int(m.sum())
        if area < min_area:
            continue
        ys, xs = np.nonzero(m)
        out.append({"area": area, "cx": float(xs.mean()), "cy": float(ys.mean()), "x0": int(xs.min()), "x1": int(xs.max()), "y0": int(ys.min()), "y1": int(ys.max())})
    return sorted(out, key=lambda h: -h["area"])


def place(im: Image.Image, cx: float, cy: float, scale: float) -> Image.Image:
    """Resample so source point (cx, cy) lands on canvas centre at the given scale (premultiplied Lanczos)."""
    pad = int(CANVAS / scale) + 8
    big = Image.new("RGBA", (im.width + 2 * pad, im.height + 2 * pad), (0, 0, 0, 0))
    big.paste(im, (pad, pad))
    half = C / scale
    box = (cx + pad - half, cy + pad - half, cx + pad + half, cy + pad + half)
    out = big.resize((CANVAS, CANVAS), Image.LANCZOS, box=box)
    a = np.asarray(out).copy()
    a[a[..., 3] < 3] = 0  # drop resampling haze
    return Image.fromarray(a, "RGBA")


def measure_out(im: Image.Image) -> dict:
    m = alpha_mask(im)
    ys, xs = np.nonzero(m)
    return {"bbox": [int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())]}


def save(im: Image.Image, name: str, extra: dict | None = None):
    PARTS.mkdir(parents=True, exist_ok=True)
    im.save(PARTS / f"{name}.png", optimize=True)
    im.save(PARTS / f"{name}.webp", "WEBP", quality=90, alpha_quality=100, method=6)
    entry = report["parts"].setdefault(name, {})
    entry.update(measure_out(im))
    entry["png_kb"] = round((PARTS / f"{name}.png").stat().st_size / 1024)
    entry["webp_kb"] = round((PARTS / f"{name}.webp").stat().st_size / 1024)
    if extra:
        entry.update(extra)


# ── Parts ────────────────────────────────────────────────────────────────────
def do_case():
    im, st = clean(load(FILES["case_C01"]))
    m = alpha_mask(im)
    ap = inner_holes(m)[0]  # the dial opening
    cy_row = int(round(ap["cy"]))
    row = np.nonzero(m[cy_row])[0]
    width = row.max() - row.min() + 1  # body width at the widest (centre) row, left of the crown
    scale = SPEC["case_body_width"] / width
    out = place(im, ap["cx"], ap["cy"], scale)
    # crown angle for the notes
    ys, xs = np.nonzero(m)
    rows = np.unique(ys)
    rx = np.array([np.nonzero(m[y])[0].max() for y in rows])
    k = rx.argmax()
    ang = float(np.degrees(np.arctan2(rows[k] - ap["cy"], rx[k] - ap["cx"])))
    save(out, "case_C01", {"source": FILES["case_C01"], "measuredBodyWidthPx": int(width), "scale": round(scale, 4), "apertureCentre": [round(ap["cx"], 1), round(ap["cy"], 1)], "apertureDiameterPx": round(2 * (ap["area"] / np.pi) ** 0.5 * scale, 1), "crownAngleBelow3oclockDeg": round(ang, 1), "clean": st})


def do_dial(name: str):
    im, st = clean(load(FILES[name]))
    m = alpha_mask(im)
    cx, cy, r = fit_circle(outer_boundary(m))
    holes = inner_holes(m)
    centre_hole = min(holes, key=lambda h: np.hypot(h["cx"] - cx, h["cy"] - cy))
    window = max((h for h in holes if h is not centre_hole), key=lambda h: h["cx"])  # 3 o'clock
    scale = SPEC["dial_diameter"] / (2 * r)
    # Centre midway between the fitted outer circle and the axis hole, so neither the printed
    # markers nor the hand pivot is visibly off. The residual offset of each is reported.
    ocx, ocy = cx, cy
    cx, cy = (ocx + centre_hole["cx"]) / 2, (ocy + centre_hole["cy"]) / 2
    out = place(im, cx, cy, scale)
    wx0, wx1 = (window["x0"] - cx) * scale + C, (window["x1"] + 1 - cx) * scale + C
    wy0, wy1 = (window["y0"] - cy) * scale + C, (window["y1"] + 1 - cy) * scale + C
    hole_off = ((centre_hole["cx"] - cx) * scale, (centre_hole["cy"] - cy) * scale)  # residual axis-hole offset (mirrored for the outer circle)
    save(out, name, {"source": FILES[name], "fittedDiameterSrcPx": round(2 * r, 1), "scale": round(scale, 4), "axisHoleOffsetPx": [round(hole_off[0], 2), round(hole_off[1], 2)], "dateWindow": {"x": round(wx0, 1), "y": round(wy0, 1), "w": round(wx1 - wx0, 1), "h": round(wy1 - wy0, 1)}, "clean": st})
    return hole_off


def do_hand(name: str, tip: int):
    im, st = clean(load(FILES[name]))
    m = alpha_mask(im)
    ys, xs = np.nonzero(m)
    top = ys.min()
    hole = inner_holes(m, 300)[0]
    tip_x = float(np.mean([np.nonzero(m[y])[0].mean() for y in range(top, top + 4)]))
    length = hole["cy"] - top
    tilt = float(np.degrees(np.arctan2(tip_x - hole["cx"], length)))
    if abs(tilt) > 0.15:  # straighten about the pivot
        im = im.rotate(tilt, resample=Image.BICUBIC, center=(hole["cx"], hole["cy"]))
        m = alpha_mask(im)
        ys, xs = np.nonzero(m)
        top = ys.min()
        length = hole["cy"] - top
    scale = tip / length
    out = place(im, hole["cx"], hole["cy"], scale)
    save(out, name, {"source": FILES[name], "pivotToTipSrcPx": round(float(length), 1), "scale": round(scale, 4), "tiltCorrectedDeg": round(tilt, 2) if abs(tilt) > 0.15 else 0, "tipPx": tip, "clean": st})


def do_ring():
    im, st = clean(load(FILES["ring_R01"]))
    m = alpha_mask(im)
    ox, oy, orad = fit_circle(outer_boundary(m))
    hole = inner_holes(m)[0]
    ih = np.nonzero(ndi.binary_fill_holes(m) & ~m)
    # centre = mean of outer fit and inner opening centroid
    cx, cy = (ox + hole["cx"]) / 2, (oy + hole["cy"]) / 2
    scale = SPEC["ring_outer"] / (2 * orad)
    out = place(im, cx, cy, scale)
    save(out, "ring_R01", {"source": FILES["ring_R01"], "scale": round(scale, 4), "outerCentreVsInnerCentreSrcPx": [round(ox - hole["cx"], 2), round(oy - hole["cy"], 2)], "innerDiameterPx": round(2 * (hole["area"] / np.pi) ** 0.5 * scale, 1), "clean": st})


def do_insert():
    full = load(FILES["insert_B01"])
    right = full.crop((979, 0, full.width, full.height))  # right-hand object; left is the bare case
    im, st = clean(right)
    m = alpha_mask(im)
    cx, cy, _ = fit_circle(outer_boundary(m))
    pts = outer_boundary(m)
    radii = np.hypot(pts[:, 0] - cx, pts[:, 1] - cy)
    r_out = float(np.percentile(radii, 98))  # tooth tips
    scale = SPEC["bezel_outer"] / (2 * r_out)
    hole = inner_holes(m)[0]
    src_inner = 2 * (hole["area"] / np.pi) ** 0.5
    out = place(im, cx, cy, scale)
    # Open the centre to exactly the spec'd inner diameter (anti-aliased, 4x supersampled)
    ss = 4
    yy, xx = np.mgrid[0 : CANVAS * ss, 0 : CANVAS * ss] / ss
    inside = np.hypot(xx - C + 0.5 / ss, yy - C + 0.5 / ss) < SPEC["bezel_inner"] / 2
    cut = Image.fromarray((~inside * 255).astype(np.uint8)).resize((CANVAS, CANVAS), Image.BOX)
    a = np.asarray(out).copy()
    a[..., 3] = (a[..., 3].astype(np.uint16) * np.asarray(cut) // 255).astype(np.uint8)
    a[a[..., 3] == 0, :3] = 0
    out = Image.fromarray(a, "RGBA")
    save(out, "insert_B01", {"source": FILES["insert_B01"] + " (right-hand object)", "scale": round(scale, 4), "originalInnerDiameterAtSpecScalePx": round(src_inner * scale, 1), "innerOpeningCutToPx": SPEC["bezel_inner"], "trimmedPx": round((SPEC["bezel_inner"] - src_inner * scale) / 2, 1), "clean": st})


def do_strap(name: str):
    im, st = clean(load(FILES[name]))
    m = alpha_mask(im)
    lab, n = ndi.label(ndi.binary_closing(m, iterations=3))
    sizes = ndi.sum(m, lab, range(1, n + 1))
    comps = [np.argsort(sizes)[::-1][i] + 1 for i in range(2)]
    pieces = sorted(comps, key=lambda i: np.nonzero(lab == i)[0].min())  # top piece first
    gap_top, gap_bot = SPEC["strap_gap"]
    canvas = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    info = {}
    for which, comp in zip(("top", "bottom"), pieces):
        pm = (lab == comp) & m
        ys, xs = np.nonzero(pm)
        # case end: bottom edge of the top piece / top edge of the bottom piece
        end = ys.max() if which == "top" else ys.min()
        d = -1 if which == "top" else 1
        widths, centres = [], []
        for k in range(40, 121, 4):  # band 40-120 px in from the end, clear of pins and curved corners
            r = np.nonzero(pm[end + d * k])[0]
            widths.append(r.max() - r.min() + 1)
            centres.append((r.max() + r.min()) / 2)
        w = float(np.median(widths))
        cx = float(np.median(centres))
        scale = SPEC["strap_width"] / w
        # place so the case end lands exactly on the gap edge; the piece runs off the canvas.
        # Top piece: the bottom edge of its last row sits on y=gap_top. Bottom piece: its first row starts at y=gap_bot.
        anchor_src = end + 1 if which == "top" else end
        target_end = gap_top if which == "top" else gap_bot
        piece = Image.fromarray(np.where(pm[..., None], np.asarray(im), 0).astype(np.uint8), "RGBA")
        pad = int(CANVAS / scale) + 8
        big = Image.new("RGBA", (piece.width + 2 * pad, piece.height + 2 * pad), (0, 0, 0, 0))
        big.paste(piece, (pad, pad))
        # source -> canvas:  u = (x - cx) * scale + C ;  v = (y - anchor_src) * scale + target_end
        box = (cx + pad - C / scale, anchor_src + pad - target_end / scale, cx + pad + C / scale, anchor_src + pad + (CANVAS - target_end) / scale)
        part = big.resize((CANVAS, CANVAS), Image.LANCZOS, box=box)
        pa = np.asarray(part).copy()
        pa[pa[..., 3] < 3] = 0
        part = Image.fromarray(pa, "RGBA")
        canvas.alpha_composite(part)
        info[which] = {"scale": round(scale, 3), "srcBodyWidthPx": round(w, 1), "upscale": round(scale, 2)}
    ca = np.asarray(canvas).copy()
    ca[ca[..., 3] < 3] = 0
    canvas = Image.fromarray(ca, "RGBA")
    # The gap must be truly empty. Resampling ringing may leave faint alpha right at the edge; clip it.
    leak = int(ca[gap_top:gap_bot, :, 3].max())
    assert leak < 64, f"{name}: strap intrudes into the gap (alpha {leak}); check placement"
    ca[gap_top:gap_bot] = 0
    canvas = Image.fromarray(ca, "RGBA")
    info["gapLeakClipped"] = leak
    save(canvas, name, {"source": FILES[name], "pieces": info, "gap": list(SPEC["strap_gap"]), "clean": st})


def do_products():
    PRODUCTS.mkdir(parents=True, exist_ok=True)
    for out_name, src_name in PRODUCT_FILES.items():
        im = Image.open(SRC / src_name).convert("RGB")
        w, h = im.size
        target_w = int(round(h * 4 / 5))
        if target_w <= w:  # too wide: trim sides, centred
            x0 = (w - target_w) // 2
            im = im.crop((x0, 0, x0 + target_w, h))
        else:  # too tall: trim top/bottom, keep slightly above centre
            target_h = int(round(w * 5 / 4))
            y0 = int((h - target_h) * 0.4)
            im = im.crop((0, y0, w, y0 + target_h))
        if im.height > 1600:
            im = im.resize((int(round(1600 * 4 / 5)), 1600), Image.LANCZOS)
        im.save(PRODUCTS / f"{out_name}.jpg", quality=86, optimize=True, progressive=True)
        im.save(PRODUCTS / f"{out_name}.webp", "WEBP", quality=84, method=6)
        report.setdefault("products", {})[out_name] = {"source": src_name, "size": list(im.size), "jpg_kb": round((PRODUCTS / f"{out_name}.jpg").stat().st_size / 1024), "webp_kb": round((PRODUCTS / f"{out_name}.webp").stat().st_size / 1024)}


def copy_alternates():
    UNSORTED.mkdir(parents=True, exist_ok=True)
    for f in ALTERNATES:
        shutil.copy2(SRC / f, UNSORTED / f)


def main():
    missing = [k for k, v in FILES.items() if not (SRC / v).exists()]
    if missing:
        sys.exit(f"Missing source images for: {missing}")
    do_case()
    for d in ("dial_D01", "dial_D02", "dial_D03", "dial_D04"):
        do_dial(d)
    do_hand("hands_H01_hour", SPEC["hour_tip"])
    do_hand("hands_H01_minute", SPEC["minute_tip"])
    do_hand("hands_H01_second", SPEC["second_tip"])
    do_ring()
    do_insert()
    for s in ("bracelet_S02", "bracelet_S01", "strap_S08", "strap_S09"):
        do_strap(s)
    do_products()
    copy_alternates()
    (PARTS / "layers.json").write_text(json.dumps(report, indent=2))
    print(json.dumps(report["parts"], indent=1))


if __name__ == "__main__":
    main()
