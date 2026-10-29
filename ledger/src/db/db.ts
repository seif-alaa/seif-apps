import Dexie, { type EntityTable } from "dexie";
import type {
  AccountKind,
  ClassificationMethod,
  ClassificationState,
  Direction,
  EventOutcome,
  Origin,
  ParsedFields,
  PostingStatus,
  ReviewState,
  SourceKind,
  TxnKind,
} from "@/engine/model";

/**
 * Ledger stores everything on-device in IndexedDB.
 * Money is always an integer in minor units (piastres / cents).
 */

export interface Account {
  id: string;
  name: string;
  kind: AccountKind;
  /** Institution key (see engine/institutions.ts), e.g. "cib", "telda", "cash". */
  institution: string;
  /** Last four digits of the card / account, used to match incoming alerts. */
  last4: string | null;
  currency: string;
  /** Balance before the first transaction Ledger knows about. */
  startingBalance: number;
  archived: boolean;
  createdAt: number;
  /** Sample / simulated accounts are removed together with their data. */
  origin?: Origin;
  /** Legacy (v1) presentation field, kept so old exports round-trip. */
  emoji?: string;
}

export interface Category {
  id: string;
  /** Stable key for built-in categories (drives translation + rules). Null for user-made ones. */
  key: string | null;
  name: string;
  /** Icon name from components/icons.tsx. */
  icon: string;
  kind: "expense" | "income";
  slot: number;
  createdAt: number;
  emoji?: string;
}

export interface Transaction {
  id: string;
  /** Always positive, minor units. `direction` carries the sign. */
  amount: number;
  currency: string;
  /** Null only when a source told us money moved but not which way — never guessed. */
  direction: Direction | null;
  kind: TxnKind;
  /** The user's account the money left / arrived in. Null = not yet matched to an account. */
  accountId: string | null;
  /** For transfers: the other owned account involved, if known. */
  counterAccountId: string | null;
  transferGroupId: string | null;
  /** For refunds: the original purchase, if found. */
  refundOf: string | null;
  categoryId: string | null;
  merchant: string | null;
  merchantKey: string | null;
  note: string;
  /** When the money moved (best known). */
  occurredAt: number;
  /** Start of the local day of occurredAt — used for grouping and indexes. */
  date: number;
  /** When Ledger first learned about it. */
  detectedAt: number;
  source: SourceKind;
  sourceEventIds: string[];
  reference: string | null;
  posting: PostingStatus;
  classification: ClassificationState;
  method: ClassificationMethod;
  /** 0..1 confidence in kind + category. */
  confidence: number;
  review: ReviewState;
  /** Why this needs the user (shown in the review sheet). */
  reviewReason: string | null;
  origin: Origin;
  createdAt: number;
  updatedAt: number;
}

export interface Budget {
  categoryId: string;
  amount: number;
  updatedAt: number;
}

/** One raw observation from a source. The id is the idempotency key. */
export interface SourceEvent {
  id: string;
  sourceKind: SourceKind;
  receivedAt: number;
  occurredAt: number | null;
  outcome: EventOutcome;
  transactionId: string | null;
  /** Parsed, minimal fields. Never contains OTPs or full message bodies. */
  parsed: ParsedFields | null;
  /** Redacted snippet, only stored when the user enables evidence retention. */
  evidence: string | null;
  origin: Origin;
}

/** Ledger's memory of how the user classifies a merchant / counterparty. */
export interface MerchantMemory {
  merchantKey: string;
  label: string;
  /** categoryId → number of confirmations. "kind:<kind>" keys hold kind counts for category-less kinds. */
  counts: Record<string, number>;
  updatedAt: number;
}

export interface Reconciliation {
  id: string;
  accountId: string;
  expected: number;
  verified: number;
  difference: number;
  status: "open" | "resolved";
  resolution: "adjusted" | "explained" | null;
  adjustmentTxnId: string | null;
  createdAt: number;
  resolvedAt: number | null;
}

/** A transaction source the user has set up (status shown honestly in Settings → Sources). */
export interface SourceConnection {
  id: string;
  kind: SourceKind;
  status: "active" | "paused" | "disconnected" | "error";
  connectedAt: number;
  lastEventAt: number | null;
  lastError: string | null;
}

