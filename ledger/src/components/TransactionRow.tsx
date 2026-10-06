import type { Account, Category, Transaction } from "@/db/db";
import { useMoney } from "@/lib/format";
import { usePrefs } from "@/store/ui";
import { cn } from "@/lib/utils";
import { CategoryBadge } from "./CategoryBadge";

export function TransactionRow({ t, category, account }: { t: Transaction; category?: Category; account?: Account }) {
  const money = useMoney();
  const hidden = usePrefs((s) => s.hideAmounts);
  const income = t.type === "income";
  return (
    <div className="flex items-center gap-3 px-3 py-3">
      <CategoryBadge category={category} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-medium">{t.note || category?.name || "Untitled"}</div>
        <div className="truncate text-[13px] text-muted-foreground">
          {t.note ? category?.name : null}
          {t.note && account ? " · " : null}
          {account ? `${account.emoji} ${account.name}` : null}
        </div>
      </div>
      <div className={cn("num text-[15px] font-semibold", income ? "text-emerald" : "text-foreground")}>
        {hidden ? "••••" : money(income ? t.amount : -t.amount, { signed: true })}
      </div>
    </div>
  );
}
