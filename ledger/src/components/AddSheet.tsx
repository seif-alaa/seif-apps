import { useEffect, useMemo, useState } from "react";
import { format, startOfDay, subDays, isSameDay } from "date-fns";
import { toast } from "sonner";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Segmented } from "@/components/ui/segmented";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAccounts, useCategories } from "@/db/hooks";
import { addManual } from "@/engine/actions";
import { useI18n } from "@/i18n";
import { categoryName } from "@/lib/labels";
import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import { useSheets } from "@/store/ui";
import { AmountDisplay } from "./AmountDisplay";
import { Keypad, pressKey, toMinor } from "./Keypad";
import { CATEGORY_ICONS } from "./icons";
import { AccountChips } from "./ReviewSheet";
import { CircleHelp } from "lucide-react";

type Mode = "out" | "in" | "transfer";

/** Manual entry — the fast path for cash and anything no source can see. */
export function AddSheet() {
  const { add, set } = useSheets();
  const { t, day } = useI18n();
  const accounts = useAccounts();
  const categories = useCategories();
  const [mode, setMode] = useState<Mode>("out");
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState<string | null>(null);
  const [toId, setToId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [date, setDate] = useState(() => startOfDay(new Date()));
  const [note, setNote] = useState("");
  const [shake, setShake] = useState(0);
  const [noteOpen, setNoteOpen] = useState(false);

  // Cash is the most common manual case, so it's the default account when present.
  useEffect(() => {
    if (!add) return;
    setMode("out");
    setAmount("");
    setCategoryId(null);
    setNote("");
    setNoteOpen(false);
    setDate(startOfDay(new Date()));
    setAccountId(accounts.find((a) => a.kind === "cash")?.id ?? accounts[0]?.id ?? null);
    setToId(null);
  }, [add]); // eslint-disable-line react-hooks/exhaustive-deps

  const visible = useMemo(() => categories.filter((c) => c.kind === (mode === "in" ? "income" : "expense")), [categories, mode]);
  const account = accounts.find((a) => a.id === accountId);
  const currency = account?.currency ?? "EGP";
  const today = startOfDay(new Date());

  async function save() {
    const minor = toMinor(amount);
    const missing = minor <= 0 || !accountId || (mode !== "transfer" && !categoryId) || (mode === "transfer" && !toId);
    if (missing) {
      haptic("warning");
      setShake((n) => n + 1);
      toast(t(minor <= 0 ? "add.needAmount" : mode === "transfer" ? "add.needTo" : "add.needCategory"));
      return;
    }
    await addManual({
      amount: minor,
      direction: mode === "in" ? "in" : "out",
      kind: mode === "transfer" ? "transfer" : mode === "in" ? "income" : "expense",
      categoryId,
      accountId: accountId!,
      counterAccountId: mode === "transfer" ? toId : null,
      occurredAt: isSameDay(date, today) ? Date.now() : date.getTime() + 12 * 3_600_000,
      note: note.trim(),
      merchant: note.trim() || undefined,
      currency,
    });
    haptic("success");
    toast.success(t("add.saved"));
    set({ add: false });
  }

  return (
    <Sheet open={add} onOpenChange={(o) => set({ add: o })}>
      <SheetContent title={t("add.title")} hideTitle>
        <div className="no-scrollbar overflow-y-auto px-5 pb-4 pt-3">
          <Segmented<Mode>
            value={mode}
            onChange={(m) => {
              setMode(m);
              setCategoryId(null);
            }}
            options={[
              { value: "out", label: t("add.out") },
              { value: "in", label: t("add.in") },
              { value: "transfer", label: t("add.transfer") },
            ]}
          />
          <div className="py-3">
            <AmountDisplay value={amount} currency={currency} tone={mode === "in" ? "in" : "neutral"} shakeKey={shake} />
          </div>

          <div className="mb-1 text-xs font-medium text-ink-3">{mode === "transfer" ? t("add.from") : t("add.account")}</div>
          <AccountChips accounts={accounts} value={accountId} onChange={setAccountId} />

          {mode === "transfer" ? (
            <>
              <div className="mb-1 mt-2.5 text-xs font-medium text-ink-3">{t("add.to")}</div>
              <AccountChips accounts={accounts.filter((a) => a.id !== accountId)} value={toId} onChange={setToId} />
            </>
          ) : (
            <>
              <div className="mb-1 mt-2.5 text-xs font-medium text-ink-3">{t("add.category")}</div>
              <div className="-mx-5 flex gap-1.5 overflow-x-auto px-5 no-scrollbar">
                {visible.map((c) => {
                  const Icon = CATEGORY_ICONS[c.icon] ?? CircleHelp;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setCategoryId(c.id)}
                      className={cn("flex h-9 shrink-0 items-center gap-1.5 rounded-sm border px-2.5 text-sm font-medium", c.id === categoryId ? "border-ink bg-ink text-paper" : "border-rule-strong text-ink-2")}
                    >
                      <Icon className="size-4" strokeWidth={1.75} />
                      {categoryName(c, t)}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          <div className="mt-2.5 flex gap-1.5">
            {[today, subDays(today, 1)].map((d) => (
              <button key={d.getTime()} type="button" onClick={() => setDate(d)} className={cn("h-8 rounded-sm border px-2.5 text-sm", isSameDay(date, d) ? "border-ink text-ink" : "border-rule-strong text-ink-3")}>
                {day(d.getTime())}
              </button>
            ))}
            <label className={cn("relative flex h-8 items-center rounded-sm border px-2.5 text-sm", !isSameDay(date, today) && !isSameDay(date, subDays(today, 1)) ? "border-ink text-ink" : "border-rule-strong text-ink-3")}>
              {!isSameDay(date, today) && !isSameDay(date, subDays(today, 1)) ? day(date.getTime()) : t("add.pickDate")}
              <input
                type="date"
                className="absolute inset-0 opacity-0"
                max={format(today, "yyyy-MM-dd")}
                value={format(date, "yyyy-MM-dd")}
                onChange={(e) => e.target.value && setDate(startOfDay(new Date(`${e.target.value}T00:00:00`)))}
              />
            </label>
          </div>

          {noteOpen || note ? (
            <Input autoFocus className="mt-2.5 h-10" placeholder={t("add.notePlaceholder")} value={note} onChange={(e) => setNote(e.target.value)} maxLength={60} enterKeyHint="done" />
          ) : (
            <button type="button" onClick={() => setNoteOpen(true)} className="mt-2.5 block text-sm font-medium text-accent-ink">
              {t("add.addNote")}
            </button>
          )}
          <Keypad className="mt-2.5" onKey={(k) => setAmount((v) => pressKey(v, k, currency === "JPY" ? 0 : 2))} />
          <Button size="lg" variant="ink" className="mt-2.5 w-full" onClick={save}>
            {t("add.save")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