export const db = new Dexie("ledger") as Dexie & {
  accounts: EntityTable<Account, "id">;
  categories: EntityTable<Category, "id">;
  transactions: EntityTable<Transaction, "id">;
  budgets: EntityTable<Budget, "categoryId">;
  events: EntityTable<SourceEvent, "id">;
  merchants: EntityTable<MerchantMemory, "merchantKey">;
  reconciliations: EntityTable<Reconciliation, "id">;
  sources: EntityTable<SourceConnection, "id">;
};

db.version(1).stores({
  accounts: "id, createdAt",
  categories: "id, kind, createdAt",
  transactions: "id, date, type, categoryId, accountId, [type+date]",
  budgets: "categoryId",
});

/** v2: transaction intelligence. Upgrades v1 data in place — nothing is dropped. */
db.version(2)
  .stores({
    accounts: "id, createdAt, institution, last4",
    categories: "id, kind, key, createdAt",
    transactions: "id, date, occurredAt, kind, review, categoryId, accountId, transferGroupId, merchantKey, reference, [accountId+date]",
    budgets: "categoryId",
    events: "id, receivedAt, transactionId, sourceKind",
    merchants: "merchantKey",
    reconciliations: "id, accountId, status",
    sources: "id, kind",
  })
  .upgrade(async (tx) => {
    const currency = legacyCurrency();
    await tx.table("accounts").toCollection().modify((a: Record<string, unknown>) => upgradeV1Account(a, currency));
    await tx.table("categories").toCollection().modify((c: Record<string, unknown>) => upgradeV1Category(c));
    await tx.table("transactions").toCollection().modify((t: Record<string, unknown>) => upgradeV1Transaction(t, currency));
  });

/* In-place v1 → v2 record upgrades, shared by the IndexedDB migration and v1 backup import. */
export function upgradeV1Account(a: Record<string, unknown>, currency: string) {
  const t = a.type as string | undefined;
  a.kind = t === "credit" ? "credit" : t === "cash" ? "cash" : "bank";
  a.institution = t === "cash" ? "cash" : "other";
  a.last4 = null;
  a.currency = currency;
  a.archived = false;
  delete a.type;
  return a;
}

export function upgradeV1Category(c: Record<string, unknown>) {
  const key = LEGACY_CATEGORY_KEYS[c.name as string] ?? null;
  c.key = key;
  c.icon = (key && ICON_FOR_KEY[key]) || "tag";
  return c;
}

export function upgradeV1Transaction(t: Record<string, unknown>, currency: string) {
  const income = t.type === "income";
  Object.assign(t, {
    direction: income ? "in" : "out",
    kind: income ? "income" : "expense",
    currency,
    counterAccountId: null,
    transferGroupId: null,
    refundOf: null,
    merchant: null,
    merchantKey: null,
    occurredAt: t.date,
    detectedAt: t.createdAt,
    source: "manual",
    sourceEventIds: [],
    reference: null,
    posting: "posted",
    classification: "classified",
    method: "user",
    confidence: 1,
    review: "confirmed",
    reviewReason: null,
    origin: "real",
    updatedAt: t.createdAt,
  });
  delete t.type;
  return t;
}

/** v1 kept currency only in localStorage prefs; read it so migrated rows keep their meaning. */
function legacyCurrency() {
  try {
    return JSON.parse(localStorage.getItem("ledger-prefs") || "{}")?.state?.currency || "EGP";
  } catch {
    return "EGP";
  }
}

export const LEGACY_CATEGORY_KEYS: Record<string, string> = {
  Groceries: "groceries",
  "Dining out": "dining",
  Coffee: "coffee",
  Transport: "transport",
  "Home & bills": "bills",
  Shopping: "shopping",
  Fun: "entertainment",
  Health: "health",
  Salary: "salary",
  "Side hustle": "freelance",
  Gifts: "gifts",
};

export const ICON_FOR_KEY: Record<string, string> = {
  groceries: "basket",
  dining: "utensils",
  coffee: "coffee",
  transport: "car",
  bills: "receipt",
  shopping: "bag",
  entertainment: "ticket",
  health: "pulse",
  education: "book",
  fees: "percent",
  other_expense: "dot",
  salary: "briefcase",
  freelance: "laptop",
  gifts: "gift",
  interest: "trend",
  other_income: "dot",
};

export const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
