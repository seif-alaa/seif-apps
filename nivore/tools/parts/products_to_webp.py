#!/usr/bin/env python3
"""Convert finished-watch photos to 4:5 WebP (centred crop, max 1600 px tall) in public/products/.
    python tools/parts/products_to_webp.py --src incoming-images/watches/06_finished_watches --out public/products
Missing source files are reported and skipped."""
import argparse, os
from PIL import Image

NAMES = ["product_1_diver", "product_2_gmt", "product_3_chocolate", "product_4_wave_diver", "product_5_panda_chrono"]
ap = argparse.ArgumentParser(); ap.add_argument("--src", required=True); ap.add_argument("--out", required=True); a = ap.parse_args()
os.makedirs(a.out, exist_ok=True)
for n in NAMES:
    p = os.path.join(a.src, n + ".png")
    if not os.path.exists(p): print("MISSING", p); continue
    im = Image.open(p).convert("RGB"); w, h = im.size
    tw = round(h * 4 / 5)
    if tw <= w: x = (w - tw) // 2; im = im.crop((x, 0, x + tw, h))
    else: th = round(w * 5 / 4); y = (h - th) // 2; im = im.crop((0, y, w, y + th))
    if im.height > 1600: im = im.resize((1280, 1600), Image.LANCZOS)
    im.save(os.path.join(a.out, n + ".webp"), "WEBP", quality=84, method=6)
    print("ok", n, im.size)
