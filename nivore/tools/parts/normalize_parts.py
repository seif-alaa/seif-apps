#!/usr/bin/env python3
"""
NIVORE parts normaliser.
Reads parts-manifest.json, takes every image from the downloaded Drive folder,
removes any solid background, scales it to its real size (1 mm = 19.5 px),
centres it on a 1024x1024 transparent canvas and saves it to public/parts/.

Usage (from the project root):
    pip install pillow numpy scipy
    python tools/parts/normalize_parts.py --src incoming-images/watches --out public/parts --manifest tools/parts/parts-manifest.json

Manual fixes: add "scale": 1.03 and/or "offset_px": [dx, dy] to a part in the manifest and re-run.

Outputs:
    public/parts/<id>.webp   (used by the site)
    public/parts/<id>.png    (lossless backup)
    public/parts/_report.json       (what happened to every file)
    public/parts/_contact_sheet.png (all parts on one sheet, for a quick visual check)
    public/parts/_preview_<family>.png (one stacked watch per live family)
"""
import argparse, json, os, sys
import numpy as np
from PIL import Image

CANVAS = 1024
PX_MM = 19.5
C = CANVAS // 2


def load_rgba(path):
    im = Image.open(path).convert("RGBA")
    return np.array(im)


def remove_background(a, hole=False, tol=28):
    """If the image has no real transparency, remove the solid background colour that touches
    the borders (white, grey or black). With hole=True (cases, bezels, rings) the same colour in
    the centre opening is removed too."""
    from scipy import ndimage
    alpha = a[..., 3]
    out = a.copy()
    note = "had_alpha"
    if (alpha < 250).mean() <= 0.05:
        rgb = a[..., :3].astype(int)
        border = np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]])
        bg = np.median(border, axis=0)
        mask = np.abs(rgb - bg).max(axis=2) <= tol
        lab, _ = ndimage.label(mask)
        edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
        kill = np.isin(lab, list(edge))
        if hole:
            ys, xs = np.where(~kill)
            if len(xs):
                cy, cx = int(ys.mean()), int(xs.mean())
                if lab[cy, cx]:
                    kill |= lab == lab[cy, cx]
        out[..., 3] = np.where(kill, 0, 255).astype(np.uint8)
        note = "bg_removed(%s)" % ",".join(str(int(v)) for v in bg)
    return out, note


def bbox(a, thr=20):
    ys, xs = np.where(a[..., 3] > thr)
    if len(xs) == 0:
        return None
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1


def place(img, scale, cx_src, cy_src, cx_dst=C, cy_dst=C):
    """Scale img and paste it so that source point (cx_src, cy_src) lands on (cx_dst, cy_dst)."""
    w, h = img.size
    nw, nh = max(1, round(w * scale)), max(1, round(h * scale))
    img = img.resize((nw, nh), Image.LANCZOS)
    canvas = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    canvas.paste(img, (round(cx_dst - cx_src * scale), round(cy_dst - cy_src * scale)), img)
    return canvas


def fit_round(a, diameter_mm):
    x0, y0, x1, y1 = bbox(a)
    target = diameter_mm * PX_MM
    scale = target / max(x1 - x0, y1 - y0)
    crop = Image.fromarray(a).crop((x0, y0, x1, y1))
    return place(crop, scale, (x1 - x0) / 2, (y1 - y0) / 2), scale


