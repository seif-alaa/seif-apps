import { z } from "zod";
import { repos } from "@/data/repositories";
import { BID_ERROR_MESSAGE, minimumNextBid } from "@/domain/auction";
import { normalizePhone } from "@/domain/egypt";
import { resolveStorefront } from "@/domain/storefront";
import { ipHash, json, readJson, requestIp, sameOrigin } from "@/server/http";
import { rateLimit } from "@/server/rate-limit";

const Body = z.object({
  amountMinor: z.number().int().positive(),
  idempotencyKey: z.string().min(8).max(64),
  expectedVersion: z.number().int().nonnegative().optional(),
  bidder: z.object({ name: z.string().trim().min(2).max(80), email: z.email().max(120), phone: z.string().trim().max(24) }),
  acceptTerms: z.literal(true),
});

/**
 * Place a bid. While an auction is in demonstration mode, bids are stored and
 * shown as demonstration bids only. Live bidding additionally requires the
 * durable driver and verified bidder identity (OTP), which are not built yet,
 * so live mode refuses bids until docs/PRODUCTION.md §Auctions is complete.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req)) return json({ error: "Refused." }, 403);
  const limit = rateLimit(`bid:${requestIp(req)}`, 10, 60_000);
  if (!limit.ok) return json({ error: BID_ERROR_MESSAGE.rate_limited, code: "rate_limited" }, 429);
  const { id } = await params;
  const r = repos();
  const settings = await r.settings.get();
  if (!resolveStorefront(settings.storefront, new Date(), { hasAccessPass: true }).biddingOpen) return json({ error: "Bidding is paused at the moment." }, 403);

  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) return json({ error: "Please complete your details and accept the auction terms." }, 422);
  const auction = await r.auctions.get(id);
  if (!auction || !auction.published) return json({ error: "Not found." }, 404);

  const live = auction.mode === "live";
  if (live && (r.driver === "dev" || process.env.AUCTIONS_LIVE !== "1")) {
    return json({ error: BID_ERROR_MESSAGE.live_bidding_disabled, code: "live_bidding_disabled" }, 403);
  }

  const phone = normalizePhone(parsed.data.bidder.phone, { allowInternational: settings.allowInternationalPhones });
  if (!phone) return json({ error: "Enter an Egyptian mobile number." }, 422);
  // Demonstration: contact details stand in for verification. Live: OTP verification required (not built).
  const bidder = await r.auctions.upsertBidder({ name: parsed.data.bidder.name, email: parsed.data.bidder.email.toLowerCase(), phone, verified: !live });
  const ownerEmails = [process.env.ADMIN_EMAIL, "atelier@nivore.local"].filter(Boolean).map((e) => e!.toLowerCase());

  const result = await r.auctions.placeBid({
    auctionId: auction.id,
    bidderId: bidder.id,
    amountMinor: parsed.data.amountMinor,
    idempotencyKey: parsed.data.idempotencyKey,
    expectedVersion: parsed.data.expectedVersion,
    ipHash: await ipHash(req),
    demonstration: !live,
    bidderIsOwner: ownerEmails.includes(bidder.email),
  });
  if (!result.ok) {
    return json(
      { error: BID_ERROR_MESSAGE[result.error], code: result.error, minimumNextMinor: result.auction ? minimumNextBid(result.auction) : null, version: result.auction?.version },
      result.error === "rate_limited" ? 429 : 409,
    );
  }
  return json({ ok: true, demonstration: result.bid.demonstration, label: result.bid.bidderLabel, auction: { currentBidMinor: result.auction.currentBidMinor, bidCount: result.auction.bidCount, closesAt: result.auction.closesAt, version: result.auction.version, minimumNextMinor: minimumNextBid(result.auction) } }, 201);
}
