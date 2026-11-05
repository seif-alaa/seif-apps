import { z } from "zod";
import type { Minor } from "./money";

/**
 * Auction rules. Pure functions so the same logic runs in the development
 * store and, later, inside a database transaction (see docs/DATABASE.md).
 * Time always comes from the server; client clocks are display-only.
 */

export const AdminAuctionStatus = z.enum(["scheduled", "pending_payment", "sold", "unsold", "cancelled"]);

export const AuctionSchema = z.object({
  id: z.string(),
  slug: z.string().regex(/^[a-z0-9-]{2,80}$/),
  title: z.string().min(2).max(80),
  subtitle: z.string().max(120),
  description: z.string().max(4000),
  /** Component/specification lines, e.g. "Case — 38 mm brushed steel". */
  specs: z.array(z.object({ label: z.string(), value: z.string() })),
  /** Configuration used to draw an illustrative preview when photography is missing. */
  previewBuild: z.string().nullable(),
  images: z.array(z.string()),
  startingBidMinor: z.number().int().positive(),
  incrementMinor: z.number().int().positive(),
  reserveMinor: z.number().int().positive().nullable(),
  opensAt: z.string(),
  closesAt: z.string(),
  antiSnipe: z.object({
    enabled: z.boolean(),
    windowMinutes: z.number().int().min(1).max(60),
    extendMinutes: z.number().int().min(1).max(60),
  }),
  adminStatus: AdminAuctionStatus,
  /** "demonstration": bids are illustrative and clearly marked. "live" requires durable storage. */
  mode: z.enum(["demonstration", "live"]),
  published: z.boolean(),
  currentBidMinor: z.number().int().nonnegative(),
  bidCount: z.number().int().nonnegative(),
  leadingBidderId: z.string().nullable(),
  winner: z
    .object({ bidderId: z.string(), amountMinor: z.number().int(), confirmedAt: z.string().nullable(), paymentConfirmedAt: z.string().nullable() })
    .nullable(),
  terms: z.string().max(4000),
  version: z.number().int().nonnegative(),
  archived: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Auction = z.infer<typeof AuctionSchema>;

export interface Bid {
  id: string;
  auctionId: string;
  bidderId: string;
  bidderLabel: string; // privacy-safe public label, e.g. "Bidder 3"
  amountMinor: Minor;
  placedAt: string;
  idempotencyKey: string;
  demonstration: boolean;
  status: "accepted" | "rejected";
  rejectReason?: BidError;
  ipHash?: string;
}

export type PublicStatus = "upcoming" | "open" | "closed" | "pending_payment" | "sold" | "unsold" | "cancelled";

export const PUBLIC_STATUS_LABEL: Record<PublicStatus, string> = {
  upcoming: "Upcoming",
  open: "Open for bidding",
  closed: "Closed",
  pending_payment: "Pending payment",
  sold: "Sold",
  unsold: "Unsold",
  cancelled: "Cancelled",
};

export function auctionStatus(a: Pick<Auction, "adminStatus" | "opensAt" | "closesAt">, now: Date): PublicStatus {
  if (a.adminStatus !== "scheduled") return a.adminStatus;
  const t = now.getTime();
  if (t < Date.parse(a.opensAt)) return "upcoming";
  if (t < Date.parse(a.closesAt)) return "open";
  return "closed";
}

export function minimumNextBid(a: Pick<Auction, "bidCount" | "startingBidMinor" | "currentBidMinor" | "incrementMinor">): Minor {
  return a.bidCount === 0 ? a.startingBidMinor : a.currentBidMinor + a.incrementMinor;
}

export type BidError =
  | "not_open"
  | "too_low"
  | "not_whole_pounds"
  | "owner_bid"
  | "unverified_bidder"
  | "rate_limited"
  | "duplicate"
  | "already_leading"
  | "stale_version"
  | "live_bidding_disabled";

export const BID_ERROR_MESSAGE: Record<BidError, string> = {
  not_open: "Bidding is not open for this piece.",
  too_low: "Your bid is below the minimum next bid.",
  not_whole_pounds: "Bids are placed in whole Egyptian pounds.",
  owner_bid: "Atelier accounts cannot bid on atelier listings.",
  unverified_bidder: "Please verify your contact details before bidding.",
  rate_limited: "You are bidding too quickly. Please wait a moment.",
  duplicate: "This bid was already received.",
  already_leading: "You already hold the highest bid.",
  stale_version: "The auction changed while you were bidding. Please review the new minimum.",
  live_bidding_disabled: "Live bidding is not open yet. This room is in demonstration mode.",
};

export interface BidAttempt {
  bidderId: string;
  bidderVerified: boolean;
  bidderIsOwner: boolean;
  amountMinor: Minor;
  idempotencyKey: string;
  /** Version the bidder saw; protects against racing on a stale minimum. */
  expectedVersion?: number;
}

export interface BidContext {
  now: Date;
  /** Previous bids by this bidder in the recent window (for rate limiting). */
  recentBidsByBidder: number;
  maxBidsPerWindow: number;
  seenIdempotencyKeys: ReadonlySet<string>;
}

export function validateBid(a: Auction, attempt: BidAttempt, ctx: BidContext): BidError | null {
  if (ctx.seenIdempotencyKeys.has(attempt.idempotencyKey)) return "duplicate";
  if (auctionStatus(a, ctx.now) !== "open" || !a.published) return "not_open";
  if (attempt.bidderIsOwner) return "owner_bid";
  if (!attempt.bidderVerified) return "unverified_bidder";
  if (ctx.recentBidsByBidder >= ctx.maxBidsPerWindow) return "rate_limited";
  if (attempt.expectedVersion != null && attempt.expectedVersion !== a.version) return "stale_version";
  if (!Number.isSafeInteger(attempt.amountMinor) || attempt.amountMinor % 100 !== 0) return "not_whole_pounds";
  if (a.leadingBidderId === attempt.bidderId) return "already_leading";
  if (attempt.amountMinor < minimumNextBid(a)) return "too_low";
  return null;
}

/** Apply an accepted bid. Returns the new auction state (pure). */
export function applyBid(a: Auction, attempt: BidAttempt, now: Date): Auction {
  let closesAt = a.closesAt;
  if (a.antiSnipe.enabled) {
    const remainingMs = Date.parse(a.closesAt) - now.getTime();
    if (remainingMs <= a.antiSnipe.windowMinutes * 60_000) {
      closesAt = new Date(Date.parse(a.closesAt) + a.antiSnipe.extendMinutes * 60_000).toISOString();
    }
  }
  return {
    ...a,
    currentBidMinor: attempt.amountMinor,
    bidCount: a.bidCount + 1,
    leadingBidderId: attempt.bidderId,
    closesAt,
    version: a.version + 1,
    updatedAt: now.toISOString(),
  };
}

/** Decide the outcome once closed. Highest accepted bid wins if it meets the reserve. */
export function settleAuction(a: Auction, bids: readonly Bid[], now: Date): Auction {
  if (auctionStatus(a, now) !== "closed") return a;
  const accepted = bids.filter((b) => b.auctionId === a.id && b.status === "accepted" && !b.demonstration);
  const top = accepted.reduce<Bid | null>(
    (best, b) => (!best || b.amountMinor > best.amountMinor || (b.amountMinor === best.amountMinor && b.placedAt < best.placedAt) ? b : best),
    null,
  );
  if (!top || (a.reserveMinor != null && top.amountMinor < a.reserveMinor)) {
    return { ...a, adminStatus: "unsold", version: a.version + 1, updatedAt: now.toISOString() };
  }
  return {
    ...a,
    adminStatus: "pending_payment",
    winner: { bidderId: top.bidderId, amountMinor: top.amountMinor, confirmedAt: null, paymentConfirmedAt: null },
    version: a.version + 1,
    updatedAt: now.toISOString(),
  };
}
