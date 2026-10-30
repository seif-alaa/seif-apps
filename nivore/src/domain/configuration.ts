import { z } from "zod";
import type { ComponentType, PublicComponent } from "./catalog";

/**
 * A custom watch configuration: one component id per applicable slot plus
 * personalisation. Slots are component types. SLOT_ORDER defines what counts
 * as an "earlier" choice: earlier choices constrain later ones, and later
 * choices are adjusted (with the customer's confirmation) when an earlier
 * choice changes.
 */
export const SLOT_ORDER = [
  "movement",
  "dial",
  "case",
  "hands",
  "bezel",
  "insert",
  "crystal",
  "chapterRing",
  "band",
  "clasp",
  "caseback",
] as const satisfies readonly ComponentType[];
export type Slot = (typeof SLOT_ORDER)[number];

export const SLOT_LABEL: Record<Slot, string> = {
  movement: "Movement",
  dial: "Dial",
  case: "Case",
  hands: "Hands",
  bezel: "Bezel",
  insert: "Bezel insert",
  crystal: "Crystal",
  chapterRing: "Chapter ring",
  band: "Bracelet / strap",
  clasp: "Clasp",
  caseback: "Caseback",
};

export const EngravingSchema = z.object({
  text: z
    .string()
    .max(80)
    .regex(/^[\p{L}\p{N} .,'&\-–—:/·♥]*$/u, "Letters, numbers and simple punctuation only"),
  style: z.enum(["sans", "serif"]),
});
export type Engraving = z.infer<typeof EngravingSchema>;

export const ConfigurationSchema = z.object({
  parts: z.partialRecord(z.enum(SLOT_ORDER), z.string()),
  engraving: EngravingSchema.nullable(),
  options: z.array(z.string()).max(10),
});
export type Configuration = z.infer<typeof ConfigurationSchema>;

export const EMPTY_CONFIGURATION: Configuration = { parts: {}, engraving: null, options: [] };

/* ── Steps ─────────────────────────────────────────────────────────────── */

export interface StepDef {
  id: "movement" | "dial" | "case" | "hands" | "bezel" | "band" | "personalize" | "review";
  index: string;
  title: string;
  verb: string;
  narrative: string;
  slots: Slot[];
  /** Preview framing for this step: scale and vertical offset (% of stage). */
  camera: { scale: number; y: number };
}

export const STEPS: StepDef[] = [
  {
    id: "movement",
    index: "01",
    title: "Movement",
    verb: "Begin with what it does",
    narrative:
      "The movement decides what the watch can tell you: the time alone, the date, the day, or a second time zone.",
    slots: ["movement"],
    camera: { scale: 1, y: 0 },
  },
  {
    id: "dial",
    index: "02",
    title: "Dial",
    verb: "Choose its face",
    narrative: "Colour, texture and markers. The dial is what you will look at most, so take your time.",
    slots: ["dial"],
    camera: { scale: 1.28, y: 0 },
  },
  {
    id: "case",
    index: "03",
    title: "Case",
    verb: "Set its proportion",
    narrative: "Diameter and lug-to-lug decide how the watch sits on your wrist. Every case is drawn to its measurements.",
    slots: ["case"],
    camera: { scale: 1, y: 0 },
  },
  {
    id: "hands",
    index: "04",
    title: "Hands",
    verb: "Draw the hands",
    narrative: "Shape and finish change how quickly the time reads, and how the dial catches light.",
    slots: ["hands"],
    camera: { scale: 1.32, y: 0 },
  },
  {
    id: "bezel",
    index: "05",
    title: "Bezel & crystal",
    verb: "Frame the dial",
    narrative: "The ring around the dial, and the glass above it. Options follow what your case can accept.",
    slots: ["bezel", "insert", "crystal", "chapterRing"],
    camera: { scale: 1.16, y: 0 },
  },
  {
    id: "band",
    index: "06",
    title: "Bracelet or strap",
    verb: "Fit it to the wrist",
    narrative: "Steel, leather, rubber or fabric. Only widths that fit your case's lugs are offered.",
    slots: ["band", "clasp"],
    camera: { scale: 0.86, y: 0 },
  },
  {
    id: "personalize",
    index: "07",
    title: "Personalisation",
    verb: "Make it yours",
    narrative: "The back of the watch is private. Choose a caseback, and where offered, a few words to keep there.",
    slots: ["caseback"],
    camera: { scale: 1.04, y: 0 },
  },
  {
    id: "review",
    index: "08",
    title: "Review",
    verb: "Your composition",
    narrative: "Every part, its contribution and the total. Edit any step without losing the rest.",
    slots: [],
    camera: { scale: 0.94, y: 0 },
  },
];

export function stepForSlot(slot: Slot): StepDef {
  return STEPS.find((s) => s.slots.includes(slot)) ?? STEPS[0];
}

/* ── Share-URL encoding ────────────────────────────────────────────────── */

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromBase64Url(input: string): string {
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((input.length + 3) % 4);
  const bin = atob(b64);
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

type CodeLookup = Pick<PublicComponent, "id" | "code" | "type">;

/** Encode as URL params: b=M1.D03.C02… (component codes), e=engraving, o=options. */
export function encodeConfiguration(config: Configuration, components: readonly CodeLookup[]): URLSearchParams {
  const byId = new Map(components.map((c) => [c.id, c]));
  const codes = SLOT_ORDER.map((s) => config.parts[s])
    .filter((id): id is string => Boolean(id))
    .map((id) => byId.get(id)?.code)
    .filter(Boolean);
  const params = new URLSearchParams();
  params.set("b", codes.join("."));
  if (config.engraving?.text) {
    params.set("e", toBase64Url(JSON.stringify([config.engraving.text, config.engraving.style])));
  }
  if (config.options.length) params.set("o", config.options.join("."));
  return params;
}

export function decodeConfiguration(
  params: URLSearchParams | Record<string, string | string[] | undefined>,
  components: readonly CodeLookup[],
): Configuration | null {
  const get = (k: string): string | undefined => {
    if (params instanceof URLSearchParams) return params.get(k) ?? undefined;
    const v = params[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const b = get("b");
  if (!b || b.length > 200) return null;
  const byCode = new Map(components.map((c) => [c.code, c]));
  const parts: Configuration["parts"] = {};
  for (const code of b.split(".")) {
    const c = byCode.get(code);
    if (c && (SLOT_ORDER as readonly string[]).includes(c.type)) parts[c.type as Slot] = c.id;
  }
  let engraving: Engraving | null = null;
  const e = get("e");
  if (e && e.length < 400) {
    try {
      const [text, style] = JSON.parse(fromBase64Url(e)) as [string, string];
      const parsed = EngravingSchema.safeParse({ text, style });
      if (parsed.success) engraving = parsed.data;
    } catch {
      /* ignore malformed engraving */
    }
  }
  const o = get("o");
  const options = o ? o.split(".").filter((x) => /^[a-z0-9-]{1,40}$/.test(x)).slice(0, 10) : [];
  return { parts, engraving, options };
}

/* ── Build reference & presentation name ──────────────────────────────── */

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function fnv1a(text: string, seed: number): number {
  let h = seed >>> 0;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export function canonicalConfiguration(config: Configuration): string {
  const parts = SLOT_ORDER.map((s) => `${s}=${config.parts[s] ?? ""}`).join("|");
  const engr = config.engraving ? `${config.engraving.style}:${config.engraving.text}` : "";
  return `${parts}|e=${engr}|o=${[...config.options].sort().join(",")}`;
}

/** Deterministic, readable reference: identical builds share a reference. "NV-7K3Q-M2XA" */
export function buildReference(config: Configuration): string {
  const canon = canonicalConfiguration(config);
  const a = fnv1a(canon, 0x811c9dc5);
  const b = fnv1a(canon, 0x9e3779b9);
  // 40 bits → 8 Crockford characters.
  let n = BigInt(a) * 256n + BigInt(b & 0xff);
  let out = "";
  for (let i = 0; i < 8; i++) {
    out = CROCKFORD[Number(n % 32n)] + out;
    n /= 32n;
  }
  return `NV-${out.slice(0, 4)}-${out.slice(4)}`;
}

/**
 * Presentation name after the Brand Book naming formula
 * (Collection + case size + dial). Collections follow the hours of light:
 * ALBA (dawn, light dials), MERIDIANA (midday, blue/green), SERA (evening,
 * warm), NOTTE (night, dark). Never a substitute for the specification list.
 */
export function presentationName(
  dial: { spec: { colorFamily: string; colorName: string } } | undefined,
  kase: { spec: { diameterMm: number } } | undefined,
  complications: readonly string[] = [],
): { collection: string; size: string; dial: string; full: string } {
  const family = dial?.spec.colorFamily ?? "light";
  const collection =
    family === "dark"
      ? "NOTTE"
      : family === "blue" || family === "green"
        ? "MERIDIANA"
        : family === "brown" || family === "red"
          ? "SERA"
          : "ALBA";
  const size = kase ? String(Math.round(kase.spec.diameterMm)) : "";
  const suffix = complications.includes("gmt") ? " GMT" : "";
  const dialName = dial?.spec.colorName ?? "";
  return {
    collection,
    size: size + suffix,
    dial: dialName,
    full: `${collection} ${size}${suffix}${dialName ? ` · ${dialName}` : ""}`.trim(),
  };
}
