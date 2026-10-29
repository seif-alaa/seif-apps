import { startOfDay } from "date-fns";
import { db, uid, type Account, type Category, type SourceEvent, type Transaction } from "@/db/db";
import { classify } from "./classify";
import { DEFAULT_CONFIG, RULES, type EngineConfig } from "./config";
import { merchantKey, merchantLabel } from "./merchants";
import { canPost, isLive, type EventOutcome, type IncomingEvent, type ReviewState } from "./model";
import { hashString, redact } from "./text";

/**
 * Financial Event → Normalization → Deduplication → Account matching →
 * Classification → Confidence evaluation → Ledger update → Optional review.
 *
 * Every step runs inside one IndexedDB transaction keyed by the event's
 * idempotency id, so replaying an event can never create a second entry.
 */

export interface IngestResult {
  eventId: string;
  outcome: EventOutcome;
  transactionId: string | null;
  needsReview: boolean;
  autoAccepted: boolean;
}

export const REVIEW_REASONS = {
  unknownCategory: "unknown_category",
  unknownIncome: "unknown_income",
  noAccount: "no_account",
  unknownDirection: "unknown_direction",
  possibleDuplicate: "possible_duplicate",
  suggestion: "suggestion",
  ambiguousTransfer: "ambiguous_transfer",
} as const;

const TABLES = () => [db.transactions, db.events, db.accounts, db.categories, db.merchants, db.sources];

export function eventId(e: IncomingEvent) {
  if (e.externalId) return `${e.sourceKind}:${e.externalId}`;
  const p = e.parsed;
  return `${e.sourceKind}:${hashString([p.amount, p.currency, p.direction, p.status, p.last4, p.institution, p.merchant, p.counterparty, p.reference, p.occurredAt ?? e.receivedAt].join("|"))}`;
}

const isStatement = (t: { source: string }) => t.source === "statement_csv";

