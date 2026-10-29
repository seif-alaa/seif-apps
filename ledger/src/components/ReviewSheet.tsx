import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeftRight, Check, CircleCheck, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { useLiveQuery } from "dexie-react-hooks";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { db, type Transaction } from "@/db/db";
import { useAccountMap, useAccounts, useCategories, useCategoryMap } from "@/db/hooks";
import { confirmClassification, keepSeparate, mergeDuplicate } from "@/engine/actions";
import { useI18n } from "@/i18n";
import { categoryName, txnTitle } from "@/lib/labels";
import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import { engineConfig, useSheets } from "@/store/ui";
import { AccountMark } from "./icons";
import { CategoryGrid } from "./CategoryGrid";
import { Money } from "./Money";

/**
 * Quick Capture. The review queue as a compact sheet over whatever screen the
 * user is on: one tap on a category files the transaction and slides to the next.
 */
export function ReviewSheet() {
  const { review, set } = useSheets();
  const queue = useLiveQuery(() => db.transactions.where("review").equals("needs_review").reverse().sortBy("occurredAt"), []) ?? [];
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [done, setDone] = useState(0);
  const { t } = useI18n();

  useEffect(() => {
    if (review.open) {
      setCurrentId(review.focus);
      setDone(0);
    }
  }, [review.open, review.focus]);

  const current = queue.find((x) => x.id === currentId) ?? queue[0] ?? null;
  const position = current ? queue.indexOf(current) + 1 : 0;

  const close = () => set({ review: { open: false, focus: null } });
  const advance = () => {
    const rest = queue.filter((x) => x.id !== current?.id);
    setCurrentId(rest[0]?.id ?? null);
    setDone((n) => n + 1);
  };

  return (
    <Sheet open={review.open} onOpenChange={(o) => !o && close()}>
      <SheetContent title={t("review.title")} hideTitle className="min-h-[60dvh]">
        <div className="flex items-center justify-between px-5 pt-3">
          <span className="eyebrow">{t("review.title")}</span>
          {current && <span className="fig text-xs text-ink-3">{t("review.position", { n: position, total: queue.length })}</span>}
        </div>
        <div className="no-scrollbar relative flex-1 overflow-y-auto overflow-x-hidden">
          <AnimatePresence mode="popLayout" initial={false}>
            {current ? (
              <motion.div key={current.id} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ type: "spring", stiffness: 500, damping: 42 }}>
                <ReviewItem txn={current} onDone={advance} />
              </motion.div>
            ) : (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center px-8 py-14 text-center">
                <CircleCheck className="size-8 text-pos" strokeWidth={1.5} />
                <div className="mt-3 text-md font-semibold">{t("review.doneTitle")}</div>
                <p className="mt-1 text-sm text-ink-3">{done ? t("review.doneBody", { count: done }) : t("review.emptyBody")}</p>
                <Button variant="secondary" className="mt-6" onClick={close}>
                  {t("common.close")}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </SheetContent>
    </Sheet>
  );
}

type Mode = "categories" | "transfer";

