import { z } from "zod";
import { effectivePrice, type PublicComponent } from "./catalog";
import type { Engine } from "./compatibility";
import { SLOT_ORDER, SLOT_LABEL, type Configuration, type Slot } from "./configuration";
import { assertMinor, percentOf, sumMinor, type Minor } from "./money";

/* ── Admin-controlled pricing settings ────────────────────────────────── */

export const PersonalizationOptionSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{2,40}$/),
  name: z.string().min(2).max(60),
  description: z.string().max(240),
  priceMinor: z.number().int().nonnegative(),
  enabled: z.boolean(),
});
export type PersonalizationOption = z.infer<typeof PersonalizationOptionSchema>;

export const PromoSchema = z.object({
  code: z.string().regex(/^[A-Z0-9-]{3,24}$/),
  label: z.string().max(80),
  kind: z.enum(["percent", "fixed"]),
  /** Basis points for percent (1000 = 10%), minor units for fixed. */
  value: z.number().int().positive(),
  appliesTo: z.enum(["all", "custom", "catalog"]),
  minSubtotalMinor: z.number().int().nonnegative(),
  startsAt: z.string().nullable(),
  endsAt: z.string().nullable(),
  active: z.boolean(),
  usageLimit: z.number().int().positive().nullable(),
  usedCount: z.number().int().nonnegative(),
});
export type Promo = z.infer<typeof PromoSchema>;

export const PricingSettingsSchema = z.object({
  assemblyMinor: z.number().int().nonnegative(),
  engraving: z.object({
    enabled: z.boolean(),
    priceMinor: z.number().int().nonnegative(),
    maxChars: z.number().int().min(1).max(80),
    note: z.string().max(240),
  }),
  options: z.array(PersonalizationOptionSchema),
  promos: z.array(PromoSchema),
  tax: z.object({ enabled: z.boolean(), rateBp: z.number().int().min(0).max(5000), label: z.string() }),
  maxCustomQuantity: z.number().int().min(1).max(10),
});
export type PricingSettings = z.infer<typeof PricingSettingsSchema>;

export const ShippingSettingsSchema = z.object({
  delivery: z.object({
    enabled: z.boolean(),
    defaultMinor: z.number().int().nonnegative(),
    byGovernorate: z.record(z.string(), z.number().int().nonnegative()),
    freeOverMinor: z.number().int().nonnegative().nullable(),
    note: z.string().max(240),
  }),
  pickup: z.object({
    enabled: z.boolean(),
    location: z.string().max(240),
    note: z.string().max(240),
  }),
});
export type ShippingSettings = z.infer<typeof ShippingSettingsSchema>;

/* ── Build quote ───────────────────────────────────────────────────────── */

export interface QuoteLine {
  key: string;
  label: string;
  name: string;
  amountMinor: Minor;
  discountEligible: boolean;
  componentId?: string;
  sku?: string;
}

export interface Availability {
  status: "available" | "made_to_order" | "unavailable";
  /** Longest component lead time in days, if any part is made to order. */
  leadTimeDays: number | null;
  notes: string[];
}

export interface BuildQuote {
  lines: QuoteLine[];
  totalMinor: Minor;
  discountableMinor: Minor;
  availability: Availability;
}

export function quoteBuild(config: Configuration, engine: Engine, pricing: PricingSettings): BuildQuote {
  const lines: QuoteLine[] = [];
  const notes: string[] = [];
  let leadTimeDays: number | null = null;
  let status: Availability["status"] = "available";

  for (const slot of SLOT_ORDER) {
    const c = engine.get(config.parts[slot]) as PublicComponent | undefined;
    if (!c || !engine.applicable(config, slot)) continue;
    lines.push({
      key: slot,
      label: SLOT_LABEL[slot as Slot],
      name: c.name,
      amountMinor: assertMinor(effectivePrice(c)),
      discountEligible: c.discountEligible,
      componentId: c.id,
      sku: c.sku,
    });
    if (c.stock.status === "out_of_stock" || !c.active) {
      status = "unavailable";
      notes.push(`${c.name} is currently unavailable.`);
    } else if (c.stock.status === "made_to_order") {
      if (status === "available") status = "made_to_order";
      if (c.stock.leadTimeDays != null) leadTimeDays = Math.max(leadTimeDays ?? 0, c.stock.leadTimeDays);
      notes.push(`${c.name} is ordered in for your build.`);
    }
  }

  lines.push({
    key: "assembly",
    label: "Assembly",
    name: "Atelier assembly and regulation check",
    amountMinor: pricing.assemblyMinor,
    discountEligible: false,
  });

  if (config.engraving?.text && pricing.engraving.enabled) {
    lines.push({
      key: "engraving",
      label: "Engraving",
      name: `Caseback engraving · ${config.engraving.text.length} characters`,
      amountMinor: pricing.engraving.priceMinor,
      discountEligible: false,
    });
  }
  for (const optionId of config.options) {
    const option = pricing.options.find((o) => o.id === optionId && o.enabled);
    if (option) {
      lines.push({ key: `option:${option.id}`, label: "Option", name: option.name, amountMinor: option.priceMinor, discountEligible: false });
    }
  }

  return {
    lines,
    totalMinor: sumMinor(lines.map((l) => l.amountMinor)),
    discountableMinor: sumMinor(lines.filter((l) => l.discountEligible).map((l) => l.amountMinor)),
    availability: { status, leadTimeDays, notes },
  };
}

