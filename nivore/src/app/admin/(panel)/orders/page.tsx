import Link from "next/link";
import { PageHeader, Pill, Table, fmtDate } from "@/components/admin/ui";
import { repos } from "@/data/repositories";
import { formatEGP } from "@/domain/money";
import { ORDER_STATUS_LABEL, ORDER_STATUSES, PAYMENT_METHOD_LABEL, PAYMENT_STATUS_LABEL } from "@/domain/models";

const GROUPS: Record<string, string[]> = {
  attention: ["received", "awaiting_payment", "payment_under_review"],
  workshop: ["confirmed", "payment_confirmed", "components_preparing", "assembly", "quality_check"],
  dispatch: ["ready_for_dispatch", "shipped"],
};

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ status?: string; payment?: string; q?: string }> }) {
  const { status = "all", payment = "all", q = "" } = await searchParams;
  const all = await repos().orders.list();
  const orders = all
    .filter((o) => status === "all" || (GROUPS[status] ? GROUPS[status].includes(o.status) : o.status === status))
    .filter((o) => payment === "all" || (payment === "open" ? ["awaiting", "under_review", "due_on_delivery", "due_on_pickup"].includes(o.payment.status) : o.payment.status === payment))
    .filter((o) => !q || `${o.ref} ${o.customer.name} ${o.customer.phone} ${o.customer.email}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <PageHeader title="Orders" actions={<a className="btn btn-outline" href={`/api/admin/export/orders?status=${status}`}>Export CSV</a>}>Every order keeps the exact components and prices at the time it was placed.</PageHeader>
      <form className="mb-5 grid gap-3 sm:grid-cols-[1fr_auto_auto_auto]">
        <input name="q" defaultValue={q} placeholder="Reference, name, phone or email" className="field !min-h-10 text-sm" />
        <select name="status" defaultValue={status} className="field !min-h-10 text-sm">
          <option value="all">All statuses</option>
          <option value="attention">Needs attention</option>
          <option value="workshop">In the workshop</option>
          <option value="dispatch">Dispatch</option>
          {ORDER_STATUSES.map((s) => <option key={s} value={s}>{ORDER_STATUS_LABEL[s]}</option>)}
        </select>
        <select name="payment" defaultValue={payment} className="field !min-h-10 text-sm">
          <option value="all">Any payment</option>
          <option value="open">Unpaid / pending</option>
          <option value="under_review">Under review</option>
          <option value="confirmed">Confirmed</option>
        </select>
        <button className="btn btn-primary !min-h-10">Filter</button>
      </form>
      <Table head={["Order", "Placed", "Customer", "Items", "Payment", "Status", "Total"]}>
        {orders.map((o) => (
          <tr key={o.ref} className="hover:bg-cream/50">
            <td className="px-4 py-3"><Link href={`/admin/orders/${o.ref}`} className="font-medium underline-offset-4 hover:underline">{o.ref}</Link>{o.environment === "development" && <span className="ml-2 text-[10px] text-warn">DEV</span>}</td>
            <td className="px-4 py-3 text-taupe-ink">{fmtDate(o.createdAt)}</td>
            <td className="px-4 py-3">{o.customer.name}<span className="block text-[11.5px] text-taupe-ink">{o.customer.phone}</span></td>
            <td className="px-4 py-3">{o.items.map((i) => i.name).join(", ")}</td>
            <td className="px-4 py-3">{PAYMENT_METHOD_LABEL[o.payment.method]}<span className="block"><Pill tone={o.payment.status === "confirmed" ? "ok" : o.payment.status === "under_review" ? "warn" : "muted"}>{PAYMENT_STATUS_LABEL[o.payment.status]}</Pill></span></td>
            <td className="px-4 py-3"><Pill tone={o.status === "cancelled" ? "err" : o.status === "delivered" ? "ok" : "muted"}>{ORDER_STATUS_LABEL[o.status]}</Pill></td>
            <td className="tabular px-4 py-3">{formatEGP(o.totals.totalMinor)}</td>
          </tr>
        ))}
      </Table>
      {!orders.length && <p className="p-8 text-center text-[13px] text-taupe-ink">No orders match.</p>}
    </>
  );
}
