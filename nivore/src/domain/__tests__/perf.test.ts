import { describe, expect, it } from "vitest";
import { compat, components, movementFamilies, STARTER_PARTS } from "@/data/seed/components";
import { toPublicCatalog } from "@/domain/catalog";
import { createEngine } from "@/domain/compatibility";
import { SLOT_ORDER } from "@/domain/configuration";

/** Budget guard: evaluating every step's options must stay well inside one frame. */
describe("engine performance", () => {
  it("evaluates all options for every slot quickly", () => {
    const engine = createEngine(toPublicCatalog({ movementFamilies, components, compat, assets: [] }));
    const config = { parts: { ...STARTER_PARTS }, engraving: null, options: [] };
    const worstSlot: Record<string, number> = {};
    for (let round = 0; round < 3; round++) {
      for (const slot of SLOT_ORDER) {
        const t = performance.now();
        engine.options(config, slot);
        const dt = performance.now() - t;
        worstSlot[slot] = Math.max(worstSlot[slot] ?? 0, round === 0 ? 0 : dt);
      }
    }
    console.log("worst ms per slot:", Object.fromEntries(Object.entries(worstSlot).map(([k, v]) => [k, +v.toFixed(2)])));
    expect(Math.max(...Object.values(worstSlot))).toBeLessThan(25);
  });
});
