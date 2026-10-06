import { useDeferredValue, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, Search, X } from "lucide-react";
import { toast } from "sonner";
import { Page, Reveal } from "@/components/Page";
import { PageHeader } from "@/components/PageHeader";
import { Segmented } from "@/components/ui/segmented";
import { Button } from "@/components/ui/button";
import { SwipeableRow } from "@/components/SwipeableRow";
import { TransactionRow } from "@/components/TransactionRow";
import { EmptyState } from "@/components/EmptyState";
import { ReceiptIllustration } from "@/components/Illustrations";
import { useAccountMap, useAccounts, useCategoryMap, useTransactions } from "@/db/hooks";
import { db, type Transaction } from "@/db/db";
import { friendlyDay, useMoney } from "@/lib/format";
import { signed } from "@/lib/stats";
import { useComposer, usePrefs } from "@/store/ui";
import { cn } from "@/lib/utils";

type Filter = "all" | "expense" | "income";
const PAGE = 120;

export default function Activity() {
  const txns = useTransactions();
  const cats = useCategoryMap();
  const accounts = useAccounts();
  const accountMap = useAccountMap();
  const { openNew, openEdit } = useComposer();
  const hidden = usePrefs((s) => s.hideAmounts);
  const money = useMoney();
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const q = useDeferredValue(query.trim().toLowerCase());

  const filtered = useMemo(() => {
    return (txns ?? []).filter((t) => {
      if (filter !== "all" && t.type !== filter) return false;
      if (!q) return true;
      const c = cats.get(t.categoryId);
      return t.note.toLowerCase().includes(q) || c?.name.toLowerCase().includes(q) || String(t.amount / 100).includes(q);
    });
  }, [txns, filter, q, cats]);

  const groups = useMemo(() => {
    const out: { day: number; items: Transaction[]; net: number }[] = [];
    for (const t of filtered.slice(0, limit)) {
      const last = out[out.length - 1];
      if (last && last.day === t.date) {
        last.items.push(t);
        last.net += signed(t);
      } else out.push({ day: t.date, items: [t], net: signed(t) });
    }
    return out;
  }, [filtered, limit]);

  async function remove(t: Transaction) {
    await db.transactions.delete(t.id);
    const c = cats.get(t.categoryId);
    toast(`Deleted ${c?.emoji ?? ""} ${t.note || c?.name || "transaction"}`, {
      action: { label: "Undo", onClick: () => db.transactions.add(t) },
    });
  }

  const empty = txns && txns.length === 0;

  return (
    <Page>
      <PageHeader eyebrow={txns ? `${txns.length} transactions` : " "} title="Activity" />

      {!empty && (
        <div className="sticky top-0 z-10 space-y-3 bg-gradient-to-b from-background via-background/95 to-background/0 px-5 pb-3 pt-1">
          <div className="relative">
            <Search className="pointer-events-none absolute z-10 left-4 top-1/2 size-[18px] -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search notes, categories, amounts"
              className="h-12 w-full rounded-2xl border border-input bg-card/70 pl-11 pr-10 text-base outline-none backdrop-blur placeholder:text-muted-foreground/70 focus:ring-2 focus:ring-ring/50"
              enterKeyHint="search"
            />
            <AnimatePresence>
              {query && (
                <motion.button
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  onClick={() => setQuery("")}
                  className="absolute right-3 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-full bg-muted-foreground/25"
                  aria-label="Clear search"
                >
                  <X className="size-3.5" />
                </motion.button>
              )}
            </AnimatePresence>
          </div>
          <Segmented
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: "Everything" },
              { value: "expense", label: "Money out", activeClass: "text-coral" },
              { value: "income", label: "Money in", activeClass: "text-emerald" },
            ]}
          />
        </div>
      )}

      {empty ? (
        <EmptyState
          art={<ReceiptIllustration />}
          title="Nothing here yet"
          body="Every coffee, paycheck and late-night snack you log will show up here, neatly sorted by day."
          action={
            <Button onClick={() => openNew()}>
              <Plus /> Log something
            </Button>
          }
        />
      ) : txns && filtered.length === 0 ? (
        <EmptyState art={<ReceiptIllustration />} title="No matches" body={q ? `Couldn't find anything for “${query}”. Try a category name or amount.` : "Nothing in this view yet."} />
      ) : (
        <div className="space-y-5 px-5">
          {groups.map((g, gi) => (
            <Reveal key={g.day} i={Math.min(gi, 6)}>
              <div className="mb-1.5 flex items-baseline justify-between px-1">
                <h2 className="text-sm font-semibold">{friendlyDay(g.day)}</h2>
                <span className={cn("num text-xs", g.net >= 0 ? "text-emerald" : "text-muted-foreground")}>{hidden ? "••••" : money(g.net, { signed: true })}</span>
              </div>
              <div className="space-y-0.5 rounded-3xl border border-border/70 bg-card p-1.5 shadow-soft">
                <AnimatePresence initial={false}>
                  {g.items.map((t) => (
                    <motion.div key={t.id} layout exit={{ opacity: 0, height: 0 }} transition={{ type: "spring", stiffness: 400, damping: 36 }}>
                      <SwipeableRow onDelete={() => remove(t)} onTap={() => openEdit(t)}>
                        <TransactionRow t={t} category={cats.get(t.categoryId)} account={accounts.length > 1 ? accountMap.get(t.accountId) : undefined} />
                      </SwipeableRow>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </Reveal>
          ))}
          {filtered.length > limit && (
            <Button variant="secondary" className="w-full" onClick={() => setLimit((l) => l + PAGE)}>
              Show older
            </Button>
          )}
          {filtered.length > 0 && filtered.length <= limit && <p className="py-4 text-center text-sm text-muted-foreground">That's everything ✨</p>}
        </div>
      )}
    </Page>
  );
}
