import Dexie, { type EntityTable } from "dexie";

export type TxnType = "expense" | "income";
export type AccountType = "checking" | "savings" | "credit" | "cash";

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  emoji: string;
  /** Opening balance in minor units (cents). */
  startingBalance: number;
  createdAt: number;
}

export interface Category {
  id: string;
  name: string;
  emoji: string;
  kind: TxnType;
  /** Fixed categorical chart slot 1–8 — colour follows the category, never its rank. */
  slot: number;
  createdAt: number;
}

export interface Transaction {
  id: string;
  type: TxnType;
  /** Always positive, in minor units (cents). `type` carries the sign. */
  amount: number;
  categoryId: string;
  accountId: string;
  note: string;
  /** Epoch ms of the day the money moved. */
  date: number;
  createdAt: number;
}

export interface Budget {
  /** One monthly budget per category, so the category id is the key. */
  categoryId: string;
  amount: number;
  updatedAt: number;
}

export const db = new Dexie("ledger") as Dexie & {
  accounts: EntityTable<Account, "id">;
  categories: EntityTable<Category, "id">;
  transactions: EntityTable<Transaction, "id">;
  budgets: EntityTable<Budget, "categoryId">;
};

db.version(1).stores({
  accounts: "id, createdAt",
  categories: "id, kind, createdAt",
  transactions: "id, date, type, categoryId, accountId, [type+date]",
  budgets: "categoryId",
});

export const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
