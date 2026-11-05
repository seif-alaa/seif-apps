/**
 * Photo-parts model. The single source of truth is tools/parts/parts-manifest.json
 * (parts, live families, layer order); availability comes from public/parts/_report.json
 * (written by tools/parts/normalize_parts.py) and prices from data/prices.json.
 * Everything here is pure so the builder, server pricing and thumbnails share it.
 */

export interface ManifestPart {
  id: string;
  type: "case" | "bezel" | "dial" | "ring" | "hand" | "bracelet";
  family: string;
  label: string;
  set?: string;
  hand?: "hour" | "minute" | "second" | "gmt";
  /** Bracelets/straps: the width (mm) the image was normalised to. */
  width_mm?: number;
}
export interface ManifestFamily {
  name: string;
  movement: string;
  case: string[];
  bezel: string[];
  dial: string[];
  ring?: string[];
  hands: string[];
  gmt_hand?: string[];
  bracelet: string[];
  /** Lug width (mm): bracelets are scaled in CSS by lug_mm / width_mm. */
  lug_mm?: number;
}
export interface Manifest {
  families_live: Record<string, ManifestFamily>;
  families_coming_soon: string[];
  parts: ManifestPart[];
}

export interface PartInfo {
  id: string;
  type: ManifestPart["type"];
  label: string;
  priceEgp: number;
  widthMm?: number;
}
export interface HandsSet {
  id: string;
  label: string;
  hour: string;
  minute: string;
  second: string;
}
export interface FamilyInfo {
  id: string;
  name: string;
  movement: string;
  caliber: string;
  /** True when every step has at least one option with an image. Otherwise shown as "Coming soon". */
  live: boolean;
  case: string[];
  bezel: string[];
  dial: string[];
  hands: HandsSet[];
  band: string[];
  ring: string | null;
  gmt: string | null;
  lugMm: number;
}
export interface PartsCatalog {
  families: FamilyInfo[];
  comingSoon: string[];
  parts: Record<string, PartInfo>;
}

/** One id per step. `bezel` is "" only for a family that has no bezel options. */
export interface PhotoBuild {
  family: string;
  case: string;
  bezel: string;
  dial: string;
  hands: string; // hands set id
  band: string;
}

/** Part ids per rendered layer, in stacking order (bracelet first, bezel last). */
export interface Layers {
  bracelet: string | null;
  case: string | null;
  dial: string | null;
  ring: string | null;
  hour: string | null;
  minute: string | null;
  gmt: string | null;
  second: string | null;
  bezel: string | null;
  /** CSS scale for the bracelet layer: the family's lug width / the bracelet image's width. */
  braceletScale?: number;
}

export const LAYER_ORDER = ["bracelet", "case", "dial", "ring", "hour", "minute", "gmt", "second", "bezel"] as const;
export const partSrc = (id: string) => `/parts/${id}.webp`;