export async function ingest(e: IncomingEvent, cfg: EngineConfig = DEFAULT_CONFIG): Promise<IngestResult> {
  const id = eventId(e);
  return db.transaction("rw", TABLES(), async () => {
    const seen = await db.events.get(id);
    if (seen) return result(id, "duplicate", seen.transactionId);

    const p = e.parsed;
    const origin = e.origin ?? "real";
    const evidence = cfg.keepEvidence && e.rawText ? redact(e.rawText) : null;
    const record = (outcome: EventOutcome, transactionId: string | null): SourceEvent => ({
      id,
      sourceKind: e.sourceKind,
      receivedAt: e.receivedAt,
      occurredAt: p.occurredAt,
      outcome,
      transactionId,
      parsed: p,
      evidence,
      origin,
    });
    await touchSource(e.sourceKind, e.receivedAt);

    if (!p.amount || p.amount <= 0) {
      await db.events.put({ ...record("ignored_unreadable", null), parsed: null });
      return result(id, "ignored_unreadable", null);
    }

    const accounts = await db.accounts.toArray();
    const account = e.accountId !== undefined ? accounts.find((a) => a.id === e.accountId) ?? null : matchAccount(accounts, p.last4, p.institution);
    const currency = p.currency ?? account?.currency ?? cfg.baseCurrency;
    const occurredAt = p.occurredAt ?? e.receivedAt;
    let direction = p.direction;
    let refundHint = !!p.hints.refund;

    // --- Status changes: reversals, failures, pending → posted -------------------------
    if (p.status === "failed" || p.status === "reversed") {
      const target = await findStatusTarget(account?.id ?? null, p.amount, p.reference, occurredAt);
      if (target && canPost(target.posting, p.status)) {
        await db.transactions.update(target.id, {
          posting: p.status,
          sourceEventIds: [...target.sourceEventIds, id],
          updatedAt: Date.now(),
          // A reversed / failed payment no longer needs a decision from the user.
          review: target.review === "needs_review" ? "not_required" : target.review,
        });
        await db.events.put(record("status_update", target.id));
        return result(id, "status_update", target.id);
      }
      if (p.status === "failed") {
        // A failed payment never moved money: remember the event, change nothing.
        await db.events.put(record("no_effect", null));
        return result(id, "no_effect", null);
      }
      // A reversal we can't pair is money coming back: treat it as a refund.
      direction = "in";
      refundHint = true;
    }

    if (p.status === "posted") {
      const pending = await findPendingToPost(account?.id ?? null, p.amount, direction, occurredAt);
      if (pending) {
        await db.transactions.update(pending.id, {
          posting: "posted",
          sourceEventIds: [...pending.sourceEventIds, id],
          reference: pending.reference ?? p.reference,
          updatedAt: Date.now(),
        });
        await db.events.put(record("merged", pending.id));
        return result(id, "merged", pending.id);
      }
    }

    // --- Deduplication across sources / repeated alerts -----------------------------------
    const dup = await findDuplicate(e, account?.id ?? null, p.amount, direction, occurredAt, p.reference);
    let possibleDuplicate = false;
    if (dup?.certain) {
      const t = dup.txn;
      await db.transactions.update(t.id, {
        sourceEventIds: [...t.sourceEventIds, id],
        reference: t.reference ?? p.reference,
        merchant: t.merchant ?? merchantLabel(p.merchant ?? p.counterparty),
        merchantKey: t.merchantKey ?? merchantKey(p.merchant ?? p.counterparty),
        accountId: t.accountId ?? account?.id ?? null,
        updatedAt: Date.now(),
      });
      await db.events.put(record("merged", t.id));
      return result(id, "merged", t.id);
    }
    if (dup) possibleDuplicate = true;

    // --- Build the transaction --------------------------------------------------------------
    const now = Date.now();
    const party = p.merchant ?? p.counterparty;
    const mKey = merchantKey(party);
    const txn: Transaction = {
      id: uid(),
      amount: p.amount,
      currency,
      direction,
      kind: "unknown",
      accountId: account?.id ?? null,
      counterAccountId: null,
      transferGroupId: null,
      refundOf: null,
      categoryId: null,
      merchant: merchantLabel(party),
      merchantKey: mKey,
      note: e.note ?? "",
      occurredAt,
      date: startOfDay(occurredAt).getTime(),
      detectedAt: e.receivedAt,
      source: e.sourceKind,
      sourceEventIds: [id],
      reference: p.reference,
      posting: p.status === "reversed" ? "posted" : p.status,
      classification: "unclassified",
      method: "none",
      confidence: 0,
      review: "needs_review",
      reviewReason: null,
      origin,
      createdAt: now,
      updatedAt: now,
    };

    const categories = await db.categories.toArray();
    const memory = mKey ? await db.merchants.get(mKey) : undefined;
    const s = classify(direction, { hints: { ...p.hints, refund: refundHint || undefined }, merchant: p.merchant, counterparty: p.counterparty }, { categories, memory });
    Object.assign(txn, { kind: s.kind, categoryId: s.categoryId, confidence: s.confidence, method: s.method });

    // Refunds: link to the purchase they reverse, inheriting its category.
    if (direction === "in" && (s.kind === "refund" || refundHint)) {
      const original = await findRefundTarget(txn);
      if (original) Object.assign(txn, { kind: "refund", refundOf: original.id, categoryId: txn.categoryId ?? original.categoryId, confidence: Math.max(s.confidence, 0.9), method: "refund_match" });
    }

    let transferLinked = false;
    let ambiguous = false;
    if (txn.accountId && direction && txn.kind !== "refund") {
      // ATM: money moves from the bank into the user's pocket.
      if (direction === "out" && p.hints.atm) {
        transferLinked = await linkAtm(txn, accounts, cfg);
      } else {
        const named = p.hints.otherLast4 ? accounts.find((a) => a.last4 === p.hints.otherLast4 && a.id !== txn.accountId) : undefined;
        const m = await findTransferLeg(txn, named?.id);
        if (m.leg) {
          await linkTransfer(txn, m.leg, cfg);
          transferLinked = true;
        } else if (named) {
          Object.assign(txn, { kind: "transfer", counterAccountId: named.id, categoryId: null, confidence: 0.85, method: "rule" });
        }
        ambiguous = m.ambiguous;
      }
    }

    if (!transferLinked) {
      const auto = cfg.autoCategorize && txn.confidence >= cfg.autoThreshold && txn.kind !== "unknown" && (txn.kind === "transfer" || txn.categoryId !== null);
      txn.classification = txn.kind === "unknown" ? "unclassified" : auto ? "classified" : "suggested";
      txn.review = auto ? "auto_accepted" : "needs_review";
      txn.reviewReason = auto
        ? null
        : txn.kind === "unknown"
          ? direction === "in"
            ? REVIEW_REASONS.unknownIncome
            : REVIEW_REASONS.unknownCategory
          : REVIEW_REASONS.suggestion;
    }
    if (ambiguous && !transferLinked) txn.reviewReason = REVIEW_REASONS.ambiguousTransfer;
    if (!direction) txn.reviewReason = REVIEW_REASONS.unknownDirection;
    if (!txn.accountId) {
      txn.review = "needs_review";
      txn.reviewReason = REVIEW_REASONS.noAccount;
    }
    if (possibleDuplicate) {
      txn.review = "needs_review";
      txn.reviewReason = REVIEW_REASONS.possibleDuplicate;
    }

    await db.transactions.add(txn);
    await db.events.put(record("created", txn.id));
    return result(id, "created", txn.id, txn.review);
  });
}

