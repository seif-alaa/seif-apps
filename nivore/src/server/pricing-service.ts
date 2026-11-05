import "server-only";
import { isProductVisible, type CheckoutItem, type ComponentSnapshot, type Product } from "@/domain/models";
import { WELCOME_BASIS_POINTS, WELCOME_CODE } from "@/domain/contact";
import { computeTotals, type Promo, type QuoteLine, type Totals } from "@/domain/pricing";
import type { Settings } from "@/domain/settings";
import { buildName, buildReference, encodeBuild, handsPrice, layersOf, validateBuild, type Layers, type PartsCatalog, type PhotoBuild } from "@/lib/parts";

/**
 * Server-authoritative pricing. Every total shown at checkout and every order
 * total is recomputed here from the parts manifest and data/prices.json;
 * client-supplied prices are never read.
 */

export interface PricedLine {
  index: number;
  kind: "custom" | "catalog";
  ok: boolean;
  error: string | null;
  name: string;
  detail: string;
  quantity: number;
  unitMinor: number;
  discountableUnitMinor: number;
  lines: QuoteLine[];
  components: ComponentSnapshot[];
  buildRef: string | null;
  encoded: string | null;
  productId: string | null;
  layers: Layers | null;
}

export interface PricedCart {
  ok: boolean;
  lines: PricedLine[];
  totals: Totals;
}

/** One line per part (hands as a set), then the assembly fee. Part prices come from data/prices.json (EGP). */
function quoteBuild(parts: PartsCatalog, b: PhotoBuild, assemblyMinor: number) {
  const f = validateBuild(parts, b)!;
  const L = layersOf(parts, b);
  const hands = f.hands.find((h) => h.id === b.hands)!;
  const rows: { key: string; label: string; id: string; name: string; egp: number }[] = [];
  const row = (key: string, label: string, id: string | null) => id && rows.push({ key, label, id, name: parts.parts[id].label, egp: parts.parts[id].priceEgp });
  row("case", "Case", L.case);
  row("bezel", "Bezel", L.bezel);
  row("dial", "Dial", L.dial);
  row("ring", "Chapter ring", L.ring);
  rows.push({ key: "hands", label: "Hands", id: hands.id, name: hands.label, egp: handsPrice(parts, hands) });
  row("gmt", "GMT hand", L.gmt);
  row("band", "Bracelet / strap", L.bracelet);
  const lines: QuoteLine[] = rows.map((r) => ({ key: r.key, label: r.label, name: r.name, amountMinor: r.egp * 100, discountEligible: true, componentId: r.id, sku: r.id }));
  lines.push({ key: "assembly", label: "Assembly", name: "Atelier assembly and regulation check", amountMinor: assemblyMinor, discountEligible: false });
  const components: ComponentSnapshot[] = rows.map((r) => ({ slot: r.key, componentId: r.id, name: r.name, sku: r.id, priceMinor: r.egp * 100, costMinor: null, spec: { family: f.id, movement: f.movement } }));
  return { family: f, lines, components, layers: L };
}

const WELCOME_PROMO: Promo = { code: WELCOME_CODE, label: "Welcome 5%", kind: "percent", value: WELCOME_BASIS_POINTS, appliesTo: "all", minSubtotalMinor: 0, startsAt: null, endsAt: null, active: true, usageLimit: null, usedCount: 0 };

export function priceCart(
  items: CheckoutItem[],
  ctx: { parts: PartsCatalog; products: Product[]; settings: Settings; promoCode?: string | null; welcomeOk?: boolean; method?: "delivery" | "pickup" | null; governorate?: string | null; now?: Date },
): PricedCart {
  const now = ctx.now ?? new Date();
  const isWelcome = (ctx.promoCode ?? "").trim().toUpperCase() === WELCOME_CODE;
  // WELCOME5 is built in: 5% of the subtotal (never shipping), only when the server confirmed the contact is eligible.
  const pricing = isWelcome && ctx.welcomeOk ? { ...ctx.settings.pricing, promos: [...ctx.settings.pricing.promos.filter((p) => p.code !== WELCOME_CODE), WELCOME_PROMO] } : ctx.settings.pricing;

  const lines: PricedLine[] = items.map((item, index) => {
    if (item.kind === "custom") {
      const b = item.build;
      if (!validateBuild(ctx.parts, b)) {
        return { index, kind: "custom", ok: false, error: "Part of this composition is no longer available. Open it in the builder to choose again.", name: "Custom composition", detail: "", quantity: item.quantity, unitMinor: 0, discountableUnitMinor: 0, lines: [], components: [], buildRef: null, encoded: null, productId: null, layers: null };
      }
      const q = quoteBuild(ctx.parts, b, pricing.assemblyMinor);
      const unitMinor = q.lines.reduce((s, l) => s + l.amountMinor, 0);
      const error = item.quantity > pricing.maxCustomQuantity ? `Custom compositions are limited to ${pricing.maxCustomQuantity} per order.` : null;
      return {
        index,
        kind: "custom",
        ok: !error,
        error,
        name: buildName(ctx.parts, b),
        detail: [q.family.movement, ctx.parts.parts[b.case].label].join(" · "),
        quantity: item.quantity,
        unitMinor,
        discountableUnitMinor: q.lines.filter((l) => l.discountEligible).reduce((s, l) => s + l.amountMinor, 0),
        lines: q.lines,
        components: q.components,
        buildRef: buildReference(b),
        encoded: encodeBuild(b),
        productId: null,
        layers: q.layers,
      };
    }
    const p = ctx.products.find((x) => x.id === item.productId);
    let error: string | null = null;
    if (!p || !isProductVisible(p, now)) error = "This piece is no longer available.";
    else if (p.priceMinor <= 0) error = "This piece has no price yet.";
    else if (p.soldOut || p.stockQuantity < 1) error = "This piece has sold out.";
    else if (item.quantity > Math.min(p.maxPerOrder, p.stockQuantity)) error = `Only ${Math.min(p.maxPerOrder, p.stockQuantity)} available per order.`;
    return {
      index,
      kind: "catalog",
      ok: !error,
      error,
      name: p ? `${p.name}${p.dialLabel ? ` · ${p.dialLabel}` : ""}` : "Unavailable piece",
      detail: p?.movement ?? "",
      quantity: item.quantity,
      unitMinor: p?.priceMinor ?? 0,
      discountableUnitMinor: p?.priceMinor ?? 0,
      lines: p ? [{ key: "product", label: "Timepiece", name: p.name, amountMinor: p.priceMinor, discountEligible: true }] : [],
      components: [],
      buildRef: null,
      encoded: null,
      productId: p?.id ?? null,
      layers: null,
    };
  });

  const valid = lines.filter((l) => l.ok);
  const totals = computeTotals(
    valid.map((l) => ({ kind: l.kind, unitMinor: l.unitMinor, quantity: l.quantity, discountableUnitMinor: isWelcome ? l.unitMinor : l.discountableUnitMinor })),
    { pricing, shipping: ctx.settings.shipping, promoCode: ctx.promoCode, method: ctx.method ?? null, governorate: ctx.governorate ?? null, now },
  );
  if (isWelcome && !ctx.welcomeOk) totals.promoError = "This code is for a first order by a contact on our list. Use the same email or mobile number you gave us.";
  return { ok: lines.length > 0 && lines.every((l) => l.ok), lines, totals };
}
