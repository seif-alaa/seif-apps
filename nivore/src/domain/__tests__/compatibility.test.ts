import { describe, expect, it } from "vitest";
import { compat, components, movementFamilies, STARTER_PARTS } from "@/data/seed/components";
import { toPublicCatalog } from "@/domain/catalog";
import { createEngine } from "@/domain/compatibility";
import {
  buildReference,
  decodeConfiguration,
  encodeConfiguration,
  presentationName,
  type Configuration,
} from "@/domain/configuration";

const catalog = toPublicCatalog({ movementFamilies, components, compat, assets: [] });
const engine = createEngine(catalog);
const starter: Configuration = { parts: { ...STARTER_PARTS }, engraving: null, options: [] };

describe("seed catalogue", () => {
  it("has unique ids and codes", () => {
    const ids = new Set(components.map((c) => c.id));
    const codes = new Set(components.map((c) => c.code));
    expect(ids.size).toBe(components.length);
    expect(codes.size).toBe(components.length);
  });

  it("starter build is fully compatible", () => {
    const v = engine.validate(starter);
    expect(v.issues).toEqual([]);
    expect(v.missing).toEqual([]);
    expect(v.ok).toBe(true);
  });
});

describe("attribute rules", () => {
  it("rejects a day-date dial on a date-only movement", () => {
    const issues = engine.pairIssues(engine.get("mv-nh35-white-3")!, engine.get("dial-ivory-daydate")!);
    expect(issues[0]?.status).toBe("incompatible");
    expect(issues[0]?.message).toMatch(/day-date/);
  });

  it("marks a no-date dial on a date movement as unconfirmed, not compatible", () => {
    const issues = engine.pairIssues(engine.get("mv-nh35-white-3")!, engine.get("dial-ivory-nodate")!);
    expect(issues).toHaveLength(1);
    expect(issues[0].status).toBe("unconfirmed");
  });

  it("accepts a no-date dial on the NH38", () => {
    expect(engine.pairIssues(engine.get("mv-nh38")!, engine.get("dial-ivory-nodate")!)).toEqual([]);
  });

  it("enforces crown position between date movement and case", () => {
    const issues = engine.pairIssues(engine.get("mv-nh35-white-3")!, engine.get("case-diver-40")!);
    expect(issues.some((i) => i.ruleId === "movement-case-crown" && i.status === "incompatible")).toBe(true);
    // A no-date movement can sit at either orientation.
    expect(engine.pairIssues(engine.get("mv-nh38")!, engine.get("case-diver-40")!)).toEqual([]);
  });

  it("treats missing movement height as unconfirmed (never as compatible)", () => {
    const issues = engine.pairIssues(engine.get("mv-nh34-white-3")!, engine.get("case-diver-40-3")!);
    expect(issues.map((i) => i.status)).toContain("unconfirmed");
  });

  it("lets an atelier record override the attribute rules", () => {
    expect(engine.pairIssues(engine.get("mv-nh34-white-3")!, engine.get("case-voyager-40")!)).toEqual([]);
    const reversed = engine.pairIssues(engine.get("case-voyager-40")!, engine.get("mv-nh34-white-3")!);
    expect(reversed).toEqual([]);
  });

  it("requires a GMT hand for the NH34 and forbids it elsewhere", () => {
    expect(engine.pairIssues(engine.get("mv-nh34-white-3")!, engine.get("hands-sword-lume")!)[0].message).toMatch(/four-hand/);
    expect(engine.pairIssues(engine.get("mv-nh35-white-3")!, engine.get("hands-gmt-sword")!)[0].message).toMatch(/GMT movement/);
  });

  it("checks dial diameter and dial feet against the case", () => {
    expect(engine.pairIssues(engine.get("dial-sky-30")!, engine.get("case-field-39")!)[0].message).toMatch(/30 mm/);
    expect(engine.pairIssues(engine.get("dial-black-diver")!, engine.get("case-diver-40-3")!)[0].message).toMatch(/feet/);
    expect(engine.pairIssues(engine.get("dial-stone-feetless")!, engine.get("case-diver-40")!)).toEqual([]);
  });

  it("matches lug width and fitted end links", () => {
    expect(engine.pairIssues(engine.get("case-dress-36")!, engine.get("st-leather-taupe-20")!)[0].message).toMatch(/18 mm/);
    expect(engine.pairIssues(engine.get("case-field-39")!, engine.get("br-oyster-20")!)[0].message).toMatch(/end links/);
    expect(engine.pairIssues(engine.get("case-field-39")!, engine.get("br-beads-20")!)).toEqual([]);
  });

  it("flags unverified hand lengths as unconfirmed", () => {
    const issues = engine.pairIssues(engine.get("dial-sky-30")!, engine.get("hands-cathedral")!);
    expect(issues[0].status).toBe("unconfirmed");
  });

  it("rejects a date magnifier over a no-date dial", () => {
    expect(engine.pairIssues(engine.get("dial-ivory-nodate")!, engine.get("cx-cyclops-315")!)[0].status).toBe("incompatible");
  });
});

