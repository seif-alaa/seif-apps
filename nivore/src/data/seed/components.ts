import type { CompatRecord, Component, ComponentOf, ComponentType, MovementFamily, SpecFor } from "@/domain/catalog";

/**
 * SAMPLE CATALOGUE — development seed only.
 * Prices, costs, suppliers and stock are illustrative and must be replaced in
 * the admin before launch. Movement figures are commonly published values and
 * are flagged `specsVerified: false` until checked against supplier datasheets.
 */

const T0 = "2026-10-01T09:00:00.000Z";
const egp = (pounds: number) => pounds * 100;

type Base = Partial<Omit<Component, "type" | "spec">> & { id: string; code: string; name: string; price: number; cost?: number | null };

let order = 0;
function make<T extends ComponentType>(type: T, b: Base, spec: SpecFor<T>): ComponentOf<T> {
  order += 10;
  return {
    type,
    id: b.id,
    code: b.code,
    name: b.name,
    sku: b.sku ?? `NV-${b.code}`,
    supplier: b.supplier ?? "Sample supplier",
    supplierRef: b.supplierRef ?? null,
    costMinor: b.cost === undefined ? Math.round(egp(b.price) * 0.55) : b.cost === null ? null : egp(b.cost),
    priceMinor: egp(b.price),
    priceAdjustmentMinor: 0,
    discountEligible: b.discountEligible ?? true,
    description: b.description ?? "",
    images: [],
    stock: b.stock ?? { status: "in_stock", quantity: 6, leadTimeDays: null },
    active: b.active ?? true,
    sortOrder: b.sortOrder ?? order,
    updatedAt: T0,
    spec,
  } as unknown as ComponentOf<T>;
}

/* ── Movement families ────────────────────────────────────────────────── */

const SRC = "Commonly published TMI datasheet figures. Verify against your supplier's datasheet before publishing.";

export const movementFamilies: MovementFamily[] = [
  {
    id: "nh35",
    name: "TMI NH35A",
    caliber: "NH35A",
    maker: "Time Module Inc. (TMI)",
    complications: ["date"],
    jewels: 24,
    frequencyBph: 21600,
    powerReserveHours: 41,
    diameterMm: 27.4,
    heightMm: 5.32,
    hacking: true,
    handWinding: true,
    plainLanguage:
      "Shows the time and the date. It winds itself as you wear it, can also be wound by the crown, and the seconds hand stops when you set the time so you can set it precisely.",
    specsSource: SRC,
    specsVerified: false,
  },
  {
    id: "nh36",
    name: "TMI NH36A",
    caliber: "NH36A",
    maker: "Time Module Inc. (TMI)",
    complications: ["day", "date"],
    jewels: 24,
    frequencyBph: 21600,
    powerReserveHours: 41,
    diameterMm: 27.4,
    heightMm: 5.32,
    hacking: true,
    handWinding: true,
    plainLanguage:
      "Shows the time, the date and the day of the week in one window. Otherwise it behaves like the NH35: self-winding, hand-windable and hacking.",
    specsSource: SRC,
    specsVerified: false,
  },
  {
    id: "nh38",
    name: "TMI NH38A",
    caliber: "NH38A",
    maker: "Time Module Inc. (TMI)",
    complications: [],
    jewels: 24,
    frequencyBph: 21600,
    powerReserveHours: 41,
    diameterMm: 27.4,
    heightMm: 5.32,
    hacking: true,
    handWinding: true,
    plainLanguage:
      "Time only, with no date. The cleanest choice for a dial without a window, and the crown has no date-setting position to skip past.",
    specsSource: SRC,
    specsVerified: false,
  },
  {
    id: "nh34",
    name: "TMI NH34A GMT",
    caliber: "NH34A",
    maker: "Time Module Inc. (TMI)",
    complications: ["date", "gmt"],
    jewels: 24,
    frequencyBph: 21600,
    powerReserveHours: 41,
    diameterMm: 27.4,
    heightMm: null,
    hacking: true,
    handWinding: true,
    plainLanguage:
      "Adds a fourth hand that tracks a second time zone over 24 hours, alongside the date. Useful if you travel, or keep time with someone abroad.",
    specsSource: "Height not yet measured by the atelier. Case clearance is confirmed per case.",
    specsVerified: false,
  },
];

/* ── Movements (supplier variants) ────────────────────────────────────── */

const movement = (b: Base, s: SpecFor<"movement">) => make("movement", b, s);

const movements = [
  movement(
    { id: "mv-nh35-white-3", code: "M1", name: "NH35A · White date", price: 2200, description: "White date wheel, for a crown at 3 o'clock." },
    { familyId: "nh35", crownPosition: 3, dateWheel: "white", variantNote: "White date wheel · crown at 3" },
  ),
  movement(
    { id: "mv-nh35-black-3", code: "M2", name: "NH35A · Black date", price: 2250, description: "Black date wheel that disappears into dark dials. Crown at 3." },
    { familyId: "nh35", crownPosition: 3, dateWheel: "black", variantNote: "Black date wheel · crown at 3" },
  ),
  movement(
    { id: "mv-nh35-white-38", code: "M3", name: "NH35A · White date, 3.8 crown", price: 2300, description: "Date wheel printed for a crown at 4 o'clock, so the date still reads at 3." },
    { familyId: "nh35", crownPosition: 3.8, dateWheel: "white", variantNote: "White date wheel · crown at 3.8" },
  ),
  movement(
    { id: "mv-nh36-white-3", code: "M4", name: "NH36A · White day-date", price: 2500, description: "English day wheel and white date. Crown at 3." },
    { familyId: "nh36", crownPosition: 3, dateWheel: "white", variantNote: "White day-date · crown at 3" },
  ),
  movement(
    { id: "mv-nh36-black-38", code: "M5", name: "NH36A · Black day-date, 3.8 crown", price: 2550, description: "Black day and date wheels for a crown at 4 o'clock." },
    { familyId: "nh36", crownPosition: 3.8, dateWheel: "black", variantNote: "Black day-date · crown at 3.8" },
  ),
  movement(
    { id: "mv-nh38", code: "M6", name: "NH38A · No date", price: 2400, description: "Time only. Fits either crown position." },
    { familyId: "nh38", crownPosition: 3, dateWheel: null, variantNote: "No date wheel" },
  ),
  movement(
    {
      id: "mv-nh34-white-3",
      code: "M7",
      name: "NH34A GMT · White date",
      price: 4800,
      description: "Four-hand GMT with white date. Ordered in for each build.",
      stock: { status: "made_to_order", quantity: null, leadTimeDays: 14 },
    },
    { familyId: "nh34", crownPosition: 3, dateWheel: "white", variantNote: "GMT · white date · crown at 3" },
  ),
];

