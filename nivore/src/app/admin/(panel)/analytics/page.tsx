import { Card, PageHeader, Stat } from "@/components/admin/ui";
import { repos } from "@/data/repositories";
import { auctionStatus } from "@/domain/auction";
import { formatEGP } from "@/domain/money";
import { computeMetrics, parseRange } from "@/server/analytics";

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const sp = await searchParams;
  const range = parseRange(sp);
  const [orders, auctions] = await Promise.all([repos().orders.list(), repos().auctions.list()]);
  const m = computeMetrics(orders, range);
  const max = Math.max(1, ...m.byDay.map(([, d]) => d.placed));
  const iso = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(d);
  const now = new Date();
  return (
    <>
      <PageHeader title="Analytics" actions={<a className="btn btn-outline" href={`/api/admin/export/analytics?from=${iso(range.from)}&to=${iso(range.to)}`}>Export CSV</a>}>
        Placed value, confirmed revenue and margin are separate figures. Margin uses component costs recorded at the time of each paid order and excludes orders where any cost is missing.
      </PageHeader>
      <form className="mb-6 flex flex-wrap items-end gap-3">
        <label><span className="field-label">From</span><input type="date" name="from" defaultValue={iso(range.from)} className="field !min-h-10 text-sm" /></label>
        <label><span className="field-label">To</span><input type="date" name="to" defaultValue={iso(range.to)} className="field !min-h-10 text-sm" /></label>
        <button className="btn btn-primary !min-h-10">Apply</button>
      </form>
      {m.developmentOrders > 0 && <p className="mb-5 text-[12.5px] text-warn">{m.developmentOrders} development (test) orders are included in this range.</p>}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Orders placed" value={m.orderCount} note={`${formatEGP(m.placedValue)} total value`} />
        <Stat label="Confirmed revenue" value={formatEGP(m.confirmedRevenue)} note="Payment confirmed received" />
        <Stat label="Gross margin" value={formatEGP(m.margin.profit)} note={m.margin.excluded ? `${m.margin.excluded} paid orders excluded (missing costs)` : "Paid orders, excluding delivery"} />
        <Stat label="Average order" value={formatEGP(m.aov)} />
        <Stat label="Payments pending" value={formatEGP(m.pendingValue)} note={`${m.pendingCount} orders`} />
        <Stat label="Cancelled" value={m.cancelled} />
        <Stat label="Custom vs catalogue" value={`${m.customVsCatalog.custom} / ${m.customVsCatalog.catalog}`} note="Pieces sold" />
        <Stat label="Conversion funnel" value="—" note="Connect a privacy-respecting analytics tool to measure visits" />
      </div>
      <Card title="Value by day (placed, with confirmed in dark)" className="mt-6">
        {m.byDay.length ? (
          <ul className="space-y-1.5">
            {m.byDay.map(([day, d]) => (
              <li key={day} className="grid grid-cols-[6.5rem_1fr_7rem] items-center gap-3 text-[12px]">
                <span className="tabular text-taupe-ink">{day}</span>
                <span className="relative h-3 bg-cream">
                  <span className="absolute inset-y-0 left-0 bg-stone" style={{ width: `${(d.placed / max) * 100}%` }} />
                  <span className="absolute inset-y-0 left-0 bg-espresso" style={{ width: `${(d.paid / max) * 100}%` }} />
                </span>
                <span className="tabular text-right">{formatEGP(d.placed)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[13px] text-taupe-ink">No orders in this range.</p>
        )}
      </Card>
      <div className="mt-6 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {([["Most ordered watches", m.topWatches], ["Movements", m.topMovements], ["Dials", m.topDials], ["Bracelets & straps", m.topBands]] as const).map(([t, list]) => (
          <Card key={t} title={t}>
            {list.length ? <ol className="space-y-1 text-[13px]">{list.map(([n, c]) => <li key={n} className="flex justify-between gap-2"><span className="truncate">{n}</span><span className="tabular text-taupe-ink">{c}</span></li>)}</ol> : <p className="text-[13px] text-taupe-ink">No data.</p>}
          </Card>
        ))}
      </div>
      <Card title="Auction performance" className="mt-6">
        <ul className="divide-y divide-line text-[13px]">
          {auctions.map((a) => (
            <li key={a.id} className="flex justify-between py-2"><span>{a.title} · {auctionStatus(a, now)}{a.mode === "demonstration" && " (demonstration)"}</span><span className="tabular">{a.bidCount} bids · {formatEGP(a.currentBidMinor)}</span></li>
          ))}
        </ul>
      </Card>
    </>
  );
}