describe("options", () => {
  it("offers only dials compatible with the chosen movement", () => {
    const opts = engine.options(starter, "dial");
    const dayDate = opts.find((o) => o.component.id === "dial-ivory-daydate")!;
    expect(dayDate.available).toBe(false);
    expect(dayDate.unavailableReason).toMatch(/day-date/);
    const ivory = opts.find((o) => o.component.id === "dial-ivory-date")!;
    expect(ivory.available).toBe(true);
  });

  it("reports later choices an option would affect", () => {
    const opts = engine.options(starter, "dial");
    const sky = opts.find((o) => o.component.id === "dial-sky-30")!;
    expect(sky.available).toBe(true);
    expect(sky.affects.some((i) => i.slots.includes("case"))).toBe(true);
  });

  it("marks out-of-stock parts unavailable even when compatible", () => {
    const config = { ...starter, parts: { ...starter.parts, movement: "mv-nh35-white-38", case: "case-diver-40" } };
    const burgundy = engine.options(config, "dial").find((o) => o.component.id === "dial-burgundy-diver")!;
    expect(burgundy.available).toBe(false);
    expect(burgundy.unavailableReason).toMatch(/unavailable/);
  });
});

describe("propose (earlier change repairs later choices)", () => {
  it("switching to the NH36 swaps the dial for its day-date sibling and asks first", () => {
    const p = engine.propose(starter, "movement", "mv-nh36-white-3");
    const dialChange = p.changes.find((c) => c.slot === "dial");
    expect(dialChange?.to).toBe("dial-ivory-daydate");
    expect(p.needsConfirmation).toBe(true);
    expect(engine.validate(p.next).ok).toBe(true);
  });

  it("switching to the GMT movement repairs case and hands", () => {
    const p = engine.propose(starter, "movement", "mv-nh34-white-3");
    expect(p.next.parts.case).toBe("case-voyager-40");
    expect(engine.get(p.next.parts.hands!)!.spec).toMatchObject({ gmtHand: true });
    expect(p.blocked).toEqual([]);
    expect(engine.validate(p.next).ok).toBe(true);
  });

  it("changing to an integrated-bezel case removes the bezel and chapter ring", () => {
    const config = { ...starter, parts: { ...starter.parts, dial: "dial-champagne-30" } };
    const p = engine.propose(config, "case", "case-cushion-40");
    expect(p.next.parts.bezel).toBeUndefined();
    expect(p.next.parts.chapterRing).toBeUndefined();
    expect(p.changes.filter((c) => c.kind === "removed").map((c) => c.slot).sort()).toEqual(["bezel", "chapterRing"]);
    // 22 mm lugs: the 20 mm strap must be replaced, and its buckle follows.
    expect(engine.get(p.next.parts.band!)!.spec).toMatchObject({ lugWidthMm: 22 });
    expect(engine.validate(p.next).ok).toBe(true);
  });

  it("adds an insert when a rotating-bezel case is chosen", () => {
    const config = { ...starter, parts: { ...starter.parts, movement: "mv-nh35-white-38", dial: "dial-black-diver" } };
    const p = engine.propose(config, "case", "case-diver-40");
    expect(p.next.parts.insert).toBeDefined();
    expect(p.changes.find((c) => c.slot === "insert")?.kind).toBe("added");
    expect(engine.validate(p.next).ok).toBe(true);
  });

  it("does not ask for confirmation when nothing the customer chose changes", () => {
    const p = engine.propose(starter, "dial", "dial-rose-linen");
    expect(p.changes).toEqual([]);
    expect(p.needsConfirmation).toBe(false);
  });

  it("rapid repeated changes keep the build valid", () => {
    let config = starter;
    const sequence: [Parameters<typeof engine.propose>[1], string][] = [
      ["movement", "mv-nh36-black-38"],
      ["movement", "mv-nh34-white-3"],
      ["movement", "mv-nh38"],
      ["case", "case-octagon-39"],
      ["case", "case-petite-34"],
      ["movement", "mv-nh35-black-3"],
      ["band", "st-leather-espresso-18"],
      ["case", "case-diver-40-3"],
    ];
    for (const [slot, id] of sequence) {
      const opt = engine.options(config, slot).find((o) => o.component.id === id)!;
      expect(opt, `${slot}=${id}`).toBeDefined();
      config = engine.propose(config, slot, id).next;
      const v = engine.validate(config);
      expect(v.issues, `${slot}=${id}`).toEqual([]);
      expect(v.missing, `${slot}=${id}`).toEqual([]);
    }
  });
});

