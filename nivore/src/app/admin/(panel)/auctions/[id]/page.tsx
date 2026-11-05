import { notFound } from "next/navigation";
import { AuctionActions, AuctionEditor } from "@/components/admin/AuctionEditor";
import { Card, PageHeader, Pill, Table, fmtDate } from "@/components/admin/ui";
import { repos } from "@/data/repositories";
import { auctionStatus, BID_ERROR_MESSAGE, PUBLIC_STATUS_LABEL, type Auction } from "@/domain/auction";
import { formatEGP } from "@/domain/money";

export default async function AuctionAdmin({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = repos();
  const isNew = id === "new";
  const now = new Date();
  const a: Auction | null = isNew
    ? { id: `auc-${Date.now().toString(36)}`, slug: "", title: "", subtitle: "", description: "", specs: [], previewBuild: null, images: [], startingBidMinor: 1_000_000, incrementMinor: 50_000, reserveMinor: null, opensAt: new Date(now.getTime() + 86_400_000).toISOString(), closesAt: new Date(now.getTime() + 8 * 86_400_000).toISOString(), antiSnipe: { enabled: true, windowMinutes: 5, extendMinutes: 5 }, adminStatus: "scheduled", mode: "demonstration", published: false, currentBidMinor: 0, bidCount: 0, leadingBidderId: null, winner: null, terms: "", version: 0, archived: false, createdAt: now.toISOString(), updatedAt: now.toISOString() }
    : await r.auctions.get(id);
  if (!a) notFound();
  const [bids, bidders] = isNew ? [[], []] : await Promise.all([r.auctions.bids(a.id), r.auctions.bidders()]);
  const who = (bidderId: string) => bidders.find((b) => b.id === bidderId);
  const winner = a.winner ? who(a.winner.bidderId) : null;
  return (
    <>
      <PageHeader title={isNew ? "New auction" : a.title} eyebrow={isNew ? "Auction" : PUBLIC_STATUS_LABEL[auctionStatus(a, now)]} />
      {!isNew && (
        <div className="mb-8 grid gap-6 lg:grid-cols-2">
          <Card title="Outcome & payment">
            {a.winner ? (
              <div className="space-y-1 text-[13.5px]">
                <p>Winner: <strong>{winner?.name}</strong> · {winner?.email} · {winner?.phone}</p>
                <p>Winning bid {formatEGP(a.winner.amountMinor)}{a.reserveMinor ? ` (reserve ${formatEGP(a.reserveMinor)})` : ""}</p>
                <p>Contacted: {fmtDate(a.winner.confirmedAt)} · Payment received: {fmtDate(a.winner.paymentConfirmedAt)}</p>
              </div>
            ) : (
              <p className="text-[13px] text-taupe-ink">No winner yet. After closing, &ldquo;Close & select winner&rdquo; picks the highest accepted non-demonstration bid that meets the reserve.</p>
            )}
            <div className="mt-4"><AuctionActions id={a.id} hasWinner={Boolean(a.winner)} /></div>
          </Card>
          <Card title={`Bids · ${bids.length} (including rejected)`}>
            <Table head={["When", "Bidder", "Amount", "Result"]}>
              {bids.slice(0, 30).map((b) => (
                <tr key={b.id}>
                  <td className="px-4 py-2 text-taupe-ink">{fmtDate(b.placedAt)}</td>
                  <td className="px-4 py-2">{b.bidderLabel}<span className="block text-[11px] text-taupe-ink">{who(b.bidderId)?.email} · ip {b.ipHash?.slice(0, 8)}</span></td>
                  <td className="tabular px-4 py-2">{formatEGP(b.amountMinor)}</td>
                  <td className="px-4 py-2">{b.status === "accepted" ? <Pill tone={b.demonstration ? "muted" : "ok"}>{b.demonstration ? "demo" : "accepted"}</Pill> : <Pill tone="err">{b.rejectReason ? BID_ERROR_MESSAGE[b.rejectReason].slice(0, 40) : "rejected"}</Pill>}</td>
                </tr>
              ))}
            </Table>
          </Card>
        </div>
      )}
      <AuctionEditor initial={a} isNew={isNew} />
    </>
  );
}
