import { startOfDay } from "date-fns";
import { db, uid, type Reconciliation, type Transaction } from "@/db/db";
import { classify } from "./classify";
import { DEFAULT_CONFIG, type EngineConfig } from "./config";
import { merchantKey, merchantLabel } from "./merchants";
import { assertPosting, assertReview, type Direction, type PostingStatus, type TxnKind } from "./model";
import { feeTolerance, findTransferLeg, REVIEW_REASONS } from "./pipeline";
import { accountBalance } from "./ledger";

/**
 * Everything the user can do to a transaction. None of these change a balance
 * unless the user changes a money fact (amount, direction, account, posting).
 */

const RW = () => [db.transactions, db.merchants, db.categories, db.events, db.accounts, db.reconciliations];

export interface ClassifyInput {
  kind: TxnKind;
  categoryId: string | null;
  note?: string;
  /** For transfers: the user's other account (null = an account Ledger doesn't track). */
  counterAccountId?: string | null;
  accountId?: string | null;
  direction?: Direction;
}

/** Confirm or correct a transaction, teach Ledger about the merchant, and re-check similar pending items. */
export async function confirmClassification(id: string, input: ClassifyInput, cfg: EngineConfig = DEFAULT_CONFIG) {
  return db.transaction("rw", RW(), async () => {
    const t = await db.transactions.get(id);
    if (!t) throw new Error("Transaction not found");
    assertReview(t.review, "confirmed");

    const leavingTransfer = t.transferGroupId && input.kind !== "transfer";
    if (leavingTransfer) await unlinkTransfer(t);

    const patch: Partial<Transaction> = {
      kind: input.kind,
      categoryId: input.kind === "transfer" || input.kind === "adjustment" ? null : input.categoryId,
      note: input.note ?? t.note,
      classification: "classified",
      method: "user",
      confidence: 1,
      review: "confirmed",
      reviewReason: null,
      updatedAt: Date.now(),
    };
    if (input.accountId !== undefined) patch.accountId = input.accountId;
    if (input.direction) patch.direction = input.direction;
    if (leavingTransfer) Object.assign(patch, { transferGroupId: null, counterAccountId: null });
    await db.transactions.update(id, patch);
    const updated = { ...t, ...patch } as Transaction;

    if (input.kind === "transfer" && !t.transferGroupId) await attachTransfer(updated, input.counterAccountId ?? null);

    if (t.merchantKey && input.kind !== "adjustment" && input.kind !== "unknown") {
      await learn(t.merchantKey, t.merchant ?? t.merchantKey, input.kind, patch.categoryId ?? null);
      await reconsiderPending(t.merchantKey, id, cfg);
    }
    return updated;
  });
}

async function learn(key: string, label: string, kind: TxnKind, categoryId: string | null) {
  const slot = categoryId ?? `kind:${kind}`;
  const mem = (await db.merchants.get(key)) ?? { merchantKey: key, label, counts: {}, updatedAt: 0 };
  mem.counts = { ...mem.counts, [slot]: (mem.counts[slot] ?? 0) + 1 };
  mem.updatedAt = Date.now();
  await db.merchants.put(mem);
}

/** After the user teaches Ledger, quietly resolve other waiting items from the same merchant if now confident. */
async function reconsiderPending(key: string, exceptId: string, cfg: EngineConfig) {
  const [memory, categories] = await Promise.all([db.merchants.get(key), db.categories.toArray()]);
  const waiting = await db.transactions
    .where("merchantKey")
    .equals(key)
    .filter((t) => t.id !== exceptId && t.review === "needs_review" && t.reviewReason !== REVIEW_REASONS.possibleDuplicate && !!t.accountId)
    .toArray();
  for (const t of waiting) {
    const s = classify(t.direction, { hints: {}, merchant: t.merchant, counterparty: null }, { categories, memory });
    if (s.kind === "unknown") continue;
    const auto = cfg.autoCategorize && s.confidence >= cfg.autoThreshold && (s.categoryId !== null || s.kind === "transfer");
    await db.transactions.update(t.id, {
      kind: s.kind,
      categoryId: s.categoryId,
      confidence: s.confidence,
      method: s.method,
      classification: auto ? "classified" : "suggested",
      review: auto ? "auto_accepted" : "needs_review",
      reviewReason: auto ? null : REVIEW_REASONS.suggestion,
      updatedAt: Date.now(),
    });
  }
}