function ReviewItem({ txn, onDone }: { txn: Transaction; onDone: () => void }) {
  const { t, time, day } = useI18n();
  const categories = useCategories();
  const cats = useCategoryMap();
  const accounts = useAccounts();
  const accountMap = useAccountMap();
  const [direction, setDirection] = useState(txn.direction);
  const [accountId, setAccountId] = useState(txn.accountId);
  const [mode, setMode] = useState<Mode>("categories");
  const [note, setNote] = useState(txn.note);
  const [noteOpen, setNoteOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const duplicateOf = useLiveQuery(async () => {
    if (txn.reviewReason !== "possible_duplicate") return null;
    return (
      (await db.transactions
        .where("occurredAt")
        .between(txn.occurredAt - 3_600_000, txn.occurredAt + 1, true, true)
        .filter((o) => o.id !== txn.id && o.amount === txn.amount && o.direction === txn.direction && o.accountId === txn.accountId)
        .first()) ?? null
    );
  }, [txn.id]);

  const out = direction === "out";
  const visible = useMemo(() => categories.filter((c) => c.kind === (out ? "expense" : "income")), [categories, out]);
  const suggested = txn.classification === "suggested" ? txn.categoryId : null;
  const suggestedKind = txn.classification === "suggested" ? txn.kind : null;
  const needsAccount = !accountId;
  const party = txnTitle(txn, cats, accountMap, t);

  async function confirm(kind: Transaction["kind"], categoryId: string | null, counterAccountId?: string | null) {
    if (needsAccount || !direction) {
      haptic("warning");
      toast(t(needsAccount ? "review.pickAccount" : "review.pickDirection"));
      return;
    }
    setBusy(true);
    try {
      await confirmClassification(txn.id, { kind, categoryId, note, counterAccountId, accountId, direction }, engineConfig());
      haptic("success");
      const label = kind === "transfer" ? t("kind.transfer") : kind === "refund" ? t("kind.refund") : categoryName(cats.get(categoryId ?? ""), t) || t(`kind.${kind}`);
      toast.success(t("review.filed", { label }));
      onDone();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const pick = (id: string) => {
    if (id === "_refund") return confirm("refund", txn.categoryId);
    if (id === "_transfer") return setMode("transfer");
    const c = cats.get(id)!;
    confirm(c.kind === "income" ? "income" : "expense", id);
  };

  const reason = txn.reviewReason ? t(`reason.${txn.reviewReason}`) : null;
  const account = accountId ? accountMap.get(accountId) : null;

  return (
    <div className="px-5 pb-5">
      <div className="pb-4 pt-5">
        <div className="text-sm text-ink-2">{party}</div>
        <Money value={direction === "in" ? txn.amount : direction === "out" ? -txn.amount : txn.amount} currency={txn.currency} signed size="hero" tone={direction === "in" ? "pos" : "ink"} className="mt-1" />
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-3">
          {account && (
            <span className="inline-flex items-center gap-1.5">
              <AccountMark account={account} size="sm" />
              {account.name}
            </span>
          )}
          <span>· {t(`source.${txn.source}`)}</span>
          <span>
            · {day(txn.occurredAt)} {time(txn.occurredAt)}
          </span>
          {txn.origin !== "real" && <span className="rounded-xs border border-rule-strong px-1 text-2xs font-semibold uppercase text-ink-3">{t(`origin.${txn.origin}`)}</span>}
        </div>
      </div>

      {reason && <p className="mb-4 border-s-2 border-accent ps-3 text-sm text-ink-2">{reason}</p>}

      {txn.reviewReason === "possible_duplicate" && duplicateOf && (
        <div className="mb-5 rounded border border-rule p-3">
          <div className="text-sm text-ink-2">{t("review.dupCompare", { time: time(duplicateOf.occurredAt) })}</div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button
              variant="ink"
              size="sm"
              disabled={busy}
              onClick={async () => {
                await mergeDuplicate(txn.id, duplicateOf.id);
                toast.success(t("review.merged"));
                onDone();
              }}
            >
              {t("review.samePayment")}
            </Button>
            <Button variant="outline" size="sm" onClick={() => keepSeparate(txn.id)}>
              {t("review.separate")}
            </Button>
          </div>
        </div>
      )}

      {!txn.direction && (
        <div className="mb-4">
          <div className="mb-2 text-sm font-medium">{t("review.whichWay")}</div>
          <Segmented<"out" | "in">
            value={(direction ?? "out") as "out" | "in"}
            onChange={setDirection}
            options={[
              { value: "out", label: t("dir.out") },
              { value: "in", label: t("dir.in") },
            ]}
          />
        </div>
      )}

      {needsAccount && (
        <div className="mb-4">
          <div className="mb-2 text-sm font-medium">{t("review.whichAccount")}</div>
          <AccountChips accounts={accounts} value={accountId} onChange={setAccountId} />
        </div>
      )}

      {mode === "categories" ? (
        <>
          <div className="mb-2 text-sm font-medium">{out ? t("review.whatFor") : t("review.whatSource")}</div>
          <CategoryGrid
            categories={visible}
            suggestedId={suggested}
            onPick={pick}
            extra={[
              ...(out ? [] : [{ id: "_refund", label: t("review.refundTile"), icon: Undo2 }]),
              { id: "_transfer", label: out ? t("review.toMyAccount") : t("review.fromMyAccount"), icon: ArrowLeftRight },
            ]}
          />
          {suggestedKind === "transfer" && (
            <Button variant="outline" className="mt-3 w-full" onClick={() => confirm("transfer", null, txn.counterAccountId)}>
              <Check /> {t("review.confirmTransfer")}
            </Button>
          )}
          {suggestedKind === "refund" && (
            <Button variant="outline" className="mt-3 w-full" onClick={() => confirm("refund", txn.categoryId)}>
              <Check /> {t("review.confirmRefund")}
            </Button>
          )}
        </>
      ) : (
        <div>
          <div className="mb-2 text-sm font-medium">{out ? t("review.toWhich") : t("review.fromWhich")}</div>
          <div className="flex flex-col divide-y divide-rule rounded border border-rule">
            {accounts
              .filter((a) => a.id !== accountId)
              .map((a) => (
                <button key={a.id} className="tap flex items-center gap-3 px-3 py-3 text-start" onClick={() => confirm("transfer", null, a.id)}>
                  <AccountMark account={a} size="sm" />
                  <span className="flex-1 text-base">{a.name}</span>
                </button>
              ))}
            <button className="tap flex items-center gap-3 px-3 py-3 text-start text-ink-2" onClick={() => confirm("transfer", null, null)}>
              <span className="size-7" />
              <span className="flex-1 text-base">{t("review.untracked")}</span>
            </button>
          </div>
          <Button variant="ghost" size="sm" className="mt-2" onClick={() => setMode("categories")}>
            {t("common.back")}
          </Button>
        </div>
      )}

      <div className="mt-4">
        {noteOpen ? (
          <Input autoFocus placeholder={t("review.notePlaceholder")} value={note} onChange={(e) => setNote(e.target.value)} maxLength={80} enterKeyHint="done" />
        ) : (
          <button className="text-sm font-medium text-accent-ink" onClick={() => setNoteOpen(true)}>
            {note ? note : t("review.addNote")}
          </button>
        )}
      </div>

      <div className="mt-5 flex items-center justify-between border-t border-rule pt-3">
        <Button variant="ghost" size="sm" onClick={onDone}>
          {t("review.skip")}
        </Button>
        <span className="text-xs text-ink-4">{t("review.skipHint")}</span>
      </div>
    </div>
  );
}

export function AccountChips({ accounts, value, onChange }: { accounts: { id: string; name: string }[]; value: string | null; onChange: (id: string) => void }) {
  return (
    <div className="-mx-5 flex gap-1.5 overflow-x-auto px-5 no-scrollbar">
      {accounts.map((a) => (
        <button
          key={a.id}
          type="button"
          onClick={() => onChange(a.id)}
          className={cn("h-9 shrink-0 rounded-sm border px-3 text-sm font-medium transition-colors", a.id === value ? "border-ink bg-ink text-paper" : "border-rule-strong text-ink-2")}
        >
          {a.name}
        </button>
      ))}
    </div>
  );
}
