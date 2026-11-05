import { describe, expect, it } from "vitest";
import { products, seedAuctions } from "@/data/seed/catalog-seed";
import { buildPartsCatalog, buildReference, decodeBuild, defaultBuild, encodeBuild, handAngles, handsPrice, layersOf, partsTotalEgp, validateBuild, type Manifest } from "@/lib/parts";
import manifest from "../../../tools/parts/parts-manifest.json";
import report from "../../../public/parts/_report.json";
import prices from "../../../data/prices.json";

const available = new Set((report as { id: string; status: string }[]).filter((r) => r.status === "ok").map((r) => r.id));
const cat = buildPartsCatalog(manifest as unknown as Manifest, available, prices as unknown as Record<string, number>);
const skx = cat.families.find((f) => f.id === "SKX")!;

describe("parts catalogue (manifest + report + prices)", () => {
  it("SKX 42 is live with a real option in every step", () => {
    expect(skx.live).toBe(true);
    expect(skx.name).toBe("SKX 42");
    expect(skx.caliber).toBe("NH35");
    expect(skx.case.length).toBeGreaterThan(0);
    expect(skx.bezel.length).toBeGreaterThan(0);
    expect(skx.dial.length).toBe(4);
    expect(skx.hands.map((h) => h.id)).toEqual(["hands_SKX_mercedes"]);
    expect(skx.ring).toBe("ring_SKX_brushed");
    expect(skx.gmt).toBeNull();
  });

  it("only offers options whose image exists, and demotes families that lack a step", () => {
    for (const f of cat.families) for (const id of [...f.case, ...f.bezel, ...f.dial, ...f.band]) expect(available.has(id), id).toBe(true);
    const withoutCase = buildPartsCatalog(manifest as unknown as Manifest, new Set([...available].filter((id) => id !== "case_SKX_steel")), {});
    expect(withoutCase.families.find((f) => f.id === "SKX")!.live).toBe(false);
  });

  it("GMT 40 carries its GMT hand automatically once its images exist", () => {
    const all = new Set((manifest as unknown as Manifest).parts.map((p) => p.id));
    const full = buildPartsCatalog(manifest as unknown as Manifest, all, {});
    const gm = full.families.find((f) => f.id === "GM")!;
    expect(gm.live).toBe(true);
    expect(gm.gmt).toBe("hands_GM_gmt_red");
    expect(layersOf(full, defaultBuild(gm)).gmt).toBe("hands_GM_gmt_red");
  });

  it("lists unfinished families as coming soon, without internal notes", () => {
    expect(cat.comingSoon).toContain("Octa 40");
    expect(cat.comingSoon.every((n) => !n.includes("("))).toBe(true);
  });

  it("uses no third-party model names in any part label", () => {
    const labels = Object.values(cat.parts).map((p) => p.label.toLowerCase());
    for (const banned of ["rolex", "oyster", "jubilee", "submariner", "datejust", "explorer", "pepsi", "patek", "omega", "cartier"]) expect(labels.some((l) => l.includes(banned)), banned).toBe(false);
  });
});

describe("builds", () => {
  const b = defaultBuild(skx);
  it("layers follow the manifest order and include the SKX chapter ring", () => {
    const L = layersOf(cat, b);
    expect(L).toMatchObject({ bracelet: b.band, case: b.case, dial: b.dial, ring: "ring_SKX_brushed", bezel: b.bezel });
    expect(L.hour && L.minute && L.second).toBeTruthy();
  });

  it("round-trips through the share link and rejects old or tampered links", () => {
    expect(decodeBuild(cat, encodeBuild(b))).toEqual(b);
    expect(decodeBuild(cat, "M1.D03.C02.H01.Z03.X05.S02.K01.B04")).toBeNull(); // old format
    expect(decodeBuild(cat, encodeBuild({ ...b, dial: "dial_SKX_nope" }))).toBeNull();
    expect(decodeBuild(cat, encodeBuild({ ...b, family: "CL" }))).toBeNull(); // CL not live
    expect(validateBuild(cat, { ...b, hands: "hands_SKX_mercedes_v1_dropped" })).toBeNull();
  });

  it("gives a stable reference that changes with the build", () => {
    expect(buildReference(b)).toMatch(/^NV-[0-9A-Z]{4}-[0-9A-Z]{4}$/);
    expect(buildReference(b)).toBe(buildReference({ ...b }));
    expect(buildReference({ ...b, dial: skx.dial[1] })).not.toBe(buildReference(b));
  });

  it("prices are the sum of the rendered parts' prices (all 0 until set)", () => {
    expect(partsTotalEgp(cat, b)).toBe(0);
    const priced = buildPartsCatalog(manifest as unknown as Manifest, available, { ...(prices as unknown as Record<string, number>), [b.case]: 1000, [b.dial]: 250, ring_SKX_brushed: 100, [skx.hands[0].hour]: 10, [skx.hands[0].minute]: 20, [skx.hands[0].second]: 5 });
    expect(partsTotalEgp(priced, b)).toBe(1385);
    expect(handsPrice(priced, skx.hands[0])).toBe(35);
  });

  it("hand angles: 10:08:35 and live-time maths", () => {
    const a = handAngles(10, 8, 35);
    expect(a.hour).toBeCloseTo(304.29, 1);
    expect(a.minute).toBeCloseTo(51.5, 5);
    expect(a.second).toBe(210);
    expect(handAngles(15, 0, 0).hour).toBe(90);
  });
});

describe("seed data", () => {
  it("auction previews decode to live builds", () => {
    for (const a of seedAuctions(new Date())) expect(decodeBuild(cat, a.previewBuild), a.id).not.toBeNull();
  });
  it("every visible product has a photo; photoless ones stay drafts; unpriced ones are not orderable", () => {
    for (const p of products) {
      if (p.images.length === 0) expect(p.status).toBe("draft");
      else expect(p.images[0].src).toMatch(/^\/products\/.+\.webp$/);
      expect(p.priceMinor).toBe(0);
    }
  });
});
