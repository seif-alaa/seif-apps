import { eachDayOfInterval, endOfMonth, format, isAfter, startOfMonth, subMonths } from "date-fns";
import type { Account, Budget, Category, Transaction } from "@/db/db";
import { isLive } from "./model";

/**
 * The single source of truth for every number Ledger shows. Home, Activity,
 * Budgets, Insights and reports all call these functions, so screens can't disagree.
 *
 * Rules:
 *  - Balances move only with posted money (pending is shown, not counted).
 *  - Spending  = expenses − refunds + transfer fees.   (pending purchases included)
 *  - Income    = transactions classified as income. Unclassified inflows are reported separately.
 *  - Transfers between own accounts and balance adjustments are neither spending nor income.
 */

export const signedAmount = (t: Pick<Transaction, "amount" | "direction">) => (t.direction === "in" ? t.amount : t.direction === "out" ? -t.amount : 0);

export function accountBalance(account: Account, txns: Transaction[]) {
  let b = account.startingBalance;
  for (const t of txns) if (t.accountId === account.id && t.posting === "posted") b += signedAmount(t);
  return b;
}

export function pendingAmount(accountId: string, txns: Transaction[]) {
  let p = 0;
  for (const t of txns) if (t.accountId === accountId && t.posting === "pending") p += signedAmount(t);
  return p;
}

export function balances(accounts: Account[], txns: Transaction[]) {
  const map = new Map<string, number>(accounts.map((a) => [a.id, a.startingBalance]));
  for (const t of txns) if (t.accountId && t.posting === "posted" && map.has(t.accountId)) map.set(t.accountId, map.get(t.accountId)! + signedAmount(t));
  return map;
}

/** Net worth in one currency. Accounts in other currencies are listed, never silently converted. */
export function netWorth(accounts: Account[], txns: Transaction[], currency: string) {
  const b = balances(accounts, txns);
  let total = 0;
  const other = new Map<string, number>();
  for (const a of accounts) {
    if (a.archived) continue;
    const v = b.get(a.id) ?? 0;
    if (a.currency === currency) total += v;
    else other.set(a.currency, (other.get(a.currency) ?? 0) + v);
  }
  return { total, other: [...other.entries()].map(([c, amount]) => ({ currency: c, amount })) };
}

export interface PeriodSummary {
  income: number;
  spending: number;
  expenses: number;
  refunds: number;
  fees: number;
  /** Money out Ledger hasn't classified yet (shown as "to review"). */
  unknownOut: number;
  /** Money in Ledger hasn't classified yet — not counted as income. */
  unknownIn: number;
  cashWithdrawn: number;
  net: number;
  savingsRate: number | null;
  byCategory: Map<string, number>;
  incomeByCategory: Map<string, number>;
  count: number;
}

export function inPeriod(txns: Transaction[], from: number, to: number, currency?: string) {
  return txns.filter((t) => t.occurredAt >= from && t.occurredAt <= to && isLive(t.posting) && (!currency || t.currency === currency));
}

export function summarize(txns: Transaction[], from: number, to: number, currency: string, accounts?: Account[]): PeriodSummary {
  const s: PeriodSummary = {
    income: 0,
    spending: 0,
    expenses: 0,
    refunds: 0,
    fees: 0,
    unknownOut: 0,
    unknownIn: 0,
    cashWithdrawn: 0,
    net: 0,
    savingsRate: null,
    byCategory: new Map(),
    incomeByCategory: new Map(),
    count: 0,
  };
  const cashIds = new Set(accounts?.filter((a) => a.kind === "cash").map((a) => a.id));
  const groups = new Map<string, Transaction[]>();
  for (const t of inPeriod(txns, from, to, currency)) {
    s.count++;
    const cat = t.categoryId ?? "_none";
    switch (t.kind) {
      case "expense":
        if (t.direction === "out") {
          s.expenses += t.amount;
          s.byCategory.set(cat, (s.byCategory.get(cat) ?? 0) + t.amount);
        } else if (t.direction === "in") {
          // An "expense" record flowing in is effectively a refund.
          s.refunds += t.amount;
          s.byCategory.set(cat, (s.byCategory.get(cat) ?? 0) - t.amount);
        }
        break;
      case "refund":
        if (t.direction === "in") {
          s.refunds += t.amount;
          s.byCategory.set(cat, (s.byCategory.get(cat) ?? 0) - t.amount);
        }
        break;
      case "income":
        if (t.direction === "in") {
          s.income += t.amount;
          s.incomeByCategory.set(cat, (s.incomeByCategory.get(cat) ?? 0) + t.amount);
        }
        break;
      case "unknown":
        if (t.direction === "out") s.unknownOut += t.amount;
        else if (t.direction === "in") s.unknownIn += t.amount;
        break;
      case "transfer":
        if (t.transferGroupId) groups.set(t.transferGroupId, [...(groups.get(t.transferGroupId) ?? []), t]);
        if (t.direction === "out" && ((t.counterAccountId && cashIds.has(t.counterAccountId)) || (!t.counterAccountId && t.merchant === "ATM"))) s.cashWithdrawn += t.amount;
        break;
      case "adjustment":
        break;
    }
  }
  // Fees: the difference between what left one account and what arrived in the other.
  for (const legs of groups.values()) {
    const out = legs.find((l) => l.direction === "out");
    const inn = legs.find((l) => l.direction === "in");
    if (out && inn && out.amount > inn.amount) s.fees += out.amount - inn.amount;
  }
  if (s.fees) s.byCategory.set("_fees", (s.byCategory.get("_fees") ?? 0) + s.fees);
  for (const [k, v] of s.byCategory) if (v <= 0) s.byCategory.delete(k);
  s.spending = Math.max(0, s.expenses - s.refunds + s.fees);
  s.net = s.income - s.spending;
  s.savingsRate = s.income > 0 ? s.net / s.income : null;
  return s;
}

