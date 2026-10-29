import type { Category, MerchantMemory } from "@/db/db";
import type { ClassificationMethod, Direction, ParsedFields, TxnKind } from "./model";
import { findBrand } from "./merchants";

export interface Suggestion {
  kind: TxnKind;
  categoryId: string | null;
  confidence: number;
  method: ClassificationMethod;
}

/**
 * Confidence from the user's own history with a merchant. Grows with agreement
 * *and* volume: 1 confirmation ≈ 0.5, 2 ≈ 0.75, 3 consistent ≈ 0.875, 4 ≈ 0.94.
 * A single disagreeing correction drops it below the auto-file threshold.
 */
export function memoryConfidence(counts: Record<string, number>) {
  let total = 0;
  let top: string | null = null;
  let topN = 0;
  for (const [k, n] of Object.entries(counts)) {
    total += n;
    if (n > topN) {
      top = k;
      topN = n;
    }
  }
  if (!top || total === 0) return { key: null, confidence: 0 };
  return { key: top, confidence: (topN / total) * (1 - 0.5 ** total) };
}

export interface ClassifyContext {
  categories: Category[];
  memory: MerchantMemory | undefined;
}

/** Deterministic classification. Unknown stays unknown — nothing is invented. */
export function classify(direction: Direction | null, parsed: Pick<ParsedFields, "hints" | "merchant" | "counterparty">, ctx: ClassifyContext): Suggestion {
  const none: Suggestion = { kind: "unknown", categoryId: null, confidence: 0, method: "none" };
  if (!direction) return none;
  const byKey = (k: string) => ctx.categories.find((c) => c.key === k) ?? null;

  if (direction === "out" && parsed.hints.atm) return { kind: "transfer", categoryId: null, confidence: 0.9, method: "rule" };

  if (ctx.memory) {
    const { key, confidence } = memoryConfidence(ctx.memory.counts);
    if (key?.startsWith("kind:")) {
      const kind = key.slice(5) as TxnKind;
      if (!(kind === "income" && direction === "out")) return { kind, categoryId: null, confidence, method: "merchant_memory" };
    } else if (key) {
      const cat = ctx.categories.find((c) => c.id === key);
      if (cat) {
        // An expense category on incoming money from the same merchant means a refund.
        const kind: TxnKind = direction === "out" ? (cat.kind === "expense" ? "expense" : "unknown") : cat.kind === "income" ? "income" : "refund";
        if (kind !== "unknown") return { kind, categoryId: cat.id, confidence, method: "merchant_memory" };
      }
    }
  }

  if (direction === "out") {
    const brand = findBrand(parsed.merchant ?? parsed.counterparty);
    const cat = brand ? byKey(brand.category) : null;
    if (cat) return { kind: "expense", categoryId: cat.id, confidence: 0.6, method: "rule" };
    return none;
  }

  if (parsed.hints.refund) return { kind: "refund", categoryId: null, confidence: 0.7, method: "rule" };
  if (parsed.hints.salary) {
    const cat = byKey("salary");
    return { kind: "income", categoryId: cat?.id ?? null, confidence: 0.7, method: "rule" };
  }
  // Incoming money is never assumed to be earned income.
  return none;
}
