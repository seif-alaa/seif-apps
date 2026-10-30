import { repos } from "@/data/repositories";
import { auctionStatus, minimumNextBid } from "@/domain/auction";
import { json } from "@/server/http";

/** Live auction state. Server time is included so countdowns never trust the client clock. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = repos();
  const a = await r.auctions.get(id);
  if (!a || !a.published) return json({ error: "Not found." }, 404);
  const now = new Date();
  const bids = await r.auctions.bids(a.id);
  return json({
    id: a.id,
    status: auctionStatus(a, now),
    mode: a.mode,
    currentBidMinor: a.currentBidMinor,
    bidCount: a.bidCount,
    minimumNextMinor: minimumNextBid(a),
    opensAt: a.opensAt,
    closesAt: a.closesAt,
    version: a.version,
    serverTime: now.toISOString(),
    recent: bids
      .filter((b) => b.status === "accepted")
      .slice(0, 8)
      .map((b) => ({ label: b.bidderLabel, amountMinor: b.amountMinor, at: b.placedAt, demonstration: b.demonstration })),
  });
}
