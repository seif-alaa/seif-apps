import { z } from "zod";

/**
 * Catalog model. Every configurator option is a Component; its technical
 * attributes live in a type-specific `spec`. Missing technical data is
 * represented as `null` and is NEVER treated as proof of compatibility.
 */

export const COMPONENT_TYPES = [
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
] as const;
export type ComponentType = (typeof COMPONENT_TYPES)[number];

export const COMPONENT_TYPE_LABEL: Record<ComponentType, string> = {
  movement: "Movement",
  dial: "Dial",
  case: "Case",
  hands: "Hands",
  bezel: "Bezel",
  insert: "Bezel insert",
  crystal: "Crystal",
  chapterRing: "Chapter ring",
  band: "Bracelet / strap",
  clasp: "Clasp / buckle",
  caseback: "Caseback",
};

/** Short code prefix used in share URLs and SKUs. */
export const COMPONENT_CODE_PREFIX: Record<ComponentType, string> = {
  movement: "M",
  dial: "D",
  case: "C",
  hands: "H",
  bezel: "Z",
  insert: "I",
  crystal: "X",
  chapterRing: "R",
  band: "S",
  clasp: "K",
  caseback: "B",
};

export const StockStatus = z.enum(["in_stock", "low", "made_to_order", "out_of_stock"]);
export type StockStatus = z.infer<typeof StockStatus>;

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a 6-digit hex colour, e.g. #3A322E");
const mm = z.number().positive().max(80);
const nullableMm = mm.nullable();

export const CrownPosition = z.union([z.literal(3), z.literal(3.8)]);
export type CrownPosition = z.infer<typeof CrownPosition>;

/* ── Movement family (caliber-level facts) ────────────────────────────── */

export const Complication = z.enum(["date", "day", "gmt"]);
export type Complication = z.infer<typeof Complication>;

export const MovementFamilySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1), // "TMI NH35A"
  caliber: z.string().min(1), // "NH35A"
  maker: z.string().min(1),
  complications: z.array(Complication),
  jewels: z.number().int().positive().nullable(),
  frequencyBph: z.number().int().positive().nullable(),
  powerReserveHours: z.number().positive().nullable(),
  diameterMm: nullableMm,
  heightMm: nullableMm,
  hacking: z.boolean().nullable(),
  handWinding: z.boolean().nullable(),
  /** Customer-friendly explanation, plain language. */
  plainLanguage: z.string(),
  /** Where the technical figures came from; shown to admins. */
  specsSource: z.string(),
  specsVerified: z.boolean(),
});
export type MovementFamily = z.infer<typeof MovementFamilySchema>;

/* ── Type-specific specs ──────────────────────────────────────────────── */

export const MovementSpec = z.object({
  familyId: z.string().min(1),
  /** Crown orientation the date wheel is printed for (3 or 3.8 o'clock). */
  crownPosition: CrownPosition,
  dateWheel: z.enum(["white", "black"]).nullable(),
  variantNote: z.string(),
});

export const DialSpec = z.object({
  diameterMm: mm,
  /** Dial feet orientation: built for a crown at 3, at 3.8, or feetless. */
  feet: z.enum(["crown-3", "crown-3.8", "feetless"]),
  dateWindow: z.enum(["none", "date", "day-date"]),
  colorName: z.string(),
  colorHex: hex,
  colorFamily: z.enum(["light", "blue", "green", "brown", "red", "dark", "grey", "pink"]),
  texture: z.enum(["sunburst", "matte", "linen", "grained", "lacquer", "stone"]),
  markers: z.enum(["baton", "arabic", "roman", "dot", "explorer", "minimal"]),
  markerTone: z.enum(["steel", "gold", "rose", "black"]),
  lume: z.boolean(),
  lumeHex: hex.nullable(),
  printHex: hex,
  dialText: z.string().max(24),
  collection: z.string(),
});

export const CaseSpec = z.object({
  styleName: z.string(),
  shape: z.enum(["round", "cushion", "octagon"]),
  diameterMm: mm,
  lugToLugMm: mm,
  thicknessMm: mm,
  lugWidthMm: mm,
  dialOpeningMm: mm,
  crystalDiameterMm: mm,
  crownPosition: CrownPosition,
  crownGuards: z.boolean(),
  material: z.string(),
  finish: z.enum(["brushed", "polished", "brushed-polished", "bead-blasted"]),
  tone: z.enum(["steel", "gold", "black"]),
  bezelSystem: z.enum(["dive-120", "fixed", "integrated"]),
  chapterRingSize: z.string().nullable(),
  maxMovementHeightMm: nullableMm,
  supportsExhibitionCaseback: z.boolean(),
  casebackFit: z.string(),
  lugStyle: z.enum(["straight", "curved", "drilled"]),
});

