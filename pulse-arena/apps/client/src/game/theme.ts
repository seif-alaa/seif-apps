/**
 * Block palette and sprite rendering.
 *
 * The block treatment ("cored tile") is original to this project: a beveled
 * tile with a lit top face, a darker base lip and an inset core plate with a
 * hairline rim. Sprites are pre-rendered per size and color for speed.
 */

export interface BlockColor {
  base: string;
  light: string;
  dark: string;
  core: string;
  glow: string;
}

/** Index 0 unused, 1..7 piece families, 8 Static. */
export const BLOCK_COLORS: BlockColor[] = [
  { base: '#000', light: '#000', dark: '#000', core: '#000', glow: '#000' },
  { base: '#FF6A3D', light: '#FF9670', dark: '#C2401C', core: '#E9552A', glow: 'rgba(255,106,61,0.55)' }, // Ember (mote)
  { base: '#FFC23D', light: '#FFD97E', dark: '#C78C12', core: '#F2AE22', glow: 'rgba(255,194,61,0.5)' }, // Amber (rod)
  { base: '#9DDB4E', light: '#BDEB82', dark: '#62A021', core: '#88C93A', glow: 'rgba(157,219,78,0.5)' }, // Lime (hook)
  { base: '#27CFB0', light: '#6BE6CF', dark: '#11927A', core: '#1DB99C', glow: 'rgba(39,207,176,0.5)' }, // Teal (slab)
  { base: '#4C9DFF', light: '#86BEFF', dark: '#2464C4', core: '#3A87EA', glow: 'rgba(76,157,255,0.55)' }, // Azure (step)
  { base: '#9B7BFF', light: '#BCA7FF', dark: '#6447D1', core: '#876AF0', glow: 'rgba(155,123,255,0.55)' }, // Violet (fork)
  { base: '#FF5C9A', light: '#FF8DB9', dark: '#C42B67', core: '#EE4787', glow: 'rgba(255,92,154,0.55)' }, // Rose (spark)
  { base: '#2A3140', light: '#384154', dark: '#1A1F2A', core: '#232A37', glow: 'rgba(120,130,150,0.3)' }, // Static
];

export const UI = {
  boardBg: '#0B0F16',
  slot: '#131A25',
  slotEdge: '#0A0E14',
  slotLip: '#1A2331',
  frame: '#243042',
  surge: '#FFB23E',
  danger: '#FF4D5E',
  pulse: '#3DE0D0',
  text: '#EEF2F8',
};

export const COLOR_COUNT = BLOCK_COLORS.length;

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export { roundRect };

const spriteCache = new Map<string, HTMLCanvasElement>();