describe("normalize / validate", () => {
  it("fills a partial configuration with compatible parts", () => {
    const n = engine.normalize({ parts: { movement: "mv-nh36-white-3", case: "case-dress-36" }, engraving: null, options: [] });
    expect(engine.validate(n).issues).toEqual([]);
    expect(n.parts.dial).toBe("dial-ivory-daydate");
  });

  it("server validation catches a tampered build", () => {
    const tampered = { ...starter, parts: { ...starter.parts, dial: "dial-black-diver" } };
    const v = engine.validate(tampered);
    expect(v.ok).toBe(false);
    expect(v.issues.length).toBeGreaterThan(0);
  });

  it("server validation catches a part in an inapplicable slot", () => {
    const v = engine.validate({ ...starter, parts: { ...starter.parts, insert: "ins-black-alu" } });
    expect(v.ok).toBe(false);
  });
});

describe("share encoding and build identity", () => {
  it("round-trips through URL parameters, including engraving", () => {
    const config: Configuration = { ...starter, engraving: { text: "For L. — 2026", style: "serif" }, options: [] };
    const params = encodeConfiguration(config, catalog.components);
    const back = decodeConfiguration(new URLSearchParams(params.toString()), catalog.components);
    expect(back).toEqual(config);
  });

  it("ignores unknown codes and malformed engraving", () => {
    const back = decodeConfiguration(new URLSearchParams("b=M1.ZZZ.D01&e=@@@"), catalog.components);
    expect(back?.parts).toEqual({ movement: "mv-nh35-white-3", dial: "dial-ivory-date" });
    expect(back?.engraving).toBeNull();
  });

  it("produces a stable, readable reference", () => {
    const a = buildReference(starter);
    expect(a).toMatch(/^NV-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/);
    expect(buildReference({ ...starter })).toBe(a);
    expect(buildReference({ ...starter, parts: { ...starter.parts, dial: "dial-rose-linen" } })).not.toBe(a);
  });

  it("names builds after the Brand Book formula", () => {
    const name = presentationName(engine.get("dial-cognac-roman") as never, engine.get("case-dress-36") as never);
    expect(name.full).toBe("SERA 36 · Cognac");
    const gmt = presentationName(engine.get("dial-graphite-gmt") as never, engine.get("case-voyager-40") as never, ["date", "gmt"]);
    expect(gmt.full).toBe("ALBA 40 GMT · Graphite");
  });
});

describe("exhaustive: every offered option yields an orderable build", () => {
  it("holds from several starting points across all slots", () => {
    const starts: Configuration[] = [starter];
    // Grow the start set with one build per movement family.
    for (const m of ["mv-nh36-black-38", "mv-nh34-white-3", "mv-nh38", "mv-nh35-white-38"]) {
      starts.push(engine.propose(starter, "movement", m).next);
    }
    let checked = 0;
    for (const start of starts) {
      expect(engine.validate(start).ok).toBe(true);
      for (const slot of ["movement", "dial", "case", "hands", "bezel", "insert", "crystal", "chapterRing", "band", "clasp", "caseback"] as const) {
        if (!engine.applicable(start, slot)) continue;
        for (const opt of engine.options(start, slot)) {
          if (!opt.available) continue;
          const p = engine.propose(start, slot, opt.component.id);
          const v = engine.validate(p.next);
          expect({ slot, id: opt.component.id, blocked: p.blocked, issues: v.issues, missing: v.missing }).toMatchObject({ blocked: [], issues: [], missing: [] });
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(200);
  });
});
