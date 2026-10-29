import { useLiveQuery } from "dexie-react-hooks";
import { useMemo } from "react";
import { db, type Account, type Budget, type Category, type Reconciliation, type SourceConnection, type Transaction } from "./db";

const EMPTY: never[] = [];

/** All transactions, newest first. `undefined` while loading. */
export function useTransactions(): Transaction[] | undefined {
  return useLiveQuery(() => db.transactions.orderBy("occurredAt").reverse().toArray(), []);
}

export function useCategories(): Category[] {
  return useLiveQuery(() => db.categories.orderBy("createdAt").toArray(), []) ?? EMPTY;
}

export function useAccounts(includeArchived = false): Account[] {
  const all = useLiveQuery(() => db.accounts.orderBy("createdAt").toArray(), []) ?? EMPTY;
  return useMemo(() => (includeArchived ? all : all.filter((a) => !a.archived)), [all, includeArchived]);
}

export function useBudgets(): Budget[] {
  return useLiveQuery(() => db.budgets.toArray(), []) ?? EMPTY;
}

export function useSources(): SourceConnection[] {
  return useLiveQuery(() => db.sources.toArray(), []) ?? EMPTY;
}

export function useReconciliations(): Reconciliation[] {
  return useLiveQuery(() => db.reconciliations.toArray(), []) ?? EMPTY;
}

export function useReviewCount() {
  return useLiveQuery(() => db.transactions.where("review").equals("needs_review").count(), []) ?? 0;
}

export function useCategoryMap() {
  const cats = useCategories();
  return useMemo(() => new Map(cats.map((c) => [c.id, c])), [cats]);
}

export function useAccountMap() {
  const accounts = useAccounts(true);
  return useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
}
