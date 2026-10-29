/**
 * The normalized vocabulary of Ledger's transaction engine.
 *
 * Four independent questions are tracked separately on every transaction:
 *   1. Was it observed?          → it exists, with `source` + `sourceEventIds`
 *   2. Is it classified?         → `classification` (+ `method`, `confidence`)
 *   3. Did the user confirm it?  → `review`
 *   4. Did it post to the bank?  → `posting`
 * Balances depend only on (amount, direction, account, posting). Classification and
 * review never move money, so confirming or recategorising can't double-count.
 */

export type Direction = "in" | "out";

/**
 * - expense / income: real spending or earning
 * - transfer: money moving between the user's own accounts (incl. ATM → cash)
 * - refund: money returned for an earlier purchase (reduces spending)
 * - adjustment: an explicit balance correction from reconciliation
 * - unknown: observed, but Ledger can't tell yet (never assumed to be income)
 */
export type TxnKind = "expense" | "income" | "transfer" | "refund" | "adjustment" | "unknown";

export type PostingStatus = "pending" | "posted" | "reversed" | "failed";
export type ClassificationState = "unclassified" | "suggested" | "classified";
export type ClassificationMethod = "user" | "merchant_memory" | "rule" | "transfer_match" | "refund_match" | "import" | "none";
export type ReviewState = "needs_review" | "auto_accepted" | "confirmed" | "not_required";

/** Where a record came from. Simulated/sample data is always distinguishable from real data. */
export type Origin = "real" | "sample" | "simulated";

export type AccountKind = "bank" | "card" | "credit" | "wallet" | "cash" | "other";

export type SourceKind =
  | "manual"
  | "sms_paste"
  | "share_target"
  | "ios_shortcut"
  | "statement_csv"
  | "android_sms"
  | "android_notification"
  | "open_banking"
  | "email"
  | "aggregator"
  | "native_bridge"
  | "simulator"
  | "derived"
  | "legacy";

export type EventOutcome =
  | "created"
  | "merged"
  | "duplicate"
  | "status_update"
  | "ignored_sensitive"
  | "ignored_unreadable"
  | "no_effect";

/** The minimal facts extracted from a source event. */
export interface ParsedFields {
  amount: number | null;
  currency: string | null;
  direction: Direction | null;
  status: PostingStatus;
  institution: string | null;
  last4: string | null;
  merchant: string | null;
  counterparty: string | null;
  reference: string | null;
  occurredAt: number | null;
  balanceAfter: number | null;
  hints: {
    atm?: boolean;
    refund?: boolean;
    salary?: boolean;
    instapay?: boolean;
    /** last4 of a destination/origin account mentioned in the message. */
    otherLast4?: string | null;
  };
  /** 0..1 — how much of the message we understood. */
  parseConfidence: number;
}

/** What every adapter hands to the pipeline, regardless of how it was collected. */
export interface IncomingEvent {
  sourceKind: SourceKind;
  /** Stable id from the source if it has one (SMS id, statement row hash…). */
  externalId?: string;
  receivedAt: number;
  parsed: ParsedFields;
  /** Optional raw text. Only a redacted snippet is ever stored, and only if the user allows it. */
  rawText?: string;
  origin?: Origin;
  /** Account chosen by the user at import time (statements). */
  accountId?: string | null;
  note?: string;
}

// ---------------------------------------------------------------------------
// State machines
// ---------------------------------------------------------------------------

const POSTING: Record<PostingStatus, PostingStatus[]> = {
  pending: ["posted", "failed", "reversed"],
  posted: ["reversed"],
  failed: [],
  reversed: [],
};

const REVIEW: Record<ReviewState, ReviewState[]> = {
  needs_review: ["confirmed", "auto_accepted", "not_required"],
  auto_accepted: ["confirmed", "needs_review"],
  confirmed: ["confirmed", "needs_review"],
  not_required: ["confirmed", "needs_review"],
};

const CLASSIFICATION: Record<ClassificationState, ClassificationState[]> = {
  unclassified: ["suggested", "classified"],
  suggested: ["classified", "unclassified", "suggested"],
  classified: ["classified", "suggested"],
};

export class TransitionError extends Error {}

function check<T extends string>(table: Record<T, T[]>, name: string, from: T, to: T) {
  if (from === to && !table[from].includes(to)) return; // no-op updates are always fine
  if (!table[from].includes(to)) throw new TransitionError(`${name}: ${from} → ${to} is not allowed`);
}

export const canPost = (from: PostingStatus, to: PostingStatus) => from === to || POSTING[from].includes(to);
export const assertPosting = (from: PostingStatus, to: PostingStatus) => check(POSTING, "posting", from, to);
export const assertReview = (from: ReviewState, to: ReviewState) => check(REVIEW, "review", from, to);
export const assertClassification = (from: ClassificationState, to: ClassificationState) => check(CLASSIFICATION, "classification", from, to);

/** Posting states that move money in balances and totals. */
export const isLive = (p: PostingStatus) => p === "posted" || p === "pending";

export const KIND_LABEL_KEYS: Record<TxnKind, string> = {
  expense: "kind.expense",
  income: "kind.income",
  transfer: "kind.transfer",
  refund: "kind.refund",
  adjustment: "kind.adjustment",
  unknown: "kind.unknown",
};
