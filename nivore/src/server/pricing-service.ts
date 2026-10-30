import "server-only";
import { createEngine } from "@/domain/compatibility";
import { buildReference, encodeConfiguration, presentationName, SLOT_LABEL, SLOT_ORDER, type Configuration } from "@/domain/configuration";
import { toPublicCatalog, type Catalog } from "@/domain/catalog";
import { isProductVisible, type CheckoutItem, type ComponentSnapshot, type Product } from "@/domain/models";
import { computeTotals, quoteBuild, type QuoteLine, type Totals } from "@/domain/pricing";
import type { Settings } from "@/domain/settings";

/**
 * Server-authoritative pricing. Every total shown at checkout and every
 * order total is recomputed here from the catalogue; client-supplied prices
 * are never read.
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
  configuration: Configuration | null;
  leadTimeDays: number | null;
  /** Component/product stock to decrement when the order is placed. */
  stock: { componentIds: string[]; productId: string | null };
}

export interface PricedCart {
  ok: boolean;
  lines: PricedLine[];
  totals: Totals;
}

export function priceCart(
  items: CheckoutItem[],
  ctx: { catalog: Catalog; products: Product[]; settings: Settings; promoCode?: string | null; method?: "delivery" | "pickup" | null; governorate?: string | null; now?: Date },
): PricedCart {
  const now = ctx.now ?? new Date();
  const engine = createEngine(toPublicCatalog(ctx.catalog));
  const full = new Map(ctx.catalog.components.map((c) => [c.id, c]));
  const pricing = ctx.settings.pricing;

  const lines: PricedLine[] = items.map((item, index) => {
    if (item.kind === "custom") {
      const config = item.configuration;
      const v = engine.validate(config);
      const q = quoteBuild(config, engine, pricing);
      const b = { dial: engine.get(config.parts.dial), case: engine.get(config.parts.case), movement: engine.get(config.parts.movement) };
      const fam = b.movement ? engine.family((b.movement.spec as { familyId: string }).familyId) : undefined;
      const name = presentationName(b.dial as never, b.case as never, fam?.complications).full;
      let error: string | null = null;
      if (!v.ok) {
        error = v.unavailable[0]
          ? `${engine.get(v.unavailable[0].id)?.name ?? "A part"} is no longer available. Open the composition to choose another.`
          : v.missing[0]
            ? `Choose a ${SLOT_LABEL[v.missing[0]].toLowerCase()} before ordering.`
            : "Some parts in this composition no longer fit together. Open it in the builder to review.";
      } else if (q.availability.status === "unavailable") error = "Part of this composition is currently unavailable.";
      else if (item.quantity > pricing.maxCustomQuantity) error = `Custom compositions are limited to ${pricing.maxCustomQuantity} per order.`;
      if (config.engraving && !pricing.engraving.enabled) error = error ?? "Engraving is not offered at the moment. Remove it in the builder.";
      const components: ComponentSnapshot[] = SLOT_ORDER.flatMap((slot) => {
        const id = config.parts[slot];
        const c = id ? full.get(id) : undefined;
        if (!c) return [];
        const line = q.lines.find((l) => l.key === slot);
        return [{ slot, componentId: c.id, name: c.name, sku: c.sku, priceMinor: line?.amountMinor ?? 0, costMinor: c.costMinor, spec: c.spec as Record<string, unknown> }];
      });
      return {
        index,
        kind: "custom",
        ok: !error,
        error,
        name,
        detail: [fam?.caliber, b.case?.name].filter(Boolean).join(" · "),
        quantity: item.quantity,
        unitMinor: q.totalMinor,
        discountableUnitMinor: q.discountableMinor,
        lines: q.lines,
        components,
        buildRef: buildReference(config),
        encoded: encodeConfiguration(config, ctx.catalog.components).toString(),
        productId: null,
        configuration: config,
        leadTimeDays: q.availability.leadTimeDays,
        stock: { componentIds: components.map((c) => c.componentId), productId: null },
      };
    }
    const p = ctx.products.find((x) => x.id === item.productId);
    let error: string | null = null;
    if (!p || !isProductVisible(p, now)) error = "This piece is no longer available.";
    else if (p.soldOut || p.stockQuantity < 1) error = "This piece has sold out.";
    else if (item.quantity > Math.min(p.maxPerOrder, p.stockQuantity)) error = `Only ${Math.min(p.maxPerOrder, p.stockQuantity)} available per order.`;
    return {
      index,
      kind: "catalog",
      ok: !error,
      error,
      name: p ? `${p.name} · ${p.dialLabel}` : "Unavailable piece",
      detail: p?.subtitle ?? "",
      quantity: item.quantity,
      unitMinor: p?.priceMinor ?? 0,
      discountableUnitMinor: p?.priceMinor ?? 0,
      lines: p ? [{ key: "product", label: "Timepiece", name: `${p.name} · ${p.dialLabel}`, amountMinor: p.priceMinor, discountEligible: true }] : [],
      components: p
        ? SLOT_ORDER.flatMap((slot) => {
            const c = p.configuration.parts[slot] ? full.get(p.configuration.parts[slot]!) : undefined;
            return c ? [{ slot, componentId: c.id, name: c.name, sku: c.sku, priceMinor: 0, costMinor: c.costMinor, spec: c.spec as Record<string, unknown> }] : [];
          })
        : [],
      buildRef: null,
      encoded: null,
      productId: p?.id ?? null,
      configuration: p?.configuration ?? null,
      leadTimeDays: null,
      stock: { componentIds: [], productId: p?.id ?? null },
    };
  });

  const valid = lines.filter((l) => l.ok);
  const totals = computeTotals(
    valid.map((l) => ({ kind: l.kind, unitMinor: l.unitMinor, quantity: l.quantity, discountableUnitMinor: l.discountableUnitMinor })),
    { pricing, shipping: ctx.settings.shipping, promoCode: ctx.promoCode, method: ctx.method ?? null, governorate: ctx.governorate ?? null, now },
  );
  return { ok: lines.length > 0 && lines.every((l) => l.ok), lines, totals };
}