/* ── Cases ────────────────────────────────────────────────────────────── */

const kase = (b: Base, s: SpecFor<"case">) => make("case", b, s);

const cases = [
  kase(
    { id: "case-petite-34", code: "C1", name: "Petite 34", price: 2600, description: "A compact round case with slim curved lugs. Sits close on smaller wrists and under a cuff." },
    { styleName: "Petite", shape: "round", diameterMm: 34, lugToLugMm: 40.5, thicknessMm: 10.9, lugWidthMm: 18, dialOpeningMm: 28.5, crystalDiameterMm: 29.5, crownPosition: 3, crownGuards: false, material: "316L stainless steel", finish: "polished", tone: "steel", bezelSystem: "fixed", chapterRingSize: null, maxMovementHeightMm: 5.4, supportsExhibitionCaseback: false, casebackFit: "cb-34", lugStyle: "curved" },
  ),
  kase(
    { id: "case-dress-36", code: "C2", name: "Dress 36", price: 2800, description: "Round, polished and quiet. A dress proportion that also wears well every day." },
    { styleName: "Dress", shape: "round", diameterMm: 36, lugToLugMm: 43, thicknessMm: 11.4, lugWidthMm: 18, dialOpeningMm: 28.5, crystalDiameterMm: 30, crownPosition: 3, crownGuards: false, material: "316L stainless steel", finish: "polished", tone: "steel", bezelSystem: "fixed", chapterRingSize: null, maxMovementHeightMm: 5.4, supportsExhibitionCaseback: true, casebackFit: "cb-36", lugStyle: "curved" },
  ),
  kase(
    { id: "case-dress-36-gold", code: "C3", name: "Dress 36 · Gold tone", price: 3400, description: "The Dress 36 in a gold-tone finish over steel.", stock: { status: "low", quantity: 2, leadTimeDays: null } },
    { styleName: "Dress", shape: "round", diameterMm: 36, lugToLugMm: 43, thicknessMm: 11.4, lugWidthMm: 18, dialOpeningMm: 28.5, crystalDiameterMm: 30, crownPosition: 3, crownGuards: false, material: "316L stainless steel, gold-tone PVD", finish: "polished", tone: "gold", bezelSystem: "fixed", chapterRingSize: null, maxMovementHeightMm: 5.4, supportsExhibitionCaseback: true, casebackFit: "cb-36", lugStyle: "curved" },
  ),
  kase(
    { id: "case-field-39", code: "C4", name: "Field 39", price: 3000, description: "Straight lugs, brushed flanks and a polished bevel. Built for daily wear." },
    { styleName: "Field", shape: "round", diameterMm: 39, lugToLugMm: 46, thicknessMm: 12, lugWidthMm: 20, dialOpeningMm: 28.5, crystalDiameterMm: 31.5, crownPosition: 3, crownGuards: false, material: "316L stainless steel", finish: "brushed-polished", tone: "steel", bezelSystem: "fixed", chapterRingSize: "cr-39", maxMovementHeightMm: 5.5, supportsExhibitionCaseback: true, casebackFit: "cb-39", lugStyle: "straight" },
  ),
  kase(
    { id: "case-diver-40", code: "C5", name: "Diver 40 · 4 o'clock crown", price: 3200, description: "A rotating-bezel case with guarded crown at 4 o'clock, tucked away from the wrist." },
    { styleName: "Diver", shape: "round", diameterMm: 40, lugToLugMm: 47, thicknessMm: 13.2, lugWidthMm: 20, dialOpeningMm: 28.5, crystalDiameterMm: 31.5, crownPosition: 3.8, crownGuards: true, material: "316L stainless steel", finish: "brushed-polished", tone: "steel", bezelSystem: "dive-120", chapterRingSize: "cr-40d", maxMovementHeightMm: 5.4, supportsExhibitionCaseback: true, casebackFit: "cb-40d", lugStyle: "curved" },
  ),
  kase(
    { id: "case-diver-40-3", code: "C6", name: "Diver 40 · 3 o'clock crown", price: 3200, description: "The same rotating-bezel case with a conventional crown at 3." },
    { styleName: "Diver", shape: "round", diameterMm: 40, lugToLugMm: 47.5, thicknessMm: 13, lugWidthMm: 20, dialOpeningMm: 28.5, crystalDiameterMm: 31.5, crownPosition: 3, crownGuards: true, material: "316L stainless steel", finish: "brushed-polished", tone: "steel", bezelSystem: "dive-120", chapterRingSize: "cr-40d", maxMovementHeightMm: 5.4, supportsExhibitionCaseback: true, casebackFit: "cb-40d", lugStyle: "curved" },
  ),
  kase(
    { id: "case-voyager-40", code: "C7", name: "Voyager 40", price: 3600, description: "A travel case with extra depth for the four-hand GMT movement." },
    { styleName: "Voyager", shape: "round", diameterMm: 40, lugToLugMm: 47.5, thicknessMm: 13.6, lugWidthMm: 20, dialOpeningMm: 28.5, crystalDiameterMm: 31.5, crownPosition: 3, crownGuards: true, material: "316L stainless steel", finish: "brushed-polished", tone: "steel", bezelSystem: "dive-120", chapterRingSize: "cr-40d", maxMovementHeightMm: 5.9, supportsExhibitionCaseback: true, casebackFit: "cb-40d", lugStyle: "straight" },
  ),
  kase(
    { id: "case-cushion-40", code: "C8", name: "Cushion 40", price: 3800, description: "A softened square with an integrated bezel. Wears smaller than its width.", stock: { status: "made_to_order", quantity: null, leadTimeDays: 10 } },
    { styleName: "Cushion", shape: "cushion", diameterMm: 40, lugToLugMm: 45, thicknessMm: 12.5, lugWidthMm: 22, dialOpeningMm: 30, crystalDiameterMm: 31, crownPosition: 3, crownGuards: false, material: "316L stainless steel", finish: "brushed", tone: "steel", bezelSystem: "integrated", chapterRingSize: null, maxMovementHeightMm: 5.5, supportsExhibitionCaseback: false, casebackFit: "cb-c40", lugStyle: "straight" },
  ),
  kase(
    { id: "case-octagon-39", code: "C9", name: "Octagon 39", price: 4200, description: "An eight-sided bezel, brushed tops and polished chamfers. Architectural, and thin for its size." },
    { styleName: "Octagon", shape: "octagon", diameterMm: 39, lugToLugMm: 44, thicknessMm: 10.8, lugWidthMm: 20, dialOpeningMm: 30, crystalDiameterMm: 31.5, crownPosition: 3, crownGuards: false, material: "316L stainless steel", finish: "brushed-polished", tone: "steel", bezelSystem: "integrated", chapterRingSize: null, maxMovementHeightMm: 5.4, supportsExhibitionCaseback: true, casebackFit: "cb-o39", lugStyle: "straight" },
  ),
];

