/** Behaviour switches the user controls in Settings → Automation. */
export interface EngineConfig {
  /** Let Ledger file transactions it is confident about without asking. */
  autoCategorize: boolean;
  /** Confidence needed to auto-file. Balanced = 0.85 (≈3 consistent confirmations), Cautious = 0.95. */
  autoThreshold: number;
  /** Quietly link matching in/out legs between your own accounts. */
  autoMatchTransfers: boolean;
  /** Keep a redacted snippet of source messages (for troubleshooting). Off by default. */
  keepEvidence: boolean;
  /** Currency assumed when a message and its account don't say. */
  baseCurrency: string;
}

export const DEFAULT_CONFIG: EngineConfig = {
  autoCategorize: true,
  autoThreshold: 0.85,
  autoMatchTransfers: true,
  keepEvidence: false,
  baseCurrency: "EGP",
};

/** Matching windows and tolerances, in one place so they're easy to audit. */
export const RULES = {
  /** Two alerts for the same money within this window are one payment (different senders). */
  duplicateWindowMs: 10 * 60_000,
  /** Statements only carry a date, so match them to live alerts within ±36h. */
  statementWindowMs: 36 * 3_600_000,
  /** Out-leg and in-leg of an own transfer must land within this window. */
  transferWindowMs: 72 * 3_600_000,
  /** Allowed fee between legs: max(1% of amount, EGP 20). */
  transferFeeRatio: 0.01,
  transferFeeFloor: 2000,
  /** How far back a refund may look for its purchase. */
  refundWindowMs: 90 * 86_400_000,
  /** A pending authorisation can post up to this long after. */
  pendingWindowMs: 7 * 86_400_000,
} as const;
