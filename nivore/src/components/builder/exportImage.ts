import { DEFAULT_TIME, handAngles, LAYER_ORDER, partSrc, type Layers } from "@/lib/parts";

/** Compose the photo layers into a PNG in the browser (no server round trip). */
export async function downloadBuildImage(layers: Layers, opts: { name: string; reference: string }) {
  const S = 1024;
  const H = 1180;
  const ids = LAYER_ORDER.map((k) => layers[k]).filter((x): x is string => Boolean(x));
  const loaded = new Map<string, HTMLImageElement>();
  await Promise.all(
    ids.map(
      (id) =>
        new Promise<void>((res, rej) => {
          const im = new Image();
          im.onload = () => (loaded.set(id, im), res());
          im.onerror = () => rej(new Error(`Could not load ${id}`));
          im.src = partSrc(id);
        }),
    ),
  );
  const canvas = document.createElement("canvas");
  canvas.width = S;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#e8e2d6";
  ctx.fillRect(0, 0, S, H);
  const draw = (id: string | null, deg = 0, shadow = false) => {
    const im = id ? loaded.get(id) : null;
    if (!im) return;
    ctx.save();
    if (shadow) {
      ctx.shadowColor = "rgba(58,50,46,0.30)";
      ctx.shadowBlur = 22;
      ctx.shadowOffsetY = 14;
    }
    ctx.translate(S / 2, S / 2);
    ctx.rotate((deg * Math.PI) / 180);
    ctx.drawImage(im, -S / 2, -S / 2, S, S);
    ctx.restore();
  };
  const a = handAngles(DEFAULT_TIME.h, DEFAULT_TIME.m, DEFAULT_TIME.s);
  const br = layers.bracelet ? loaded.get(layers.bracelet) : null;
  if (br) {
    // Tall bracelet canvas (1024 x 2560, centred), scaled to the lug width and faded at the ends.
    const off = document.createElement("canvas");
    off.width = S;
    off.height = S;
    const o = off.getContext("2d")!;
    const k = layers.braceletScale ?? 1;
    const bw = S * k;
    const bh = (br.naturalHeight / br.naturalWidth) * bw;
    o.drawImage(br, S / 2 - bw / 2, S / 2 - bh / 2, bw, bh);
    const m = o.createLinearGradient(0, 0, 0, S);
    m.addColorStop(0, "rgba(0,0,0,0)");
    m.addColorStop(0.12, "rgba(0,0,0,1)");
    m.addColorStop(0.88, "rgba(0,0,0,1)");
    m.addColorStop(1, "rgba(0,0,0,0)");
    o.globalCompositeOperation = "destination-in";
    o.fillStyle = m;
    o.fillRect(0, 0, S, S);
    ctx.drawImage(off, 0, 0);
  }
  draw(layers.case, 0, true);
  draw(layers.dial);
  draw(layers.ring);
  draw(layers.hour, a.hour);
  draw(layers.minute, a.minute);
  draw(layers.gmt, a.gmt);
  draw(layers.second, a.second);
  const g = ctx.createRadialGradient(S * 0.37, S * 0.34, 0, S * 0.37, S * 0.34, S * 0.3);
  g.addColorStop(0, "rgba(255,255,255,0.30)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.save();
  ctx.beginPath();
  ctx.arc(S / 2, S / 2, S * 0.278, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  ctx.restore();
  draw(layers.bezel);

  const sans = getComputedStyle(document.body).fontFamily;
  ctx.textAlign = "center";
  ctx.fillStyle = "#3a322e";
  ctx.font = `600 30px ${sans}`;
  ctx.fillText("NIVORÉ", S / 2, S + 46);
  ctx.font = `400 26px ${sans}`;
  ctx.fillText(opts.name, S / 2, S + 90);
  ctx.fillStyle = "#5f5549";
  ctx.font = `400 18px ${sans}`;
  ctx.fillText(`${opts.reference}  ·  Illustrative rendering`, S / 2, S + 128);

  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
  if (!blob) throw new Error("Could not create image");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `nivore-${opts.reference.toLowerCase()}.png`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 2000);
}
