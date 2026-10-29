import { addDays, differenceInCalendarDays } from "date-fns";
import type { Transaction } from "@/db/db";
import { isLive } from "./model";

export interface Recurring {
  merchantKey: string;
  label: string;
  cadence: "weekly" | "monthly";
  typicalAmount: number;
  lastDate: number;
  nextExpected: number;
  categoryId: string | null;
  transactionIds: string[];
}

/**
 * Deterministic recurring-charge detection: the same merchant charging a
 * similar amount (±15% of the median) on a weekly or monthly rhythm, at least
 * three times — or twice for monthly. No AI involved.
 */
export function detectRecurring(txns: Transaction[], now = Date.now()): Recurring[] {
  const since = now - 200 * 86_400_000;
  const groups = new Map<string, Transaction[]>();
  for (const t of txns) {
    if (t.direction !== "out" || t.kind !== "expense" || !t.merchantKey || !isLive(t.posting) || t.occurredAt < since) continue;
    groups.set(t.merchantKey, [...(groups.get(t.merchantKey) ?? []), t]);
  }
  const out: Recurring[] = [];
  for (const [key, list] of groups) {
    if (list.length < 2) continue;
    list.sort((a, b) => a.occurredAt - b.occurredAt);
    const amounts = list.map((t) => t.amount).sort((a, b) => a - b);
    const median = amounts[Math.floor(amounts.length / 2)];
    const similar = list.filter((t) => Math.abs(t.amount - median) <= median * 0.15);
    if (similar.length < 2) continue;
    const gaps = similar.slice(1).map((t, i) => differenceInCalendarDays(t.occurredAt, similar[i].occurredAt));
    const monthly = gaps.every((g) => g >= 25 && g <= 35);
    const weekly = gaps.every((g) => g >= 6 && g <= 8) && similar.length >= 3;
    if (!monthly && !weekly) continue;
    const last = similar[similar.length - 1];
    // Stale: a monthly charge not seen for 2+ cycles is probably cancelled.
    if (now - last.occurredAt > (monthly ? 70 : 21) * 86_400_000) continue;
    out.push({
      merchantKey: key,
      label: last.merchant ?? key,
      cadence: monthly ? "monthly" : "weekly",
      typicalAmount: median,
      lastDate: last.occurredAt,
      nextExpected: addDays(last.occurredAt, monthly ? 30 : 7).getTime(),
      categoryId: last.categoryId,
      transactionIds: similar.map((t) => t.id),
    });
  }
  return out.sort((a, b) => b.typicalAmount - a.typicalAmount);
}
