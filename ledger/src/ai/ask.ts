import { endOfWeek, startOfWeek, subMonths, subWeeks } from "date-fns";
import type { Category, Transaction } from "@/db/db";
import { summarize } from "@/engine/ledger";
import { isLive } from "@/engine/model";
import { monthPeriod, type ReportInput, type ReportPeriod } from "./report";

/**
 * "Ask Ledger" — deterministic answers for common questions, computed from the
 * ledger. This works with no AI configured. Anything it can't answer exactly is
 * reported as unsupported rather than approximated.
 */

export type Answer =
  | { type: "top_category"; period: ReportPeriod; categoryId: string | null; amount: number; share: number; refs: string[] }
  | { type: "category_total"; period: ReportPeriod; categoryId: string; amount: number; count: number; refs: string[] }
  | { type: "compare"; current: ReportPeriod; previous: ReportPeriod; spending: [number, number]; income: [number, number] }
  | { type: "income_from"; period: ReportPeriod; label: string; amount: number; count: number; refs: string[] }
  | { type: "overspend"; period: ReportPeriod; over: { categoryId: string; amount: number; previous: number }[]; spending: number; previousSpending: number }
  | { type: "unsupported" };

function periodFrom(q: string, now: Date): ReportPeriod {
  if (/last week|الأسبوع الماضي|الاسبوع الماضي/i.test(q)) {
    const d = subWeeks(now, 1);
    return { from: startOfWeek(d, { weekStartsOn: 6 }).getTime(), to: endOfWeek(d, { weekStartsOn: 6 }).getTime(), label: "last_week" };
  }
  if (/this week|الأسبوع ده|هذا الأسبوع|الاسبوع ده/i.test(q)) return { from: startOfWeek(now, { weekStartsOn: 6 }).getTime(), to: now.getTime(), label: "this_week" };
  if (/last month|الشهر الماضي|الشهر اللي فات/i.test(q)) return { ...monthPeriod(subMonths(now, 1)), label: "last_month" };
  return { ...monthPeriod(now), label: "this_month" };
}

function findCategory(q: string, categories: Category[], names: (c: Category) => string[]) {
  const lower = q.toLowerCase();
  const aliases: Record<string, RegExp> = {
    dining: /restaurant|dining|eating out|food|مطاعم|أكل|اكل/i,
    groceries: /grocer|supermarket|سوبر|بقالة/i,
    transport: /transport|uber|taxi|careem|fuel|gas|مواصلات|بنزين/i,
    coffee: /coffee|cafe|قهوة/i,
    bills: /bill|utilit|فواتير/i,
    shopping: /shopping|تسوق/i,
    freelance: /freelance|فريلانس|عمل حر/i,
    salary: /salary|راتب|مرتب/i,
  };
  for (const c of categories) {
    if (c.key && aliases[c.key]?.test(q)) return c;
    if (names(c).some((n) => n && lower.includes(n.toLowerCase()))) return c;
  }
  return null;
}

export function ask(question: string, input: ReportInput, names: (c: Category) => string[], now = new Date()): Answer {
  const q = question.trim();
  const { txns, categories, currency } = input;
  const p = periodFrom(q, now);
  const live = (t: Transaction) => t.occurredAt >= p.from && t.occurredAt <= p.to && isLive(t.posting) && t.currency === currency;

  if (/compare|vs\.?|versus|قارن|مقارنة/i.test(q)) {
    const cur = monthPeriod(now);
    const prev = monthPeriod(subMonths(now, 1));
    const a = summarize(txns, cur.from, cur.to, currency);
    const b = summarize(txns, prev.from, prev.to, currency);
    return { type: "compare", current: { ...cur, label: "this_month" }, previous: { ...prev, label: "last_month" }, spending: [a.spending, b.spending], income: [a.income, b.income] };
  }

  if (/overspen|why.*(spend|spent)|ليه صرفت|لماذا/i.test(q)) {
    const cur = summarize(txns, p.from, p.to, currency);
    const prevP = monthPeriod(subMonths(new Date(p.from), 1));
    const prev = summarize(txns, prevP.from, prevP.to, currency);
    const over = [...cur.byCategory.entries()]
      .map(([categoryId, amount]) => ({ categoryId, amount, previous: prev.byCategory.get(categoryId) ?? 0 }))
      .filter((x) => x.amount > x.previous)
      .sort((a, b) => b.amount - b.previous - (a.amount - a.previous))
      .slice(0, 3);
    return { type: "overspend", period: p, over, spending: cur.spending, previousSpending: prev.spending };
  }

  const incoming = /receiv|earn|income|got paid|استلمت|دخل|قبضت/i.test(q);
  const cat = findCategory(q, categories, names);

  if (incoming || cat?.kind === "income") {
    const rows = txns.filter((t) => live(t) && t.kind === "income" && (!cat || t.categoryId === cat.id));
    return { type: "income_from", period: p, label: cat ? cat.id : "all", amount: rows.reduce((s, t) => s + t.amount, 0), count: rows.length, refs: rows.map((t) => t.id).slice(0, 20) };
  }

  if (cat) {
    const s = summarize(txns, p.from, p.to, currency);
    const rows = txns.filter((t) => live(t) && t.categoryId === cat.id && (t.kind === "expense" || t.kind === "refund"));
    return { type: "category_total", period: p, categoryId: cat.id, amount: s.byCategory.get(cat.id) ?? 0, count: rows.length, refs: rows.map((t) => t.id).slice(0, 20) };
  }

  if (/most|biggest|top|largest|أكثر|اكتر|أكبر/i.test(q)) {
    const s = summarize(txns, p.from, p.to, currency);
    const [top] = [...s.byCategory.entries()].sort((a, b) => b[1] - a[1]);
    const refs = top ? txns.filter((t) => live(t) && t.categoryId === top[0]).map((t) => t.id).slice(0, 20) : [];
    return { type: "top_category", period: p, categoryId: top?.[0] ?? null, amount: top?.[1] ?? 0, share: top && s.spending ? top[1] / s.spending : 0, refs };
  }

  return { type: "unsupported" };
}