/* ── Dials ────────────────────────────────────────────────────────────── */

const dial = (b: Base, s: SpecFor<"dial">) => make("dial", b, s);
const D = (s: Partial<SpecFor<"dial">> & Pick<SpecFor<"dial">, "colorName" | "colorHex" | "colorFamily">): SpecFor<"dial"> => ({
  diameterMm: 28.5,
  feet: "crown-3",
  dateWindow: "date",
  texture: "sunburst",
  markers: "baton",
  markerTone: "steel",
  lume: false,
  lumeHex: null,
  printHex: "#3a322e",
  dialText: "",
  collection: "Essentials",
  ...s,
});

const dials = [
  dial({ id: "dial-ivory-date", code: "D01", name: "Ivory sunburst · Date", price: 1300 }, D({ colorName: "Ivory", colorHex: "#efe9dc", colorFamily: "light", printHex: "#4a403a" })),
  dial({ id: "dial-ivory-nodate", code: "D02", name: "Ivory sunburst · No date", price: 1300 }, D({ colorName: "Ivory", colorHex: "#efe9dc", colorFamily: "light", dateWindow: "none", printHex: "#4a403a" })),
  dial({ id: "dial-ivory-daydate", code: "D03", name: "Ivory sunburst · Day-date", price: 1350 }, D({ colorName: "Ivory", colorHex: "#efe9dc", colorFamily: "light", dateWindow: "day-date", printHex: "#4a403a" })),
  dial({ id: "dial-rose-linen", code: "D04", name: "Rosé linen · Date", price: 1500, description: "A pale, warm pink with a fine woven texture." }, D({ colorName: "Rosé", colorHex: "#e9cfc4", colorFamily: "pink", texture: "linen", markers: "arabic", markerTone: "rose", printHex: "#7a5a50", collection: "Atelier" })),
  dial({ id: "dial-teal-explorer", code: "D05", name: "Teal sunburst · Explorer", price: 1600 }, D({ colorName: "Teal", colorHex: "#1f5a5e", colorFamily: "green", markers: "explorer", lume: true, lumeHex: "#e8e4c9", printHex: "#e9e4d8", collection: "Field" })),
  dial({ id: "dial-midnight-diver", code: "D06", name: "Midnight sunburst · Diver", price: 1550 }, D({ colorName: "Midnight", colorHex: "#1c2a44", colorFamily: "blue", feet: "crown-3.8", markers: "dot", lume: true, lumeHex: "#eae6cf", printHex: "#e9e4d8", collection: "Diver" })),
  dial({ id: "dial-black-diver", code: "D07", name: "Black matte · Diver", price: 1400 }, D({ colorName: "Black", colorHex: "#1d1b1a", colorFamily: "dark", feet: "crown-3.8", texture: "matte", markers: "dot", lume: true, lumeHex: "#ece7cd", printHex: "#e9e4d8", collection: "Diver" })),
  dial({ id: "dial-black-diver-dd", code: "D08", name: "Black matte · Diver day-date", price: 1450 }, D({ colorName: "Black", colorHex: "#1d1b1a", colorFamily: "dark", feet: "crown-3.8", texture: "matte", markers: "dot", dateWindow: "day-date", lume: true, lumeHex: "#ece7cd", printHex: "#e9e4d8", collection: "Diver" })),
  dial({ id: "dial-stone-feetless", code: "D09", name: "Stone grained · No date", price: 1700, description: "Feetless: secured with dial spacers, so it fits either crown position." }, D({ colorName: "Stone", colorHex: "#b9b1a4", colorFamily: "grey", feet: "feetless", texture: "grained", dateWindow: "none", markers: "minimal", printHex: "#3a322e", collection: "Atelier" })),
  dial({ id: "dial-cognac-roman", code: "D10", name: "Cognac sunburst · Roman", price: 1650 }, D({ colorName: "Cognac", colorHex: "#7a4a2a", colorFamily: "brown", markers: "roman", markerTone: "gold", printHex: "#ead7b3", collection: "Atelier" })),
  dial({ id: "dial-porcelain-roman", code: "D11", name: "Porcelain lacquer · Roman", price: 1900 }, D({ colorName: "Porcelain", colorHex: "#f6f2ea", colorFamily: "light", texture: "lacquer", markers: "roman", dateWindow: "none", printHex: "#2e2926", collection: "Atelier" })),
  dial({ id: "dial-graphite-gmt", code: "D12", name: "Graphite sunburst · Diver", price: 1500 }, D({ colorName: "Graphite", colorHex: "#3d3f42", colorFamily: "grey", markers: "dot", lume: true, lumeHex: "#ece7cd", printHex: "#e9e4d8", collection: "Diver" })),
  dial({ id: "dial-sky-30", code: "D13", name: "Sky matte · 30 mm", price: 1600 }, D({ colorName: "Sky", colorHex: "#9db7c9", colorFamily: "blue", diameterMm: 30, texture: "matte", printHex: "#24313b" })),
  dial({ id: "dial-champagne-30", code: "D14", name: "Champagne sunburst · 30 mm", price: 1700 }, D({ colorName: "Champagne", colorHex: "#d8c39b", colorFamily: "light", diameterMm: 30, markerTone: "gold", printHex: "#4a3c2a" })),
  dial({ id: "dial-lacquer-black-30", code: "D15", name: "Black lacquer · 30 mm, no date", price: 1900 }, D({ colorName: "Lacquer", colorHex: "#141313", colorFamily: "dark", diameterMm: 30, texture: "lacquer", dateWindow: "none", markers: "minimal", printHex: "#e9e4d8" })),
  dial({ id: "dial-sage-30", code: "D16", name: "Sage linen · 30 mm", price: 1650 }, D({ colorName: "Sage", colorHex: "#8f9c84", colorFamily: "green", diameterMm: 30, texture: "linen", markers: "arabic", printHex: "#f3efe6", collection: "Field" })),
  dial({ id: "dial-pearl", code: "D17", name: "Pearl · No date", price: 2400, description: "A natural pearlescent surface; no two are alike.", stock: { status: "low", quantity: 2, leadTimeDays: null } }, D({ colorName: "Pearl", colorHex: "#eee9e4", colorFamily: "light", texture: "stone", dateWindow: "none", markers: "minimal", markerTone: "rose", printHex: "#6b5a52", collection: "Atelier" })),
  dial({ id: "dial-burgundy-diver", code: "D18", name: "Burgundy sunburst · Diver", price: 1550, stock: { status: "out_of_stock", quantity: 0, leadTimeDays: null } }, D({ colorName: "Burgundy", colorHex: "#5a1f26", colorFamily: "red", feet: "crown-3.8", markers: "dot", lume: true, lumeHex: "#ece7cd", printHex: "#ecdcd0", collection: "Diver" })),
];

