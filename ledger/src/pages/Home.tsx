import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDownLeft, ArrowUpRight, ChevronRight, Eye, EyeOff, Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Page, Reveal } from "@/components/Page";
import { Money } from "@/components/AnimatedNumber";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SpendingTrend } from "@/components/charts/SpendingTrend";
import { SwipeableRow } from "@/components/SwipeableRow";
import { TransactionRow } from "@/components/TransactionRow";
import { EmptyState } from "@/components/EmptyState";
import { PiggyIllustration } from "@/components/Illustrations";
import { AccountSheet } from "@/components/AccountSheet";
import { InstallHint } from "@/components/InstallHint";
import { useAccountMap, useAccounts, useBudgets, useCategoryMap, useTransactions } from "@/db/hooks";
import { db, type Account } from "@/db/db";
import { loadSampleData } from "@/db/seed";
import { accountBalances, dailyCumulative, monthTxns, totals, weeklyVibe } from "@/lib/stats";
import { greeting } from "@/lib/format";
import { useComposer, usePrefs } from "@/store/ui";
import { cn } from "@/lib/utils";

const vibeTint = {
  good: "from-emerald-soft/90 to-transparent",
  warn: "from-amber-soft/90 to-transparent",
  over: "from-coral-soft/90 to-transparent",
  neutral: "from-muted to-transparent",
};