/** User says this is a transfer to/from their account: pair it with an observed leg if one exists. */
async function attachTransfer(t: Transaction, counterAccountId: string | null) {
  if (!counterAccountId) {
    await db.transactions.update(t.id, { counterAccountId: null });
    return;
  }
  const { leg } = await findTransferLeg(t, counterAccountId);
  const group = uid();
  if (leg && leg.accountId === counterAccountId) {
    await db.transactions.update(t.id, { transferGroupId: group, counterAccountId });
    await db.transactions.update(leg.id, {
      kind: "transfer",
      transferGroupId: group,
      counterAccountId: t.accountId,
      categoryId: null,
      classification: "classified",
      method: "transfer_match",
      confidence: 0.95,
      review: leg.review === "needs_review" ? "auto_accepted" : leg.review,
      reviewReason: null,
      updatedAt: Date.now(),
    });
  } else {
    await db.transactions.update(t.id, { counterAccountId });
  }
}

async function unlinkTransfer(t: Transaction) {
  const legs = await db.transactions.where("transferGroupId").equals(t.transferGroupId!).toArray();
  for (const leg of legs) {
    if (leg.id === t.id) continue;
    if (leg.source === "derived") await db.transactions.delete(leg.id);
    else
      await db.transactions.update(leg.id, {
        kind: "unknown",
        transferGroupId: null,
        counterAccountId: null,
        classification: "unclassified",
        method: "none",
        confidence: 0,
        review: "needs_review",
        reviewReason: leg.direction === "in" ? REVIEW_REASONS.unknownIncome : REVIEW_REASONS.unknownCategory,
        updatedAt: Date.now(),
      });
  }
}

/** Put a transaction back into the review queue (e.g. "this was auto-filed wrong"). */
export async function reopen(id: string) {
  const t = await db.transactions.get(id);
  if (!t) return;
  assertReview(t.review, "needs_review");
  await db.transactions.update(id, { review: "needs_review", reviewReason: REVIEW_REASONS.suggestion, updatedAt: Date.now() });
}

export async function setPosting(id: string, posting: PostingStatus) {
  const t = await db.transactions.get(id);
  if (!t) return;
  assertPosting(t.posting, posting);
  await db.transactions.update(id, { posting, updatedAt: Date.now() });
}

/** "These two alerts are the same payment": fold the duplicate into the original. */
export async function mergeDuplicate(duplicateId: string, intoId?: string) {
  return db.transaction("rw", RW(), async () => {
    const dup = await db.transactions.get(duplicateId);
    if (!dup) return;
    const target =
      (intoId && (await db.transactions.get(intoId))) ||
      (await db.transactions
        .where("occurredAt")
        .between(dup.occurredAt - 3_600_000, dup.occurredAt + 3_600_000, true, true)
        .filter((t) => t.id !== dup.id && t.amount === dup.amount && t.direction === dup.direction && t.accountId === dup.accountId)
        .first());
    if (!target) return;
    await db.transactions.update(target.id, { sourceEventIds: [...target.sourceEventIds, ...dup.sourceEventIds], updatedAt: Date.now() });
    for (const ev of dup.sourceEventIds) await db.events.update(ev, { outcome: "merged", transactionId: target.id });
    await db.transactions.delete(dup.id);
  });
}

/** "Not a duplicate — it's a separate payment." */
export async function keepSeparate(id: string) {
  const t = await db.transactions.get(id);
  if (!t) return;
  await db.transactions.update(id, {
    reviewReason: t.kind === "unknown" ? (t.direction === "in" ? REVIEW_REASONS.unknownIncome : REVIEW_REASONS.unknownCategory) : REVIEW_REASONS.suggestion,
    updatedAt: Date.now(),
  });
}

export interface Snapshot {
  txns: Transaction[];
}

/** Delete with undo. Removing one leg of a transfer returns its partner to the review queue. */
export async function deleteTransaction(id: string): Promise<Snapshot | null> {
  return db.transaction("rw", RW(), async () => {
    const t = await db.transactions.get(id);
    if (!t) return null;
    const group = t.transferGroupId ? await db.transactions.where("transferGroupId").equals(t.transferGroupId).toArray() : [t];
    const snapshot = { txns: group };
    if (t.transferGroupId) await unlinkTransfer(t);
    await db.transactions.delete(id);
    return snapshot;
  });
}

export async function restore(s: Snapshot) {
  await db.transactions.bulkPut(s.txns);
}

export interface ManualInput {
  amount: number;
  direction: Direction;
  kind: TxnKind;
  categoryId: string | null;
  accountId: string;
  counterAccountId?: string | null;
  occurredAt: number;
  note: string;
  merchant?: string;
  currency: string;
}