def fit_case(a, diameter_mm):
    """Case images include lugs (top/bottom) and a crown on the right.
    The lugs are symmetric around the case centre, so the horizontal centre is taken from the
    lug rows (top 12% and bottom 12% of the height). Case radius = centre - left edge of the body
    (the left side has no crown). Vertical centre = bbox middle."""
    x0, y0, x1, y1 = bbox(a)
    alpha = a[..., 3] > 20
    h = y1 - y0
    lug_rows = list(range(y0, y0 + int(h * 0.12))) + list(range(y1 - int(h * 0.12), y1))
    mids = []
    for y in lug_rows:
        xs = np.where(alpha[y])[0]
        if len(xs):
            mids.append((xs.min() + xs.max()) / 2)
    cx = float(np.median(mids)) if mids else (x0 + x1) / 2
    mid = slice(y0 + h // 3, y0 + 2 * h // 3)
    left = np.where(alpha[mid].any(axis=0))[0].min()
    radius = cx - left
    scale = diameter_mm * PX_MM / (2 * radius)
    cy = (y0 + y1) / 2
    return place(Image.fromarray(a), scale, cx, cy), scale


def fit_hand(a, length_px):
    """Hands point straight up. Pivot = centre of the widest row in the lower 35% of the
    hand (the round boss). Scale so pivot->tip equals length_px."""
    x0, y0, x1, y1 = bbox(a)
    alpha = a[..., 3] > 20
    h = y1 - y0
    lo = y0 + int(h * 0.65)
    widths = []
    for y in range(lo, y1):
        xs = np.where(alpha[y])[0]
        widths.append((xs.max() - xs.min() if len(xs) else 0, y, xs))
    w, py, xs = max(widths, key=lambda t: t[0])
    px = (xs.min() + xs.max()) / 2 if len(xs) else (x0 + x1) / 2
    tip_len = py - y0
    scale = length_px / max(tip_len, 1)
    return place(Image.fromarray(a), scale, px, py), scale


def fit_bracelet(a, width_mm):
    x0, y0, x1, y1 = bbox(a)
    alpha = a[..., 3] > 20
    # width = median row width (ignores clasps/end links)
    ws = [np.where(r)[0].max() - np.where(r)[0].min() for r in alpha[y0:y1] if r.any()]
    width = float(np.median(ws))
    scale = width_mm * PX_MM / width
    crop = Image.fromarray(a).crop((x0, y0, x1, y1))
    return place(crop, scale, (x1 - x0) / 2, (y1 - y0) / 2), scale


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--manifest", default=os.path.join(os.path.dirname(__file__), "parts-manifest.json"))
    args = ap.parse_args()
    man = json.load(open(args.manifest, encoding="utf-8"))
    os.makedirs(args.out, exist_ok=True)
    report, done = [], {}
    for p in man["parts"]:
        src = os.path.join(args.src, p["src"])
        r = {"id": p["id"], "src": p["src"]}
        if not os.path.exists(src):
            # tolerate Drive renaming (e.g. "name (1).png") by matching on the file stem
            folder, fname = os.path.split(src)
            stem = os.path.splitext(fname)[0]
            alt = [f for f in os.listdir(folder)] if os.path.isdir(folder) else []
            alt = [f for f in alt if f.startswith(stem)]
            if alt:
                src = os.path.join(folder, sorted(alt)[0]); r["matched"] = alt[0]
            else:
                r["status"] = "MISSING"; report.append(r); print("MISSING", p["src"]); continue
        try:
            a = load_rgba(src)
            a, bgnote = remove_background(a, hole=p["type"] in ("case", "bezel", "ring"))
            fit = p["fit"]
            if fit == "case":
                img, s = fit_case(a, p["diameter_mm"])
            elif fit == "round":
                img, s = fit_round(a, p["diameter_mm"])
            elif fit == "hand":
                img, s = fit_hand(a, p["length_px"])
            elif fit == "bracelet":
                img, s = fit_bracelet(a, p["width_mm"])
            else:
                raise ValueError(fit)
            # optional manual fixes from the manifest: "scale": 1.05, "offset_px": [dx, dy]
            if p.get("scale") or p.get("offset_px"):
                k = float(p.get("scale", 1.0)); dx, dy = p.get("offset_px", [0, 0])
                img = place(img, k, C, C, C + dx, C + dy)
            img.save(os.path.join(args.out, p["id"] + ".png"))
            img.save(os.path.join(args.out, p["id"] + ".webp"), quality=90, method=4)
            r.update(status="ok", background=bgnote, scale=round(s, 3))
            done[p["id"]] = img
        except Exception as e:
            r.update(status="ERROR", error=str(e))
        report.append(r); print(r["status"], p["id"], r.get("background", ""), r.get("error", ""))
    json.dump(report, open(os.path.join(args.out, "_report.json"), "w"), indent=1)

    # contact sheet
    ids = list(done)
    cols = 10; t = 160
    sheet = Image.new("RGBA", (cols * t, ((len(ids) + cols - 1) // cols) * t), (235, 230, 222, 255))
    for i, k in enumerate(ids):
        th = done[k].resize((t, t), Image.LANCZOS)
        sheet.alpha_composite(th, ((i % cols) * t, (i // cols) * t))
    sheet.save(os.path.join(args.out, "_contact_sheet.png"))

    # one stacked preview per live family (first option of each slot, hands at 10:08:35)
    def rot(img, deg):
        return img.rotate(-deg, resample=Image.BICUBIC, center=(C, C))
    for fk, f in man["families_live"].items():
        def first(slot):
            for k in f.get(slot, []):
                for cand in (k, k + "_hour"):
                    if cand in done: return k
            return None
        base = Image.new("RGBA", (CANVAS, CANVAS), (235, 230, 222, 255))
        br = first("bracelet")
        if br: base.alpha_composite(done[br])
        for slot in ("case", "dial", "ring"):
            k = first(slot)
            if k and k in done: base.alpha_composite(done[k])
        hs = first("hands")
        if hs:
            for part, deg in (("hour", 304), ("minute", 48), ("second", 210)):
                if hs + "_" + part in done: base.alpha_composite(rot(done[hs + "_" + part], deg))
        g = (f.get("gmt_hand") or [None])[0]
        if g in done: base.alpha_composite(rot(done[g], 70))
        bz = first("bezel")
        if bz and bz in done: base.alpha_composite(done[bz])
        base.save(os.path.join(args.out, "_preview_%s.png" % fk))
    ok = sum(1 for r in report if r["status"] == "ok")
    print("\nDone: %d ok, %d missing/error. See _report.json, _contact_sheet.png and _preview_*.png" % (ok, len(report) - ok))


if __name__ == "__main__":
    main()