export function monthRange(month: Date) {
  return { from: startOfMonth(month).getTime(), to: endOfMonth(month).getTime() };
}

export function monthSummary(txns: Transaction[], month: Date, currency: string, accounts?: Account[]) {
  const { from, to } = monthRange(month);
  return summarize(txns, from, to, currency, accounts);
}

export function monthlySeries(txns: Transaction[], months: number, anchor: Date, currency: string) {
  return Array.from({ length: months }, (_, i) => {
    const m = subMonths(anchor, months - 1 - i);
    const s = monthSummary(txns, m, currency);
    return { key: format(m, "yyyy-MM"), month: m, income: s.income, spending: s.spending };
  });
}

/** Spending per day in a month (refunds netted on the day they arrive). */
export function dailySpending(txns: Transaction[], month: Date, currency: string) {
  const days = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) });
  const today = new Date();
  return days.map((d) => {
    const from = d.getTime();
    const to = from + 86_400_000 - 1;
    const future = isAfter(d, today);
    return { day: d.getDate(), date: d, spending: future ? null : summarize(txns, from, to, currency).spending };
  });
}

export interface BudgetLine {
  budget: Budget;
  category: Category;
  spent: number;
  remaining: number;
  ratio: number;
  /** Fraction of the month elapsed (1 for past months). */
  pace: number;
  status: "on_track" | "watch" | "over";
}

export function budgetLines(budgets: Budget[], categories: Category[], txns: Transaction[], month: Date, currency: string): BudgetLine[] {
  const s = monthSummary(txns, month, currency);
  const { from, to } = monthRange(month);
  const now = Date.now();
  const pace = now >= to ? 1 : now <= from ? 0 : (now - from) / (to - from);
  return budgets
    .map((b) => {
      const category = categories.find((c) => c.id === b.categoryId);
      if (!category || b.amount <= 0) return null;
      const spent = s.byCategory.get(b.categoryId) ?? 0;
      const ratio = spent / b.amount;
      const status: BudgetLine["status"] = ratio > 1 ? "over" : ratio > Math.max(0.85, pace + 0.1) ? "watch" : "on_track";
      return { budget: b, category, spent, remaining: b.amount - spent, ratio, pace, status };
    })
    .filter((x): x is BudgetLine => !!x)
    .sort((a, b) => b.ratio - a.ratio);
}

/** Review queue, newest first. */
export const needsReview = (txns: Transaction[]) => txns.filter((t) => t.review === "needs_review").sort((a, b) => b.occurredAt - a.occurredAt);

/** Collapse the two legs of a transfer into a single row for lists. */
export function collapseTransfers(txns: Transaction[]) {
  const seen = new Set<string>();
  const out: Transaction[] = [];
  for (const t of txns) {
    if (t.transferGroupId) {
      if (seen.has(t.transferGroupId)) continue;
      seen.add(t.transferGroupId);
      // Show the outgoing leg (it carries the full amount incl. any fee).
      const partner = txns.find((x) => x.transferGroupId === t.transferGroupId && x.id !== t.id);
      out.push(t.direction === "in" && partner?.direction === "out" ? partner : t);
    } else out.push(t);
  }
  return out;
}
