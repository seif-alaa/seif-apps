import type { ComponentOf, ComponentType, MovementFamily, PublicComponent } from "@/domain/catalog";
import type { Configuration, Engraving } from "@/domain/configuration";

/**
 * Render template: a fixed canvas in which every part is drawn to scale.
 * 10 canvas units = 1 mm. Real raster assets are positioned in the same
 * space from their own px-per-mm and anchor metadata, so procedural and
 * photographic layers can be mixed and swapped part by part.
 */
export const PX_PER_MM = 10;
export const CANVAS_W = 600;
export const CANVAS_H = 860;
export const CX = CANVAS_W / 2;
export const CY = CANVAS_H / 2;

/** Displayed time: the composed 10:08, with a live sweeping seconds hand. */
export const HOUR_ANGLE = (10 + 8 / 60) * 30;
export const MINUTE_ANGLE = 8 * 6 + 0.6 * 6;
export const GMT_ANGLE = ((10 + 8 / 60 + 7) / 24) * 360;

type Pub<T extends ComponentType> = Omit<ComponentOf<T>, "costMinor" | "supplier" | "supplierRef">;

export interface ResolvedBuild {
  movement?: Pub<"movement">;
  family?: MovementFamily;
  dial?: Pub<"dial">;
  case?: Pub<"case">;
  hands?: Pub<"hands">;
  bezel?: Pub<"bezel">;
  insert?: Pub<"insert">;
  crystal?: Pub<"crystal">;
  chapterRing?: Pub<"chapterRing">;
  band?: Pub<"band">;
  clasp?: Pub<"clasp">;
  caseback?: Pub<"caseback">;
  engraving: Engraving | null;
}

export function resolveBuild(
  config: Configuration,
  get: (id: string | undefined) => PublicComponent | undefined,
  family: (id: string) => MovementFamily | undefined,
): ResolvedBuild {
  const p = config.parts;
  const movement = get(p.movement) as Pub<"movement"> | undefined;
  return {
    movement,
    family: movement ? family(movement.spec.familyId) : undefined,
    dial: get(p.dial) as Pub<"dial"> | undefined,
    case: get(p.case) as Pub<"case"> | undefined,
    hands: get(p.hands) as Pub<"hands"> | undefined,
    bezel: get(p.bezel) as Pub<"bezel"> | undefined,
    insert: get(p.insert) as Pub<"insert"> | undefined,
    crystal: get(p.crystal) as Pub<"crystal"> | undefined,
    chapterRing: get(p.chapterRing) as Pub<"chapterRing"> | undefined,
    band: get(p.band) as Pub<"band"> | undefined,
    clasp: get(p.clasp) as Pub<"clasp"> | undefined,
    caseback: get(p.caseback) as Pub<"caseback"> | undefined,
    engraving: config.engraving,
  };
}

/** Case-derived radii in canvas units. Sensible fallbacks keep partial builds drawable. */
export function caseGeometry(k: Pub<"case"> | undefined) {
  const s = k?.spec;
  const R = ((s?.diameterMm ?? 39) / 2) * PX_PER_MM;
  const L = ((s?.lugToLugMm ?? 46) / 2) * PX_PER_MM;
  const lugGap = (s?.lugWidthMm ?? 20) * PX_PER_MM;
  const crystalR = ((s?.crystalDiameterMm ?? 31.5) / 2) * PX_PER_MM;
  const dialR = ((s?.dialOpeningMm ?? 28.5) / 2) * PX_PER_MM;
  const crownDeg = s?.crownPosition === 3.8 ? 24 : 0;
  return { R, L, lugGap, crystalR, dialR, crownDeg, shape: s?.shape ?? "round", tone: s?.tone ?? "steel", finish: s?.finish ?? "brushed-polished" };
}

/* ── Materials ─────────────────────────────────────────────────────────── */

export type Tone = "steel" | "gold" | "black" | "rose" | "blue";