/* ── Hands ────────────────────────────────────────────────────────────── */

const hands = (b: Base, s: SpecFor<"hands">) => make("hands", b, s);
const NH = ["nh35", "nh36", "nh38"];
const H = (s: Partial<SpecFor<"hands">> & Pick<SpecFor<"hands">, "style" | "tone">): SpecFor<"hands"> => ({
  lume: false,
  lumeHex: null,
  secondsHex: "#c9c6c0",
  secondsStyle: "stick",
  gmtHand: false,
  gmtHex: null,
  movementFamilies: NH,
  dialDiametersMm: [28.5, 30],
  ...s,
});

const handSets = [
  hands({ id: "hands-dauphine-steel", code: "H01", name: "Dauphine · Polished steel", price: 450 }, H({ style: "dauphine", tone: "steel" })),
  hands({ id: "hands-dauphine-gold", code: "H02", name: "Dauphine · Gold tone", price: 500 }, H({ style: "dauphine", tone: "gold", secondsHex: "#c2aa83" })),
  hands({ id: "hands-sword-lume", code: "H03", name: "Sword · Steel with lume", price: 450 }, H({ style: "sword", tone: "steel", lume: true, lumeHex: "#ece7cd" })),
  hands({ id: "hands-baton-lume", code: "H04", name: "Baton · Steel with lume", price: 400 }, H({ style: "baton", tone: "steel", lume: true, lumeHex: "#ece7cd", secondsStyle: "lollipop" })),
  hands({ id: "hands-cathedral", code: "H05", name: "Cathedral · Black with lume", price: 550, description: "Lengths verified on 28.5 mm dials only." }, H({ style: "cathedral", tone: "black", lume: true, lumeHex: "#e4d9b8", dialDiametersMm: [28.5], secondsHex: "#2a2624" })),
  hands({ id: "hands-syringe", code: "H06", name: "Syringe · Steel with lume", price: 500 }, H({ style: "syringe", tone: "steel", lume: true, lumeHex: "#ece7cd", dialDiametersMm: [28.5] })),
  hands({ id: "hands-pencil-rose", code: "H07", name: "Pencil · Rose tone", price: 500 }, H({ style: "pencil", tone: "rose", secondsHex: "#b98a72" })),
  hands({ id: "hands-leaf-blue", code: "H08", name: "Leaf · Blue tone", price: 550 }, H({ style: "leaf", tone: "blue", secondsHex: "#2f4a7a" })),
  hands({ id: "hands-arrow-lume", code: "H09", name: "Arrow · Steel with lume", price: 500 }, H({ style: "arrow", tone: "steel", lume: true, lumeHex: "#ece7cd", secondsStyle: "arrow", secondsHex: "#b5523b", dialDiametersMm: [28.5] })),
  hands({ id: "hands-gmt-sword", code: "H10", name: "GMT sword · Red GMT hand", price: 750 }, H({ style: "sword", tone: "steel", lume: true, lumeHex: "#ece7cd", gmtHand: true, gmtHex: "#a8402f", movementFamilies: ["nh34"], dialDiametersMm: [28.5] })),
  hands({ id: "hands-gmt-baton", code: "H11", name: "GMT baton · Champagne GMT hand", price: 800 }, H({ style: "baton", tone: "steel", lume: true, lumeHex: "#ece7cd", gmtHand: true, gmtHex: "#c2aa83", secondsStyle: "lollipop", movementFamilies: ["nh34"], dialDiametersMm: [28.5] })),
];

