import { useMemo, useState } from "react";
import { addMonths, isSameMonth, startOfMonth, subMonths } from "date-fns";
import { ChartColumn, ChevronLeft, ChevronRight, FileText } from "lucide-react";
import { Page, TopBar, Section, Meter, Empty } from "@/components/layout";
import { Money } from "@/components/Money";
import { CategoryGlyph, Glyph } from "@/components/icons";
import { DailyBars } from "@/components/charts/DailyBars";
import { InOutBars } from "@/components/charts/InOutBars";
import { Button } from "@/components/ui/button";
import { useAccounts, useBudgets, useCategories, useCategoryMap, useTransactions } from "@/db/hooks";
import { budgetLines, dailySpending, monthSummary, monthlySeries } from "@/engine/ledger";
import { detectRecurring } from "@/engine/recurring";
import { useI18n } from "@/i18n";
import { categoryName } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { useSheets } from "@/store/ui";
import { ReportSheet } from "@/components/ReportSheet";
import { AskLedger } from "@/components/AskLedger";
import { Percent } from "lucide-react";

export default function Insights() {
  const { t, date, currency, pct, day } = useI18n();
  const txns = useTransactions();
  const accounts = useAccounts();
  const budgets = useBudgets();
  const categories = useCategories();
  const cats = useCategoryMap();
  const { openReview } = useSheets();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [report, setReport] = useState(false);
  const all = txns ?? [];
  const current = isSameMonth(month, new Date());

  const s = useMemo(() => monthSummary(all, month, currency, accounts), [all, month, currency, accounts]);
  const prev = useMemo(() => monthSummary(all, subMonths(month, 1), currency, accounts), [all, month, currency, accounts]);
  const daily = useMemo(() => dailySpending(all, month, currency), [all, month, currency]);
  const series = useMemo(() => monthlySeries(all, 6, current ? new Date() : addMonths(month, 0), currency), [all, month, current, currency]);
  const lines = useMemo(() => budgetLines(budgets, categories, all, month, currency), [budgets, categories, all, month, currency]);
  const recurring = useMemo(() => detectRecurring(all), [all]);
  const byCat = useMemo(() => {
    const total = [...s.byCategory.values()].reduce((a, b) => a + b, 0);
    return [...s.byCategory.entries()]
      .map(([id, amount]) => ({ id, amount, share: total ? amount / total : 0, change: prev.byCategory.get(id) ? (amount - prev.byCategory.get(id)!) / prev.byCategory.get(id)! : null }))
      .sort((a, b) => b.amount - a.amount);
  }, [s, prev]);
  const max = byCat[0]?.amount ?? 1;
  const delta = (a: number, b: number) => (b ? (a - b) / b : null);

  if (txns && all.length === 0) {
    return (
      <Page>
        <TopBar title={t("nav.insights")} />
        <Empty icon={<ChartColumn />} title={t("insights.emptyTitle")} body={t("insights.emptyBody")} />
      </Page>
    );
  }

  return (
    <Page>
      <TopBar
        title={t("nav.insights")}
        actions={
          <Button variant="ghost" size="icon" aria-label={t("report.title")} onClick={() => setReport(true)}>
            <FileText />
          </Button>
        }
      />
      <div className="flex items-center justify-between px-3">
        <Button variant="ghost" size="icon-sm" onClick={() => setMonth((m) => addMonths(m, -1))} aria-label={t("common.previous")}>
          <ChevronLeft className="rtl:rotate-180" />
        </Button>
        <span className="text-sm font-medium">{date(month, "MMMM yyyy")}</span>
        <Button variant="ghost" size="icon-sm" disabled={current} onClick={() => setMonth((m) => addMonths(m, 1))} aria-label={t("common.next")}>
          <ChevronRight className="rtl:rotate-180" />
        </Button>
      </div>

      <div className="mt-3 grid grid-cols-2 border-y border-rule bg-surface">
        <Kpi label={t("insights.moneyIn")} change={delta(s.income, prev.income)} goodWhenUp>
          <Money value={s.income} cents={false} size="lg" tone={s.income ? "pos" : "ink"} />
        </Kpi>
        <Kpi label={t("insights.spent")} change={delta(s.spending, prev.spending)} className="border-s">
          <Money value={s.spending} cents={false} size="lg" />
        </Kpi>
        <Kpi label={t("insights.kept")} change={null} className="border-t">
          <Money value={s.net} cents={false} size="lg" tone={s.net < 0 ? "neg" : "ink"} />
        </Kpi>
        <Kpi label={t("insights.savingsRate")} change={null} className="border-s border-t">
          <span className="fig text-xl">{s.savingsRate === null ? "—" : pct(s.savingsRate)}</span>
        </Kpi>
      </div>
      {(s.unknownOut > 0 || s.unknownIn > 0) && (
        <button onClick={() => openReview()} className="tap block w-full px-5 py-2.5 text-start text-xs leading-relaxed text-ink-3">
          {t("insights.quality")}{" "}
          {s.unknownOut > 0 && (
            <>
              <Money value={s.unknownOut} size="sm" cents={false} tone="muted" /> {t("insights.qualityOut")}
            </>
          )}
          {s.unknownOut > 0 && s.unknownIn > 0 && " · "}
          {s.unknownIn > 0 && (
            <>
              <Money value={s.unknownIn} size="sm" cents={false} tone="muted" /> {t("insights.qualityIn")}
            </>
          )}{" "}
          {t("insights.qualitySuffix")} <span className="font-medium text-accent-ink">{t("common.review")}</span>
        </button>
      )}

      <Section title={t("insights.byDay")} flush>
        <div className="px-5">
          <DailyBars data={daily} />
          <div className="mt-2 flex justify-between text-xs text-ink-3">
            <span>{t("insights.avgPerDay")}</span>
            <Money value={Math.round(s.spending / Math.max(1, daily.filter((d) => d.spending !== null).length))} cents={false} size="sm" tone="muted" />
          </div>
        </div>
      </Section>

      <Section title={t("insights.byCategory")}>
        {byCat.length === 0 && <p className="px-5 py-6 text-sm text-ink-3">{t("insights.noSpending")}</p>}
        {byCat.map((c) => {
          const cat = cats.get(c.id);
          return (
            <div key={c.id} className="border-t border-rule px-5 py-3 first:border-t-0">
              <div className="flex items-center gap-3">
                {c.id === "_fees" ? <Glyph icon={Percent} size="sm" /> : <CategoryGlyph category={cat} size="sm" />}
                <span className="flex-1 truncate text-base">{c.id === "_fees" ? t("insights.transferFees") : c.id === "_none" ? t("insights.uncategorised") : categoryName(cat, t)}</span>
                <span className="fig w-10 text-end text-xs text-ink-3">{pct(c.share)}</span>
                <Money value={c.amount} cents={false} className="w-24 justify-end font-medium" />
              </div>
              <div className="ms-10 mt-2 flex items-center gap-3">
                <div className="h-1 flex-1 rounded-full bg-rule">
                  <div className="h-full rounded-full bg-ink" style={{ width: `${(c.amount / max) * 100}%` }} />
                </div>
                <span className={cn("fig w-12 text-end text-xs", c.change === null ? "text-ink-4" : c.change > 0.05 ? "text-neg" : c.change < -0.05 ? "text-pos" : "text-ink-3")}>
                  {c.change === null ? t("insights.new") : `${c.change > 0 ? "+" : ""}${pct(c.change)}`}
                </span>
              </div>
            </div>
          );
        })}
        {byCat.length > 0 && <div className="border-t border-rule px-5 py-2 text-2xs text-ink-4">{t("insights.vsPrevious", { month: date(subMonths(month, 1), "MMMM") })}</div>}
      </Section>

      <Section title={t("insights.inVsOut")} flush>
        <div className="px-5">
          <InOutBars data={series} selected={series.find((x) => isSameMonth(x.month, month))?.key ?? ""} onSelect={(k) => setMonth(startOfMonth(new Date(`${k}-01T00:00:00`)))} />
        </div>
      </Section>

      {lines.length > 0 && (
        <Section title={t("insights.budgetPerformance")}>
          {lines.map((l) => (
            <div key={l.category.id} className="flex items-center gap-3 border-t border-rule px-5 py-2.5 first:border-t-0">
              <span className="w-28 truncate text-sm">{categoryName(l.category, t)}</span>
              <Meter className="flex-1" value={l.ratio} status={l.status} />
              <span className={cn("fig w-12 text-end text-xs", l.status === "over" ? "text-neg" : "text-ink-3")}>{pct(l.ratio)}</span>
            </div>
          ))}
        </Section>
      )}

      <Section title={t("insights.recurring")}>
        {recurring.length === 0 ? (
          <p className="px-5 py-4 text-sm text-ink-3">{t("insights.noRecurring")}</p>
        ) : (
          recurring.map((r) => (
            <div key={r.merchantKey} className="flex items-center gap-3 border-t border-rule px-5 py-3 first:border-t-0">
              <CategoryGlyph category={r.categoryId ? cats.get(r.categoryId) : null} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-base">{r.label}</div>
                <div className="text-xs text-ink-3">
                  {t(`cadence.${r.cadence}`)} · {t("insights.nextAround", { date: day(r.nextExpected) })}
                </div>
              </div>
              <Money value={r.typicalAmount} cents={false} className="font-medium" />
            </div>
          ))
        )}
      </Section>

      <Section title={t("ask.title")} flush>
        <AskLedger />
      </Section>

      <ReportSheet open={report} onOpenChange={setReport} month={month} />
    </Page>
  );
}

function Kpi({ label, change, children, className, goodWhenUp }: { label: string; change: number | null; children: React.ReactNode; className?: string; goodWhenUp?: boolean }) {
  const { pct, t } = useI18n();
  const up = change !== null && change > 0.005;
  const down = change !== null && change < -0.005;
  const good = goodWhenUp ? up : down;
  return (
    <div className={cn("border-rule px-5 py-3.5", className)}>
      <div className="eyebrow mb-1">{label}</div>
      {children}
      {change !== null && (up || down) && (
        <div className={cn("fig mt-0.5 text-xs", good ? "text-pos" : "text-ink-3")}>
          {up ? "▲" : "▼"} {pct(Math.abs(change))} <span className="text-ink-4">{t("insights.vsLast")}</span>
        </div>
      )}
    </div>
  );
}