export const HandsSpec = z.object({
  style: z.enum(["dauphine", "sword", "baton", "cathedral", "syringe", "pencil", "arrow", "leaf"]),
  tone: z.enum(["steel", "gold", "rose", "black", "blue"]),
  lume: z.boolean(),
  lumeHex: hex.nullable(),
  secondsHex: hex,
  secondsStyle: z.enum(["stick", "lollipop", "arrow"]),
  gmtHand: z.boolean(),
  gmtHex: hex.nullable(),
  movementFamilies: z.array(z.string()),
  /** Dial diameters these hand lengths are verified for. */
  dialDiametersMm: z.array(mm),
});

export const BezelSpec = z.object({
  bezelSystem: z.enum(["dive-120", "fixed"]),
  style: z.enum(["coin-edge", "fluted", "smooth", "scalloped"]),
  tone: z.enum(["steel", "gold", "black"]),
  takesInsert: z.boolean(),
  insertOuterMm: nullableMm,
  /** Fixed bezels are case-specific; list case component ids they fit. */
  fitsCaseIds: z.array(z.string()),
});

export const InsertSpec = z.object({
  outerMm: mm,
  scale: z.enum(["dive-60", "gmt-24", "minimal", "countdown"]),
  colorHex: hex,
  secondaryHex: hex.nullable(),
  numeralHex: hex,
  material: z.enum(["aluminium", "ceramic", "sapphire"]),
  lumePip: z.boolean(),
});

export const CrystalSpec = z.object({
  diameterMm: mm,
  profile: z.enum(["flat", "domed", "double-dome", "box"]),
  material: z.enum(["sapphire", "mineral"]),
  coating: z.enum(["none", "clear-ar", "blue-ar"]),
  cyclops: z.boolean(),
});

export const ChapterRingSpec = z.object({
  size: z.string(),
  colorHex: hex,
  markings: z.enum(["minute-track", "plain", "numerals"]),
  printHex: hex,
});

export const BandSpec = z.object({
  kind: z.enum(["bracelet", "leather", "rubber", "fabric"]),
  style: z.enum([
    "oyster",
    "jubilee",
    "beads",
    "mesh",
    "smooth",
    "suede",
    "tropic",
    "fkm",
    "nato",
    "sailcloth",
  ]),
  lugWidthMm: mm,
  /** Width where the band meets the clasp/buckle. */
  claspWidthMm: mm,
  colorHex: hex,
  secondaryHex: hex.nullable(),
  stitchHex: hex.nullable(),
  tone: z.enum(["steel", "gold", "black"]).nullable(),
  endLinks: z.enum(["straight", "fitted", "none"]),
  /** For fitted end links: the case component ids they are cut for. */
  fitsCaseIds: z.array(z.string()),
  claspInterface: z.enum(["bracelet", "buckle", "integrated"]),
});

export const ClaspSpec = z.object({
  interface: z.enum(["bracelet", "buckle"]),
  style: z.enum(["fold-over", "glide-lock", "butterfly", "tang-buckle", "deployant"]),
  widthMm: mm,
  tone: z.enum(["steel", "gold", "black"]),
});

export const CasebackSpec = z.object({
  kind: z.enum(["solid", "exhibition"]),
  fit: z.string(),
  engravable: z.boolean(),
  engraveMaxChars: z.number().int().min(0).max(80),
  tone: z.enum(["steel", "gold", "black"]),
});

export const SPEC_SCHEMAS = {
  movement: MovementSpec,
  dial: DialSpec,
  case: CaseSpec,
  hands: HandsSpec,
  bezel: BezelSpec,
  insert: InsertSpec,
  crystal: CrystalSpec,
  chapterRing: ChapterRingSpec,
  band: BandSpec,
  clasp: ClaspSpec,
  caseback: CasebackSpec,
} as const;

export type SpecFor<T extends ComponentType> = z.infer<(typeof SPEC_SCHEMAS)[T]>;

const ComponentBaseSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{1,63}$/, "Lowercase letters, numbers and dashes"),
  code: z.string().regex(/^[A-Z][A-Z0-9]{1,5}$/),
  name: z.string().min(2).max(80),
  sku: z.string().min(2).max(40),
  supplier: z.string().max(80).nullable(),
  supplierRef: z.string().max(80).nullable(),
  costMinor: z.number().int().nonnegative().nullable(),
  priceMinor: z.number().int().nonnegative(),
  priceAdjustmentMinor: z.number().int(),
  discountEligible: z.boolean(),
  description: z.string().max(600),
  images: z.array(z.string()),
  stock: z.object({
    status: StockStatus,
    quantity: z.number().int().nonnegative().nullable(),
    leadTimeDays: z.number().int().nonnegative().nullable(),
  }),
  active: z.boolean(),
  sortOrder: z.number().int(),
  updatedAt: z.string(),
});

