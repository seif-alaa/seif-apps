import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "sonner";
import { RotateCcw, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { db } from "@/db/db";
import { useAccountMap, useCategoryMap } from "@/db/hooks";
import { deleteTransaction, reopen, restore } from "@/engine/actions";
import { useI18n } from "@/i18n";
import { categoryName, txnTitle } from "@/lib/labels";
import { useSheets } from "@/store/ui";
import { Money } from "./Money";
import { Tag } from "./layout";

/** Everything Ledger knows about one transaction — including how it knows it. */
export function DetailSheet() {
  const { detail, set, openReview } = useSheets();
  const { t, day, time, pct } = useI18n();
  const cats = useCategoryMap();
  const accounts = useAccountMap();
  const txn = useLiveQuery(() => (detail ? db.transactions.get(detail) : undefined), [detail]);
  const events = useLiveQuery(() => (txn?.sourceEventIds.length ? db.events.bulkGet(txn.sourceEventIds) : []), [txn?.sourceEventIds.join()]) ?? [];
  const partner = useLiveQuery(() => (txn?.transferGroupId ? db.transactions.where("transferGroupId").equals(txn.transferGroupId).filter((x) => x.id !== txn.id).first() : undefined), [txn?.transferGroupId, txn?.id]);
  const close = () => set({ detail: null });

  if (!txn) return <Sheet open={false} onOpenChange={close}>{null}</Sheet>;
  const cat = txn.categoryId ? cats.get(txn.categoryId) : null;
  const account = txn.accountId ? accounts.get(txn.accountId) : null;
  const counter = txn.counterAccountId ? accounts.get(txn.counterAccountId) : null;

  async function remove() {
    const snap = await deleteTransaction(txn!.id);
    close();
    if (snap) toast(t("detail.deleted"), { action: { label: t("common.undo"), onClick: () => restore(snap) } });
  }

  return (
    <Sheet open={!!detail} onOpenChange={(o) => !o && close()}>
      <SheetContent title={txnTitle(txn, cats, accounts, t)}>
        <div className="no-scrollbar overflow-y-auto pb-4">
          <div className="px-5 pb-4 pt-2">
            <Money value={txn.direction === "in" ? txn.amount : -txn.amount} currency={txn.currency} signed={txn.kind !== "transfer"} size="hero" tone={txn.direction === "in" && txn.kind !== "transfer" ? "pos" : "ink"} />
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Tag>{t(`kind.${txn.kind}`)}</Tag>
              {txn.review === "needs_review" && <Tag tone="accent">{t("tag.review")}</Tag>}
              {txn.posting !== "posted" && <Tag tone="warn">{t(`posting.${txn.posting}`)}</Tag>}
              {txn.origin !== "real" && <Tag tone="outline">{t(`origin.${txn.origin}`)}</Tag>}
            </div>
          </div>

          <dl className="border-y border-rule bg-surface text-sm">
            <Item label={t("detail.when")}>{`${day(txn.occurredAt)} · ${time(txn.occurredAt)}`}</Item>
            <Item label={t("detail.account")}>{account?.name ?? t("txn.noAccount")}</Item>
            {txn.kind === "transfer" && <Item label={txn.direction === "out" ? t("detail.to") : t("detail.from")}>{counter?.name ?? t("review.untracked")}</Item>}
            {txn.kind === "transfer" && partner && partner.amount !== txn.amount && (
              <Item label={t("detail.fee")}>
                <Money value={Math.abs(txn.amount - partner.amount)} currency={txn.currency} size="sm" />
              </Item>
            )}
            {cat && <Item label={t("detail.category")}>{categoryName(cat, t)}</Item>}
            {txn.merchant && txn.kind !== "transfer" && <Item label={t("detail.merchant")}>{txn.merchant}</Item>}
            {txn.note && <Item label={t("detail.note")}>{txn.note}</Item>}
            {txn.reference && <Item label={t("detail.reference")}><span className="font-mono text-xs">{txn.reference}</span></Item>}
          </dl>

          <h3 className="eyebrow px-5 pb-2 pt-6">{t("detail.howKnown")}</h3>
          <dl className="border-y border-rule bg-surface text-sm">
            <Item label={t("detail.observed")}>{`${t(`source.${txn.source}`)} · ${day(txn.detectedAt)} ${time(txn.detectedAt)}`}</Item>
            <Item label={t("detail.classified")}>{`${t(`method.${txn.method}`)}${txn.method !== "user" && txn.confidence ? ` · ${pct(txn.confidence)}` : ""}`}</Item>
            <Item label={t("detail.confirmed")}>{t(`reviewState.${txn.review}`)}</Item>
            <Item label={t("detail.posted")}>{t(`posting.${txn.posting}`)}</Item>
            {txn.sourceEventIds.length > 0 && <Item label={t("detail.alerts")}>{t("detail.alertCount", { count: txn.sourceEventIds.length })}</Item>}
          </dl>
          {events.some((e) => e?.evidence) && (
            <div className="space-y-2 px-5 pt-3">
              {events.map((e) => e?.evidence && <p key={e.id} className="rounded-sm bg-sunken p-2.5 font-mono text-xs leading-relaxed text-ink-2">{e.evidence}</p>)}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 px-5 pt-6">
            <Button
              variant="secondary"
              onClick={async () => {
                if (txn.review !== "needs_review") await reopen(txn.id);
                close();
                openReview(txn.id);
              }}
            >
              <RotateCcw /> {t("detail.reclassify")}
            </Button>
            <Button variant="danger" onClick={remove}>
              <Trash2 /> {t("common.delete")}
            </Button>
          </div>
          <p className="px-5 pt-3 text-xs leading-relaxed text-ink-3">{t("detail.reclassifyHint")}</p>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Item({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-rule px-5 py-2.5 last:border-0">
      <dt className="shrink-0 text-ink-3">{label}</dt>
      <dd className="min-w-0 truncate text-end text-ink">{children}</dd>
    </div>
  );
}
