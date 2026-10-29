import { useMemo, useState } from "react";
import { toast } from "sonner";
import { monthlyReport } from "@/ai/report";
import { getAIProvider, type Explanation } from "@/ai/provider";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useAccounts, useBudgets, useCategories, useCategoryMap, useTransactions } from "@/db/hooks";
import { useI18n } from "@/i18n";
import { categoryName } from "@/lib/labels";
import { usePrefs } from "@/store/ui";
import { Money } from "./Money";

/** Monthly report: deterministic figures first; an optional AI explanation is clearly labelled and opt-in. */
export function ReportSheet({ open, onOpenChange, month }: { open: boolean; onOpenChange: (o: boolean) => void; month: Date }) {
  const { t, date, currency, pct, lang } = useI18n();
  const txns = useTransactions() ?? [];
  const categories = useCategories();
  const budgets = useBudgets();
  const accounts = useAccounts();
  const cats = useCategoryMap();
  const { aiConsent, aiShareMerchants, setPrefs } = usePrefs();
  const provider = getAIProvider();
  const [explaining, setExplaining] = useState(false);
  const [explanation, setExplanation] = useState<Explanation | null>(null);
  const r = useMemo(() => (open ? monthlyReport({ txns, categories, budgets, accounts, currency }, month) : null), [open, txns, categories, budgets, accounts, currency, month]);
  const name = (id: string) => (id === "_fees" ? t("insights.transferFees") : id === "_none" ? t("insights.uncategorised") : categoryName(cats.get(id), t));

  async function explain() {
    if (!provider || !r) return;
    setExplaining(true);
    try {
      setExplanation(await provider.explain({ report: r, locale: lang }, { merchants: aiShareMerchants }));
    } catch (e) {
      toast.error(t("report.aiError"), { description: (e as Error).message });
    } finally {
      setExplaining(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent title={t("report.title")} description={date(month, "MMMM yyyy")}>
        {r && (
          <div className="no-scrollbar overflow-y-auto px-5 pb-6 pt-4 text-base leading-relaxed">
            {r.dataQuality.containsSampleData && <p className="mb-4 rounded-sm border border-dashed border-rule-strong p-2 text-xs text-ink-3">{t("report.sampleWarning")}</p>}
            <p>
              {t("report.p1a")} <Money value={r.totals.income} cents={false} tone="pos" className="font-medium" /> {t("report.p1b")} <Money value={r.totals.spending} cents={false} className="font-medium" />
              {r.totals.savingsRate !== null ? ` — ${t("report.p1c", { rate: pct(r.totals.savingsRate) })}` : "."}
            </p>
            {r.previous.spending > 0 && (
              <p className="mt-2 text-ink-2">
                {Math.abs(r.totals.spending - r.previous.spending) / r.previous.spending < 0.01
                  ? t("report.sameAs", { month: date(r.previousPeriod.from, "MMMM") })
                  : t(r.totals.spending < r.previous.spending ? "report.lessThan" : "report.moreThan", { pct: pct(Math.abs(r.totals.spending - r.previous.spending) / r.previous.spending), month: date(r.previousPeriod.from, "MMMM") })}
              </p>
            )}

            <h3 className="eyebrow mb-2 mt-6">{t("report.topCategories")}</h3>
            <ul className="divide-y divide-rule border-y border-rule">
              {r.categories.filter((c) => c.amount > 0).slice(0, 5).map((c) => (
                <li key={c.categoryId} className="flex items-baseline justify-between py-2 text-sm">
                  <span>{name(c.categoryId)}</span>
                  <span className="flex items-baseline gap-3">
                    <span className="fig text-xs text-ink-3">{c.change === null ? t("insights.new") : `${c.change > 0 ? "+" : ""}${pct(c.change)}`}</span>
                    <Money value={c.amount} cents={false} size="sm" className="font-medium" />
                  </span>
                </li>
              ))}
            </ul>

            {r.budgets.length > 0 && (
              <>
                <h3 className="eyebrow mb-2 mt-6">{t("report.budgets")}</h3>
                <p className="text-sm text-ink-2">
                  {t("report.budgetsLine", { over: r.budgets.filter((b) => b.status === "over").length, total: r.budgets.length })}
                </p>
              </>
            )}

            {r.unusual.length > 0 && (
              <>
                <h3 className="eyebrow mb-2 mt-6">{t("report.unusual")}</h3>
                <ul className="space-y-1 text-sm">
                  {r.unusual.map((u) => (
                    <li key={u.transactionId} className="flex justify-between">
                      <span>{u.merchant ?? name(u.categoryId ?? "_none")}</span>
                      <span className="text-ink-3">
                        <Money value={u.amount} cents={false} size="sm" className="text-ink" /> · {t("report.times", { n: u.multiple.toFixed(1) })}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {r.recurring.length > 0 && (
              <>
                <h3 className="eyebrow mb-2 mt-6">{t("report.recurring")}</h3>
                <p className="text-sm text-ink-2">
                  {t("report.recurringLine", { count: r.recurring.length })} <Money value={r.recurring.filter((x) => x.cadence === "monthly").reduce((s, x) => s + x.typicalAmount, 0)} cents={false} size="sm" className="font-medium text-ink" />
                </p>
              </>
            )}

            {(r.dataQuality.needsReview > 0 || r.dataQuality.unknownOut > 0) && <p className="mt-6 text-xs text-ink-3">{t("report.quality", { count: r.dataQuality.needsReview })}</p>}
            <p className="mt-2 text-2xs uppercase tracking-wider text-ink-4">{t("ask.computed")}</p>

            <div className="mt-6 rounded border border-rule p-4">
              <div className="text-sm font-semibold">{t("report.aiTitle")}</div>
              {!provider ? (
                <p className="mt-1 text-sm text-ink-3">{t("report.aiNotConfigured")}</p>
              ) : (
                <>
                  <p className="mt-1 text-sm text-ink-3">{t("report.aiConsentBody")}</p>
                  <label className="mt-3 flex items-center justify-between gap-3 text-sm">
                    {t("report.aiConsent")}
                    <Switch checked={aiConsent} onCheckedChange={(v) => setPrefs({ aiConsent: v })} />
                  </label>
                  <label className="mt-2 flex items-center justify-between gap-3 text-sm">
                    {t("report.aiMerchants")}
                    <Switch checked={aiShareMerchants} onCheckedChange={(v) => setPrefs({ aiShareMerchants: v })} />
                  </label>
                  <Button className="mt-3 w-full" variant="outline" disabled={!aiConsent || explaining} onClick={explain}>
                    {explaining ? t("report.aiWorking") : t("report.aiExplain")}
                  </Button>
                  {explanation && (
                    <div className="mt-3 border-s-2 border-accent ps-3 text-sm">
                      <div className="mb-1 text-2xs uppercase tracking-wider text-accent-ink">{t("report.aiLabel", { model: explanation.model })}</div>
                      {explanation.text}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
