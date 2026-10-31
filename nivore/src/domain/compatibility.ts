import type {
  CompatStatus,
  ComponentOf,
  ComponentType,
  MovementFamily,
  PublicCatalog,
  PublicComponent,
} from "./catalog";
import { SLOT_ORDER, SLOT_LABEL, type Configuration, type Slot } from "./configuration";

/**
 * Compatibility engine.
 *
 * Three outcomes, never conflated:
 *  - compatible    — every applicable rule passed with known data
 *  - incompatible  — a rule failed, or the atelier recorded the pair as incompatible
 *  - unconfirmed   — data needed to decide is missing, or the atelier has not
 *                    confirmed the pairing. Unconfirmed parts cannot be ordered.
 *
 * Attribute rules run first; an explicit admin record for a pair overrides them.
 */

export interface Issue {
  ruleId: string;
  status: Exclude<CompatStatus, "compatible">;
  slots: [Slot, Slot];
  ids: [string, string];
  message: string;
}

export interface Evaluation {
  status: CompatStatus;
  issues: Issue[];
}

type AnyComp = PublicComponent;
type C<T extends ComponentType> = Omit<ComponentOf<T>, "costMinor" | "supplier" | "supplierRef">;

interface RuleCtx {
  family(id: string): MovementFamily | undefined;
}

type Verdict = { status: "incompatible" | "unconfirmed"; message: string } | null;

interface Rule<A extends ComponentType, B extends ComponentType> {
  id: string;
  a: A;
  b: B;
  check(a: C<A>, b: C<B>, ctx: RuleCtx): Verdict;
}

const bad = (message: string): Verdict => ({ status: "incompatible", message });
const unknown = (message: string): Verdict => ({ status: "unconfirmed", message });
const same = (x: number, y: number) => Math.abs(x - y) < 0.05;
const crown = (p: number) => (p === 3 ? "3 o'clock" : "4 o'clock (3.8)");

function rule<A extends ComponentType, B extends ComponentType>(r: Rule<A, B>): Rule<ComponentType, ComponentType> {
  return r as unknown as Rule<ComponentType, ComponentType>;
}