/* ── Bezels ───────────────────────────────────────────────────────────── */

const bezel = (b: Base, s: SpecFor<"bezel">) => make("bezel", b, s);
const bezels = [
  bezel({ id: "bezel-smooth-steel", code: "Z01", name: "Smooth polished · Steel", price: 450 }, { bezelSystem: "fixed", style: "smooth", tone: "steel", takesInsert: false, insertOuterMm: null, fitsCaseIds: ["case-dress-36", "case-petite-34", "case-field-39"] }),
  bezel({ id: "bezel-smooth-gold", code: "Z02", name: "Smooth polished · Gold tone", price: 650 }, { bezelSystem: "fixed", style: "smooth", tone: "gold", takesInsert: false, insertOuterMm: null, fitsCaseIds: ["case-dress-36-gold"] }),
  bezel({ id: "bezel-fluted-steel", code: "Z03", name: "Fluted · Steel", price: 900 }, { bezelSystem: "fixed", style: "fluted", tone: "steel", takesInsert: false, insertOuterMm: null, fitsCaseIds: ["case-dress-36", "case-field-39"] }),
  bezel({ id: "bezel-fluted-gold", code: "Z04", name: "Fluted · Gold tone", price: 1100 }, { bezelSystem: "fixed", style: "fluted", tone: "gold", takesInsert: false, insertOuterMm: null, fitsCaseIds: ["case-dress-36-gold"] }),
  bezel({ id: "bezel-coin-fixed", code: "Z05", name: "Coin edge · Steel", price: 650 }, { bezelSystem: "fixed", style: "coin-edge", tone: "steel", takesInsert: false, insertOuterMm: null, fitsCaseIds: ["case-field-39"] }),
  bezel({ id: "bezel-dive-coin", code: "Z06", name: "Dive bezel · Coin edge", price: 700, description: "Unidirectional, 120 clicks." }, { bezelSystem: "dive-120", style: "coin-edge", tone: "steel", takesInsert: true, insertOuterMm: 38, fitsCaseIds: [] }),
  bezel({ id: "bezel-dive-scalloped", code: "Z07", name: "Dive bezel · Scalloped", price: 750, description: "Unidirectional, 120 clicks, with a deeper grip." }, { bezelSystem: "dive-120", style: "scalloped", tone: "steel", takesInsert: true, insertOuterMm: 38, fitsCaseIds: [] }),
  bezel({ id: "bezel-dive-black", code: "Z08", name: "Dive bezel · Black coin edge", price: 850 }, { bezelSystem: "dive-120", style: "coin-edge", tone: "black", takesInsert: true, insertOuterMm: 38, fitsCaseIds: [] }),
];

const insert = (b: Base, s: SpecFor<"insert">) => make("insert", b, s);
const I = (s: Partial<SpecFor<"insert">> & Pick<SpecFor<"insert">, "colorHex">): SpecFor<"insert"> => ({
  outerMm: 38,
  scale: "dive-60",
  secondaryHex: null,
  numeralHex: "#ebe6da",
  material: "aluminium",
  lumePip: true,
  ...s,
});
const inserts = [
  insert({ id: "ins-black-alu", code: "I01", name: "Black aluminium · Dive", price: 350 }, I({ colorHex: "#1c1a19" })),
  insert({ id: "ins-navy-ceramic", code: "I02", name: "Navy ceramic · Dive", price: 950 }, I({ colorHex: "#1b2740", material: "ceramic" })),
  insert({ id: "ins-green-alu", code: "I03", name: "Forest aluminium · Dive", price: 400 }, I({ colorHex: "#22392c" })),
  insert({ id: "ins-tobacco-alu", code: "I04", name: "Tobacco aluminium · Dive", price: 400 }, I({ colorHex: "#5a4030", numeralHex: "#e8d8bd" })),
  insert({ id: "ins-cream-minimal", code: "I05", name: "Cream ceramic · Minimal", price: 950 }, I({ colorHex: "#e5ddcc", material: "ceramic", scale: "minimal", numeralHex: "#3a322e", lumePip: false })),
  insert({ id: "ins-gmt-wine-navy", code: "I06", name: "GMT · Wine and navy", price: 650, description: "24-hour scale. Reads a second time zone with a GMT movement; decorative otherwise." }, I({ colorHex: "#5b1f2a", secondaryHex: "#1c2a48", scale: "gmt-24" })),
  insert({ id: "ins-gmt-graphite", code: "I07", name: "GMT · Graphite and black", price: 650, description: "24-hour scale. Reads a second time zone with a GMT movement; decorative otherwise." }, I({ colorHex: "#55575b", secondaryHex: "#1b1a19", scale: "gmt-24" })),
];