/** Fast manual entry (cash, or anything a source can't see). Manual entries are confirmed by definition. */
export async function addManual(input: ManualInput) {
  return db.transaction("rw", RW(), async () => {
    const now = Date.now();
    const base: Transaction = {
      id: uid(),
      amount: input.amount,
      currency: input.currency,
      direction: input.direction,
      kind: input.kind,
      accountId: input.accountId,
      counterAccountId: input.counterAccountId ?? null,
      transferGroupId: null,
      refundOf: null,
      categoryId: input.kind === "transfer" ? null : input.categoryId,
      merchant: merchantLabel(input.merchant) ?? null,
      merchantKey: merchantKey(input.merchant),
      note: input.note,
      occurredAt: input.occurredAt,
      date: startOfDay(input.occurredAt).getTime(),
      detectedAt: now,
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
      createdAt: now,
      updatedAt: now,
    };
    await db.transactions.add(base);
    // A manual transfer between two tracked accounts records both legs at once.
    if (input.kind === "transfer" && input.counterAccountId) {
      const group = uid();
      await db.transactions.update(base.id, { transferGroupId: group });
      await db.transactions.add({
        ...base,
        id: uid(),
        direction: input.direction === "out" ? "in" : "out",
        accountId: input.counterAccountId,
        counterAccountId: input.accountId,
        transferGroupId: group,
      });
    }
    if (base.merchantKey) await learn(base.merchantKey, base.merchant ?? base.merchantKey, input.kind, base.categoryId);
    return base;
  });
}

export async function updateMoneyFacts(id: string, patch: Partial<Pick<Transaction, "amount" | "direction" | "accountId" | "occurredAt" | "note" | "merchant">>) {
  const extra: Partial<Transaction> = {};
  if (patch.occurredAt) extra.date = startOfDay(patch.occurredAt).getTime();
  if (patch.merchant !== undefined) extra.merchantKey = merchantKey(patch.merchant);
  await db.transactions.update(id, { ...patch, ...extra, updatedAt: Date.now() });
}

// ---------------------------------------------------------------------------
// Reconciliation
// ---------------------------------------------------------------------------

/** Compare Ledger's balance with a balance the user (or a statement) verified. Never invents transactions. */
export async function startReconciliation(accountId: string, verified: number): Promise<Reconciliation> {
  const [account, txns] = await Promise.all([db.accounts.get(accountId), db.transactions.where("accountId").equals(accountId).toArray()]);
  if (!account) throw new Error("Account not found");
  const expected = accountBalance(account, txns);
  const rec: Reconciliation = {
    id: uid(),
    accountId,
    expected,
    verified,
    difference: verified - expected,
    status: verified === expected ? "resolved" : "open",
    resolution: verified === expected ? "explained" : null,
    adjustmentTxnId: null,
    createdAt: Date.now(),
    resolvedAt: verified === expected ? Date.now() : null,
  };
  await db.reconciliations.put(rec);
  return rec;
}

/** Re-measure an open reconciliation after the user added missing transactions. */
export async function refreshReconciliation(id: string) {
  const rec = await db.reconciliations.get(id);
  if (!rec) return null;
  const [account, txns] = await Promise.all([db.accounts.get(rec.accountId), db.transactions.where("accountId").equals(rec.accountId).toArray()]);
  if (!account) return null;
  const expected = accountBalance(account, txns);
  const difference = rec.verified - expected;
  const patch: Partial<Reconciliation> = difference === 0 ? { expected, difference, status: "resolved", resolution: "explained", resolvedAt: Date.now() } : { expected, difference };
  await db.reconciliations.update(id, patch);
  return { ...rec, ...patch };
}

/** The user chooses to book the remaining gap as an explicit, labelled adjustment (not income or spending). */
export async function resolveWithAdjustment(id: string) {
  return db.transaction("rw", RW(), async () => {
    const rec = await db.reconciliations.get(id);
    if (!rec || rec.status !== "open" || rec.difference === 0) return null;
    const account = await db.accounts.get(rec.accountId);
    if (!account) return null;
    const now = Date.now();
    const txn: Transaction = {
      id: uid(),
      amount: Math.abs(rec.difference),
      currency: account.currency,
      direction: rec.difference > 0 ? "in" : "out",
      kind: "adjustment",
      accountId: account.id,
      counterAccountId: null,
      transferGroupId: null,
      refundOf: null,
      categoryId: null,
      merchant: null,
      merchantKey: null,
      note: "Balance adjustment",
      occurredAt: now,
      date: startOfDay(now).getTime(),
      detectedAt: now,
      source: "manual",
      sourceEventIds: [],
      reference: `reconcile:${rec.id}`,
      posting: "posted",
      classification: "classified",
      method: "user",
      confidence: 1,
      review: "confirmed",
      reviewReason: null,
      origin: "real",
      createdAt: now,
      updatedAt: now,
    };
    await db.transactions.add(txn);
    await db.reconciliations.update(id, { status: "resolved", resolution: "adjusted", adjustmentTxnId: txn.id, resolvedAt: now });
    return txn;
  });
}

export { feeTolerance };