export function buildPartsCatalog(manifest: Manifest, available: ReadonlySet<string>, prices: Record<string, number>): PartsCatalog {
  const byId = new Map(manifest.parts.map((p) => [p.id, p]));
  const ok = (id: string) => available.has(id) && byId.has(id);
  const used = new Set<string>();
  const use = <T extends string | null>(id: T): T => {
    if (id) used.add(id);
    return id;
  };

  const families: FamilyInfo[] = Object.entries(manifest.families_live).map(([id, f]) => {
    const hands: HandsSet[] = f.hands.flatMap((setId) => {
      const role = (r: string) => manifest.parts.find((p) => p.type === "hand" && p.set === setId && p.hand === r && ok(p.id))?.id;
      const [hour, minute, second] = [role("hour"), role("minute"), role("second")];
      if (!hour || !minute || !second) return [];
      return [{ id: setId, label: byId.get(hour)!.label.replace(/\s*·\s*hour\s*$/i, ""), hour: use(hour), minute: use(minute), second: use(second) }];
    });
    const pick = (ids: string[] | undefined) => (ids ?? []).filter(ok).map(use);
    const fam: FamilyInfo = {
      id,
      name: f.name,
      movement: f.movement,
      caliber: /\b(?:NH|VK)\d+/i.exec(f.movement)?.[0].toUpperCase() ?? "",
      live: false,
      case: pick(f.case),
      bezel: pick(f.bezel),
      dial: pick(f.dial),
      hands,
      band: pick(f.bracelet),
      ring: use((f.ring ?? []).find(ok) ?? null),
      gmt: use((f.gmt_hand ?? []).find(ok) ?? null),
      lugMm: f.lug_mm ?? 20,
    };
    fam.live = fam.case.length > 0 && fam.dial.length > 0 && fam.hands.length > 0 && fam.band.length > 0;
    return fam;
  });

  const parts: Record<string, PartInfo> = {};
  for (const id of used) {
    const p = byId.get(id)!;
    parts[id] = { id, type: p.type, label: p.label, priceEgp: Math.max(0, Math.round(prices[id] ?? 0)), ...(p.width_mm ? { widthMm: p.width_mm } : {}) };
  }
  return { families, comingSoon: manifest.families_coming_soon.map((s) => s.replace(/\s*\(.*$/, "").trim()), parts };
}

export const familyOf = (cat: PartsCatalog, id: string) => cat.families.find((f) => f.id === id);

export function defaultBuild(f: FamilyInfo): PhotoBuild {
  return { family: f.id, case: f.case[0], bezel: f.bezel[0] ?? "", dial: f.dial[0], hands: f.hands[0].id, band: f.band[0] };
}

/** The family a build belongs to, if every chosen part is one of that family's live options. */
export function validateBuild(cat: PartsCatalog, b: PhotoBuild): FamilyInfo | null {
  const f = familyOf(cat, b.family);
  if (!f?.live) return null;
  const okBezel = f.bezel.length ? f.bezel.includes(b.bezel) : b.bezel === "";
  return f.case.includes(b.case) && okBezel && f.dial.includes(b.dial) && f.hands.some((h) => h.id === b.hands) && f.band.includes(b.band) ? f : null;
}

export function layersOf(cat: PartsCatalog, b: PhotoBuild): Layers {
  const f = familyOf(cat, b.family);
  const h = f?.hands.find((x) => x.id === b.hands);
  return {
    bracelet: b.band || null,
    case: b.case || null,
    dial: b.dial || null,
    ring: f?.ring ?? null,
    hour: h?.hour ?? null,
    minute: h?.minute ?? null,
    gmt: f?.gmt ?? null,
    second: h?.second ?? null,
    bezel: b.bezel || null,
    braceletScale: f && b.band && cat.parts[b.band]?.widthMm ? f.lugMm / cat.parts[b.band].widthMm! : 1,
  };
}

/** Price (EGP) of a part set: the sum of the part ids it renders. */
export const priceOfIds = (cat: PartsCatalog, ids: (string | null | undefined)[]) => ids.reduce<number>((s, id) => s + (id ? (cat.parts[id]?.priceEgp ?? 0) : 0), 0);
export const handsPrice = (cat: PartsCatalog, h: HandsSet) => priceOfIds(cat, [h.hour, h.minute, h.second]);
export const partsTotalEgp = (cat: PartsCatalog, b: PhotoBuild) => priceOfIds(cat, LAYER_ORDER.map((k) => layersOf(cat, b)[k]));

/** Share-link value: family.case.bezel.dial.hands.band (ids never contain dots). Old-format links decode to null. */
export const encodeBuild = (b: PhotoBuild) => [b.family, b.case, b.bezel || "-", b.dial, b.hands, b.band].join(".");
export function decodeBuild(cat: PartsCatalog, raw: string | null | undefined): PhotoBuild | null {
  if (!raw || raw.length > 300) return null;
  const [family, c, bezel, dial, hands, band, extra] = raw.split(".");
  if (extra !== undefined || !band) return null;
  const b: PhotoBuild = { family, case: c, bezel: bezel === "-" ? "" : bezel, dial, hands, band };
  return validateBuild(cat, b) ? b : null;
}

/** "SKX 42 · black": family name plus the dial's colour word(s). */
export function buildName(cat: PartsCatalog, b: PhotoBuild): string {
  const f = familyOf(cat, b.family);
  const dial = cat.parts[b.dial]?.label.split(" · ").pop() ?? "";
  return [f?.name, dial].filter(Boolean).join(" · ");
}

/** Deterministic, readable reference: "NV-7K3Q-M2XA". */
export function buildReference(b: PhotoBuild): string {
  const canon = encodeBuild(b);
  const hash = (seed: number) => {
    let h = seed >>> 0;
    for (let i = 0; i < canon.length; i++) {
      h ^= canon.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h >>> 0;
  };
  const A = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  let n = BigInt(hash(0x811c9dc5)) * 256n + BigInt(hash(0x9e3779b9) & 0xff);
  let out = "";
  for (let i = 0; i < 8; i++) {
    out = A[Number(n % 32n)] + out;
    n /= 32n;
  }
  return `NV-${out.slice(0, 4)}-${out.slice(4)}`;
}

/** Hand angles (degrees clockwise from 12) for a given time. `seconds` may be fractional. */
export function handAngles(h: number, m: number, s: number) {
  return { hour: ((h % 12) + m / 60 + s / 3600) * 30, minute: (m + s / 60) * 6, second: s * 6, gmt: ((h % 24) + m / 60 + s / 3600) * 15 };
}
export const DEFAULT_TIME = { h: 10, m: 8, s: 35 };