/* ── Crystals ─────────────────────────────────────────────────────────── */

const crystal = (b: Base, s: SpecFor<"crystal">) => make("crystal", b, s);
const crystals = [
  crystal({ id: "cx-flat-295", code: "X01", name: "Flat sapphire · 29.5 mm", price: 550 }, { diameterMm: 29.5, profile: "flat", material: "sapphire", coating: "clear-ar", cyclops: false }),
  crystal({ id: "cx-flat-30", code: "X02", name: "Flat sapphire · 30 mm", price: 550 }, { diameterMm: 30, profile: "flat", material: "sapphire", coating: "clear-ar", cyclops: false }),
  crystal({ id: "cx-box-30", code: "X03", name: "Box sapphire · 30 mm", price: 950, description: "A raised, vintage-style profile." }, { diameterMm: 30, profile: "box", material: "sapphire", coating: "clear-ar", cyclops: false }),
  crystal({ id: "cx-flat-315", code: "X04", name: "Flat sapphire · 31.5 mm", price: 600 }, { diameterMm: 31.5, profile: "flat", material: "sapphire", coating: "clear-ar", cyclops: false }),
  crystal({ id: "cx-dome-315", code: "X05", name: "Double-dome sapphire · 31.5 mm", price: 850 }, { diameterMm: 31.5, profile: "double-dome", material: "sapphire", coating: "blue-ar", cyclops: false }),
  crystal({ id: "cx-cyclops-315", code: "X06", name: "Flat sapphire with date magnifier · 31.5 mm", price: 900 }, { diameterMm: 31.5, profile: "flat", material: "sapphire", coating: "clear-ar", cyclops: true }),
  crystal({ id: "cx-mineral-315", code: "X07", name: "Flat mineral · 31.5 mm", price: 300, discountEligible: false }, { diameterMm: 31.5, profile: "flat", material: "mineral", coating: "none", cyclops: false }),
  crystal({ id: "cx-dome-31", code: "X08", name: "Domed sapphire · 31 mm", price: 800 }, { diameterMm: 31, profile: "domed", material: "sapphire", coating: "clear-ar", cyclops: false }),
];

/* ── Chapter rings ───────────────────────────────────────────────────── */

const ring = (b: Base, s: SpecFor<"chapterRing">) => make("chapterRing", b, s);
const rings = [
  ring({ id: "cr-40-silver", code: "R01", name: "Silver minute track", price: 300 }, { size: "cr-40d", colorHex: "#c9c7c2", markings: "minute-track", printHex: "#2b2725" }),
  ring({ id: "cr-40-black", code: "R02", name: "Black minute track", price: 300 }, { size: "cr-40d", colorHex: "#1f1d1c", markings: "minute-track", printHex: "#e6e1d6" }),
  ring({ id: "cr-40-ivory", code: "R03", name: "Ivory plain", price: 280 }, { size: "cr-40d", colorHex: "#e9e2d3", markings: "plain", printHex: "#3a322e" }),
  ring({ id: "cr-39-steel", code: "R04", name: "Steel plain", price: 280 }, { size: "cr-39", colorHex: "#cfccc6", markings: "plain", printHex: "#3a322e" }),
  ring({ id: "cr-39-black-num", code: "R05", name: "Black with numerals", price: 380 }, { size: "cr-39", colorHex: "#22201f", markings: "numerals", printHex: "#e6e1d6" }),
];

/* ── Bracelets & straps ──────────────────────────────────────────────── */

