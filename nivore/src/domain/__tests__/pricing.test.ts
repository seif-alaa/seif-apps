import { describe, expect, it } from "vitest";
import { compat, components, movementFamilies, STARTER_PARTS } from "@/data/seed/components";
import { toPublicCatalog } from "@/domain/catalog";
import { createEngine } from "@/domain/compatibility";
import { formatEGP, percentOf, poundsToMinor, sumMinor } from "@/domain/money";
import { computeTotals, quoteBuild, type PricingSettings, type ShippingSettings } from "@/domain/pricing";

const engine = createEngine(toPublicCatalog({ movementFamilies, components, compat, assets: [] }));

const pricing: PricingSettings = {
  assemblyMinor: 150_000,
  engraving: { enabled: true, priceMinor: 40_000, maxChars: 30, note: "" },
  options: [
    { id: "gift-note", name: "Handwritten card", description: "", priceMinor: 0, enabled: true },
    { id: "disabled-opt", name: "Disabled", description: "", priceMinor: 99_900, enabled: false },
  ],
  promos: [
    { code: "ATELIER10", label: "Atelier 10%", kind: "percent", value: 1000, appliesTo: "all", minSubtotalMinor: 0, startsAt: null, endsAt: null, active: true, usageLimit: null, usedCount: 0 },
    { code: "FIXED500", label: "EGP 500 off", kind: "fixed", value: 50_000, appliesTo: "custom", minSubtotalMinor: 1_000_000, startsAt: null, endsAt: null, active: true, usageLimit: 5, usedCount: 5 },
    { code: "LATER", label: "Later", kind: "percent", value: 500, appliesTo: "all", minSubtotalMinor: 0, startsAt: "2099-01-01T00:00:00Z", endsAt: null, active: true, usageLimit: null, usedCount: 0 },
  ],
  tax: { enabled: false, rateBp: 1400, label: "VAT" },
  maxCustomQuantity: 2,
};

const shipping: ShippingSettings = {
  delivery: { enabled: true, defaultMinor: 15_000, byGovernorate: { Cairo: 10_000 }, freeOverMinor: 3_000_000, note: "" },
  pickup: { enabled: false, location: "", note: "" },
};

const starter = { parts: { ...STARTER_PARTS }, engraving: null, options: [] as string[] };

describe("money", () => {
  it("parses admin-entered pounds without floating point error", () => {
    expect(poundsToMinor("1,234.5")).toBe(123_450);
    expect(poundsToMinor("0.1")).toBe(10);
    expect(poundsToMinor(19.99)).toBe(1999);
    expect(() => poundsToMinor("12.345")).toThrow();
    expect(() => poundsToMinor("abc")).toThrow();
  });

  it("formats EGP", () => {
    expect(formatEGP(1_245_000)).toBe("EGP 12,450");
    expect(formatEGP(1_245_050)).toBe("EGP 12,450.50");
    expect(formatEGP(-5000)).toBe("−EGP 50");
  });

  it("rounds percentages half-up to the piastre in integer arithmetic", () => {
    expect(percentOf(1005, 1000)).toBe(101); // 100.5 → 101
    expect(percentOf(1004, 1000)).toBe(100);
    expect(() => percentOf(10.5, 1000)).toThrow();
  });

  it("refuses non-integer sums", () => {
    expect(() => sumMinor([1, 0.5])).toThrow();
  });
});