function result(eventId: string, outcome: EventOutcome, transactionId: string | null, review?: ReviewState): IngestResult {
  return { eventId, outcome, transactionId, needsReview: review === "needs_review", autoAccepted: review === "auto_accepted" };
}

async function touchSource(kind: IncomingEvent["sourceKind"], at: number) {
  const existing = await db.sources.where("kind").equals(kind).first();
  if (existing) await db.sources.update(existing.id, { lastEventAt: at, lastError: null });
}

/** Last-4 digits first; otherwise the only account at that institution. Never a guess between several. */
export function matchAccount(accounts: Account[], last4: string | null, inst: string | null): Account | null {
  const live = accounts.filter((a) => !a.archived);
  if (last4) {
    const hits = live.filter((a) => a.last4 === last4);
    if (hits.length === 1) return hits[0];
    if (hits.length > 1 && inst) return hits.find((a) => a.institution === inst) ?? null;
  }
  if (inst) {
    const hits = live.filter((a) => a.institution === inst);
    if (hits.length === 1) return hits[0];
  }
  return null;
}

async function findStatusTarget(accountId: string | null, amount: number, reference: string | null, at: number) {
  if (reference) {
    const byRef = await db.transactions.where("reference").equals(reference).first();
    if (byRef) return byRef;
  }
  if (!accountId) return null;
  const cands = await db.transactions
    .where("[accountId+date]")
    .between([accountId, startOfDay(at - 5 * 86_400_000).getTime()], [accountId, at + 86_400_000], true, true)
    .filter((t) => t.amount === amount && t.direction === "out" && isLive(t.posting))
    .toArray();
  // Prefer a pending authorisation, then the closest in time.
  cands.sort((a, b) => (a.posting === "pending" ? -1 : 0) - (b.posting === "pending" ? -1 : 0) || Math.abs(a.occurredAt - at) - Math.abs(b.occurredAt - at));
  return cands[0] ?? null;
}

async function findPendingToPost(accountId: string | null, amount: number, direction: IncomingEvent["parsed"]["direction"], at: number) {
  if (!accountId) return null;
  return (
    (await db.transactions
      .where("[accountId+date]")
      .between([accountId, startOfDay(at - RULES.pendingWindowMs).getTime()], [accountId, at + 86_400_000], true, true)
      .filter((t) => t.posting === "pending" && t.amount === amount && t.direction === direction)
      .first()) ?? null
  );
}

async function findDuplicate(e: IncomingEvent, accountId: string | null, amount: number, direction: IncomingEvent["parsed"]["direction"], at: number, reference: string | null) {
  const p = e.parsed;
  const statementInvolved = e.sourceKind === "statement_csv";
  const window = statementInvolved ? RULES.statementWindowMs : RULES.duplicateWindowMs;
  const cands = await db.transactions
    .where("occurredAt")
    .between(at - Math.max(window, RULES.statementWindowMs), at + Math.max(window, RULES.statementWindowMs), true, true)
    .filter((t) => t.amount === amount && t.direction === direction && (t.accountId === accountId || t.accountId === null || accountId === null) && t.source !== "derived" && t.source !== "manual")
    .toArray();
  for (const t of cands) {
    if (reference && t.reference) {
      if (reference === t.reference) return { txn: t, certain: true };
      continue;
    }
    // Identical lines within statements are separate purchases; re-imports are caught by event ids.
    if (statementInvolved && isStatement(t)) continue;
    const w = statementInvolved || isStatement(t) ? RULES.statementWindowMs : RULES.duplicateWindowMs;
    if (Math.abs(t.occurredAt - at) > w) continue;
    // A statement line confirming a live alert, or two different senders reporting one payment.
    if (statementInvolved !== isStatement(t)) return { txn: t, certain: true };
    if (t.source !== e.sourceKind) return { txn: t, certain: true };
    const ev = t.sourceEventIds.length ? await db.events.get(t.sourceEventIds[0]) : undefined;
    const prevInst = ev?.parsed?.institution ?? null;
    if (prevInst && p.institution && prevInst !== p.institution) return { txn: t, certain: true };
    // Same sender, same amount, minutes apart, no reference: could be two real purchases. Ask.
    return { txn: t, certain: false };
  }
  return null;
}