const band = (b: Base, s: SpecFor<"band">) => make("band", b, s);
const DIVERS = ["case-diver-40", "case-diver-40-3", "case-voyager-40"];
const bands = [
  band({ id: "br-oyster-20", code: "S01", name: "Three-link bracelet · 20 mm", price: 2200, description: "Brushed outer links, polished centre. Fitted end links." }, { kind: "bracelet", style: "oyster", lugWidthMm: 20, claspWidthMm: 16, colorHex: "#c8c6c1", secondaryHex: null, stitchHex: null, tone: "steel", endLinks: "fitted", fitsCaseIds: DIVERS, claspInterface: "bracelet" }),
  band({ id: "br-jubilee-20", code: "S02", name: "Five-link bracelet · 20 mm", price: 2400, description: "Small polished centre links that catch light and drape softly." }, { kind: "bracelet", style: "jubilee", lugWidthMm: 20, claspWidthMm: 16, colorHex: "#c8c6c1", secondaryHex: null, stitchHex: null, tone: "steel", endLinks: "fitted", fitsCaseIds: [...DIVERS, "case-field-39"], claspInterface: "bracelet" }),
  band({ id: "br-beads-20", code: "S03", name: "Beads bracelet · 20 mm", price: 2000, description: "Rows of small polished links. Straight end links fit most 20 mm cases." }, { kind: "bracelet", style: "beads", lugWidthMm: 20, claspWidthMm: 18, colorHex: "#c8c6c1", secondaryHex: null, stitchHex: null, tone: "steel", endLinks: "straight", fitsCaseIds: [], claspInterface: "bracelet" }),
  band({ id: "br-mesh-20", code: "S04", name: "Milanese mesh · 20 mm", price: 1400, description: "Fine woven steel with an integrated sliding clasp." }, { kind: "bracelet", style: "mesh", lugWidthMm: 20, claspWidthMm: 20, colorHex: "#c8c6c1", secondaryHex: null, stitchHex: null, tone: "steel", endLinks: "straight", fitsCaseIds: [], claspInterface: "integrated" }),
  band({ id: "br-oyster-22-cushion", code: "S05", name: "Three-link bracelet · Cushion 22 mm", price: 2600, stock: { status: "made_to_order", quantity: null, leadTimeDays: 10 } }, { kind: "bracelet", style: "oyster", lugWidthMm: 22, claspWidthMm: 18, colorHex: "#c8c6c1", secondaryHex: null, stitchHex: null, tone: "steel", endLinks: "fitted", fitsCaseIds: ["case-cushion-40"], claspInterface: "bracelet" }),
  band({ id: "br-oyster-20-octagon", code: "S06", name: "Three-link bracelet · Octagon fitted", price: 2600 }, { kind: "bracelet", style: "oyster", lugWidthMm: 20, claspWidthMm: 16, colorHex: "#c8c6c1", secondaryHex: null, stitchHex: null, tone: "steel", endLinks: "fitted", fitsCaseIds: ["case-octagon-39"], claspInterface: "bracelet" }),
  band({ id: "st-leather-taupe-20", code: "S07", name: "Taupe leather · 20 mm", price: 950, description: "Smooth calf with tonal ivory stitching." }, { kind: "leather", style: "smooth", lugWidthMm: 20, claspWidthMm: 18, colorHex: "#766a5d", secondaryHex: null, stitchHex: "#e6dccb", tone: null, endLinks: "none", fitsCaseIds: [], claspInterface: "buckle" }),
  band({ id: "st-suede-mushroom-20", code: "S08", name: "Mushroom suede · 20 mm", price: 900 }, { kind: "leather", style: "suede", lugWidthMm: 20, claspWidthMm: 18, colorHex: "#a79b8c", secondaryHex: null, stitchHex: "#8d8173", tone: null, endLinks: "none", fitsCaseIds: [], claspInterface: "buckle" }),
  band({ id: "st-leather-espresso-18", code: "S09", name: "Espresso leather · 18 mm", price: 850 }, { kind: "leather", style: "smooth", lugWidthMm: 18, claspWidthMm: 16, colorHex: "#3a2c25", secondaryHex: null, stitchHex: "#3a2c25", tone: null, endLinks: "none", fitsCaseIds: [], claspInterface: "buckle" }),
  band({ id: "st-leather-ivory-18", code: "S10", name: "Ivory leather · 18 mm", price: 900 }, { kind: "leather", style: "smooth", lugWidthMm: 18, claspWidthMm: 16, colorHex: "#ece4d6", secondaryHex: null, stitchHex: "#d8ccb8", tone: null, endLinks: "none", fitsCaseIds: [], claspInterface: "buckle" }),
  band({ id: "st-leather-cognac-22", code: "S11", name: "Cognac leather · 22 mm", price: 1000 }, { kind: "leather", style: "smooth", lugWidthMm: 22, claspWidthMm: 20, colorHex: "#8a5532", secondaryHex: null, stitchHex: "#e6d4b8", tone: null, endLinks: "none", fitsCaseIds: [], claspInterface: "buckle" }),
  band({ id: "st-rubber-tropic-20", code: "S12", name: "Tropic rubber · 20 mm", price: 750, description: "A basket-weave texture with good grip and airflow." }, { kind: "rubber", style: "tropic", lugWidthMm: 20, claspWidthMm: 20, colorHex: "#1e1d1c", secondaryHex: null, stitchHex: null, tone: null, endLinks: "none", fitsCaseIds: [], claspInterface: "buckle" }),
  band({ id: "st-fkm-navy-22", code: "S13", name: "Navy FKM rubber · 22 mm", price: 950 }, { kind: "rubber", style: "fkm", lugWidthMm: 22, claspWidthMm: 20, colorHex: "#1f2b43", secondaryHex: null, stitchHex: null, tone: null, endLinks: "none", fitsCaseIds: [], claspInterface: "buckle" }),
  band({ id: "st-nato-olive-20", code: "S14", name: "Olive and stone fabric · 20 mm", price: 450, description: "A single-pass woven strap with its own buckle." }, { kind: "fabric", style: "nato", lugWidthMm: 20, claspWidthMm: 20, colorHex: "#4e5136", secondaryHex: "#c5b9a6", stitchHex: null, tone: null, endLinks: "none", fitsCaseIds: [], claspInterface: "integrated" }),
  band({ id: "st-sail-navy-20", code: "S15", name: "Navy sailcloth · 20 mm", price: 650 }, { kind: "fabric", style: "sailcloth", lugWidthMm: 20, claspWidthMm: 18, colorHex: "#26324a", secondaryHex: null, stitchHex: "#cfc7b8", tone: null, endLinks: "none", fitsCaseIds: [], claspInterface: "buckle" }),
  band({ id: "st-nato-wine-18", code: "S16", name: "Wine and ivory fabric · 18 mm", price: 450 }, { kind: "fabric", style: "nato", lugWidthMm: 18, claspWidthMm: 18, colorHex: "#5b2430", secondaryHex: "#ece4d6", stitchHex: null, tone: null, endLinks: "none", fitsCaseIds: [], claspInterface: "integrated" }),
];

/* ── Clasps & buckles ────────────────────────────────────────────────── */