describe("quoteBuild", () => {
  it("sums each component, assembly, engraving and enabled options", () => {
    const q = quoteBuild({ ...starter, engraving: { text: "For L.", style: "serif" }, options: ["gift-note", "disabled-opt"] }, engine, pricing);
    const partsTotal = Object.values(STARTER_PARTS).reduce((sum, id) => sum + engine.get(id)!.priceMinor, 0);
    expect(q.totalMinor).toBe(partsTotal + 150_000 + 40_000);
    expect(q.lines.find((l) => l.key === "option:disabled-opt")).toBeUndefined();
    expect(q.lines.find((l) => l.key === "assembly")?.amountMinor).toBe(150_000);
  });

  it("applies per-component price adjustments and never goes negative", () => {
    const adjusted = components.map((c) =>
      c.id === "dial-ivory-date" ? { ...c, priceAdjustmentMinor: -20_000 } : c.id === "hands-dauphine-steel" ? { ...c, priceAdjustmentMinor: -9_999_999 } : c,
    );
    const e2 = createEngine(toPublicCatalog({ movementFamilies, components: adjusted, compat, assets: [] }));
    const q = quoteBuild(starter, e2, pricing);
    expect(q.lines.find((l) => l.key === "dial")!.amountMinor).toBe(130_000 - 20_000);
    expect(q.lines.find((l) => l.key === "hands")!.amountMinor).toBe(0);
  });

  it("reports made-to-order lead time", () => {
    const p = engine.propose(starter, "movement", "mv-nh34-white-3");
    const q = quoteBuild(p.next, engine, pricing);
    expect(q.availability.status).toBe("made_to_order");
    expect(q.availability.leadTimeDays).toBe(14);
  });

  it("ignores engraving when the admin has disabled it", () => {
    const q = quoteBuild({ ...starter, engraving: { text: "Hi", style: "sans" } }, engine, { ...pricing, engraving: { ...pricing.engraving, enabled: false } });
    expect(q.lines.find((l) => l.key === "engraving")).toBeUndefined();
  });
});

describe("computeTotals", () => {
  const items = [
    { kind: "custom" as const, unitMinor: 1_500_000, quantity: 1, discountableUnitMinor: 1_300_000 },
    { kind: "catalog" as const, unitMinor: 1_000_000, quantity: 2, discountableUnitMinor: 1_000_000 },
  ];

  it("applies a percentage promo only to discount-eligible amounts", () => {
    const t = computeTotals(items, { pricing, shipping, promoCode: "atelier10", method: "delivery", governorate: "Cairo" });
    expect(t.subtotalMinor).toBe(3_500_000);
    expect(t.discountMinor).toBe(330_000);
    // 3,170,000 after discount is above the free-delivery threshold.
    expect(t.shippingMinor).toBe(0);
    expect(t.totalMinor).toBe(3_170_000);
  });

  it("explains rejected promo codes", () => {
    expect(computeTotals(items, { pricing, shipping, promoCode: "FIXED500" }).promoError).toMatch(/fully used/);
    expect(computeTotals(items, { pricing, shipping, promoCode: "LATER" }).promoError).toMatch(/not active/);
    expect(computeTotals(items, { pricing, shipping, promoCode: "NOPE" }).promoError).toMatch(/not recognised/);
  });

  it("uses governorate rates and falls back to the default", () => {
    const one = [{ kind: "catalog" as const, unitMinor: 1_000_000, quantity: 1, discountableUnitMinor: 0 }];
    expect(computeTotals(one, { pricing, shipping, method: "delivery", governorate: "Cairo" }).shippingMinor).toBe(10_000);
    expect(computeTotals(one, { pricing, shipping, method: "delivery", governorate: "Aswan" }).shippingMinor).toBe(15_000);
    expect(computeTotals(one, { pricing, shipping, method: "pickup" }).shippingMinor).toBeNull();
  });

  it("adds tax only when enabled", () => {
    const one = [{ kind: "catalog" as const, unitMinor: 100_000, quantity: 1, discountableUnitMinor: 0 }];
    const t = computeTotals(one, { pricing: { ...pricing, tax: { ...pricing.tax, enabled: true } }, shipping });
    expect(t.taxMinor).toBe(14_000);
    expect(t.totalMinor).toBe(114_000);
  });

  it("rejects fractional quantities", () => {
    expect(() => computeTotals([{ kind: "custom", unitMinor: 100, quantity: 1.5, discountableUnitMinor: 0 }], { pricing, shipping })).toThrow();
  });
});