export default function Home() {
  const txns = useTransactions();
  const accounts = useAccounts();
  const accountMap = useAccountMap();
  const budgets = useBudgets();
  const cats = useCategoryMap();
  const { name, hideAmounts, setPrefs } = usePrefs();
  const { openNew, openEdit } = useComposer();
  const navigate = useNavigate();
  const [accountSheet, setAccountSheet] = useState<{ open: boolean; account: Account | null }>({ open: false, account: null });

  const all = txns ?? [];
  const balances = useMemo(() => accountBalances(accounts, all), [accounts, all]);
  const netWorth = [...balances.values()].reduce((s, v) => s + v, 0);
  const month = useMemo(() => totals(monthTxns(all, new Date())), [all]);
  const budgetTotal = budgets.reduce((s, b) => s + b.amount, 0);
  const trend = useMemo(() => dailyCumulative(all, new Date(), budgetTotal), [all, budgetTotal]);
  const vibe = useMemo(() => weeklyVibe(budgets, all, name), [budgets, all, name]);
  const recent = all.slice(0, 5);

  async function removeTxn(id: string) {
    const snap = await db.transactions.get(id);
    await db.transactions.delete(id);
    if (snap) toast("Deleted", { action: { label: "Undo", onClick: () => db.transactions.add(snap) } });
  }

  return (
    <Page>
      <header className="flex items-center justify-between px-5 pb-4 pt-[calc(env(safe-area-inset-top)+18px)]">
        <div>
          <div className="text-sm text-muted-foreground">{greeting()}{name ? "," : ""}</div>
          <h1 className="text-[28px] font-bold leading-tight tracking-tight">{name || "Welcome back"} 👋</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="icon" aria-label={hideAmounts ? "Show amounts" : "Hide amounts"} onClick={() => setPrefs({ hideAmounts: !hideAmounts })}>
            {hideAmounts ? <EyeOff /> : <Eye />}
          </Button>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => navigate("/settings")}
            aria-label="Settings"
            className="flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[hsl(var(--hero-c))] to-[hsl(var(--hero-a))] text-base font-bold text-white shadow-soft"
          >
            {(name || "L").slice(0, 1).toUpperCase()}
          </motion.button>
        </div>
      </header>

      <InstallHint />

      <Reveal i={0} className="px-5">
        <div className="hero-gradient noise relative overflow-hidden rounded-[1.75rem] p-5 text-white shadow-lift">
          <div className="absolute -right-10 -top-10 size-40 rounded-full bg-white/10 blur-2xl" />
          <div className="relative text-sm font-medium text-white/75">Total balance</div>
          <Money value={netWorth} className="relative mt-1 block text-[40px] font-semibold leading-none tracking-tight" />
          <div className="relative mt-5 grid grid-cols-2 gap-2.5">
            <div className="rounded-2xl bg-white/15 p-3 backdrop-blur-md">
              <div className="flex items-center gap-1.5 text-xs text-white/75">
                <span className="flex size-5 items-center justify-center rounded-full bg-white/20">
                  <ArrowDownLeft className="size-3.5" />
                </span>
                In this month
              </div>
              <Money value={month.income} cents={false} className="mt-1 block text-lg font-semibold" />
            </div>
            <div className="rounded-2xl bg-white/15 p-3 backdrop-blur-md">
              <div className="flex items-center gap-1.5 text-xs text-white/75">
                <span className="flex size-5 items-center justify-center rounded-full bg-white/20">
                  <ArrowUpRight className="size-3.5" />
                </span>
                Out this month
              </div>
              <Money value={month.expense} cents={false} className="mt-1 block text-lg font-semibold" />
            </div>
          </div>
        </div>
      </Reveal>

      {txns && all.length === 0 ? (
        <Reveal i={1}>
          <EmptyState
            art={<PiggyIllustration />}
            title="Your piggy bank is waiting"
            body="Log a coffee, a paycheck, anything. Ledger keeps it all on this phone — private by default."
            action={
              <div className="flex flex-col gap-2">
                <Button onClick={() => openNew()}>
                  <Plus /> Add your first transaction
                </Button>
                <Button
                  variant="ghost"
                  onClick={async () => {
                    await loadSampleData();
                    toast.success("Sample data loaded ✨", { description: "Poke around — you can erase it in Settings." });
                  }}
                >
                  <Sparkles /> Explore with sample data
                </Button>
              </div>
            }
          />
        </Reveal>
      ) : (
        <>
          <Reveal i={1} className="px-5 pt-4">
            <Link to="/budgets" className={cn("flex items-center gap-3 rounded-3xl border border-border/60 bg-gradient-to-br p-4", vibeTint[vibe.tone])}>
              <motion.div
                className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-card text-2xl shadow-soft"
                initial={{ rotate: -12, scale: 0.6 }}
                animate={{ rotate: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 12, delay: 0.3 }}
              >
                {vibe.emoji}
              </motion.div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{vibe.title}</div>
                <div className="text-sm leading-snug text-muted-foreground">{vibe.body}</div>
              </div>
            </Link>
          </Reveal>

          <Reveal i={2} className="pt-5">
            <div className="mb-2 flex items-center justify-between px-5">
              <CardTitle>Accounts</CardTitle>
            </div>
            <div className="flex gap-3 overflow-x-auto px-5 pb-2 no-scrollbar">
              {accounts.map((a) => (
                <motion.button
                  key={a.id}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => setAccountSheet({ open: true, account: a })}
                  className="surface-card w-[150px] shrink-0 p-4 text-left"
                >
                  <div className="text-2xl">{a.emoji}</div>
                  <div className="mt-3 truncate text-sm text-muted-foreground">{a.name}</div>
                  <Money value={balances.get(a.id) ?? 0} cents={false} className={cn("block text-lg font-semibold", (balances.get(a.id) ?? 0) < 0 && "text-coral")} />
                </motion.button>
              ))}
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={() => setAccountSheet({ open: true, account: null })}
                className="flex w-[110px] shrink-0 flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-border text-sm text-muted-foreground"
              >
                <Plus className="size-5" /> Add
              </motion.button>
            </div>
          </Reveal>

          <Reveal i={3} className="px-5 pt-3">
            <Card>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>Spent this month</CardTitle>
                  <Money value={month.expense} className="mt-1 block text-[26px] font-semibold" />
                  {budgetTotal > 0 && (
                    <div className="text-sm text-muted-foreground">
                      of <Money value={budgetTotal} cents={false} /> budgeted
                    </div>
                  )}
                </div>
                <Link to="/insights" className="flex items-center text-sm font-medium text-emerald">
                  Insights <ChevronRight className="size-4" />
                </Link>
              </div>
              <div className="mt-3">
                <SpendingTrend data={trend} />
              </div>
            </Card>
          </Reveal>

          <Reveal i={4} className="px-5 pt-5">
            <div className="mb-2 flex items-center justify-between">
              <CardTitle>Recent</CardTitle>
              <Link to="/activity" className="flex items-center text-sm font-medium text-emerald">
                See all <ChevronRight className="size-4" />
              </Link>
            </div>
            <div className="space-y-0.5 rounded-3xl border border-border/70 bg-card p-1.5 shadow-soft">
              <AnimatePresence initial={false}>
                {recent.map((t) => (
                  <motion.div key={t.id} layout exit={{ opacity: 0, height: 0 }} transition={{ type: "spring", stiffness: 400, damping: 36 }}>
                    <SwipeableRow onDelete={() => removeTxn(t.id)} onTap={() => openEdit(t)}>
                      <TransactionRow t={t} category={cats.get(t.categoryId)} account={accounts.length > 1 ? accountMap.get(t.accountId) : undefined} />
                    </SwipeableRow>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
            <p className="mt-2 text-center text-xs text-muted-foreground">Tip: swipe a row left to delete it</p>
          </Reveal>
        </>
      )}

      <AccountSheet open={accountSheet.open} account={accountSheet.account} onOpenChange={(open) => setAccountSheet((s) => ({ ...s, open }))} />
    </Page>
  );
}
