import { useLiveQuery } from "dexie-react-hooks";
import { useMemo } from "react";
import { db, type Account, type Budget, type Category, type Transaction } from "./db";

const EMPTY: never[] = [];

export function useTransactions(): Transaction[] | undefined {
  return useLiveQuery(() => db.transactions.orderBy("date").reverse().toArray(), []);
}

export function useCategories(): Category[] {
  return useLiveQuery(() => db.categories.orderBy("createdAt").toArray(), []) ?? EMPTY;
}

export function useAccounts(): Account[] {
  return useLiveQuery(() => db.accounts.orderBy("createdAt").toArray(), []) ?? EMPTY;
}

export function useBudgets(): Budget[] {
  return useLiveQuery(() => db.budgets.toArray(), []) ?? EMPTY;
}

export function useCategoryMap() {
  const cats = useCategories();
  return useMemo(() => new Map(cats.map((c) => [c.id, c])), [cats]);
}

export function useAccountMap() {
  const accounts = useAccounts();
  return useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
}
