import type { Auction } from "@/domain/auction";
import type { Configuration } from "@/domain/configuration";
import type { Collection, Product } from "@/domain/models";
import type { Content, Settings } from "@/domain/settings";
import { components } from "./components";

/** SAMPLE DATA — development seed. Replace through the admin before launch. */

const T0 = "2026-10-01T09:00:00.000Z";

function cfg(parts: Configuration["parts"]): Configuration {
  return { parts, engraving: null, options: [] };
}

/** Product price = component prices + assembly, rounded to the nearest EGP 50. */
function priceFor(c: Configuration, assemblyMinor: number): number {
  const sum = Object.values(c.parts).reduce((acc, id) => acc + (components.find((x) => x.id === id)?.priceMinor ?? 0), 0);
  return Math.round((sum + assemblyMinor) / 5000) * 5000;
}

export const ASSEMBLY_MINOR = 150_000;

export const collections: Collection[] = [
  { id: "col-01", slug: "collection-01", name: "Collection 01", description: "The first compositions from the atelier.", sortOrder: 1 },
  { id: "col-dress", slug: "dress", name: "Dress", description: "Slim, polished, quiet.", sortOrder: 2 },
  { id: "col-tool", slug: "tool", name: "Tool", description: "Rotating bezels, lume and steel bracelets.", sortOrder: 3 },
  { id: "col-travel", slug: "travel", name: "Travel", description: "A second time zone.", sortOrder: 4 },
];

type ProductSeed = Pick<Product, "id" | "slug" | "name" | "dialLabel" | "subtitle" | "description" | "collectionIds" | "configuration"> &
  Partial<Product>;

function product(p: ProductSeed, i: number): Product {
  return {
    compareAtMinor: null,
    priceMinor: priceFor(p.configuration, ASSEMBLY_MINOR),
    images: [],
    extraSpecs: [],
    stockQuantity: 1,
    status: "active",
    releaseAt: null,
    featured: false,
    soldOut: false,
    allowCustomization: true,
    maxPerOrder: 1,
    seo: { title: `${p.name} · ${p.dialLabel} — NIVORÉ`, description: p.subtitle },
    sortOrder: i * 10,
    createdAt: T0,
    updatedAt: T0,
    ...p,
  };
}

