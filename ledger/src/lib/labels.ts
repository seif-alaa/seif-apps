import type { Account, Category, Transaction } from "@/db/db";
import type { I18n } from "@/i18n";

export const categoryName = (c: Category | null | undefined, t: I18n["t"]) => (!c ? "" : c.key ? t(`cat.${c.key}`) : c.name);

/** The primary line of a transaction, in plain words. */
export function txnTitle(x: Transaction, cats: Map<string, Category>, accounts: Map<string, Account>, t: I18n["t"]) {
  if (x.kind === "transfer") {
    const from = x.direction === "out" ? accounts.get(x.accountId ?? "") : accounts.get(x.counterAccountId ?? "");
    const to = x.direction === "out" ? accounts.get(x.counterAccountId ?? "") : accounts.get(x.accountId ?? "");
    if (x.merchant === "ATM" && to?.kind !== "cash") return t("txn.atm");
    if (from && to) return `${from.name} → ${to.name}`;
    return x.direction === "out" ? t("txn.transferOut") : t("txn.transferIn");
  }
  if (x.kind === "adjustment") return t("txn.adjustment");
  if (x.merchant) return x.merchant;
  const c = x.categoryId ? cats.get(x.categoryId) : null;
  if (c) return categoryName(c, t);
  return x.direction === "in" ? t("txn.incoming") : x.direction === "out" ? t("txn.payment") : t("txn.movement");
}

export function kindLabel(x: Transaction, t: I18n["t"]) {
  return t(`kind.${x.kind}`);
}
