import type { Auction } from "@/domain/auction";
import type { Collection, Product } from "@/domain/models";
import type { Content, Settings } from "@/domain/settings";

/** SAMPLE DATA — development seed. Replace through the admin before launch. */

const T0 = "2026-10-01T09:00:00.000Z";

export const ASSEMBLY_MINOR = 150_000;

export const collections: Collection[] = [{ id: "col-01", slug: "collection-01", name: "Collection 01", description: "The first compositions from the atelier.", sortOrder: 1 }];

/**
 * Finished pieces, one per photo in public/products (source: incoming-images/watches/06_finished_watches).
 * TODO: the brief left names, prices and descriptions as placeholders. Names below are working names taken
 * from what each photo shows; prices are 0 ("Price to be announced", not orderable) until set in Admin → Products.
 * Pieces 3 and 4 have no photo yet, so they stay as hidden drafts.
 */
function product(p: Pick<Product, "id" | "slug" | "name" | "movement"> & Partial<Product>, i: number, photo: string | null, alt: string): Product {
  return {
    dialLabel: "",
    subtitle: `${p.movement}.`,
    description: "Description to come.",
    collectionIds: ["col-01"],
    priceMinor: 0, // TODO price
    compareAtMinor: null,
    images: photo ? [{ src: photo, alt, width: 1122, height: 1402 }] : [],
    extraSpecs: [],
    stockQuantity: 1,
    status: photo ? "active" : "draft",
    releaseAt: null,
    featured: Boolean(photo),
    soldOut: false,
    maxPerOrder: 1,
    seo: { title: `${p.name} — NIVORÉ`, description: `${p.movement}. An independent NIVORÉ build.` },
    sortOrder: i * 10,
    createdAt: T0,
    updatedAt: T0,
    ...p,
  };
}

export const products: Product[] = [
  product({ id: "p-baby-blue", slug: "baby-blue", name: "Baby Blue", movement: "NH35 automatic" }, 1, "/products/product_1_diver.webp", "A baby-blue dial watch on a steel bracelet, on a watchmaker's bench"),
  product({ id: "p-gmt", slug: "gmt", name: "GMT", movement: "NH34 GMT automatic" }, 2, "/products/product_2_gmt.webp", "A red and black 24-hour bezel GMT watch on a steel bracelet, on a watchmaker's bench"),
  product({ id: "p-chocolate", slug: "chocolate", name: "Chocolate", movement: "NH35 automatic" }, 3, null, ""),
  product({ id: "p-wave-diver", slug: "wave-diver", name: "Wave Diver", movement: "NH35 automatic" }, 4, null, ""),
  product({ id: "p-panda-chrono", slug: "panda-chrono", name: "Panda Chrono", movement: "VK63 chronograph (mecha-quartz)" }, 5, "/products/product_5_panda_chrono.webp", "A white-dial chronograph with black sub-dials on a steel bracelet, on a watchmaker's bench"),
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
      slug: "n01-skx-42-navy",
      title: "N° 01 · SKX 42",
      subtitle: "A one-of-one in navy and brown leather",
      description:
        "A single build from the atelier: a navy sunburst dial with applied lume under a black dive bezel, on a brown leather strap. It will not be repeated in this combination. Shown here as an illustration until the piece is photographed.",
      specs: [
        { label: "Movement", value: "NH35 automatic, date" },
        { label: "Case", value: "SKX 42, steel" },
        { label: "Dial", value: "Navy sunburst, applied lume" },
        { label: "Bezel", value: "Black dive insert, 60 minutes" },
        { label: "Strap", value: "Brown leather, 22 mm" },
      ],
      previewBuild: "SKX.case_SKX_steel.bezel_SKX_dive_black.dial_SKX_navy.hands_SKX_mercedes.strap_SKX_leather_brown",
      startingBidMinor: 1_400_000,
      incrementMinor: 50_000,
      opensAt: iso(-1),
      closesAt: iso(5),
    },
    {
      ...base,
      id: "auc-02",
      slug: "n02-skx-42-silver",
      title: "N° 02 · SKX 42",
      subtitle: "Silver sector dial on a 5-link bracelet",
      description: "A silver sector dial under a black dive bezel, on a 5-link steel bracelet. Opening for bids soon.",
      specs: [
        { label: "Movement", value: "NH35 automatic, date" },
        { label: "Case", value: "SKX 42, steel" },
        { label: "Dial", value: "Silver sector" },
        { label: "Bezel", value: "Black dive insert, 60 minutes" },
        { label: "Bracelet", value: "5-link steel, 22 mm" },
      ],
      previewBuild: "SKX.case_SKX_steel.bezel_SKX_dive_black.dial_SKX_silver.hands_SKX_mercedes.bracelet_SKX_jubilee_steel",
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
    image: "/products/product_2_gmt.webp",
    imageAlt: "A red and black GMT watch on a steel bracelet, on a watchmaker's bench",
  },
  intro: {
    headline: "An independent atelier for considered timepieces.",
    body:
      "NIVORÉ builds automatic watches one at a time, selecting each case, dial, hand set and strap for how they work together on the wrist.",
    body2:
      "Our pieces are custom builds around proven third-party automatic movements and selected aftermarket components. We name every part, and we never claim what we have not earned.",
  },
  process: [
    { title: "Choose a movement", body: "Date, time only or a second time zone. The movement is fixed by the model you choose." },
    { title: "Compose the watch", body: "Case, bezel, dial, hands and strap. Only parts made for the model you chose are offered." },
    { title: "We assemble it", body: "Your watch is assembled and checked in the atelier, then presented with its certificate of composition." },
  ],
  craft: {
    eyebrow: "The quiet part of the work",
    headline: "Every part is chosen for how it sits beside the others.",
    points: [
      { title: "Proportion", body: "Every part is photographed at its real size, so the builder shows how the pieces sit together." },
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
  featuredProductIds: ["p-baby-blue", "p-gmt", "p-panda-chrono"],
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
