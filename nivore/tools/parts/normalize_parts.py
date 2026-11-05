#!/usr/bin/env python3
"""
NIVORE parts normaliser.
Reads parts-manifest.json, takes every image from the downloaded Drive folder,
cuts it out with rembg (isnet-general-use), shrinks the edge by 1 px, feathers it by 1 px and
cleans halo colours, scales it to its real size (1 mm = 19.5 px), centres it on a transparent
canvas and saves it to public/parts/. Every part is 1024x1024, except bracelets/straps, which are
1024x2560 (centre at 512,1280) so that they are never cropped.

Usage (from the project root):
    pip install pillow numpy scipy "rembg[cpu]"
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
from PIL import Image, ImageFilter

CANVAS = 1024
PX_MM = 19.5
C = CANVAS // 2
BR_W, BR_H = 1024, 2560  # bracelets / straps: tall canvas, centre (512, 1280)
CACHE = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".cache")
_session = None


def rembg_alpha(path, a, pid):
    """rembg (isnet-general-use) mask of the part, cached on disk so manifest tweaks re-run fast."""
    global _session
    os.makedirs(CACHE, exist_ok=True)
    key = os.path.join(CACHE, "%s.%d.%d.png" % (pid, os.path.getsize(path), int(os.path.getmtime(path))))
    if os.path.exists(key):
        return np.array(Image.open(key).convert("L"))
    from rembg import new_session, remove
    if _session is None:
        _session = new_session("isnet-general-use")
    flat = Image.new("RGB", (a.shape[1], a.shape[0]), (255, 255, 255))
    flat.paste(Image.fromarray(a), mask=Image.fromarray(a[..., 3]))
    m = remove(flat, session=_session, only_mask=True)
    m.save(key)
    return np.array(m.convert("L"))


def cutout(path, a, pid, ptype, hole):
    """Cut-out pipeline: rembg mask x the reference alpha (original transparency, or the old
    border flood-fill for opaque inputs, which also opens the centre of cases/bezels/rings),
    then 1 px shrink, 1 px feather and halo-colour clean-up. Falls back to the reference alpha
    when rembg removes or adds too much (thin hands, pale dials)."""
    from scipy import ndimage
    ref, note = remove_background(a, hole=hole)
    ra = ref[..., 3]
    try:
        m = rembg_alpha(path, a, pid)
        new = (ra.astype(np.uint16) * m.astype(np.uint16) // 255).astype(np.uint8)
        ratio = new.sum() / max(1, ra.sum())
        if ratio < 0.85:
            new, note = ra, note + "+rembg_rejected(%.2f)" % ratio
        else:
            note += "+rembg(%.2f)" % ratio
    except Exception as e:  # rembg missing: keep the reference alpha
        new, note = ra, note + "+no_rembg(%s)" % type(e).__name__
    core = new.copy()
    if ptype != "hand":  # thin hands would vanish; they only get the feather
        core = ndimage.minimum_filter(new, size=3)
    # halo clean-up: edge pixels take the colour of the nearest solid pixel
    rgb = ref[..., :3].copy()
    solid = core >= 250
    if solid.any():
        dist, (iy, ix) = ndimage.distance_transform_edt(~solid, return_indices=True)
        band = (~solid) & (dist <= 3)
        rgb[band] = rgb[iy[band], ix[band]]
    alpha = np.array(Image.fromarray(core).filter(ImageFilter.GaussianBlur(1)))
    out = np.dstack([rgb, alpha]).astype(np.uint8)
    return out, note


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


def place(img, scale, cx_src, cy_src, cx_dst=None, cy_dst=None, size=(CANVAS, CANVAS)):
    """Scale img and paste it so that source point (cx_src, cy_src) lands on (cx_dst, cy_dst)
    (default: the canvas centre) of a transparent canvas of the given size."""
    cx_dst = size[0] / 2 if cx_dst is None else cx_dst
    cy_dst = size[1] / 2 if cy_dst is None else cy_dst
    w, h = img.size
    nw, nh = max(1, round(w * scale)), max(1, round(h * scale))
    img = img.resize((nw, nh), Image.LANCZOS)
    canvas = Image.new("RGBA", size, (0, 0, 0, 0))
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
    """Both halves of the bracelet/strap are scaled so the median row is width_mm wide and placed on
    the 1024x2560 canvas with the middle of the GAP between the two halves (= the case centre) at
    (512, 1280). Very long straps may run past the canvas by their far tail ends (beyond +/-65 mm
    from the case centre), which the builder never shows; the amount is reported as cropped_px."""
    x0, y0, x1, y1 = bbox(a)
    alpha = a[..., 3] > 20
    rows = alpha[y0:y1].any(axis=1)
    ws = [np.where(r)[0].max() - np.where(r)[0].min() for r in alpha[y0:y1] if r.any()]
    width = float(np.median(ws))
    scale = width_mm * PX_MM / width
    # longest empty run of rows = the gap where the case sits
    best, run, start = (0, 0), 0, 0
    for i, v in enumerate(rows):
        if not v:
            if run == 0: start = i
            run += 1
            if run > best[1]: best = (start, run)
        else:
            run = 0
    gap_mid = (best[0] + best[1] / 2) if best[1] > 0.05 * len(rows) else len(rows) / 2
    crop = Image.fromarray(a).crop((x0, y0, x1, y1))
    top_px = gap_mid * scale
    bot_px = (len(rows) - gap_mid) * scale
    fit_bracelet.cropped = int(max(0, top_px - BR_H / 2) + max(0, bot_px - BR_H / 2))
    return place(crop, scale, (x1 - x0) / 2, gap_mid, size=(BR_W, BR_H)), scale


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
            a, bgnote = cutout(src, a, p["id"], p["type"], hole=p["type"] in ("case", "bezel", "ring"))
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
                img = place(img, k, img.size[0] / 2, img.size[1] / 2, img.size[0] / 2 + dx, img.size[1] / 2 + dy, size=img.size)
            img.save(os.path.join(args.out, p["id"] + ".png"))
            img.save(os.path.join(args.out, p["id"] + ".webp"), quality=90, method=4)
            r.update(status="ok", background=bgnote, scale=round(s, 3), canvas=list(img.size))
            if fit == "bracelet": r["cropped_px"] = fit_bracelet.cropped
            done[p["id"]] = img
        except Exception as e:
            r.update(status="ERROR", error=str(e))
        report.append(r); print(r["status"], p["id"], r.get("background", ""), r.get("error", ""))
    json.dump(report, open(os.path.join(args.out, "_report.json"), "w"), indent=1)

    # contact sheet (bracelets keep their tall shape)
    ids = list(done)
    cols = 10; t = 160
    sheet = Image.new("RGBA", (cols * t, ((len(ids) + cols - 1) // cols) * t), (235, 230, 222, 255))
    for i, k in enumerate(ids):
        th = done[k].copy(); th.thumbnail((t, t), Image.LANCZOS)
        sheet.alpha_composite(th, ((i % cols) * t + (t - th.width) // 2, (i // cols) * t + (t - th.height) // 2))
    sheet.save(os.path.join(args.out, "_contact_sheet.png"))

    # one stacked preview per live family (first option of each slot, hands at 10:08:35).
    # 1024x2560 stage so the whole bracelet shows; square parts sit at y offset 768.
    OFF = (BR_H - CANVAS) // 2
    def rot(img, deg):
        return img.rotate(-deg, resample=Image.BICUBIC, center=(C, C))
    for fk, f in man["families_live"].items():
        def first(slot):
            for k in f.get(slot, []):
                for cand in (k, k + "_hour"):
                    if cand in done: return k
            return None
        base = Image.new("RGBA", (BR_W, BR_H), (235, 230, 222, 255))
        def put(img):
            base.alpha_composite(img, (0, 0 if img.size[1] == BR_H else OFF))
        br = first("bracelet")
        if br:
            # CSS scale: family lug width / bracelet width
            lug = f.get("lug_mm"); wmm = next((q.get("width_mm") for q in man["parts"] if q["id"] == br), None)
            im = done[br]
            if lug and wmm and lug != wmm:
                k = lug / wmm; im = place(im, k, BR_W / 2, BR_H / 2, size=im.size)
            put(im)
        for slot in ("case", "dial", "ring"):
            k = first(slot)
            if k and k in done: put(done[k])
        hs = first("hands")
        if hs:
            for part, deg in (("hour", 304), ("minute", 48), ("second", 210)):
                if hs + "_" + part in done: put(rot(done[hs + "_" + part], deg))
        g = (f.get("gmt_hand") or [None])[0]
        if g in done: put(rot(done[g], 70))
        bz = first("bezel")
        if bz and bz in done: put(done[bz])
        base.crop((0, 260, BR_W, BR_H - 260)).resize((BR_W // 2, (BR_H - 520) // 2), Image.LANCZOS).save(os.path.join(args.out, "_preview_%s.png" % fk))
    ok = sum(1 for r in report if r["status"] == "ok")
    print("\nDone: %d ok, %d missing/error. See _report.json, _contact_sheet.png and _preview_*.png" % (ok, len(report) - ok))


if __name__ == "__main__":
    main()
