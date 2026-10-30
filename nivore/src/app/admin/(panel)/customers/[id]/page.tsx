import Link from "next/link";
import { notFound } from "next/navigation";
import { CustomerNote } from "@/components/admin/CustomerNote";
import { Card, PageHeader, Pill, fmtDate } from "@/components/admin/ui";
import { repos } from "@/data/repositories";
import { formatPhone } from "@/domain/egypt";
import { formatEGP } from "@/domain/money";
import { ORDER_STATUS_LABEL } from "@/domain/models";

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await repos().customers.get(id);
  if (!c) notFound();
  const orders = (await repos().orders.list()).filter((o) => c.orderRefs.includes(o.ref));
  const total = orders.filter((o) => o.status !== "cancelled").reduce((s, o) => s + o.totals.totalMinor, 0);
  const paid = orders.filter((o) => o.payment.status === "confirmed").reduce((s, o) => s + o.totals.totalMinor, 0);
  return (
    <>
      <PageHeader title={c.name} eyebrow={`Customer since ${fmtDate(c.createdAt)}`} />
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <Card title={`Orders · ${formatEGP(total)} placed · ${formatEGP(paid)} paid`}>
            <ul className="divide-y divide-line text-[13.5px]">
              {orders.map((o) => (
                <li key={o.ref} className="flex items-center justify-between gap-3 py-2.5">
                  <Link href={`/admin/orders/${o.ref}`} className="font-medium hover:underline">{o.ref}</Link>
                  <span className="flex-1 truncate text-taupe-ink">{o.items.map((i) => i.name).join(", ")}</span>
                  <Pill>{ORDER_STATUS_LABEL[o.status]}</Pill>
                  <span className="tabular">{formatEGP(o.totals.totalMinor)}</span>
                </li>
              ))}
            </ul>
          </Card>
          <Card title="Notes">
            <ul className="mb-4 space-y-2 text-[13px]">{c.notes.map((n, i) => <li key={i}><span className="text-taupe-ink">{fmtDate(n.at)} · {n.by}:</span> {n.text}</li>)}</ul>
            <CustomerNote id={c.id} />
          </Card>
        </div>
        <div className="space-y-6">
          <Card title="Contact">
            <p className="text-[13.5px]"><a className="underline" href={`tel:${c.phone}`}>{formatPhone(c.phone)}</a></p>
            <p className="text-[13.5px]"><a className="underline" href={`mailto:${c.email}`}>{c.email}</a></p>
            <p className="mt-2 text-[12px] text-taupe-ink">Marketing consent: {c.marketingConsent ? "given" : "not given"}</p>
          </Card>
          <Card title="Delivery addresses">
            {c.addresses.length ? c.addresses.map((a, i) => <p key={i} className="mb-2 text-[13px]">{[a.address, a.landmark, a.city, a.governorate].filter(Boolean).join(", ")}</p>) : <p className="text-[13px] text-taupe-ink">Pickup only.</p>}
          </Card>
          <Card title="Saved compositions"><p className="text-[12.5px] text-taupe-ink">Saved designs are stored on the customer&rsquo;s own device until accounts are introduced with the production database.</p></Card>
        </div>
      </div>
    </>
  );
}