export const METAL: Record<Tone, { hi: string; light: string; mid: string; dark: string; deep: string }> = {
  steel: { hi: "#fbfaf8", light: "#e6e4df", mid: "#c3c0ba", dark: "#8f8b85", deep: "#5f5b56" },
  gold: { hi: "#fbf0d6", light: "#ecd6a6", mid: "#cfb07a", dark: "#a5844e", deep: "#6f5530" },
  black: { hi: "#77726e", light: "#4f4b48", mid: "#363331", dark: "#242220", deep: "#141312" },
  rose: { hi: "#fbe7dc", light: "#e8c2ad", mid: "#cd9a80", dark: "#a2705a", deep: "#6e4a3b" },
  blue: { hi: "#a9c0e6", light: "#5f7fb8", mid: "#355892", dark: "#22407a", deep: "#152a52" },
};

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

export function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  const c = (x: number, y: number) => Math.round(x + (y - x) * t).toString(16).padStart(2, "0");
  return `#${c(r1, r2)}${c(g1, g2)}${c(b1, b2)}`;
}
export const lighten = (hex: string, t: number) => mix(hex, "#ffffff", t);
export const darken = (hex: string, t: number) => mix(hex, "#000000", t);

export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/* ── Path helpers ─────────────────────────────────────────────────────── */

export const rad = (deg: number) => ((deg - 90) * Math.PI) / 180;
export const f = (n: number) => Math.round(n * 100) / 100;
/** Rounded so server (Node) and browser trig results render identical markup. */
export function polar(r: number, deg: number, cx = CX, cy = CY): [number, number] {
  return [f(cx + r * Math.cos(rad(deg))), f(cy + r * Math.sin(rad(deg)))];
}

export function annulus(r1: number, r2: number, cx = CX, cy = CY): string {
  return `M${f(cx - r2)},${cy}a${r2},${r2} 0 1,0 ${f(2 * r2)},0a${r2},${r2} 0 1,0 ${f(-2 * r2)},0Z M${f(cx - r1)},${cy}a${r1},${r1} 0 1,1 ${f(2 * r1)},0a${r1},${r1} 0 1,1 ${f(-2 * r1)},0Z`;
}

/** Wedges from the centre between angle ranges, as one path (cheap sunburst). */
export function wedges(r: number, from: number[], width: number, cx = CX, cy = CY): string {
  let d = "";
  for (const a of from) {
    const [x1, y1] = polar(r, a, cx, cy);
    const [x2, y2] = polar(r, a + width, cx, cy);
    d += `M${cx},${cy}L${f(x1)},${f(y1)}L${f(x2)},${f(y2)}Z`;
  }
  return d;
}

/** Rounded square with superellipse-like corners (cushion case). */
export function cushionPath(half: number, corner: number, cx = CX, cy = CY): string {
  const h = half;
  const c = corner;
  const bow = h * 0.06; // gently convex sides
  return [
    `M${cx - h + c},${cy - h}`,
    `Q${cx},${cy - h - bow} ${cx + h - c},${cy - h}`,
    `Q${cx + h},${cy - h} ${cx + h},${cy - h + c}`,
    `Q${cx + h + bow},${cy} ${cx + h},${cy + h - c}`,
    `Q${cx + h},${cy + h} ${cx + h - c},${cy + h}`,
    `Q${cx},${cy + h + bow} ${cx - h + c},${cy + h}`,
    `Q${cx - h},${cy + h} ${cx - h},${cy + h - c}`,
    `Q${cx - h - bow},${cy} ${cx - h},${cy - h + c}`,
    `Q${cx - h},${cy - h} ${cx - h + c},${cy - h}Z`,
  ].join("");
}

export function octagonPath(r: number, cx = CX, cy = CY, rotate = 22.5): string {
  const pts = Array.from({ length: 8 }, (_, i) => polar(r, i * 45 + rotate, cx, cy));
  return `M${pts.map(([x, y]) => `${f(x)},${f(y)}`).join("L")}Z`;
}