async function findRefundTarget(txn: Transaction) {
  if (!txn.merchantKey) return null;
  const from = txn.occurredAt - RULES.refundWindowMs;
  const refunded = new Set((await db.transactions.where("kind").equals("refund").toArray()).map((t) => t.refundOf));
  const cands = await db.transactions
    .where("merchantKey")
    .equals(txn.merchantKey)
    .filter((t) => t.direction === "out" && t.kind === "expense" && t.amount >= txn.amount && t.occurredAt >= from && t.occurredAt <= txn.occurredAt && !refunded.has(t.id) && isLive(t.posting))
    .toArray();
  cands.sort((a, b) => Math.abs(a.amount - txn.amount) - Math.abs(b.amount - txn.amount) || b.occurredAt - a.occurredAt);
  return cands[0] ?? null;
}

export function feeTolerance(amount: number) {
  return Math.max(Math.round(amount * RULES.transferFeeRatio), RULES.transferFeeFloor);
}

/** Find the other half of an own-account transfer, in either arrival order. */
export async function findTransferLeg(txn: Transaction, preferAccount?: string) {
  const window = RULES.transferWindowMs;
  const cands = await db.transactions
    .where("occurredAt")
    .between(txn.occurredAt - window, txn.occurredAt + window, true, true)
    .filter((t) => {
      if (t.id === txn.id || !t.accountId || t.accountId === txn.accountId || t.transferGroupId || !t.direction || t.direction === txn.direction) return false;
      if (t.currency !== txn.currency || !isLive(t.posting) || t.review === "confirmed") return false;
      if (!(t.kind === "unknown" || t.kind === "transfer" || t.method === "rule")) return false;
      const out = txn.direction === "out" ? txn.amount : t.amount;
      const inn = txn.direction === "in" ? txn.amount : t.amount;
      return out >= inn && out - inn <= feeTolerance(inn);
    })
    .toArray();
  if (!cands.length) return { leg: null, ambiguous: false };
  const pref = preferAccount ? cands.filter((c) => c.accountId === preferAccount) : cands;
  const pool = pref.length ? pref : cands;
  pool.sort((a, b) => Math.abs(a.amount - txn.amount) - Math.abs(b.amount - txn.amount) || Math.abs(a.occurredAt - txn.occurredAt) - Math.abs(b.occurredAt - txn.occurredAt));
  const [best, second] = pool;
  // Two equally good candidates in different accounts: don't pick one silently.
  const ambiguous = !!second && second.amount === best.amount && second.accountId !== best.accountId && !preferAccount;
  return { leg: ambiguous ? null : best, ambiguous };
}

async function linkTransfer(txn: Transaction, leg: Transaction, cfg: EngineConfig) {
  const group = uid();
  const review: ReviewState = cfg.autoMatchTransfers ? "auto_accepted" : "needs_review";
  Object.assign(txn, {
    kind: "transfer",
    transferGroupId: group,
    counterAccountId: leg.accountId,
    categoryId: null,
    classification: "classified",
    method: "transfer_match",
    confidence: 0.95,
    review,
    reviewReason: review === "needs_review" ? REVIEW_REASONS.suggestion : null,
  });
  await db.transactions.update(leg.id, {
    kind: "transfer",
    transferGroupId: group,
    counterAccountId: txn.accountId,
    categoryId: null,
    classification: "classified",
    method: "transfer_match",
    confidence: 0.95,
    review: leg.review === "needs_review" ? review : leg.review,
    reviewReason: review === "needs_review" ? REVIEW_REASONS.suggestion : null,
    updatedAt: Date.now(),
  });
}

/** ATM withdrawal: bank → cash wallet. The cash leg is derived, since cash can't report itself. */
async function linkAtm(txn: Transaction, accounts: Account[], cfg: EngineConfig) {
  const cash = accounts.find((a) => a.kind === "cash" && !a.archived && a.currency === txn.currency);
  const group = uid();
  const auto = cfg.autoCategorize && 0.9 >= cfg.autoThreshold;
  Object.assign(txn, {
    kind: "transfer",
    transferGroupId: cash ? group : null,
    counterAccountId: cash?.id ?? null,
    categoryId: null,
    classification: auto ? "classified" : "suggested",
    method: "rule",
    confidence: 0.9,
    review: auto ? "auto_accepted" : "needs_review",
    reviewReason: auto ? null : REVIEW_REASONS.suggestion,
    merchant: txn.merchant ?? "ATM",
  });
  if (!cash) return true;
  const now = Date.now();
  await db.transactions.add({
    ...txn,
    id: uid(),
    direction: "in",
    accountId: cash.id,
    counterAccountId: txn.accountId,
    source: "derived",
    sourceEventIds: [],
    review: "not_required",
    reviewReason: null,
    createdAt: now,
    updatedAt: now,
  });
  return true;
}

export type { Category };