/* ── Cart / order totals ───────────────────────────────────────────────── */

export interface PricedItem {
  kind: "custom" | "catalog";
  unitMinor: Minor;
  quantity: number;
  discountableUnitMinor: Minor;
}

export interface Totals {
  subtotalMinor: Minor;
  discountMinor: Minor;
  discountLabel: string | null;
  shippingMinor: Minor | null;
  taxMinor: Minor;
  totalMinor: Minor;
  promoError: string | null;
}

export function findPromo(code: string | null | undefined, pricing: PricingSettings, now: Date): { promo: Promo | null; error: string | null } {
  if (!code) return { promo: null, error: null };
  const normalized = code.trim().toUpperCase();
  const promo = pricing.promos.find((p) => p.code === normalized);
  if (!promo || !promo.active) return { promo: null, error: "This code is not recognised." };
  if (promo.startsAt && now < new Date(promo.startsAt)) return { promo: null, error: "This code is not active yet." };
  if (promo.endsAt && now > new Date(promo.endsAt)) return { promo: null, error: "This code has expired." };
  if (promo.usageLimit != null && promo.usedCount >= promo.usageLimit) return { promo: null, error: "This code has been fully used." };
  return { promo, error: null };
}

export function shippingFor(
  method: "delivery" | "pickup",
  governorate: string | null,
  subtotalMinor: Minor,
  shipping: ShippingSettings,
): Minor | null {
  if (method === "pickup") return shipping.pickup.enabled ? 0 : null;
  if (!shipping.delivery.enabled) return null;
  if (shipping.delivery.freeOverMinor != null && subtotalMinor >= shipping.delivery.freeOverMinor) return 0;
  if (!governorate) return null;
  return shipping.delivery.byGovernorate[governorate] ?? shipping.delivery.defaultMinor;
}

export function computeTotals(
  items: PricedItem[],
  opts: {
    pricing: PricingSettings;
    shipping: ShippingSettings;
    promoCode?: string | null;
    method?: "delivery" | "pickup" | null;
    governorate?: string | null;
    now?: Date;
  },
): Totals {
  const now = opts.now ?? new Date();
  for (const i of items) {
    if (!Number.isInteger(i.quantity) || i.quantity < 1) throw new RangeError("quantity must be a positive integer");
  }
  const subtotalMinor = sumMinor(items.map((i) => assertMinor(i.unitMinor * i.quantity)));

  const { promo, error } = findPromo(opts.promoCode, opts.pricing, now);
  let discountMinor = 0;
  let promoError = error;
  if (promo) {
    const eligible = sumMinor(
      items
        .filter((i) => promo.appliesTo === "all" || promo.appliesTo === i.kind)
        .map((i) => i.discountableUnitMinor * i.quantity),
    );
    if (subtotalMinor < promo.minSubtotalMinor) {
      promoError = "Your bag does not meet this code's minimum.";
    } else if (eligible === 0) {
      promoError = "This code does not apply to the pieces in your bag.";
    } else {
      discountMinor = promo.kind === "percent" ? percentOf(eligible, promo.value) : Math.min(promo.value, eligible);
    }
  }

  const afterDiscount = subtotalMinor - discountMinor;
  const shippingMinor = opts.method ? shippingFor(opts.method, opts.governorate ?? null, afterDiscount, opts.shipping) : null;
  // Tax is modelled for the future; disabled by default. Prices are treated as tax-inclusive when disabled.
  const taxMinor = opts.pricing.tax.enabled ? percentOf(afterDiscount, opts.pricing.tax.rateBp) : 0;
  const totalMinor = sumMinor([afterDiscount, shippingMinor ?? 0, taxMinor]);
  return {
    subtotalMinor,
    discountMinor,
    discountLabel: promo && discountMinor > 0 ? promo.label || promo.code : null,
    shippingMinor,
    taxMinor,
    totalMinor,
    promoError,
  };
}