export const products: Product[] = [
  product(
    {
      id: "p-alba-36-ivory",
      slug: "alba-36-ivory",
      name: "ALBA 36",
      dialLabel: "Ivory",
      subtitle: "A 36 mm polished steel case, an ivory sunburst dial and slim dauphine hands on espresso leather.",
      description:
        "A 36 mm polished steel case with an ivory sunburst dial and slim polished dauphine hands, fitted on a soft espresso leather strap. Built in our atelier around a third-party automatic movement, named on its certificate.",
      collectionIds: ["col-01", "col-dress"],
      featured: true,
      stockQuantity: 2,
      configuration: cfg({ movement: "mv-nh35-white-3", dial: "dial-ivory-date", case: "case-dress-36", hands: "hands-dauphine-steel", bezel: "bezel-smooth-steel", crystal: "cx-flat-30", band: "st-leather-espresso-18", clasp: "bk-tang-16", caseback: "cb-36-solid" }),
    },
    1,
  ),
  product(
    {
      id: "p-notte-40-black",
      slug: "notte-40-black",
      name: "NOTTE 40",
      dialLabel: "Black",
      subtitle: "A 40 mm rotating-bezel case, matte black dial with lume, on a three-link steel bracelet.",
      description:
        "A 40 mm brushed and polished steel case with a guarded crown at 4 o'clock, a matte black dial with applied lume and a black aluminium dive insert. Fitted on a three-link bracelet with a glide-adjust clasp, and a display caseback to show the movement.",
      collectionIds: ["col-01", "col-tool"],
      featured: true,
      configuration: cfg({ movement: "mv-nh35-white-38", dial: "dial-black-diver", case: "case-diver-40", hands: "hands-sword-lume", bezel: "bezel-dive-coin", insert: "ins-black-alu", crystal: "cx-dome-315", chapterRing: "cr-40-black", band: "br-oyster-20", clasp: "cl-glide-16", caseback: "cb-40-display" }),
    },
    2,
  ),
  product(
    {
      id: "p-alba-40-gmt-graphite",
      slug: "alba-40-gmt-graphite",
      name: "ALBA 40 GMT",
      dialLabel: "Graphite",
      subtitle: "A four-hand GMT in a 40 mm travel case, with a wine and navy 24-hour insert on a five-link bracelet.",
      description:
        "A graphite sunburst dial and a red-tipped GMT hand that tracks a second time zone against a wine and navy 24-hour insert. The movement is ordered in for each build, so allow for its lead time.",
      collectionIds: ["col-01", "col-travel"],
      featured: true,
      configuration: cfg({ movement: "mv-nh34-white-3", dial: "dial-graphite-gmt", case: "case-voyager-40", hands: "hands-gmt-sword", bezel: "bezel-dive-coin", insert: "ins-gmt-wine-navy", crystal: "cx-cyclops-315", chapterRing: "cr-40-silver", band: "br-jubilee-20", clasp: "cl-fold-16", caseback: "cb-40-solid" }),
    },
    3,
  ),
  product(
    {
      id: "p-sera-36-cognac",
      slug: "sera-36-cognac",
      name: "SERA 36",
      dialLabel: "Cognac",
      subtitle: "A gold-tone 36 mm case, cognac sunburst dial with Roman numerals and a fluted bezel.",
      description:
        "Warm and evening-minded: a cognac sunburst dial with printed Roman numerals and gold-tone dauphine hands under a box sapphire crystal, framed by a fluted gold-tone bezel.",
      collectionIds: ["col-01", "col-dress"],
      configuration: cfg({ movement: "mv-nh35-white-3", dial: "dial-cognac-roman", case: "case-dress-36-gold", hands: "hands-dauphine-gold", bezel: "bezel-fluted-gold", crystal: "cx-box-30", band: "st-leather-espresso-18", clasp: "bk-tang-16-gold", caseback: "cb-36-solid" }),
    },
    4,
  ),
  product(
    {
      id: "p-alba-34-pearl",
      slug: "alba-34-pearl",
      name: "ALBA 34",
      dialLabel: "Pearl",
      subtitle: "A 34 mm polished case with a natural pearlescent dial and rose-tone pencil hands, no date.",
      description:
        "A compact 34 mm case with a pearlescent dial that shifts with the light, and rose-tone pencil hands. Time only, on ivory leather. Every pearl dial is slightly different from the photograph.",
      collectionIds: ["col-01", "col-dress"],
      featured: true,
      configuration: cfg({ movement: "mv-nh38", dial: "dial-pearl", case: "case-petite-34", hands: "hands-pencil-rose", bezel: "bezel-smooth-steel", crystal: "cx-flat-295", band: "st-leather-ivory-18", clasp: "bk-tang-16", caseback: "cb-34-solid" }),
    },
    5,
  ),
  product(
    {
      id: "p-meridiana-40-sky",
      slug: "meridiana-40-sky",
      name: "MERIDIANA 40",
      dialLabel: "Sky",
      subtitle: "A brushed cushion case with an integrated bezel and a pale sky dial, on a 22 mm bracelet.",
      description:
        "A softened-square case that wears smaller than its 40 mm width, a matte sky dial with lumed batons, and a three-link bracelet cut for the cushion profile.",
      collectionIds: ["col-01"],
      configuration: cfg({ movement: "mv-nh35-white-3", dial: "dial-sky-30", case: "case-cushion-40", hands: "hands-baton-lume", crystal: "cx-dome-31", band: "br-oyster-22-cushion", clasp: "cl-fold-18", caseback: "cb-c40-solid" }),
    },
    6,
  ),
  product(
    {
      id: "p-notte-39-lacquer",
      slug: "notte-39-lacquer",
      name: "NOTTE 39",
      dialLabel: "Lacquer",
      subtitle: "An octagonal 39 mm case with a black lacquer dial, time only.",
      description:
        "Eight brushed facets and polished chamfers around a deep black lacquer dial, with nothing on it but the hours. A display caseback shows the movement.",
      collectionIds: ["col-01"],
      configuration: cfg({ movement: "mv-nh38", dial: "dial-lacquer-black-30", case: "case-octagon-39", hands: "hands-dauphine-steel", crystal: "cx-flat-315", band: "br-oyster-20-octagon", clasp: "cl-fold-16", caseback: "cb-o39-display" }),
    },
    7,
  ),
];