export const RULES: Rule<ComponentType, ComponentType>[] = [
  rule({
    id: "movement-dial-date-window",
    a: "movement",
    b: "dial",
    check(m, d, ctx) {
      const fam = ctx.family(m.spec.familyId);
      if (!fam) return unknown("Movement family details are missing.");
      const hasDate = fam.complications.includes("date");
      const hasDay = fam.complications.includes("day");
      switch (d.spec.dateWindow) {
        case "day-date":
          return hasDay && hasDate ? null : bad("This dial has a day-date window and needs a day-date movement (such as the NH36).");
        case "date":
          if (!hasDate) return bad("This dial has a date window, but the movement shows no date.");
          if (hasDay) return bad("A day-date movement does not align with a date-only window.");
          return null;
        case "none":
          return hasDate
            ? unknown("A no-date dial on a date movement leaves a hidden date position at the crown. The atelier has not confirmed this pairing.")
            : null;
      }
    },
  }),
  rule({
    id: "movement-case-crown",
    a: "movement",
    b: "case",
    check(m, k, ctx) {
      const fam = ctx.family(m.spec.familyId);
      if (!fam) return unknown("Movement family details are missing.");
      if (fam.complications.includes("date") && m.spec.crownPosition !== k.spec.crownPosition) {
        return bad(
          `This movement's date wheel is printed for a crown at ${crown(m.spec.crownPosition)}; the case places the crown at ${crown(k.spec.crownPosition)}.`,
        );
      }
      return null;
    },
  }),
  rule({
    id: "movement-case-height",
    a: "movement",
    b: "case",
    check(m, k, ctx) {
      const fam = ctx.family(m.spec.familyId);
      const h = fam?.heightMm ?? null;
      const max = k.spec.maxMovementHeightMm;
      if (h == null || max == null) {
        return unknown("Movement height and case clearance have not both been measured, so hand clearance is unconfirmed.");
      }
      return h > max + 0.001 ? bad(`The movement is ${h} mm tall; this case allows ${max} mm.`) : null;
    },
  }),
  rule({
    id: "dial-case-diameter",
    a: "dial",
    b: "case",
    check(d, k) {
      if (!same(d.spec.diameterMm, k.spec.dialOpeningMm)) {
        return bad(`The dial is ${d.spec.diameterMm} mm; this case takes a ${k.spec.dialOpeningMm} mm dial.`);
      }
      if (d.spec.feet !== "feetless") {
        const want = k.spec.crownPosition === 3 ? "crown-3" : "crown-3.8";
        if (d.spec.feet !== want) {
          return bad(`The dial feet are placed for a crown at ${d.spec.feet === "crown-3" ? "3 o'clock" : "4 o'clock"}; this case's crown is at ${crown(k.spec.crownPosition)}.`);
        }
      }
      return null;
    },
  }),
  rule({
    id: "movement-hands-fit",
    a: "movement",
    b: "hands",
    check(m, h, ctx) {
      const fam = ctx.family(m.spec.familyId);
      if (!fam) return unknown("Movement family details are missing.");
      const gmt = fam.complications.includes("gmt");
      if (gmt && !h.spec.gmtHand) return bad("A GMT movement needs a four-hand set that includes a GMT hand.");
      if (!gmt && h.spec.gmtHand) return bad("This set includes a GMT hand, which needs a GMT movement (such as the NH34).");
      if (h.spec.movementFamilies.length === 0) return unknown("Hand fitment has not been recorded for any movement.");
      if (!h.spec.movementFamilies.includes(fam.id)) return bad(`These hands are not fitted to the ${fam.caliber}.`);
      return null;
    },
  }),
  rule({
    id: "dial-hands-length",
    a: "dial",
    b: "hands",
    check(d, h) {
      return h.spec.dialDiametersMm.some((x) => same(x, d.spec.diameterMm))
        ? null
        : unknown(`Hand lengths have not been verified on a ${d.spec.diameterMm} mm dial.`);
    },
  }),
  rule({
    id: "case-bezel-system",
    a: "case",
    b: "bezel",
    check(k, z) {
      if (k.spec.bezelSystem === "integrated") return bad("This case has an integrated bezel.");
      if (k.spec.bezelSystem !== z.spec.bezelSystem) {
        return bad(k.spec.bezelSystem === "dive-120" ? "This case takes a rotating bezel." : "This case takes a fixed bezel.");
      }
      if (z.spec.bezelSystem === "fixed" && !z.spec.fitsCaseIds.includes(k.id)) {
        return bad("This fixed bezel is cut for a different case.");
      }
      return null;
    },
  }),
  rule({
    id: "bezel-insert-size",
    a: "bezel",
    b: "insert",
    check(z, i) {
      if (!z.spec.takesInsert) return bad("This bezel does not take an insert.");
      if (z.spec.insertOuterMm == null) return unknown("The bezel's insert seat has not been measured.");
      return same(z.spec.insertOuterMm, i.spec.outerMm)
        ? null
        : bad(`The insert is ${i.spec.outerMm} mm; this bezel seats ${z.spec.insertOuterMm} mm.`);
    },
  }),
  rule({
    id: "case-crystal-size",
    a: "case",
    b: "crystal",
    check(k, x) {
      return same(k.spec.crystalDiameterMm, x.spec.diameterMm)
        ? null
        : bad(`The crystal is ${x.spec.diameterMm} mm; this case seats ${k.spec.crystalDiameterMm} mm.`);
    },
  }),
  rule({
    id: "dial-crystal-cyclops",
    a: "dial",
    b: "crystal",
    check(d, x) {
      return x.spec.cyclops && d.spec.dateWindow === "none"
        ? bad("A date magnifier would sit over a dial with no date window.")
        : null;
    },
  }),
  rule({
    id: "case-chapter-ring",
    a: "case",
    b: "chapterRing",
    check(k, r) {
      if (!k.spec.chapterRingSize) return bad("This case has no chapter ring seat.");
      return k.spec.chapterRingSize === r.spec.size ? null : bad("This chapter ring is sized for a different case.");
    },
  }),
  rule({
    id: "case-band-lug-width",
    a: "case",
    b: "band",
    check(k, s) {
      if (!same(k.spec.lugWidthMm, s.spec.lugWidthMm)) {
        return bad(`This ${s.spec.kind === "bracelet" ? "bracelet" : "strap"} is ${s.spec.lugWidthMm} mm; the case lugs are ${k.spec.lugWidthMm} mm apart.`);
      }
      if (s.spec.endLinks === "fitted" && !s.spec.fitsCaseIds.includes(k.id)) {
        return bad("Its fitted end links are cut for a different case profile.");
      }
      return null;
    },
  }),
  rule({
    id: "band-clasp",
    a: "band",
    b: "clasp",
    check(s, q) {
      if (s.spec.claspInterface === "integrated") return bad("This strap has its own integrated buckle.");
      if (s.spec.claspInterface !== q.spec.interface) {
        return bad(q.spec.interface === "bracelet" ? "A bracelet clasp does not fit a strap." : "A strap buckle does not fit a bracelet.");
      }
      return same(s.spec.claspWidthMm, q.spec.widthMm)
        ? null
        : bad(`The band narrows to ${s.spec.claspWidthMm} mm; this clasp is ${q.spec.widthMm} mm.`);
    },
  }),
  rule({
    id: "case-caseback",
    a: "case",
    b: "caseback",
    check(k, b) {
      if (b.spec.fit !== k.spec.casebackFit) return bad("This caseback is threaded for a different case.");
      if (b.spec.kind === "exhibition" && !k.spec.supportsExhibitionCaseback) {
        return bad("This case does not accept a display caseback.");
      }
      return null;
    },
  }),
];

