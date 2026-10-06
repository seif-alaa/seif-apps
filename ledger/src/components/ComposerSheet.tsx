import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { format, startOfDay, subDays, isSameDay } from "date-fns";
import { CalendarDays, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { Segmented } from "@/components/ui/segmented";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AmountDisplay } from "./AmountDisplay";
import { Keypad, fromMinor, pressKey, toMinor } from "./Keypad";
import { db, uid, type TxnType } from "@/db/db";
import { useAccounts, useCategories } from "@/db/hooks";
import { useComposer, usePrefs } from "@/store/ui";
import { currencySymbol, formatMoney } from "@/lib/format";
import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";

const chip = "flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors";

export function ComposerSheet() {
  const { open, editing, defaultType, close } = useComposer();
  const currency = usePrefs((s) => s.currency);
  const categories = useCategories();
  const accounts = useAccounts();

  const [type, setType] = useState<TxnType>("expense");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [accountId, setAccountId] = useState<string>("");
  const [date, setDate] = useState(() => startOfDay(new Date()));
  const [note, setNote] = useState("");
  const [shake, setShake] = useState(0);
  const dateInput = useRef<HTMLInputElement>(null);

  // Reset the form each time the sheet opens.
  useEffect(() => {
    if (!open) return;
    if (editing) {
      setType(editing.type);
      setAmount(fromMinor(editing.amount));
      setCategoryId(editing.categoryId);
      setAccountId(editing.accountId);
      setDate(new Date(editing.date));
      setNote(editing.note);
    } else {
      setType(defaultType);
      setAmount("");
      setCategoryId("");
      setAccountId("");
      setDate(startOfDay(new Date()));
      setNote("");
    }
  }, [open, editing, defaultType]);

  const visibleCats = useMemo(() => categories.filter((c) => c.kind === type), [categories, type]);
  const catId = visibleCats.some((c) => c.id === categoryId) ? categoryId : visibleCats[0]?.id ?? "";
  const accId = accounts.some((a) => a.id === accountId) ? accountId : accounts[0]?.id ?? "";

  const today = startOfDay(new Date());
  const yesterday = subDays(today, 1);
  const customDate = !isSameDay(date, today) && !isSameDay(date, yesterday);

  async function save() {
    const minor = toMinor(amount);
    if (minor <= 0 || !catId || !accId) {
      haptic("warning");
      setShake((n) => n + 1);
      return;
    }
    const cat = categories.find((c) => c.id === catId);
    const record = { type, amount: minor, categoryId: catId, accountId: accId, note: note.trim(), date: date.getTime() };
    if (editing) {
      await db.transactions.update(editing.id, record);
      toast.success("Updated", { description: "All squared away." });
    } else {
      await db.transactions.add({ ...record, id: uid(), createdAt: Date.now() });
      toast.success(type === "income" ? `Nice! +${formatMoney(minor, currency)} 🎉` : `Logged ${formatMoney(minor, currency)}`, {
        description: `${cat?.emoji ?? ""} ${cat?.name ?? ""}${type === "income" ? " — money in the bank." : ""}`,
      });
    }
    haptic("success");
    close();
  }

  async function remove() {
    if (!editing) return;
    const snapshot = editing;
    await db.transactions.delete(snapshot.id);
    haptic("warning");
    close();
    toast("Transaction deleted", { action: { label: "Undo", onClick: () => db.transactions.add(snapshot) } });
  }

  return (
    <Drawer open={open} onOpenChange={(o) => !o && close()} repositionInputs={false}>
      <DrawerContent>
        <div className="no-scrollbar overflow-y-auto px-5 pb-3 pt-2">
          <DrawerTitle className="sr-only">{editing ? "Edit transaction" : "New transaction"}</DrawerTitle>
          <DrawerDescription className="sr-only">Enter an amount, pick a category and save.</DrawerDescription>
          <div className="mt-1 flex items-center gap-2">
            <Segmented
              className="flex-1"
              value={type}
              onChange={setType}
              options={[
                { value: "expense", label: "Expense", activeClass: "text-coral" },
                { value: "income", label: "Income", activeClass: "text-emerald" },
              ]}
            />
            {editing && (
              <Button variant="secondary" size="icon" className="text-coral" onClick={remove} aria-label="Delete transaction">
                <Trash2 />
              </Button>
            )}
          </div>

          <div className="py-3">
            <AmountDisplay value={amount} symbol={currencySymbol(currency)} tone={type} shakeKey={shake} />
          </div>

          <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 no-scrollbar">
            {visibleCats.map((c) => {
              const active = c.id === catId;
              return (
                <motion.button
                  key={c.id}
                  whileTap={{ scale: 0.92 }}
                  onClick={() => {
                    haptic("light");
                    setCategoryId(c.id);
                  }}
                  className={cn(chip, active ? "border-transparent text-foreground" : "border-border bg-card/50 text-muted-foreground")}
                  style={active ? { background: `color-mix(in srgb, var(--series-${c.slot}) 22%, transparent)`, boxShadow: `inset 0 0 0 1.5px var(--series-${c.slot})` } : undefined}
                >
                  <span className="text-base">{c.emoji}</span>
                  {c.name}
                </motion.button>
              );
            })}
          </div>

          <div className="-mx-5 mt-2 flex gap-2 overflow-x-auto px-5 pb-1 no-scrollbar">
            {[
              { label: "Today", d: today },
              { label: "Yesterday", d: yesterday },
            ].map(({ label, d }) => (
              <button
                key={label}
                onClick={() => setDate(d)}
                className={cn(chip, isSameDay(date, d) ? "border-primary/60 bg-primary/10 text-foreground" : "border-border bg-card/50 text-muted-foreground")}
              >
                {label}
              </button>
            ))}
            <button
              onClick={() => dateInput.current?.showPicker?.() ?? dateInput.current?.click()}
              className={cn(chip, "relative", customDate ? "border-primary/60 bg-primary/10 text-foreground" : "border-border bg-card/50 text-muted-foreground")}
            >
              <CalendarDays className="size-4" />
              {customDate ? format(date, "MMM d") : "Pick date"}
              <input
                ref={dateInput}
                type="date"
                className="absolute inset-0 opacity-0"
                max={format(today, "yyyy-MM-dd")}
                value={format(date, "yyyy-MM-dd")}
                onChange={(e) => e.target.value && setDate(startOfDay(new Date(`${e.target.value}T00:00:00`)))}
              />
            </button>
            {accounts.length > 1 &&
              accounts.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setAccountId(a.id)}
                  className={cn(chip, a.id === accId ? "border-primary/60 bg-primary/10 text-foreground" : "border-border bg-card/50 text-muted-foreground")}
                >
                  <span>{a.emoji}</span>
                  {a.name}
                </button>
              ))}
          </div>

          <Input className="mt-2.5 h-11" placeholder="Add a note (optional)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={60} enterKeyHint="done" />

          <Keypad className="mt-3" onKey={(k) => setAmount((v) => pressKey(v, k, currency === "JPY" ? 0 : 2))} />

          <Button size="lg" className={cn("mt-3 w-full", type === "expense" && "bg-coral shadow-none hover:bg-coral/90")} onClick={save}>
            {editing ? "Save changes" : type === "income" ? "Add income" : "Add expense"}
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
