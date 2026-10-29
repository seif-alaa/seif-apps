import { useEffect, useMemo, useState } from "react";
import { addMonths, getDaysInMonth, isSameMonth, startOfMonth } from "date-fns";
import { ChevronLeft, ChevronRight, Plus, Target } from "lucide-react";
import { toast } from "sonner";
import { Page, TopBar, Meter, Empty, Tag } from "@/components/layout";
import { Money } from "@/components/Money";
import { CategoryGlyph } from "@/components/icons";
import { CategoryGrid } from "@/components/CategoryGrid";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { db, type Budget } from "@/db/db";
import { useBudgets, useCategories, useCategoryMap, useTransactions } from "@/db/hooks";
import { budgetLines, monthSummary } from "@/engine/ledger";
import { useI18n } from "@/i18n";
import { categoryName } from "@/lib/labels";
import { useSheets } from "@/store/ui";

export default function Budgets() {
  const { t, date, currency, pct } = useI18n();
  const txns = useTransactions();
  const budgets = useBudgets();
  const categories = useCategories();
  const { openReview } = useSheets();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [edit, setEdit] = useState<{ open: boolean; budget: Budget | null }>({ open: false, budget: null });
  const all = txns ?? [];
  const lines = useMemo(() => budgetLines(budgets, categories, all, month, currency), [budgets, categories, all, month, currency]);
  const summary = useMemo(() => monthSummary(all, month, currency), [all, month, currency]);
  const total = lines.reduce((s, l) => s + l.budget.amount, 0);
  const spent = lines.reduce((s, l) => s + l.spent, 0);
  const current = isSameMonth(month, new Date());
  const daysLeft = current ? getDaysInMonth(month) - new Date().getDate() + 1 : 0;
  const pace = lines[0]?.pace ?? (current ? new Date().getDate() / getDaysInMonth(month) : 1);
  const status = spent > total ? "over" : total && spent / total > pace + 0.1 ? "watch" : "on_track";
  const perDay = current && daysLeft > 0 ? Math.max(0, total - spent) / daysLeft : 0;

  return (
    <Page>
      <TopBar
        title={t("nav.budgets")}
        actions={
          budgets.length > 0 && (
            <Button variant="ghost" size="icon" aria-label={t("budgets.add")} onClick={() => setEdit({ open: true, budget: null })}>
              <Plus />
            </Button>
          )
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

      {lines.length === 0 ? (
        <Empty
          icon={<Target />}
          title={t("budgets.emptyTitle")}
          body={t("budgets.emptyBody")}
          action={
            <Button variant="ink" onClick={() => setEdit({ open: true, budget: null })}>
              {t("budgets.create")}
            </Button>
          }
        />
      ) : (
        <>
          <section className="px-5 pb-2 pt-4">
            <div className="grid grid-cols-3 gap-4">
              <Stat label={t("budgets.budgeted")}>
                <Money value={total} cents={false} size="lg" />
              </Stat>
              <Stat label={t("budgets.spentBudgeted")}>
                <Money value={spent} cents={false} size="lg" />
              </Stat>
              <Stat label={spent > total ? t("budgets.overBy") : t("budgets.remaining")}>
                <Money value={Math.abs(total - spent)} cents={false} size="lg" tone={spent > total ? "neg" : "ink"} />
              </Stat>
            </div>
            <Meter className="mt-4" value={total ? spent / total : 0} pace={pace} status={status} />
            <p className="mt-2.5 text-sm text-ink-3">
              {current
                ? status === "over"
                  ? t("budgets.statusOver")
                  : t(status === "watch" ? "budgets.statusWatch" : "budgets.statusOk", { pct: pct(pace) })
                : t("budgets.statusPast", { pct: pct(total ? spent / total : 0) })}
              {current && perDay > 0 && (
                <>
                  {" "}
                  {t("budgets.perDayPrefix")} <Money value={perDay} cents={false} size="sm" className="font-medium text-ink" /> {t("budgets.perDaySuffix", { count: daysLeft })}
                </>
              )}
            </p>
          </section>

          {summary.unknownOut > 0 && (
            <button onClick={() => openReview()} className="tap mx-5 mt-3 flex w-[calc(100%-2.5rem)] items-center justify-between rounded border border-accent/40 bg-accent-wash px-3 py-2.5 text-start text-sm">
              <span className="text-ink-2">
                <Money value={summary.unknownOut} cents={false} size="sm" className="font-medium text-ink" /> {t("budgets.uncategorized")}
              </span>
              <span className="font-medium text-accent-ink">{t("common.review")}</span>
            </button>
          )}

          <div className="mt-6 border-y border-rule bg-surface">
            <div className="grid grid-cols-[1fr_auto] px-5 pb-1 pt-3 text-2xs font-medium uppercase tracking-wider text-ink-3">
              <span>{t("budgets.category")}</span>
              <span>{t("budgets.spentOfBudget")}</span>
            </div>
            {lines.map((l) => (
              <button key={l.category.id} onClick={() => setEdit({ open: true, budget: l.budget })} className="tap block w-full border-t border-rule px-5 py-3 text-start first:border-t-0">
                <div className="flex items-center gap-3">
                  <CategoryGlyph category={l.category} size="sm" />
                  <span className="flex-1 truncate text-base font-medium">{categoryName(l.category, t)}</span>
                  <span className="text-sm text-ink-3">
                    <Money value={l.spent} cents={false} size="sm" className="font-medium text-ink" /> / <Money value={l.budget.amount} cents={false} size="sm" tone="muted" />
                  </span>
                </div>
                <Meter className="mt-2.5" value={l.ratio} pace={current ? l.pace : undefined} status={l.status} />
                <div className="mt-1.5 flex items-center justify-between text-xs">
                  <span className="text-ink-3">
                    {l.remaining >= 0 ? (
                      <>
                        <Money value={l.remaining} cents={false} size="sm" tone="muted" /> {t("budgets.leftWord")}
                      </>
                    ) : (
                      <>
                        <Money value={-l.remaining} cents={false} size="sm" tone="neg" /> {t("budgets.overWord")}
                      </>
                    )}
                  </span>
                  {l.status !== "on_track" && <Tag tone={l.status === "over" ? "neg" : "warn"}>{t(l.status === "over" ? "budgets.over" : "budgets.watch")}</Tag>}
                </div>
              </button>
            ))}
          </div>
          {current && <p className="px-5 pt-3 text-xs text-ink-4">{t("budgets.tickHint")}</p>}
        </>
      )}

      <BudgetSheet open={edit.open} budget={edit.budget} onOpenChange={(open) => setEdit((s) => ({ ...s, open }))} />
    </Page>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="eyebrow mb-1">{label}</div>
      {children}
    </div>
  );
}

function BudgetSheet({ open, budget, onOpenChange }: { open: boolean; budget: Budget | null; onOpenChange: (o: boolean) => void }) {
  const { t, currency } = useI18n();
  const categories = useCategories();
  const cats = useCategoryMap();
  const budgets = useBudgets();
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  useEffect(() => {
    if (!open) return;
    setCategoryId(budget?.categoryId ?? null);
    setAmount(budget ? String(budget.amount / 100) : "");
  }, [open, budget]);
  const used = new Set(budgets.map((b) => b.categoryId));
  const available = categories.filter((c) => c.kind === "expense" && (!used.has(c.id) || c.id === budget?.categoryId));

  async function save() {
    const minor = Math.round((parseFloat(amount.replace(",", ".")) || 0) * 100);
    if (!categoryId || minor <= 0) return toast(t("budgets.needAmount"));
    await db.budgets.put({ categoryId, amount: minor, updatedAt: Date.now() });
    toast.success(t("budgets.saved"));
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent title={budget ? categoryName(cats.get(budget.categoryId), t) : t("budgets.add")} description={t("budgets.sheetHint")}>
        <div className="no-scrollbar space-y-4 overflow-y-auto px-5 pb-5 pt-4">
          {!budget && <CategoryGrid categories={available} selectedId={categoryId} onPick={setCategoryId} />}
          <Field label={t("budgets.monthlyAmount", { currency })}>
            <Input inputMode="decimal" className="fig text-lg" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <div className="flex gap-2">
            {budget && (
              <Button
                variant="danger"
                onClick={async () => {
                  await db.budgets.delete(budget.categoryId);
                  toast(t("budgets.removed"), { action: { label: t("common.undo"), onClick: () => db.budgets.put(budget) } });
                  onOpenChange(false);
                }}
              >
                {t("common.remove")}
              </Button>
            )}
            <Button variant="ink" className="flex-1" onClick={save}>
              {t("common.save")}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