/* ── Auctions (demonstration mode, no bids) ──────────────────────────── */

export function seedAuctions(now: Date): Auction[] {
  const iso = (days: number) => new Date(now.getTime() + days * 86_400_000).toISOString();
  const base = {
    images: [],
    reserveMinor: null,
    antiSnipe: { enabled: true, windowMinutes: 5, extendMinutes: 5 },
    adminStatus: "scheduled" as const,
    mode: "demonstration" as const,
    published: true,
    currentBidMinor: 0,
    bidCount: 0,
    leadingBidderId: null,
    winner: null,
    terms: "",
    version: 0,
    archived: false,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
  return [
    {
      ...base,
      id: "auc-01",
      slug: "n01-notte-40-burgundy",
      title: "N° 01 · SERA 40",
      subtitle: "A one-of-one in burgundy and tobacco",
      description:
        "A single build from the atelier: a burgundy sunburst dial that leans brown in shade, a tobacco dive insert, and a scalloped bezel. It will not be repeated in this combination. Shown here as an illustration until the piece is photographed.",
      specs: [
        { label: "Movement", value: "TMI NH35A, 3.8 crown, white date" },
        { label: "Case", value: "Diver 40, brushed and polished steel" },
        { label: "Dial", value: "Burgundy sunburst, applied lume" },
        { label: "Bezel", value: "Scalloped, tobacco aluminium insert" },
        { label: "Bracelet", value: "Five-link steel, fold-over clasp" },
      ],
      previewBuild: "b=M3.D18.C5.H09.Z07.I04.X05.R01.S02.K01.B07",
      startingBidMinor: 1_400_000,
      incrementMinor: 50_000,
      opensAt: iso(-1),
      closesAt: iso(5),
    },
    {
      ...base,
      id: "auc-02",
      slug: "n02-alba-34-stone",
      title: "N° 02 · ALBA 34",
      subtitle: "Stone dial, time only",
      description:
        "A feetless stone-grained dial in the Petite 34 case, with blue-tone leaf hands. Opening for bids soon.",
      specs: [
        { label: "Movement", value: "TMI NH38A, no date" },
        { label: "Case", value: "Petite 34, polished steel" },
        { label: "Dial", value: "Stone grained, feetless" },
        { label: "Hands", value: "Leaf, blue tone" },
        { label: "Strap", value: "Ivory leather, 18 mm" },
      ],
      previewBuild: "b=M6.D09.C1.H08.Z01.X01.S10.K04.B01",
      startingBidMinor: 1_100_000,
      incrementMinor: 50_000,
      opensAt: iso(10),
      closesAt: iso(17),
    },
  ];
}

/* ── Settings ─────────────────────────────────────────────────────────── */

export const settings: Settings = {
  business: {
    displayName: "NIVORÉ Timepieces",
    email: null,
    phone: null,
    whatsapp: null,
    instagram: null,
    city: "Egypt",
    hours: null,
    replyWithinDays: null,
    assemblyLeadTime: null,
  },
  payments: {
    cod: { enabled: true, note: "Pay in cash when your watch is delivered." },
    cop: { enabled: false, note: "Pay in cash when you collect from the atelier." },
    instapay: {
      enabled: true,
      handle: "sample-handle@instapay",
      accountName: "SAMPLE — replace in Settings",
      instructions:
        "Send the order total by InstaPay to the address shown, then enter the transfer reference below. Your order stays pending until the atelier confirms the money has arrived.",
      evidenceUploadEnabled: true,
    },
  },
  shipping: {
    delivery: {
      enabled: true,
      defaultMinor: 15_000,
      byGovernorate: { Cairo: 10_000, Giza: 10_000 },
      freeOverMinor: null,
      note: "Sample rates. Replace with your courier's rates before launch.",
    },
    pickup: { enabled: false, location: "", note: "" },
  },
  pricing: {
    assemblyMinor: ASSEMBLY_MINOR,
    engraving: {
      enabled: true,
      priceMinor: 40_000,
      maxChars: 30,
      note: "Confirm the atelier can provide caseback engraving before launch, or switch this off.",
    },
    options: [
      { id: "handwritten-card", name: "Handwritten card", description: "A short note from you, written by the atelier and placed in the box.", priceMinor: 0, enabled: true },
      { id: "special-finish", name: "Special finishing", description: "Example only. Describe a finishing service you actually provide before enabling.", priceMinor: 120_000, enabled: false },
    ],
    promos: [
      { code: "ATELIER-PREVIEW", label: "Preview code (sample)", kind: "percent", value: 500, appliesTo: "all", minSubtotalMinor: 0, startsAt: null, endsAt: null, active: true, usageLimit: null, usedCount: 0 },
    ],
    tax: { enabled: false, rateBp: 1400, label: "VAT" },
    maxCustomQuantity: 1,
  },
  storefront: {
    mode: "live",
    launchAt: null,
    countdownVisible: true,
    headline: "Collection 01. Composed one at a time.",
    subheadline: "An independent atelier in Egypt, composing automatic watches part by part.",
    announcement: "",
    backgroundImage: null,
    waitlistEnabled: true,
    maintenanceMessage: "We are adjusting a few details and will be back shortly.",
    checkoutLocked: false,
    checkoutLockedMessage: "Ordering is paused for a moment. You can still compose and save your watch.",
    biddingLocked: false,
    accessCodes: [],
  },
  notifications: { emailProvider: "none", orderAlertsTo: null, customerConfirmations: false },
  seo: {
    title: "NIVORÉ Timepieces — Defined by Detail.",
    description: "An independent watch atelier in Egypt. Compose your own automatic watch, part by part, or choose a finished NIVORÉ build.",
  },
  policies: {
    shipping: { title: "Shipping", body: null, updatedAt: null },
    returns: { title: "Returns & cancellations", body: null, updatedAt: null },
    care: {
      title: "Caring for your timepiece",
      body:
        "Wear it often; an automatic movement winds as you move.\n\nUnless your documentation states otherwise, keep it away from water.\n\nAvoid strong magnetic fields and hard knocks.\n\nHave it serviced by a qualified watchmaker.",
      updatedAt: T0,
    },
    privacy: { title: "Privacy", body: null, updatedAt: null },
    terms: { title: "Terms & conditions", body: null, updatedAt: null },
    "auction-terms": { title: "Private auction terms", body: null, updatedAt: null },
  },
  previewNotice: true,
  allowInternationalPhones: false,
};

/* ── Content (Brand Book voice: precise, warm, calm, honest) ──────────── */

export const content: Content = {
  banner: { enabled: false, text: "", href: null },
  hero: {
    eyebrow: "Atelier · Collection 01",
    headline: "Defined by Detail.",
    body: "Automatic watches composed one part at a time in our atelier in Egypt. Choose a finished piece, or compose your own.",
    image: null,
    imageAlt: "",
  },
  intro: {
    headline: "An independent atelier for considered timepieces.",
    body:
      "NIVORÉ builds automatic watches one at a time, selecting each case, dial, hand set and strap for how they work together on the wrist.",
    body2:
      "Our pieces are custom builds around proven third-party automatic movements and selected aftermarket components. We name every part, and we never claim what we have not earned.",
  },
  process: [
    { title: "Choose a movement", body: "Date, day-date, time only or a second time zone. We explain each in plain words." },
    { title: "Compose the watch", body: "Dial, case, hands, bezel and strap. Only parts that fit together are offered." },
    { title: "We assemble it", body: "Your watch is assembled and checked in the atelier, then presented with its certificate of composition." },
  ],
  craft: {
    eyebrow: "The quiet part of the work",
    headline: "Every part is chosen for how it sits beside the others.",
    points: [
      { title: "Proportion", body: "Case diameter, lug-to-lug and hand length are recorded for every part, and the builder draws them to scale." },
      { title: "Honesty", body: "Movements and components are named as supplied by their makers. Nothing is described as more than it is." },
      { title: "Restraint", body: "We add only what improves the piece. Fewer details, each given full attention." },
    ],
  },
  packaging: {
    headline: "Presented as carefully as it was made.",
    body: "A cream rigid box with a taupe lining, an ivory sleeve, and a certificate of composition listing every part of your watch.",
    image: null,
  },
  ordering: [
    { title: "Order", body: "Add a finished piece or your composition to the bag. No account is needed." },
    { title: "Pay", body: "Cash on delivery or InstaPay transfer. Transfers are confirmed by the atelier by hand." },
    { title: "Assembly", body: "We prepare the components and assemble your watch. You can check its status at any time." },
    { title: "Delivery", body: "Your watch is delivered across Egypt, with its certificate and care card." },
  ],
  featuredProductIds: ["p-alba-36-ivory", "p-notte-40-black", "p-alba-34-pearl"],
  featuredAuctionId: "auc-01",
  collectionBanner: {
    headline: "Timepieces",
    body: "Finished compositions from the atelier. Each can be ordered as it is, or opened in the builder and made your own.",
  },
  atelier: {
    headline: "We believe a watch should be noticed slowly.",
    paragraphs: [
      "In the balance of a dial. In the weight of a crown under the thumb. In a strap that softens with wear.",
      "NIVORÉ is an independent watch atelier based in Egypt. We build automatic timepieces one at a time, selecting each case, dial, hand set and strap for how they work together on the wrist.",
      "Our watches are custom builds around proven third-party automatic movements and aftermarket components. NIVORÉ is independent and is not affiliated with, or endorsed by, the makers of those movements.",
      "We choose fewer details and give each one our full attention. We make watches for people, not for a type of person.",
    ],
    values: [
      { title: "Proportion", body: "Every element is sized against the others, from case diameter to the width of a hand." },
      { title: "Honesty", body: "We name movements and components clearly and never claim what we have not earned." },
      { title: "Restraint", body: "We add only what improves the piece." },
      { title: "Intimacy", body: "Each watch is assembled for one wearer. Conversation comes before transaction." },
      { title: "Openness", body: "Designed for every wrist. Collections are defined by size and character, never gender." },
    ],
  },
  faq: [
    { q: "Is NIVORÉ affiliated with Seiko?", a: "No. NIVORÉ is an independent watch-modification atelier. We build watches around third-party movements and aftermarket components, and we are not affiliated with, authorised by, or endorsed by Seiko or any movement maker." },
    { q: "What is a custom or modified watch?", a: "A watch assembled from individually chosen parts: a movement, dial, case, hands, crystal, bezel and strap. We select each part and assemble the watch in our atelier." },
    { q: "Do I need an account to compose a watch?", a: "No. You can compose, save on this device, share a link and order as a guest." },
    { q: "How does the builder know parts fit?", a: "Every part has recorded measurements and fitments. The builder only offers parts that fit together, and parts whose fit has not been confirmed are not offered until we check them." },
    { q: "How do I pay?", a: "Cash on delivery, or an InstaPay transfer. InstaPay orders stay pending until we confirm the transfer has arrived. We never ask for card details." },
    { q: "What warranty is offered?", a: "Our warranty terms are being finalised and will be published here before we accept orders. Please ask us if you need details now." },
    { q: "Is my watch water resistant?", a: "Unless your documentation states otherwise, keep it away from water. We do not quote water-resistance figures that we have not tested." },
  ],
  footer: {
    tagline: "Defined by Detail.",
    disclosure:
      "NIVORÉ is an independent watch atelier. Our watches are built around third-party automatic movements and aftermarket components, named as supplied by their makers. NIVORÉ is not affiliated with or endorsed by any movement maker, including Seiko.",
  },
  announcement: { enabled: false, headline: "", body: "" },
};
