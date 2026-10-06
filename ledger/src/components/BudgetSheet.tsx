import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { AmountDisplay } from "./AmountDisplay";
import { Keypad, fromMinor, pressKey, toMinor } from "./Keypad";
import { db, type Budget } from "@/db/db";
import { useBudgets, useCategories } from "@/db/hooks";
import { usePrefs } from "@/store/ui";
import { currencySymbol, formatMoney } from "@/lib/format";
import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";

export function BudgetSheet({ open, onOpenChange, budget }: { open: boolean; onOpenChange: (o: boolean) => void; budget?: Budget | null }) {
  const currency = usePrefs((s) => s.currency);
  const categories = useCategories();
  const budgets = useBudgets();
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [shake, setShake] = useState(0);

  const available = useMemo(() => {
    const used = new Set(budgets.map((b) => b.categoryId));
    return categories.filter((c) => c.kind === "expense" && (!used.has(c.id) || c.id === budget?.categoryId));
  }, [categories, budgets, budget]);

  useEffect(() => {
    if (!open) return;
    setCategoryId(budget?.categoryId ?? "");
    setAmount(budget ? fromMinor(budget.amount) : "");
  }, [open, budget]);

  const catId = available.some((c) => c.id === categoryId) ? categoryId : available[0]?.id ?? "";
  const cat = categories.find((c) => c.id === catId);

  async function save() {
    const minor = toMinor(amount);
    if (!catId || minor <= 0) {
      haptic("warning");
      setShake((n) => n + 1);
      return;
    }
    await db.budgets.put({ categoryId: catId, amount: minor, updatedAt: Date.now() });
    haptic("success");
    toast.success(`${cat?.emoji} ${formatMoney(minor, currency, { cents: false })} a month for ${cat?.name}`, { description: "I'll keep an eye on it for you." });
    onOpenChange(false);
  }

  async function remove() {
    if (!budget) return;
    await db.budgets.delete(budget.categoryId);
    toast("Budget removed", { action: { label: "Undo", onClick: () => db.budgets.put(budget) } });
    onOpenChange(false);
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <div className="no-scrollbar overflow-y-auto px-5 pb-4 pt-3">
          <DrawerTitle>{budget ? `${cat?.emoji ?? ""} ${cat?.name ?? "Budget"}` : "New monthly budget"}</DrawerTitle>
          <DrawerDescription>{budget ? "Adjust how much you'd like to spend each month." : "Pick a category and a monthly amount that feels doable."}</DrawerDescription>

          {!budget && (
            <div className="-mx-5 mt-4 flex gap-2 overflow-x-auto px-5 pb-1 no-scrollbar">
              {available.map((c) => (
                <motion.button
                  key={c.id}
                  whileTap={{ scale: 0.92 }}
                  onClick={() => setCategoryId(c.id)}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium",
                    c.id === catId ? "border-transparent text-foreground" : "border-border bg-card/50 text-muted-foreground",
                  )}
                  style={c.id === catId ? { background: `color-mix(in srgb, var(--series-${c.slot}) 22%, transparent)`, boxShadow: `inset 0 0 0 1.5px var(--series-${c.slot})` } : undefined}
                >
                  <span className="text-base">{c.emoji}</span>
                  {c.name}
                </motion.button>
              ))}
              {available.length === 0 && <p className="text-sm text-muted-foreground">Every expense category already has a budget. Overachiever! 🏆</p>}
            </div>
          )}

          <div className="py-7">
            <AmountDisplay value={amount} symbol={currencySymbol(currency)} tone="expense" shakeKey={shake} />
            <p className="mt-2 text-center text-sm text-muted-foreground">per month</p>
          </div>

          <Keypad onKey={(k) => setAmount((v) => pressKey(v, k, currency === "JPY" ? 0 : 2))} />

          <div className="mt-4 flex gap-2">
            {budget && (
              <Button variant="secondary" className="text-coral" onClick={remove}>
                Remove
              </Button>
            )}
            <Button size="lg" className="flex-1" onClick={save} disabled={!catId}>
              {budget ? "Save budget" : "Set budget"}
            </Button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