const clasp = (b: Base, s: SpecFor<"clasp">) => make("clasp", b, s);
const clasps = [
  clasp({ id: "cl-fold-16", code: "K01", name: "Fold-over clasp · 16 mm", price: 450 }, { interface: "bracelet", style: "fold-over", widthMm: 16, tone: "steel" }),
  clasp({ id: "cl-glide-16", code: "K02", name: "Glide-adjust clasp · 16 mm", price: 900, description: "Fine-adjusts length without tools." }, { interface: "bracelet", style: "glide-lock", widthMm: 16, tone: "steel" }),
  clasp({ id: "cl-fold-18", code: "K03", name: "Fold-over clasp · 18 mm", price: 450 }, { interface: "bracelet", style: "fold-over", widthMm: 18, tone: "steel" }),
  clasp({ id: "bk-tang-16", code: "K04", name: "Tang buckle · 16 mm steel", price: 250 }, { interface: "buckle", style: "tang-buckle", widthMm: 16, tone: "steel" }),
  clasp({ id: "bk-tang-16-gold", code: "K05", name: "Tang buckle · 16 mm gold tone", price: 300 }, { interface: "buckle", style: "tang-buckle", widthMm: 16, tone: "gold" }),
  clasp({ id: "bk-tang-18", code: "K06", name: "Tang buckle · 18 mm steel", price: 250 }, { interface: "buckle", style: "tang-buckle", widthMm: 18, tone: "steel" }),
  clasp({ id: "bk-deploy-18", code: "K07", name: "Deployant clasp · 18 mm", price: 650, description: "Folds closed so the strap is never pulled through a keeper." }, { interface: "buckle", style: "deployant", widthMm: 18, tone: "steel" }),
  clasp({ id: "bk-tang-20", code: "K08", name: "Tang buckle · 20 mm steel", price: 280 }, { interface: "buckle", style: "tang-buckle", widthMm: 20, tone: "steel" }),
  clasp({ id: "bk-tang-20-black", code: "K09", name: "Tang buckle · 20 mm black", price: 320 }, { interface: "buckle", style: "tang-buckle", widthMm: 20, tone: "black" }),
];

/* ── Casebacks ───────────────────────────────────────────────────────── */

const caseback = (b: Base, s: SpecFor<"caseback">) => make("caseback", b, s);
const casebacks = [
  caseback({ id: "cb-34-solid", code: "B01", name: "Solid steel · Petite", price: 300 }, { kind: "solid", fit: "cb-34", engravable: true, engraveMaxChars: 24, tone: "steel" }),
  caseback({ id: "cb-36-solid", code: "B02", name: "Solid steel · Dress", price: 300 }, { kind: "solid", fit: "cb-36", engravable: true, engraveMaxChars: 30, tone: "steel" }),
  caseback({ id: "cb-36-display", code: "B03", name: "Display sapphire · Dress", price: 750, description: "Shows the movement through a sapphire window." }, { kind: "exhibition", fit: "cb-36", engravable: false, engraveMaxChars: 0, tone: "steel" }),
  caseback({ id: "cb-39-solid", code: "B04", name: "Solid steel · Field", price: 300 }, { kind: "solid", fit: "cb-39", engravable: true, engraveMaxChars: 30, tone: "steel" }),
  caseback({ id: "cb-39-display", code: "B05", name: "Display sapphire · Field", price: 750 }, { kind: "exhibition", fit: "cb-39", engravable: false, engraveMaxChars: 0, tone: "steel" }),
  caseback({ id: "cb-40-solid", code: "B06", name: "Solid steel · Diver", price: 350 }, { kind: "solid", fit: "cb-40d", engravable: true, engraveMaxChars: 30, tone: "steel" }),
  caseback({ id: "cb-40-display", code: "B07", name: "Display sapphire · Diver", price: 800 }, { kind: "exhibition", fit: "cb-40d", engravable: false, engraveMaxChars: 0, tone: "steel" }),
  caseback({ id: "cb-c40-solid", code: "B08", name: "Solid steel · Cushion", price: 350 }, { kind: "solid", fit: "cb-c40", engravable: true, engraveMaxChars: 30, tone: "steel" }),
  caseback({ id: "cb-o39-solid", code: "B09", name: "Solid steel · Octagon", price: 350 }, { kind: "solid", fit: "cb-o39", engravable: true, engraveMaxChars: 30, tone: "steel" }),
  caseback({ id: "cb-o39-display", code: "B10", name: "Display sapphire · Octagon", price: 850 }, { kind: "exhibition", fit: "cb-o39", engravable: false, engraveMaxChars: 0, tone: "steel" }),
];

export const components: Component[] = [
  ...movements,
  ...cases,
  ...dials,
  ...handSets,
  ...bezels,
  ...inserts,
  ...crystals,
  ...rings,
  ...bands,
  ...clasps,
  ...casebacks,
];

/** Atelier-recorded pairings that override attribute rules. */
export const compat: CompatRecord[] = [
  {
    id: "cr-nh34-voyager",
    aId: "mv-nh34-white-3",
    bId: "case-voyager-40",
    status: "compatible",
    note: "Fitted and hand clearance checked in the atelier.",
    source: "atelier-tested",
    updatedAt: T0,
  },
  {
    id: "cr-cathedral-cyclops",
    aId: "hands-cathedral",
    bId: "cx-cyclops-315",
    status: "unconfirmed",
    note: "Hour-hand clearance under the magnifier has not been checked.",
    source: "atelier-tested",
    updatedAt: T0,
  },
];

/** The configuration the builder opens with: a complete, compatible watch. */
export const STARTER_PARTS = {
  movement: "mv-nh35-white-3",
  dial: "dial-ivory-date",
  case: "case-field-39",
  hands: "hands-dauphine-steel",
  bezel: "bezel-smooth-steel",
  crystal: "cx-flat-315",
  chapterRing: "cr-39-steel",
  band: "st-leather-taupe-20",
  clasp: "bk-tang-18",
  caseback: "cb-39-solid",
} as const;