/* ── Engine ────────────────────────────────────────────────────────────── */

export interface OptionEvaluation {
  component: AnyComp;
  /** Result against choices made in earlier steps (decides availability). */
  status: CompatStatus;
  blocking: Issue[];
  /** Later choices that would need to change if this option is picked. */
  affects: Issue[];
  available: boolean;
  unavailableReason: string | null;
  /** Precomputed result of choosing this option (null if already selected). */
  proposal: Proposal | null;
}

export interface Change {
  slot: Slot;
  from: string | null;
  to: string | null;
  reason: string;
  kind: "replaced" | "removed" | "added";
}

export interface Proposal {
  next: Configuration;
  changes: Change[];
  /** Later slots for which no compatible replacement exists. */
  blocked: { slot: Slot; message: string }[];
  /** True when existing customer choices are replaced or removed. */
  needsConfirmation: boolean;
}

export interface Validation {
  ok: boolean;
  issues: Issue[];
  missing: Slot[];
  unavailable: { slot: Slot; id: string; reason: string }[];
}

const slotIndex = (s: Slot) => SLOT_ORDER.indexOf(s);

export function createEngine(catalog: Pick<PublicCatalog, "components" | "movementFamilies" | "compat">) {
  const byId = new Map<string, AnyComp>(catalog.components.map((c) => [c.id, c]));
  const families = new Map(catalog.movementFamilies.map((f) => [f.id, f]));
  const ctx: RuleCtx = { family: (id) => families.get(id) };
  const explicit = new Map<string, { status: CompatStatus; note: string }>();
  for (const r of catalog.compat) {
    explicit.set(`${r.aId}::${r.bId}`, r);
    explicit.set(`${r.bId}::${r.aId}`, r);
  }
  const rulesByPair = new Map<string, Rule<ComponentType, ComponentType>[]>();
  for (const r of RULES) {
    const k = `${r.a}::${r.b}`;
    rulesByPair.set(k, [...(rulesByPair.get(k) ?? []), r]);
  }
  const byType = new Map<ComponentType, AnyComp[]>();
  for (const c of catalog.components) {
    if (!c.active) continue;
    byType.set(c.type, [...(byType.get(c.type) ?? []), c]);
  }
  for (const list of byType.values()) list.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));

  const get = (id: string | undefined | null) => (id ? byId.get(id) : undefined);

  /** Issues between two specific components (either order). */
  function pairIssues(x: AnyComp, y: AnyComp): Issue[] {
    const override = explicit.get(`${x.id}::${y.id}`);
    if (override) {
      return override.status === "compatible"
        ? []
        : [
            {
              ruleId: "atelier-record",
              status: override.status,
              slots: [x.type as Slot, y.type as Slot],
              ids: [x.id, y.id],
              message:
                override.note ||
                (override.status === "incompatible" ? "Recorded by the atelier as incompatible." : "Not yet confirmed by the atelier."),
            },
          ];
    }
    const out: Issue[] = [];
    const forward = rulesByPair.get(`${x.type}::${y.type}`) ?? [];
    const backward = rulesByPair.get(`${y.type}::${x.type}`) ?? [];
    for (const r of forward) {
      const v = r.check(x as never, y as never, ctx);
      if (v) out.push({ ruleId: r.id, status: v.status, slots: [x.type as Slot, y.type as Slot], ids: [x.id, y.id], message: v.message });
    }
    for (const r of backward) {
      const v = r.check(y as never, x as never, ctx);
      if (v) out.push({ ruleId: r.id, status: v.status, slots: [y.type as Slot, x.type as Slot], ids: [y.id, x.id], message: v.message });
    }
    return out;
  }

  function worst(issues: Issue[]): CompatStatus {
    if (issues.some((i) => i.status === "incompatible")) return "incompatible";
    if (issues.length) return "unconfirmed";
    return "compatible";
  }

  /** Whether a slot applies to this configuration at all. */
  function applicable(config: Configuration, slot: Slot): boolean {
    const kase = get(config.parts.case) as C<"case"> | undefined;
    switch (slot) {
      case "bezel":
        return !kase || kase.spec.bezelSystem !== "integrated";
      case "insert": {
        if (!applicable(config, "bezel")) return false;
        const bezel = get(config.parts.bezel) as C<"bezel"> | undefined;
        return Boolean(bezel?.spec.takesInsert);
      }
      case "chapterRing":
        return !kase || Boolean(kase.spec.chapterRingSize);
      case "clasp": {
        const band = get(config.parts.band) as C<"band"> | undefined;
        return !band || band.spec.claspInterface !== "integrated";
      }
      default:
        return true;
    }
  }

  function evaluateAgainst(config: Configuration, candidate: AnyComp, slots: readonly Slot[]): Issue[] {
    const issues: Issue[] = [];
    for (const s of slots) {
      if (s === candidate.type) continue;
      const other = get(config.parts[s]);
      if (other) issues.push(...pairIssues(candidate, other));
    }
    return issues;
  }

  function stockReason(c: AnyComp): string | null {
    if (!c.active) return "No longer offered.";
    if (c.stock.status === "out_of_stock") return "Currently unavailable.";
    return null;
  }

  /** Every option for a slot, evaluated against the current configuration. */
  function options(config: Configuration, slot: Slot): OptionEvaluation[] {
    const earlier = SLOT_ORDER.filter((s) => slotIndex(s) < slotIndex(slot));
    const later = SLOT_ORDER.filter((s) => slotIndex(s) > slotIndex(slot));
    return (byType.get(slot) ?? []).map((component) => {
      const blocking = evaluateAgainst(config, component, earlier);
      const affects = evaluateAgainst(config, component, later);
      const status = worst(blocking);
      const stock = stockReason(component);
      let available = status === "compatible" && !stock;
      let unavailableReason = stock ?? (blocking[0]?.message || null);
      let proposal: Proposal | null = null;
      if (available) {
        // Lookahead: only offer parts that still lead to a complete, valid watch.
        proposal = config.parts[slot] === component.id ? null : propose(config, slot, component.id);
        if (proposal?.blocked.length) {
          available = false;
          const b = proposal.blocked[0];
          unavailableReason = `No ${SLOT_LABEL[b.slot].toLowerCase()} can complete this build. ${b.message}`;
        }
      }
      return { component, status, blocking, affects, available, unavailableReason, proposal };
    });
  }

  function similarity(a: AnyComp, b: AnyComp): number {
    let score = 0;
    const sa = a.spec as Record<string, unknown>;
    const sb = b.spec as Record<string, unknown>;
    for (const key of Object.keys(sa)) {
      const x = sa[key];
      const y = sb[key];
      if (typeof x === "string" && typeof y === "string" && /^#[0-9a-f]{6}$/i.test(x) && /^#[0-9a-f]{6}$/i.test(y)) {
        score += 2 * (1 - hexDistance(x, y));
      } else if (x === y && x !== null && typeof x !== "object") {
        score += key === "colorName" ? 3 : 1;
      }
    }
    return score;
  }

  /** Compatible candidates for `slot`, most similar to `like` first. */
  function candidatesFor(config: Configuration, slot: Slot, settled: readonly Slot[], like?: AnyComp): AnyComp[] {
    const list = (byType.get(slot) ?? []).filter(
      (c) => !stockReason(c) && worst(evaluateAgainst(config, c, settled)) === "compatible",
    );
    if (!like) return list;
    return list
      .map((c) => ({ c, score: c.id === like.id ? Infinity : similarity(like, c) }))
      .sort((a, b) => b.score - a.score)
      .map((x) => x.c);
  }

  function bestFor(config: Configuration, slot: Slot, settled: readonly Slot[], like?: AnyComp): AnyComp | null {
    return candidatesFor(config, slot, settled, like)[0] ?? null;
  }

  /**
   * Apply a change and repair every other slot. Choices in earlier steps are
   * locked; later slots keep their part when it still fits, otherwise take
   * the most similar compatible part. A bounded depth-first search avoids
   * dead ends (e.g. a dial that fits the movement but no available case).
   * Nothing is applied until the caller commits `next`; `needsConfirmation`
   * tells the UI to ask first.
   */
  function propose(config: Configuration, slot: Slot, id: string | null): Proposal {
    const parts: Configuration["parts"] = { ...config.parts };
    if (id) parts[slot] = id;
    else delete parts[slot];
    const working: Configuration = { ...config, parts };
    const order = SLOT_ORDER.filter((s) => s !== slot);
    const assigned: Slot[] = [slot];
    let budget = 6000;

    const dfs = (i: number): boolean => {
      if (i === order.length) return true;
      const s = order[i];
      const original = get(config.parts[s]);
      if (!applicable(working, s)) {
        delete parts[s];
        return dfs(i + 1);
      }
      const locked = slotIndex(s) < slotIndex(slot);
      const pool = locked
        ? original && worst(evaluateAgainst(working, original, assigned)) === "compatible" && !stockReason(original)
          ? [original]
          : []
        : candidatesFor(working, s, assigned, original);
      for (const c of pool) {
        if (--budget < 0) return false;
        parts[s] = c.id;
        assigned.push(s);
        if (dfs(i + 1)) return true;
        assigned.pop();
      }
      delete parts[s];
      return false;
    };

    const solved = dfs(0);
    const blocked: Proposal["blocked"] = [];
    if (!solved) {
      // Fall back to a greedy repair so the UI can explain exactly what cannot fit.
      Object.keys(parts).forEach((k) => delete parts[k as Slot]);
      Object.assign(parts, config.parts);
      if (id) parts[slot] = id;
      for (const s of order) {
        if (!applicable(working, s)) {
          delete parts[s];
          continue;
        }
        const settled = SLOT_ORDER.filter((x) => (slotIndex(x) < slotIndex(s) || x === slot) && x !== s && parts[x]);
        const current = get(parts[s]);
        if (current && worst(evaluateAgainst(working, current, settled)) === "compatible" && !stockReason(current)) continue;
        const pick = bestFor(working, s, settled, current);
        if (pick) parts[s] = pick.id;
        else {
          const issue = current ? evaluateAgainst(working, current, settled)[0] : undefined;
          blocked.push({ slot: s, message: issue?.message ?? `No compatible ${SLOT_LABEL[s].toLowerCase()} is available.` });
        }
      }
    }

    const changes: Change[] = [];
    for (const s of order) {
      const from = config.parts[s] ?? null;
      const to = parts[s] ?? null;
      if (from === to) continue;
      if (from && !to) {
        changes.push({ slot: s, from, to: null, kind: "removed", reason: applicable(working, s) ? `No compatible ${SLOT_LABEL[s].toLowerCase()} is available.` : notApplicableReason(s) });
      } else if (!from && to) {
        changes.push({ slot: s, from: null, to, kind: "added", reason: `${SLOT_LABEL[s]} now applies to this build.` });
      } else if (from && to) {
        const old = get(from)!;
        const others = SLOT_ORDER.filter((x) => x !== s && parts[x]);
        const reason =
          stockReason(old) ??
          evaluateAgainst(working, old, others)[0]?.message ??
          "Changed so the remaining parts fit together.";
        changes.push({ slot: s, from, to, kind: "replaced", reason });
      }
    }
    return { next: working, changes, blocked, needsConfirmation: changes.some((c) => c.kind !== "added") };
  }

  function notApplicableReason(s: Slot): string {
    switch (s) {
      case "bezel":
        return "This case has an integrated bezel.";
      case "insert":
        return "The selected bezel has no insert.";
      case "chapterRing":
        return "This case has no chapter ring.";
      case "clasp":
        return "This strap has its own buckle.";
      default:
        return "Not used with this build.";
    }
  }

  /** Fill gaps and drop inapplicable slots without replacing valid choices. */
  function normalize(config: Configuration): Configuration {
    let next: Configuration = { ...config, parts: { ...config.parts } };
    for (const s of SLOT_ORDER) {
      if (!applicable(next, s)) {
        delete next.parts[s];
        continue;
      }
      if (!get(next.parts[s])) {
        const settled = SLOT_ORDER.filter((x) => slotIndex(x) < slotIndex(s));
        const fill = bestFor(next, s, settled);
        if (fill) next.parts[s] = fill.id;
      }
    }
    // A second pass picks up slots that became applicable (e.g. insert after bezel).
    for (const s of SLOT_ORDER) {
      if (applicable(next, s) && !get(next.parts[s])) {
        const fill = bestFor(next, s, SLOT_ORDER.filter((x) => slotIndex(x) < slotIndex(s)));
        if (fill) next.parts[s] = fill.id;
      } else if (!applicable(next, s)) delete next.parts[s];
    }
    next = { ...next, options: [...new Set(next.options)] };
    return next;
  }

  /** Full validation, used by the server before accepting an order. */
  function validate(config: Configuration): Validation {
    const issues: Issue[] = [];
    const missing: Slot[] = [];
    const unavailable: Validation["unavailable"] = [];
    const present: AnyComp[] = [];
    for (const s of SLOT_ORDER) {
      const id = config.parts[s];
      const app = applicable(config, s);
      if (!app) {
        if (id) issues.push({ ruleId: "not-applicable", status: "incompatible", slots: [s, s], ids: [id, id], message: notApplicableReason(s) });
        continue;
      }
      const c = get(id);
      if (!c) {
        missing.push(s);
        continue;
      }
      if (c.type !== s) {
        issues.push({ ruleId: "wrong-slot", status: "incompatible", slots: [s, s], ids: [c.id, c.id], message: "Component placed in the wrong slot." });
        continue;
      }
      const reason = stockReason(c);
      if (reason) unavailable.push({ slot: s, id: c.id, reason });
      present.push(c);
    }
    for (let i = 0; i < present.length; i++) {
      for (let j = i + 1; j < present.length; j++) issues.push(...pairIssues(present[i], present[j]));
    }
    return { ok: !issues.length && !missing.length && !unavailable.length, issues, missing, unavailable };
  }

  return {
    get,
    family: (id: string) => families.get(id),
    listType: (t: ComponentType) => byType.get(t) ?? [],
    pairIssues,
    applicable,
    options,
    propose,
    normalize,
    validate,
    worst,
  };
}

export type Engine = ReturnType<typeof createEngine>;

function hexDistance(a: string, b: string): number {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [r1, g1, b1] = p(a);
  const [r2, g2, b2] = p(b);
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2) / 441.7;
}