export const ComponentSchema = z.discriminatedUnion("type", [
  ComponentBaseSchema.extend({ type: z.literal("movement"), spec: MovementSpec }),
  ComponentBaseSchema.extend({ type: z.literal("dial"), spec: DialSpec }),
  ComponentBaseSchema.extend({ type: z.literal("case"), spec: CaseSpec }),
  ComponentBaseSchema.extend({ type: z.literal("hands"), spec: HandsSpec }),
  ComponentBaseSchema.extend({ type: z.literal("bezel"), spec: BezelSpec }),
  ComponentBaseSchema.extend({ type: z.literal("insert"), spec: InsertSpec }),
  ComponentBaseSchema.extend({ type: z.literal("crystal"), spec: CrystalSpec }),
  ComponentBaseSchema.extend({ type: z.literal("chapterRing"), spec: ChapterRingSpec }),
  ComponentBaseSchema.extend({ type: z.literal("band"), spec: BandSpec }),
  ComponentBaseSchema.extend({ type: z.literal("clasp"), spec: ClaspSpec }),
  ComponentBaseSchema.extend({ type: z.literal("caseback"), spec: CasebackSpec }),
]);
export type Component = z.infer<typeof ComponentSchema>;
export type ComponentOf<T extends ComponentType> = Extract<Component, { type: T }>;

/* ── Explicit compatibility records (admin-managed overrides) ─────────── */

export const CompatStatus = z.enum(["compatible", "incompatible", "unconfirmed"]);
export type CompatStatus = z.infer<typeof CompatStatus>;

export const CompatRecordSchema = z.object({
  id: z.string(),
  aId: z.string(),
  bId: z.string(),
  status: CompatStatus,
  note: z.string().max(280),
  source: z.enum(["atelier-tested", "supplier", "measurement", "other"]),
  updatedAt: z.string(),
});
export type CompatRecord = z.infer<typeof CompatRecordSchema>;

/* ── Preview assets (raster layers with physical alignment) ───────────── */

export const ASSET_SLOTS = [
  "case",
  "bezel",
  "insert",
  "chapterRing",
  "dial",
  "hand-hour",
  "hand-minute",
  "hand-seconds",
  "hand-gmt",
  "crystal",
  "band-top",
  "band-bottom",
  "caseback",
] as const;
export type AssetSlot = (typeof ASSET_SLOTS)[number];

export const PreviewAssetSchema = z.object({
  id: z.string(),
  componentId: z.string(),
  view: z.enum(["front", "rear"]),
  slot: z.enum(ASSET_SLOTS),
  src: z.string(),
  widthPx: z.number().int().positive(),
  heightPx: z.number().int().positive(),
  /** Source resolution: image pixels per millimetre of the real part. */
  pxPerMm: z.number().positive(),
  /** Anchor in image pixels: case/dial centre, hand pinion, or lug-bar centre. */
  anchorX: z.number(),
  anchorY: z.number(),
  rotationDeg: z.number().min(-180).max(180),
  opacity: z.number().min(0).max(1),
  zOffset: z.number().int().min(-5).max(5),
  status: z.enum(["draft", "validated", "published"]),
  note: z.string().max(280),
  updatedAt: z.string(),
});
export type PreviewAsset = z.infer<typeof PreviewAssetSchema>;

/* ── Aggregate ────────────────────────────────────────────────────────── */

export interface Catalog {
  movementFamilies: MovementFamily[];
  components: Component[];
  compat: CompatRecord[];
  assets: PreviewAsset[];
}

/** Catalog as sent to browsers: supplier, cost and SKU-level supplier refs removed. */
export type PublicComponent = Omit<Component, "costMinor" | "supplier" | "supplierRef"> & {
  costMinor?: never;
};
export interface PublicCatalog {
  movementFamilies: MovementFamily[];
  components: PublicComponent[];
  compat: Pick<CompatRecord, "aId" | "bId" | "status" | "note">[];
  assets: PreviewAsset[];
}

export function toPublicCatalog(catalog: Catalog): PublicCatalog {
  return {
    movementFamilies: catalog.movementFamilies,
    components: catalog.components
      .filter((c) => c.active)
      .map(({ costMinor: _c, supplier: _s, supplierRef: _r, ...rest }) => rest as PublicComponent),
    compat: catalog.compat.map(({ aId, bId, status, note }) => ({ aId, bId, status, note })),
    assets: catalog.assets.filter((a) => a.status === "published"),
  };
}

export function effectivePrice(c: Pick<Component, "priceMinor" | "priceAdjustmentMinor">): number {
  return Math.max(0, c.priceMinor + (c.priceAdjustmentMinor ?? 0));
}

export function indexCatalog<C extends { id: string }>(components: readonly C[]): Map<string, C> {
  return new Map(components.map((c) => [c.id, c]));
}
