import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { addMonths, eachDayOfInterval, endOfMonth, format, isSameMonth, isAfter, parse, startOfMonth, subMonths } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Page, Reveal } from "@/components/Page";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Money, CountUp } from "@/components/AnimatedNumber";
import { MonthlyBars } from "@/components/charts/MonthlyBars";
import { SpendingTrend } from "@/components/charts/SpendingTrend";
import { CategoryBreakdown } from "@/components/charts/CategoryBreakdown";
import { EmptyState } from "@/components/EmptyState";
import { ChartIllustration } from "@/components/Illustrations";
import { useBudgets, useCategoryMap, useTransactions } from "@/db/hooks";
import { dailyCumulative, monthTxns, monthlySeries, spendByCategory, totals } from "@/lib/stats";
import { useMoney } from "@/lib/format";
import { usePrefs } from "@/store/ui";
import { cn } from "@/lib/utils";

interface Nugget {
  emoji: string;
  text: string;
}

export default function Insights() {
  const txns = useTransactions();
  const cats = useCategoryMap();
  const budgets = useBudgets();
  const money = useMoney();
  const hidden = usePrefs((s) => s.hideAmounts);
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [dir, setDir] = useState(0);

  const all = txns ?? [];
  const cur = useMemo(() => monthTxns(all, month), [all, month]);
  const prev = useMemo(() => monthTxns(all, subMonths(month, 1)), [all, month]);
  const t = totals(cur);
  const p = totals(prev);
  const rate = t.income ? Math.max(0, t.net / t.income) : 0;
  const byCat = useMemo(() => spendByCategory(cur, cats), [cur, cats]);
  const series = useMemo(() => monthlySeries(all, 6, month), [all, month]);
  const budgetTotal = budgets.reduce((s, b) => s + b.amount, 0);
  const trend = useMemo(() => dailyCumulative(all, month, budgetTotal), [all, month, budgetTotal]);
  const isCurrent = isSameMonth(month, new Date());

  const nuggets = useMemo<Nugget[]>(() => {
    const m = (n: number) => (hidden ? "••••" : money(n, { cents: false }));
    const out: Nugget[] = [];
    if (p.expense > 0 && t.expense > 0) {
      const diff = (t.expense - p.expense) / p.expense;
      if (diff < -0.03) out.push({ emoji: "📉", text: `You've spent ${Math.round(-diff * 100)}% less than ${format(subMonths(month, 1), "MMMM")}${isCurrent ? " so far" : ""}. Nicely done.` });
      else if (diff > 0.03 && !isCurrent) out.push({ emoji: "📈", text: `Spending was ${Math.round(diff * 100)}% higher than ${format(subMonths(month, 1), "MMMM")}.` });
    }
    if (byCat[0]) out.push({ emoji: byCat[0].category.emoji, text: `${byCat[0].category.name} led the way at ${Math.round(byCat[0].share * 100)}% of spending (${m(byCat[0].amount)}).` });
    const biggest = cur.filter((x) => x.type === "expense").sort((a, b) => b.amount - a.amount)[0];
    if (biggest) out.push({ emoji: "🧾", text: `Biggest single spend: ${m(biggest.amount)}${biggest.note ? ` on “${biggest.note}”` : ""}.` });
    const end = isCurrent ? new Date() : endOfMonth(month);
    const days = eachDayOfInterval({ start: month, end });
    const spendDays = new Set(cur.filter((x) => x.type === "expense").map((x) => x.date));
    const noSpend = days.filter((d) => !spendDays.has(d.getTime())).length;
    if (noSpend > 0 && cur.length) out.push({ emoji: "🧘", text: `${noSpend} no-spend ${noSpend === 1 ? "day" : "days"} this month. Your wallet says thanks.` });
    if (t.net > 0) out.push({ emoji: "🌱", text: `You kept ${m(t.net)} — that's ${Math.round(rate * 100)}% of what came in.` });
    return out;
  }, [p.expense, t.expense, t.net, byCat, cur, month, isCurrent, rate, money, hidden]);

  const go = (n: number) => {
    const next = addMonths(month, n);
    if (isAfter(next, new Date())) return;
    setDir(n);
    setMonth(next);
  };

  if (txns && all.length === 0) {
    return (
      <Page>
        <PageHeader title="Insights" />
        <EmptyState art={<ChartIllustration />} title="Charts are hungry" body="Log a few transactions and this page fills up with trends, patterns and little wins worth celebrating." />
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader title="Insights" />

      <div className="flex items-center justify-between px-5 pb-3">
        <Button variant="secondary" size="icon-sm" onClick={() => go(-1)} aria-label="Previous month">
          <ChevronLeft />
        </Button>
        <div className="relative h-7 flex-1 overflow-hidden text-center">
          <AnimatePresence initial={false} custom={dir} mode="popLayout">
            <motion.div
              key={month.toISOString()}
              custom={dir}
              initial={{ x: dir * 40, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: dir * -40, opacity: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 34 }}
              className="text-lg font-semibold"
            >
              {format(month, "MMMM yyyy")}
            </motion.div>
          </AnimatePresence>
        </div>
        <Button variant="secondary" size="icon-sm" onClick={() => go(1)} disabled={isCurrent} aria-label="Next month">
          <ChevronRight />
        </Button>
      </div>

      <Reveal i={0} className="grid grid-cols-2 gap-3 px-5">
        {[
          { label: "Money in", value: t.income, cls: "text-emerald" },
          { label: "Money out", value: t.expense, cls: "text-coral" },
          { label: "Kept", value: t.net, cls: t.net >= 0 ? "text-foreground" : "text-coral" },
        ].map((s) => (
          <div key={s.label} className="surface-card p-4">
            <div className="text-[13px] text-muted-foreground">{s.label}</div>
            <Money key={month.toISOString()} value={s.value} cents={false} className={cn("mt-1 block text-xl font-semibold", s.cls)} />
          </div>
        ))}
        <div className="surface-card p-4">
          <div className="text-[13px] text-muted-foreground">Savings rate</div>
          <CountUp key={month.toISOString()} value={Math.round(rate * 100)} suffix="%" className="mt-1 block text-xl font-semibold" />
        </div>
      </Reveal>

      {nuggets.length > 0 && (
        <Reveal i={1} className="pt-4">
          <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-1 no-scrollbar">
            {nuggets.map((n, i) => (
              <motion.div
                key={`${month.toISOString()}-${i}`}
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.08 * i, type: "spring", stiffness: 300, damping: 28 }}
                className="surface-card flex w-[78%] shrink-0 snap-start items-start gap-3 p-4"
              >
                <span className="text-2xl">{n.emoji}</span>
                <p className="text-sm leading-snug">{n.text}</p>
              </motion.div>
            ))}
          </div>
        </Reveal>
      )}

      <Reveal i={2} className="px-5 pt-4">
        <Card>
          <CardTitle className="mb-3">Last 6 months</CardTitle>
          <MonthlyBars data={series} activeKey={format(month, "yyyy-MM")} onSelect={(k) => setMonth(startOfMonth(parse(k, "yyyy-MM", new Date())))} />
        </Card>
      </Reveal>

      <Reveal i={3} className="px-5 pt-4">
        <Card>
          <CardTitle>Spending through the month</CardTitle>
          <p className="mb-2 text-sm text-muted-foreground">{budgetTotal ? "Dashed line = even pace for your budgets." : "Set budgets to see your pace line."}</p>
          <SpendingTrend key={month.toISOString()} data={trend} height={170} />
        </Card>
      </Reveal>

      <Reveal i={4} className="px-5 pt-4">
        <Card>
          <CardTitle className="mb-4">Where it went</CardTitle>
          {byCat.length ? <CategoryBreakdown key={month.toISOString()} rows={byCat} /> : <p className="py-6 text-center text-sm text-muted-foreground">No spending this month. Wild! 🦄</p>}
        </Card>
      </Reveal>
    </Page>
  );
}
