import type { Account, Category, Transaction } from "@/db/db";
import { useI18n } from "@/i18n";
import { categoryName, txnTitle } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { TxnGlyph } from "./icons";
import { Money } from "./Money";
import { Tag } from "./layout";

export function TxnRow({
  t: x,
  cats,
  accounts,
  showAccount = true,
  onClick,
}: {
  t: Transaction;
  cats: Map<string, Category>;
  accounts: Map<string, Account>;
  showAccount?: boolean;
  onClick?: () => void;
}) {
  const { t, time } = useI18n();
  const cat = x.categoryId ? cats.get(x.categoryId) : null;
  const account = x.accountId ? accounts.get(x.accountId) : null;
  const title = txnTitle(x, cats, accounts, t);
  const sub: string[] = [];
  if (x.merchant && cat && x.kind !== "transfer") sub.push(categoryName(cat, t));
  if (x.kind === "refund") sub.push(t("kind.refund"));
  if (showAccount && account && x.kind !== "transfer") sub.push(account.name);
  if (!account && x.kind !== "adjustment") sub.push(t("txn.noAccount"));
  if (!sub.length) sub.push(time(x.occurredAt));
  const dead = x.posting === "reversed" || x.posting === "failed";
  const signed = x.direction === "in" ? x.amount : -x.amount;

  return (
    <button onClick={onClick} className="tap group relative flex min-h-[60px] w-full items-center gap-3 bg-surface px-5 py-2.5 text-start">
      <TxnGlyph t={x} category={cat} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className={cn("truncate text-base font-medium", dead && "text-ink-3 line-through")}>{title}</span>
        </div>
        <div className="flex items-center gap-1.5 text-sm text-ink-3">
          {x.review === "needs_review" && <Tag tone="accent">{t("tag.review")}</Tag>}
          {x.posting === "pending" && <Tag tone="warn">{t("tag.pending")}</Tag>}
          {dead && <Tag>{t(`posting.${x.posting}`)}</Tag>}
          {x.origin !== "real" && <Tag tone="outline">{t(`origin.${x.origin}`)}</Tag>}
          <span className="truncate">{sub.join(" · ")}</span>
        </div>
      </div>
      <Money
        value={x.kind === "transfer" ? x.amount : signed}
        currency={x.currency}
        signed={x.kind !== "transfer"}
        tone={dead || x.kind === "transfer" ? "muted" : x.direction === "in" ? "pos" : "ink"}
        className={cn("shrink-0 font-medium", dead && "line-through")}
      />
      <span className="pointer-events-none absolute bottom-0 end-0 start-[68px] h-px bg-rule group-last:hidden" />
    </button>
  );
}