/** Draw one block tile filling an s-by-s square at (0,0). */
function paintBlock(ctx: CanvasRenderingContext2D, s: number, colorIdx: number): void {
  const c = BLOCK_COLORS[colorIdx]!;
  const pad = Math.max(1, s * 0.045);
  const r = s * 0.17;
  const x = pad;
  const y = pad;
  const w = s - pad * 2;

  // Base lip (darker, offset down) for material depth.
  roundRect(ctx, x, y + s * 0.03, w, w, r);
  ctx.fillStyle = c.dark;
  ctx.fill();

  // Body with vertical light falloff.
  const g = ctx.createLinearGradient(0, y, 0, y + w);
  g.addColorStop(0, c.light);
  g.addColorStop(0.45, c.base);
  g.addColorStop(1, c.core);
  roundRect(ctx, x, y, w, w - s * 0.03, r);
  ctx.fillStyle = g;
  ctx.fill();

  // Top rim highlight.
  ctx.save();
  roundRect(ctx, x, y, w, w - s * 0.03, r);
  ctx.clip();
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = Math.max(1, s * 0.035);
  ctx.beginPath();
  ctx.moveTo(x + r * 0.6, y + ctx.lineWidth / 2);
  ctx.lineTo(x + w - r * 0.6, y + ctx.lineWidth / 2);
  ctx.stroke();
  ctx.restore();

  if (colorIdx === 8) {
    // Static: hatched, matte, no core glow.
    ctx.save();
    roundRect(ctx, x, y, w, w - s * 0.03, r);
    ctx.clip();
    ctx.strokeStyle = 'rgba(140,152,175,0.22)';
    ctx.lineWidth = Math.max(1, s * 0.05);
    for (let k = -s; k < s * 2; k += s * 0.2) {
      ctx.beginPath();
      ctx.moveTo(k, y);
      ctx.lineTo(k + s, y + s);
      ctx.stroke();
    }
    ctx.restore();
    roundRect(ctx, s * 0.36, s * 0.34, s * 0.28, s * 0.28, s * 0.06);
    ctx.strokeStyle = 'rgba(170,180,200,0.35)';
    ctx.lineWidth = Math.max(1, s * 0.03);
    ctx.stroke();
    return;
  }

  // Inset core plate.
  const ci = s * 0.29;
  const cw = s - ci * 2;
  const cr = s * 0.08;
  const cg = ctx.createLinearGradient(0, ci, 0, ci + cw);
  cg.addColorStop(0, c.core);
  cg.addColorStop(1, c.light);
  roundRect(ctx, ci, ci - s * 0.015, cw, cw, cr);
  ctx.fillStyle = cg;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = Math.max(1, s * 0.025);
  ctx.stroke();
  // Core shadow line (top inner edge) sells the inset.
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.moveTo(ci + cr, ci - s * 0.015 + ctx.lineWidth);
  ctx.lineTo(ci + cw - cr, ci - s * 0.015 + ctx.lineWidth);
  ctx.stroke();

  // Diagonal facet sheen across the upper-left of the face.
  ctx.save();
  roundRect(ctx, x, y, w, w - s * 0.03, r);
  ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,0.09)';
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w * 0.62, y);
  ctx.lineTo(x, y + w * 0.62);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function paintSlot(ctx: CanvasRenderingContext2D, s: number): void {
  const pad = Math.max(1, s * 0.045);
  const r = s * 0.15;
  roundRect(ctx, pad, pad, s - pad * 2, s - pad * 2, r);
  ctx.fillStyle = UI.slot;
  ctx.fill();
  // Recessed: dark top edge, faint light bottom lip.
  ctx.save();
  roundRect(ctx, pad, pad, s - pad * 2, s - pad * 2, r);
  ctx.clip();
  ctx.fillStyle = UI.slotEdge;
  ctx.fillRect(0, pad, s, Math.max(1, s * 0.05));
  ctx.fillStyle = UI.slotLip;
  ctx.fillRect(0, s - pad - Math.max(1, s * 0.035), s, Math.max(1, s * 0.035));
  ctx.restore();
}

/** Cached sprite for a block (colorIdx 1..8) or empty slot (colorIdx 0) at a device-pixel size. */
export function sprite(colorIdx: number, px: number): HTMLCanvasElement {
  const size = Math.max(4, Math.round(px));
  const key = `${colorIdx}:${size}`;
  let c = spriteCache.get(key);
  if (!c) {
    c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d')!;
    if (colorIdx === 0) paintSlot(ctx, size);
    else paintBlock(ctx, size, colorIdx);
    spriteCache.set(key, c);
    if (spriteCache.size > 400) spriteCache.delete(spriteCache.keys().next().value!);
  }
  return c;
}

/** Draw a piece shape (cells in [col,row]) with its top-left at x,y. */
export function drawPiece(
  ctx: CanvasRenderingContext2D,
  cells: ReadonlyArray<readonly [number, number]>,
  colorIdx: number,
  x: number,
  y: number,
  cell: number,
  dpr: number,
): void {
  const spr = sprite(colorIdx, cell * dpr);
  for (const [c, r] of cells) ctx.drawImage(spr, x + c * cell, y + r * cell, cell, cell);
}
