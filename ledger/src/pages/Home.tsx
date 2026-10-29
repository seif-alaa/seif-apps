import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Eye, EyeOff, Settings2 } from "lucide-react";
import { Page, Row, Section, SectionLink, Tag, Meter, Empty } from "@/components/layout";
import { Money } from "@/components/Money";
import { AccountMark } from "@/components/icons";
import { TxnRow } from "@/components/TxnRow";
import { Button } from "@/components/ui/button";
import { useAccountMap, useAccounts, useBudgets, useCategories, useCategoryMap, useReconciliations, useTransactions } from "@/db/hooks";
import { balances, budgetLines, collapseTransfers, monthSummary, needsReview, netWorth, pendingAmount } from "@/engine/ledger";
import { trackingMode } from "@/engine/sources";
import type { SourceKind } from "@/engine/model";
import { useI18n } from "@/i18n";
import { categoryName } from "@/lib/labels";
import { usePrefs, useSheets } from "@/store/ui";
import { SampleBanner } from "@/components/SampleBanner";
import { InstallHint } from "@/components/InstallHint";
import { BookOpen } from "lucide-react";

export default function Home() {
  const { t, date, currency, num } = useI18n();
  const navigate = useNavigate();
  const txns = useTransactions();
  const accounts = useAccounts();
  const accountMap = useAccountMap();
  const categories = useCategories();
  const cats = useCategoryMap();
  const budgets = useBudgets();
  const recs = useReconciliations();
  const { name, hideAmounts, setPrefs } = usePrefs();
  const { openReview, openDetail, openAdd } = useSheets();

  const all = txns ?? [];
  const now = new Date();
  const worth = useMemo(() => netWorth(accounts, all, currency), [accounts, all, currency]);
  const bal = useMemo(() => balances(accounts, all), [accounts, all]);
  const month = useMemo(() => monthSummary(all, now, currency, accounts), [all, currency, accounts]); // eslint-disable-line react-hooks/exhaustive-deps
  const queue = useMemo(() => needsReview(all), [all]);
  const lines = useMemo(() => budgetLines(budgets, categories, all, now, currency), [budgets, categories, all, currency]); // eslint-disable-line react-hooks/exhaustive-deps
  const recent = useMemo(() => collapseTransfers(all).slice(0, 6), [all]);
  const modes = useMemo(() => {
    const m = new Map<string, Set<SourceKind>>();
    for (const x of all) if (x.accountId) m.set(x.accountId, (m.get(x.accountId) ?? new Set()).add(x.source));
    return m;
  }, [all]);
  const openRecs = recs.filter((r) => r.status === "open");
  const budgetTotal = lines.reduce((s, l) => s + l.budget.amount, 0);
  const budgetSpent = lines.reduce((s, l) => s + l.spent, 0);
  const watch = lines.filter((l) => l.status !== "on_track").slice(0, 3);

  return (
    <Page>
      <header className="flex items-center justify-between px-5 pb-1 pt-[calc(env(safe-area-inset-top)+12px)]">
        <div className="flex items-baseline gap-2">
          <span className="text-md font-semibold tracking-tight">Ledger</span>
          <span className="text-sm text-ink-3">{date(now, "EEE d MMM")}</span>
        </div>
        <div className="flex items-center">
          <Button variant="ghost" size="icon" aria-label={hideAmounts ? t("home.showAmounts") : t("home.hideAmounts")} onClick={() => setPrefs({ hideAmounts: !hideAmounts })}>
            {hideAmounts ? <EyeOff /> : <Eye />}
          </Button>
          <Button variant="ghost" size="icon" aria-label={t("nav.settings")} onClick={() => navigate("/settings")}>
            <Settings2 />
          </Button>
        </div>
      </header>

      <SampleBanner />
      <InstallHint />

      <section className="px-5 pb-1 pt-5">
        <div className="text-sm text-ink-3">{name ? t("home.balanceFor", { name }) : t("home.balance")}</div>
        <Money value={worth.total} currency={currency} size="hero" animateChanges className="mt-1" />
        {worth.other.length > 0 && (
          <div className="mt-1 text-xs text-ink-3">
            {t("home.notIncluded")}{" "}
            {worth.other.map((o) => (
              <Money key={o.currency} value={o.amount} currency={o.currency} size="sm" tone="muted" className="me-2" />
            ))}
          </div>
        )}
        <div className="mt-5 grid grid-cols-2 border-t border-rule pt-3">
          <div>
            <div className="eyebrow">{t("home.inThisMonth")}</div>
            <Money value={month.income} currency={currency} size="lg" cents={false} tone={month.income ? "pos" : "ink"} className="mt-1" />
            {month.unknownIn > 0 && <div className="text-xs text-ink-3">{t("home.plusUnclassified")} <Money value={month.unknownIn} currency={currency} size="sm" cents={false} tone="muted" /></div>}
          </div>
          <div className="border-s border-rule ps-4">
            <div className="eyebrow">{t("home.spentThisMonth")}</div>
            <Money value={month.spending} currency={currency} size="lg" cents={false} className="mt-1" />
            {month.unknownOut > 0 && <div className="text-xs text-ink-3">{t("home.plusUnreviewed")} <Money value={month.unknownOut} currency={currency} size="sm" cents={false} tone="muted" /></div>}
          </div>
        </div>
      </section>

      {(queue.length > 0 || openRecs.length > 0) && (
        <section className="px-5 pt-6">
          {queue.length > 0 && (
            <button onClick={() => openReview()} className="tap flex w-full items-center gap-3 rounded border border-accent/40 bg-accent-wash px-4 py-3 text-start">
              <span className="fig flex size-7 shrink-0 items-center justify-center rounded-sm bg-accent text-sm font-semibold text-accent-contrast">{num(queue.length)}</span>
              <span className="flex-1">
                <span className="block text-base font-medium text-ink">{t("home.attention", { count: queue.length })}</span>
                <span className="block text-sm text-ink-2">{t("home.attentionHint")}</span>
              </span>
              <ArrowRight className="size-4 text-accent-ink rtl:rotate-180" />
            </button>
          )}
          {openRecs.map((r) => (
            <button key={r.id} onClick={() => navigate(`/accounts/${r.accountId}`)} className="tap mt-2 flex w-full items-center gap-3 rounded border border-warn/40 bg-warn-wash px-4 py-3 text-start">
              <span className="flex-1 text-sm text-ink">
                {t("home.unexplained", { account: accountMap.get(r.accountId)?.name ?? "" })} <Money value={r.difference} currency={accountMap.get(r.accountId)?.currency} signed size="sm" />
              </span>
              <ArrowRight className="size-4 text-warn rtl:rotate-180" />
            </button>
          ))}
        </section>
      )}

      <Section title={t("home.accounts")} action={<SectionLink onClick={() => navigate("/accounts")}>{t("common.manage")}</SectionLink>}>
        {accounts.map((a) => {
          const mode = trackingMode(modes.get(a.id) ?? new Set(), false);
          const pending = pendingAmount(a.id, all);
          return (
            <Row
              key={a.id}
              onClick={() => navigate(`/accounts/${a.id}`)}
              leading={<AccountMark account={a} />}
              title={a.name}
              subtitle={<TrackingLabel mode={mode} />}
              trailing={
                <div>
                  <Money value={bal.get(a.id) ?? 0} currency={a.currency} tone={(bal.get(a.id) ?? 0) < 0 ? "neg" : "ink"} className="font-medium" />
                  {pending !== 0 && (
                    <div className="text-xs text-ink-3">
                      {t("home.pending")} <Money value={pending} currency={a.currency} size="sm" tone="muted" signed />
                    </div>
                  )}
                </div>
              }
            />
          );
        })}
      </Section>

      {lines.length > 0 && (
        <Section title={t("home.budgets")} action={<SectionLink onClick={() => navigate("/budgets")}>{t("common.all")}</SectionLink>}>
          <div className="px-5 py-3.5">
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-ink-2">
                <Money value={budgetSpent} currency={currency} cents={false} size="sm" className="font-medium" /> {t("budgets.of")} <Money value={budgetTotal} currency={currency} cents={false} size="sm" tone="muted" />
              </span>
              <span className="text-ink-3">
                <Money value={Math.abs(budgetTotal - budgetSpent)} currency={currency} cents={false} size="sm" tone={budgetSpent > budgetTotal ? "neg" : "muted"} /> {budgetSpent > budgetTotal ? t("budgets.overWord") : t("budgets.leftWord")}
              </span>
            </div>
            <Meter className="mt-2.5" value={budgetTotal ? budgetSpent / budgetTotal : 0} pace={lines[0]?.pace} status={budgetSpent > budgetTotal ? "over" : budgetSpent / (budgetTotal || 1) > (lines[0]?.pace ?? 0) + 0.1 ? "watch" : "on_track"} />
          </div>
          {watch.map((l) => (
            <div key={l.category.id} className="flex items-center justify-between border-t border-rule px-5 py-2.5 text-sm">
              <span className="text-ink-2">{categoryName(l.category, t)}</span>
              <Tag tone={l.status === "over" ? "neg" : "warn"}>{l.status === "over" ? t("budgets.over") : t("budgets.watch")}</Tag>
            </div>
          ))}
        </Section>
      )}

      <Section title={t("home.recent")} action={all.length > 0 && <SectionLink onClick={() => navigate("/activity")}>{t("common.all")}</SectionLink>}>
        {txns && all.length === 0 ? (
          <Empty
            icon={<BookOpen />}
            title={t("home.emptyTitle")}
            body={t("home.emptyBody")}
            action={
              <div className="flex gap-2">
                <Button variant="ink" onClick={() => navigate("/sources")}>
                  {t("home.connectSource")}
                </Button>
                <Button variant="outline" onClick={openAdd}>
                  {t("home.addManually")}
                </Button>
              </div>
            }
          />
        ) : (
          recent.map((x) => <TxnRow key={x.id} t={x} cats={cats} accounts={accountMap} onClick={() => (x.review === "needs_review" ? openReview(x.id) : openDetail(x.id))} />)
        )}
      </Section>
    </Page>
  );
}

export function TrackingLabel({ mode }: { mode: ReturnType<typeof trackingMode> }) {
  const { t } = useI18n();
  const dot = { automatic: "bg-pos", partial: "bg-accent", import: "bg-ink-3", manual: "border border-ink-3", disconnected: "bg-neg" }[mode];
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`size-1.5 rounded-full ${dot}`} />
      {t(`tracking.${mode}`)}
    </span>
  );
}
