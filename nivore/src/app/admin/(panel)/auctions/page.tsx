import Link from "next/link";
import { PageHeader, Pill, Table, fmtDate } from "@/components/admin/ui";
import { repos } from "@/data/repositories";
import { auctionStatus, PUBLIC_STATUS_LABEL } from "@/domain/auction";
import { formatEGP } from "@/domain/money";

export default async function AuctionsPage() {
  const auctions = await repos().auctions.list();
  const now = new Date();
  return (
    <>
      <PageHeader title="Auctions" actions={<Link href="/admin/auctions/new" className="btn btn-primary">New auction</Link>}>
        Rare pieces run in demonstration mode until the production database, bidder verification and transactional bidding are in place (docs/PRODUCTION.md §Auctions).
      </PageHeader>
      <Table head={["Piece", "Status", "Mode", "Bids", "Highest", "Closes"]}>
        {auctions.map((a) => (
          <tr key={a.id} className={a.archived ? "opacity-50" : ""}>
            <td className="px-4 py-2.5"><Link className="hover:underline" href={`/admin/auctions/${a.id}`}>{a.title}</Link>{!a.published && <span className="ml-2 text-[11px] text-taupe-ink">unpublished</span>}</td>
            <td className="px-4 py-2.5"><Pill>{PUBLIC_STATUS_LABEL[auctionStatus(a, now)]}</Pill></td>
            <td className="px-4 py-2.5">{a.mode}</td>
            <td className="tabular px-4 py-2.5">{a.bidCount}</td>
            <td className="tabular px-4 py-2.5">{a.bidCount ? formatEGP(a.currentBidMinor) : "—"}</td>
            <td className="px-4 py-2.5 text-taupe-ink">{fmtDate(a.closesAt)}</td>
          </tr>
        ))}
      </Table>
    </>
  );
}
