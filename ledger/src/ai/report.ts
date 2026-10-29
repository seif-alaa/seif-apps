import { endOfMonth, format, startOfMonth, subMonths } from "date-fns";
import type { Account, Budget, Category, Transaction } from "@/db/db";
import { budgetLines, needsReview, summarize, type PeriodSummary } from "@/engine/ledger";
import { detectRecurring, type Recurring } from "@/engine/recurring";
import { isLive } from "@/engine/model";

/**
 * Deterministic financial reports. Every number here is computed from the
 * ledger by the same functions the screens use. An AI provider may *explain*
 * a report, but never produces the figures.
 */

export interface ReportPeriod {
  from: number;
  to: number;
  label: string;
}

export interface CategoryLine {
  categoryId: string;
  amount: number;
  share: number;
  previous: number;
  /** Relative change vs previous period, null if there was nothing before. */
  change: number | null;
}

export interface UnusualTxn {
  transactionId: string;
  amount: number;
  merchant: string | null;
  categoryId: string | null;
  /** How many times the category's typical (median) spend. */
  multiple: number;
}

export interface FinancialReport {
  version: 1;
  generatedAt: number;
  currency: string;
  period: ReportPeriod;
  previousPeriod: ReportPeriod;
  totals: Totals;
  previous: Totals;
  categories: CategoryLine[];
  budgets: { categoryId: string; budget: number; spent: number; remaining: number; status: string }[];
  recurring: Recurring[];
  unusual: UnusualTxn[];
  topMerchants: { label: string; amount: number; count: number }[];
  dataQuality: { needsReview: number; unknownOut: number; unknownIn: number; containsSampleData: boolean };
}

type Totals = Pick<PeriodSummary, "income" | "spending" | "net" | "savingsRate" | "fees" | "refunds" | "cashWithdrawn" | "unknownIn" | "unknownOut">;

const pick = (s: PeriodSummary): Totals => ({
  income: s.income,
  spending: s.spending,
  net: s.net,
  savingsRate: s.savingsRate,
  fees: s.fees,
  refunds: s.refunds,
  cashWithdrawn: s.cashWithdrawn,
  unknownIn: s.unknownIn,
  unknownOut: s.unknownOut,
});

export interface ReportInput {
  txns: Transaction[];
  categories: Category[];
  budgets: Budget[];
  accounts: Account[];
  currency: string;
}

export function monthPeriod(month: Date): ReportPeriod {
  return { from: startOfMonth(month).getTime(), to: endOfMonth(month).getTime(), label: format(month, "yyyy-MM") };
}

export function buildReport(input: ReportInput, period: ReportPeriod, previousPeriod: ReportPeriod, now = Date.now()): FinancialReport {
  const { txns, currency } = input;
  const cur = summarize(txns, period.from, period.to, currency, input.accounts);
  const prev = summarize(txns, previousPeriod.from, previousPeriod.to, currency, input.accounts);
  const total = [...cur.byCategory.values()].reduce((a, b) => a + b, 0);
  const keys = new Set([...cur.byCategory.keys(), ...prev.byCategory.keys()]);
  const categories: CategoryLine[] = [...keys]
    .map((id) => {
      const amount = cur.byCategory.get(id) ?? 0;
      const previous = prev.byCategory.get(id) ?? 0;
      return { categoryId: id, amount, previous, share: total ? amount / total : 0, change: previous ? (amount - previous) / previous : null };
    })
    .sort((a, b) => b.amount - a.amount);

  const inP = txns.filter((t) => t.occurredAt >= period.from && t.occurredAt <= period.to && isLive(t.posting) && t.currency === currency);

  // Unusual: more than 3× the category's median over the prior 90 days, with enough history to judge.
  const history = txns.filter((t) => t.kind === "expense" && t.direction === "out" && t.occurredAt < period.from && t.occurredAt >= period.from - 90 * 86_400_000);
  const medians = new Map<string, number>();
  const byCat = new Map<string, number[]>();
  for (const t of history) if (t.categoryId) byCat.set(t.categoryId, [...(byCat.get(t.categoryId) ?? []), t.amount]);
  for (const [k, v] of byCat) if (v.length >= 5) medians.set(k, v.sort((a, b) => a - b)[Math.floor(v.length / 2)]);
  const unusual: UnusualTxn[] = inP
    .filter((t) => t.kind === "expense" && t.direction === "out" && t.categoryId && medians.has(t.categoryId) && t.amount > 3 * medians.get(t.categoryId)!)
    .map((t) => ({ transactionId: t.id, amount: t.amount, merchant: t.merchant, categoryId: t.categoryId, multiple: t.amount / medians.get(t.categoryId!)! }))
    .sort((a, b) => b.multiple - a.multiple)
    .slice(0, 5);

  const merchants = new Map<string, { label: string; amount: number; count: number }>();
  for (const t of inP) {
    if (t.kind !== "expense" || t.direction !== "out" || !t.merchantKey) continue;
    const m = merchants.get(t.merchantKey) ?? { label: t.merchant ?? t.merchantKey, amount: 0, count: 0 };
    m.amount += t.amount;
    m.count++;
    merchants.set(t.merchantKey, m);
  }

  return {
    version: 1,
    generatedAt: now,
    currency,
    period,
    previousPeriod,
    totals: pick(cur),
    previous: pick(prev),
    categories,
    budgets: budgetLines(input.budgets, input.categories, txns, new Date(period.from), currency).map((b) => ({
      categoryId: b.category.id,
      budget: b.budget.amount,
      spent: b.spent,
      remaining: b.remaining,
      status: b.status,
    })),
    recurring: detectRecurring(txns, Math.min(now, period.to)),
    unusual,
    topMerchants: [...merchants.values()].sort((a, b) => b.amount - a.amount).slice(0, 5),
    dataQuality: {
      needsReview: needsReview(inP).length,
      unknownOut: cur.unknownOut,
      unknownIn: cur.unknownIn,
      containsSampleData: inP.some((t) => t.origin !== "real"),
    },
  };
}

export function monthlyReport(input: ReportInput, month: Date, now = Date.now()) {
  return buildReport(input, monthPeriod(month), monthPeriod(subMonths(month, 1)), now);
}
