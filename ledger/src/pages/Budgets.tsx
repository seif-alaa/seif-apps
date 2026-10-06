import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { format, getDaysInMonth } from "date-fns";
import { Plus } from "lucide-react";
import { Page, Reveal } from "@/components/Page";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Money, CountUp } from "@/components/AnimatedNumber";
import { ProgressBar, ProgressRing } from "@/components/Progress";
import { CategoryBadge } from "@/components/CategoryBadge";
import { EmptyState } from "@/components/EmptyState";
import { TargetIllustration } from "@/components/Illustrations";
import { BudgetSheet } from "@/components/BudgetSheet";
import { useBudgets, useCategoryMap, useTransactions } from "@/db/hooks";
import type { Budget } from "@/db/db";
import { budgetStatuses, type BudgetStatus } from "@/lib/stats";
import { useMoney } from "@/lib/format";
import { usePrefs } from "@/store/ui";
import { cn } from "@/lib/utils";

function statusLine(s: BudgetStatus, money: (n: number, o?: object) => string, hidden: boolean) {
  const left = s.budget.amount - s.spent;
  const m = (n: number) => (hidden ? "••••" : money(n, { cents: false }));
  if (s.tone === "over") return { text: `Over by ${m(-left)} — it happens`, cls: "text-coral" };
  if (s.ratio === 0) return { text: "Untouched so far 🌱", cls: "text-emerald" };
  if (s.tone === "warn") return { text: `${m(left)} left — getting close`, cls: "text-amber" };
  return { text: `${m(left)} left · on track`, cls: "text-emerald" };
}

export default function Budgets() {
  const budgets = useBudgets();
  const txns = useTransactions();
  const cats = useCategoryMap();
  const money = useMoney();
  const hidden = usePrefs((s) => s.hideAmounts);
  const [sheet, setSheet] = useState<{ open: boolean; budget: Budget | null }>({ open: false, budget: null });

  const statuses = useMemo(() => budgetStatuses(budgets, txns ?? [], cats), [budgets, txns, cats]);
  const total = statuses.reduce((s, b) => s + b.budget.amount, 0);
  const spent = statuses.reduce((s, b) => s + Math.min(b.spent, b.budget.amount * 10), 0);
  const ratio = total ? spent / total : 0;
  const today = new Date();
  const daysLeft = getDaysInMonth(today) - today.getDate() + 1;
  const pace = today.getDate() / getDaysInMonth(today);
  const tone = ratio > 1 ? "over" : ratio > pace + 0.1 ? "warn" : "good";
  const perDay = Math.max(0, total - spent) / daysLeft;

  const headline =
    tone === "over"
      ? { t: "Over budget this month", b: "No guilt — next month is a fresh page. Maybe trim one category for now?" }
      : tone === "warn"
        ? { t: "Running a bit hot", b: `You've used more than ${Math.round(pace * 100)}% of the month's budget. Easy does it.` }
        : { t: "You're doing great", b: `Spending is behind the calendar — exactly where you want it.` };

  return (
    <Page>
      <PageHeader
        eyebrow={format(today, "MMMM yyyy")}
        title="Budgets"
        action={
          statuses.length > 0 && (
            <Button size="icon" variant="soft" aria-label="Add budget" onClick={() => setSheet({ open: true, budget: null })}>
              <Plus />
            </Button>
          )
        }
      />

      {statuses.length === 0 ? (
        <EmptyState
          art={<TargetIllustration />}
          title="Give your money a plan"
          body="Set a monthly amount for the things you love (and the things you have to). I'll cheer you on as you go."
          action={
            <Button onClick={() => setSheet({ open: true, budget: null })}>
              <Plus /> Create a budget
            </Button>
          }
        />
      ) : (
        <>
          <Reveal i={0} className="px-5">
            <div className="surface-card flex items-center gap-5 p-5">
              <ProgressRing value={ratio} tone={tone} size={116} stroke={11}>
                <CountUp value={Math.round(ratio * 100)} suffix="%" className="text-2xl font-semibold" />
                <span className="text-[11px] text-muted-foreground">used</span>
              </ProgressRing>
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{headline.t}</div>
                <p className="mt-0.5 text-sm leading-snug text-muted-foreground">{headline.b}</p>
                <div className="mt-3 text-sm">
                  <Money value={Math.max(0, total - spent)} cents={false} className={cn("text-lg font-semibold", tone === "over" ? "text-coral" : "text-foreground")} />
                  <span className="text-muted-foreground"> left</span>
                </div>
                {tone !== "over" && (
                  <div className="text-xs text-muted-foreground">
                    ≈ <Money value={perDay} cents={false} fromZero={false} /> a day for {daysLeft} {daysLeft === 1 ? "day" : "days"}
                  </div>
                )}
              </div>
            </div>
          </Reveal>

          <div className="space-y-3 px-5 pt-4">
            {statuses.map((s, i) => {
              const line = statusLine(s, money, hidden);
              return (
                <Reveal key={s.budget.categoryId} i={i + 1}>
                  <motion.button whileTap={{ scale: 0.98 }} onClick={() => setSheet({ open: true, budget: s.budget })} className="surface-card block w-full p-4 text-left">
                    <div className="flex items-center gap-3">
                      <CategoryBadge category={s.category} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="truncate font-semibold">{s.category.name}</span>
                          <span className="text-sm text-muted-foreground">
                            <Money value={s.spent} cents={false} className="font-semibold text-foreground" /> / <Money value={s.budget.amount} cents={false} fromZero={false} />
                          </span>
                        </div>
                        <div className={cn("text-[13px] font-medium", line.cls)}>{line.text}</div>
                      </div>
                    </div>
                    <ProgressBar className="mt-3" value={s.ratio} tone={s.tone} pace={s.paceRatio} />
                  </motion.button>
                </Reveal>
              );
            })}
            <p className="pt-1 text-center text-xs text-muted-foreground">The little tick shows where you'd be if you spent evenly all month.</p>
          </div>
        </>
      )}

      <BudgetSheet open={sheet.open} budget={sheet.budget} onOpenChange={(open) => setSheet((s) => ({ ...s, open }))} />
    </Page>
  );
}
