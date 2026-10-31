import Link from "next/link";
import { Card, PageHeader, Pill, Stat, fmtDate } from "@/components/admin/ui";
import { repos } from "@/data/repositories";
import { auctionStatus } from "@/domain/auction";
import { formatEGP } from "@/domain/money";
import { ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL } from "@/domain/models";
import { resolveStorefront, STOREFRONT_MODE_LABEL } from "@/domain/storefront";
import { computeMetrics } from "@/server/analytics";

export default async function Overview() {
  const r = repos();
  const [orders, catalog, auctions, inquiries, settings, waitlist, customers] = await Promise.all([r.orders.list(), r.catalog.get(), r.auctions.list(), r.misc.inquiries(), r.settings.get(), r.misc.waitlist(), r.customers.list()]);
  const now = new Date();
  const all = computeMetrics(orders, { from: new Date(0), to: now });
  const month = computeMetrics(orders, { from: new Date(now.getTime() - 30 * 86_400_000), to: now });
  const lowStock = catalog.components.filter((c) => c.active && (c.stock.status === "low" || c.stock.status === "out_of_stock"));
  const activeAuctions = auctions.filter((a) => a.published && !a.archived && auctionStatus(a, now) === "open");
  const awaitingWinnerPay = auctions.filter((a) => a.adminStatus === "pending_payment" && !a.winner?.paymentConfirmedAt);
  const needsAction = orders.filter((o) => ["received", "payment_under_review", "awaiting_payment"].includes(o.status));
  const sf = resolveStorefront(settings.storefront, now);

  return (
    <>
      <PageHeader title="Overview" eyebrow={new Intl.DateTimeFormat("en-GB", { dateStyle: "full", timeZone: "Africa/Cairo" }).format(now)}>
        Storefront: <strong>{STOREFRONT_MODE_LABEL[settings.storefront.mode].title}</strong>
        {settings.storefront.mode === "scheduled" && ` → currently ${sf.effectiveMode === "live" ? "live" : "closed"}`}
        {settings.storefront.checkoutLocked && " · checkout locked"}. <Link href="/admin/storefront" className="underline underline-offset-4">Change</Link>
      </PageHeader>

      {orders.length === 0 && <p className="mb-6 border border-dashed border-line p-4 text-[13px] text-taupe-ink">No orders yet. Every figure below is computed from real stored orders, so they read zero until orders arrive.</p>}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Orders placed · value" value={formatEGP(all.placedValue)} note={`${all.orderCount} orders, excluding cancelled`} href="/admin/orders" />
        <Stat label="Confirmed revenue" value={formatEGP(all.confirmedRevenue)} note="Payments confirmed received" href="/admin/analytics" />
        <Stat label="Payments pending" value={formatEGP(all.pendingValue)} note={`${all.pendingCount} orders not yet paid`} href="/admin/orders?payment=open" />
        <Stat label="Last 30 days" value={formatEGP(month.placedValue)} note={`${month.orderCount} orders · ${formatEGP(month.confirmedRevenue)} confirmed`} />
        <Stat label="Need your review" value={needsAction.length} note="New, or awaiting payment check" href="/admin/orders?status=attention" />
        <Stat label="In the workshop" value={all.inWorkshop} note="Confirmed through quality check" href="/admin/orders?status=workshop" />
        <Stat label="Delivered" value={all.completed} />
        <Stat label="Customers" value={customers.length} note={`${waitlist.length} on the launch list`} href="/admin/customers" />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card title="Orders needing attention" action={<Link href="/admin/orders" className="text-[12px] underline">All orders</Link>}>
          {needsAction.length ? (
            <ul className="divide-y divide-line text-[13.5px]">
              {needsAction.slice(0, 8).map((o) => (
                <li key={o.ref} className="flex items-center justify-between gap-3 py-2.5">
                  <Link href={`/admin/orders/${o.ref}`} className="font-medium hover:underline">{o.ref}</Link>
                  <span className="min-w-0 flex-1 truncate text-taupe-ink">{o.customer.name}</span>
                  <Pill tone={o.status === "payment_under_review" ? "warn" : "muted"}>{ORDER_STATUS_LABEL[o.status]}</Pill>
                  <span className="tabular">{formatEGP(o.totals.totalMinor)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-taupe-ink">Nothing waiting.</p>
          )}
        </Card>

        <Card title="Inventory alerts" action={<Link href="/admin/components?stock=alert" className="text-[12px] underline">Components</Link>}>
          {lowStock.length ? (
            <ul className="divide-y divide-line text-[13.5px]">
              {lowStock.slice(0, 10).map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 py-2">
                  <Link href={`/admin/components/${c.id}`} className="hover:underline">{c.name}</Link>
                  <Pill tone={c.stock.status === "out_of_stock" ? "err" : "warn"}>{c.stock.status === "out_of_stock" ? "Out of stock" : `Low · ${c.stock.quantity ?? "?"}`}</Pill>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-taupe-ink">All active components are stocked.</p>
          )}
        </Card>

        <Card title="Popular choices (all time)">
          {all.topDials.length ? (
            <div className="grid gap-4 text-[13px] sm:grid-cols-2">
              {[["Watches", all.topWatches], ["Movements", all.topMovements], ["Dials", all.topDials], ["Bracelets & straps", all.topBands]].map(([t, list]) => (
                <div key={t as string}>
                  <p className="eyebrow mb-1">{t as string}</p>
                  <ol className="space-y-0.5">{(list as [string, number][]).slice(0, 4).map(([n, c]) => <li key={n} className="flex justify-between gap-2"><span className="truncate">{n}</span><span className="tabular text-taupe-ink">{c}</span></li>)}</ol>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[13px] text-taupe-ink">Appears once orders exist.</p>
          )}
        </Card>

        <Card title="Rare pieces & messages">
          <ul className="space-y-2 text-[13.5px]">
            <li className="flex justify-between"><span>Auctions open now</span><Link href="/admin/auctions" className="tabular underline">{activeAuctions.length}</Link></li>
            <li className="flex justify-between"><span>Winners awaiting payment</span><span className="tabular">{awaitingWinnerPay.length}</span></li>
            <li className="flex justify-between"><span>New inquiries</span><Link href="/admin/inquiries" className="tabular underline">{inquiries.filter((i) => i.status === "new").length}</Link></li>
          </ul>
          <p className="mt-5 border-t border-line pt-4 text-[12px] leading-relaxed text-taupe-ink">
            Website performance: field Core Web Vitals appear here once an analytics provider is connected (see docs/PRODUCTION.md). Lab measurements are recorded in PROGRESS.md.
          </p>
        </Card>
      </div>

      {orders[0] && <p className="mt-6 text-[12px] text-taupe-ink">Latest order {fmtDate(orders[0].createdAt)} · {PAYMENT_STATUS_LABEL[orders[0].payment.status]}</p>}
    </>
  );
}
