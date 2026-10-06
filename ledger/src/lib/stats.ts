import {
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  getDaysInMonth,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import type { Account, Budget, Category, Transaction } from "@/db/db";

export const signed = (t: Transaction) => (t.type === "income" ? t.amount : -t.amount);

export function accountBalances(accounts: Account[], txns: Transaction[]) {
  const map = new Map(accounts.map((a) => [a.id, a.startingBalance]));
  for (const t of txns) map.set(t.accountId, (map.get(t.accountId) ?? 0) + signed(t));
  return map;
}

export function inRange(txns: Transaction[], from: Date, to: Date) {
  const a = from.getTime();
  const b = to.getTime();
  return txns.filter((t) => t.date >= a && t.date <= b);
}

export function totals(txns: Transaction[]) {
  let income = 0;
  let expense = 0;
  for (const t of txns) t.type === "income" ? (income += t.amount) : (expense += t.amount);
  return { income, expense, net: income - expense };
}

export function monthTxns(txns: Transaction[], month: Date) {
  return inRange(txns, startOfMonth(month), endOfMonth(month));
}

export interface CategorySpend {
  category: Category;
  amount: number;
  share: number;
  count: number;
}

export function spendByCategory(txns: Transaction[], cats: Map<string, Category>): CategorySpend[] {
  const sums = new Map<string, { amount: number; count: number }>();
  let total = 0;
  for (const t of txns) {
    if (t.type !== "expense") continue;
    const s = sums.get(t.categoryId) ?? { amount: 0, count: 0 };
    s.amount += t.amount;
    s.count += 1;
    sums.set(t.categoryId, s);
    total += t.amount;
  }
  return [...sums.entries()]
    .filter(([id]) => cats.has(id))
    .map(([id, s]) => ({ category: cats.get(id)!, amount: s.amount, count: s.count, share: total ? s.amount / total : 0 }))
    .sort((a, b) => b.amount - a.amount);
}

/** Cumulative spend per day of a month, with the even-pace budget line. */
export function dailyCumulative(txns: Transaction[], month: Date, budgetTotal: number) {
  const days = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) });
  const perDay = new Map<number, number>();
  for (const t of monthTxns(txns, month)) {
    if (t.type === "expense") perDay.set(new Date(t.date).getDate(), (perDay.get(new Date(t.date).getDate()) ?? 0) + t.amount);
  }
  const today = new Date();
  const lastDay = isSameMonth(month, today) ? today.getDate() : days.length;
  let running = 0;
  return days.map((d) => {
    const n = d.getDate();
    running += perDay.get(n) ?? 0;
    return {
      day: n,
      label: format(d, "MMM d"),
      spent: n <= lastDay ? running / 100 : null,
      pace: budgetTotal ? ((budgetTotal / days.length) * n) / 100 : null,
    };
  });
}

export function monthlySeries(txns: Transaction[], months = 6, anchor = new Date()) {
  return Array.from({ length: months }, (_, i) => {
    const m = subMonths(anchor, months - 1 - i);
    const t = totals(monthTxns(txns, m));
    return { key: format(m, "yyyy-MM"), label: format(m, "MMM"), income: t.income / 100, expense: t.expense / 100 };
  });
}

export interface BudgetStatus {
  budget: Budget;
  category: Category;
  spent: number;
  ratio: number;
  /** Where spending "should" be by today if spread evenly. */
  paceRatio: number;
  tone: "good" | "warn" | "over";
}

export function budgetStatuses(budgets: Budget[], txns: Transaction[], cats: Map<string, Category>, month = new Date()): BudgetStatus[] {
  const spent = new Map<string, number>();
  for (const t of monthTxns(txns, month)) if (t.type === "expense") spent.set(t.categoryId, (spent.get(t.categoryId) ?? 0) + t.amount);
  const paceRatio = isSameMonth(month, new Date()) ? new Date().getDate() / getDaysInMonth(month) : 1;
  return budgets
    .filter((b) => cats.has(b.categoryId) && b.amount > 0)
    .map((b) => {
      const s = spent.get(b.categoryId) ?? 0;
      const ratio = s / b.amount;
      const tone: BudgetStatus["tone"] = ratio > 1 ? "over" : ratio > Math.max(0.85, paceRatio + 0.1) ? "warn" : "good";
      return { budget: b, category: cats.get(b.categoryId)!, spent: s, ratio, paceRatio, tone };
    })
    .sort((a, b) => b.ratio - a.ratio);
}

export interface Vibe {
  emoji: string;
  title: string;
  body: string;
  tone: "good" | "warn" | "over" | "neutral";
}

/**
 * The friendly one-liner on Home. Compares this week's spending on budgeted
 * categories against the week's share of the monthly budgets.
 */
export function weeklyVibe(budgets: Budget[], txns: Transaction[], name: string): Vibe {
  const hi = name ? `, ${name}` : "";
  const today = new Date();
  const totalBudget = budgets.reduce((s, b) => s + b.amount, 0);
  const wkStart = startOfWeek(today, { weekStartsOn: 1 });
  const week = inRange(txns, wkStart, endOfWeek(today, { weekStartsOn: 1 }));

  if (txns.length === 0) {
    return { emoji: "🌱", title: `Fresh start${hi}`, body: "Log your first expense and I'll start spotting patterns for you.", tone: "neutral" };
  }
  if (totalBudget === 0) {
    const spent = totals(week).expense;
    return {
      emoji: "🧭",
      title: "Want a co-pilot?",
      body: spent ? "Set a budget or two and I'll tell you how each week is tracking." : "Quiet week so far. Set a budget and I'll keep an eye on things.",
      tone: "neutral",
    };
  }
  const budgeted = new Set(budgets.map((b) => b.categoryId));
  const spent = week.filter((t) => t.type === "expense" && budgeted.has(t.categoryId)).reduce((s, t) => s + t.amount, 0);
  const weeklyAllowance = (totalBudget / getDaysInMonth(today)) * 7;
  const daysIn = differenceInCalendarDays(today, wkStart) + 1;
  const expected = (weeklyAllowance / 7) * daysIn;
  const ratio = expected ? spent / expected : 0;

  if (spent === 0) return { emoji: "🧘", title: "Zero-spend streak", body: `Nothing out of your budgets yet this week${hi}. Love that for you.`, tone: "good" };
  if (ratio < 0.8) return { emoji: "☕", title: `Nice work${hi}`, body: "You're under budget this week. Treat yourself to a coffee — you've earned it.", tone: "good" };
  if (ratio <= 1.05) return { emoji: "🎯", title: "Right on track", body: "Spending is pacing almost exactly with your budgets this week.", tone: "good" };
  if (ratio <= 1.3) return { emoji: "🌤️", title: "A little ahead of pace", body: "You're slightly over this week's share. A quiet weekend would even it out.", tone: "warn" };
  return { emoji: "🫶", title: "Busy week, huh?", body: "You're running over this week's budget. No stress — small trims add up fast.", tone: "over" };
}
