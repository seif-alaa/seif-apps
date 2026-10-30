import Link from "next/link";
import { notFound } from "next/navigation";
import { FulfilmentControl, NoteControl, PaymentControl, StatusControl } from "@/components/admin/OrderControls";
import { Card, PageHeader, Pill, fmtDate } from "@/components/admin/ui";
import { repos } from "@/data/repositories";
import { formatPhone } from "@/domain/egypt";
import { formatEGP } from "@/domain/money";
import { ORDER_STATUS_LABEL, PAYMENT_METHOD_LABEL, PAYMENT_STATUS_LABEL } from "@/domain/models";

export default async function OrderDetail({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  const o = await repos().orders.get(ref);
  if (!o) notFound();
  const wa = o.customer.phone.replace(/\D/g, "");
  return (
    <>
      <PageHeader
        eyebrow={`Placed ${fmtDate(o.createdAt)}`}
        title={`Order ${o.ref}`}
        actions={
          <>
            <Link className="btn btn-outline" href={`/admin/orders/${o.ref}/sheet`}>Build sheet / print</Link>
            <Link className="btn btn-ghost" href="/admin/orders">All orders</Link>
          </>
        }
      >
        <Pill tone="ink">{ORDER_STATUS_LABEL[o.status]}</Pill> <Pill tone={o.payment.status === "confirmed" ? "ok" : "warn"}>{PAYMENT_STATUS_LABEL[o.payment.status]}</Pill>
        {o.environment === "development" && <> <Pill tone="warn">Development order</Pill></>}
      </PageHeader>
      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <div className="space-y-6">
          {o.items.map((item) => (
            <Card key={item.id} title={item.kind === "custom" ? `Custom composition · ${item.buildRef}` : "Catalogue piece"}>
              <div className="grid gap-5 sm:grid-cols-[150px_1fr]">
                {item.encoded ? (
                  <div className="grid grid-cols-2 gap-1 sm:grid-cols-1">
                    {/* eslint-disable-next-line @next/next/no-img-element -- server-rendered SVG */}
                    <img src={`/api/render?${item.encoded}`} alt="Front" className="aspect-[600/860] w-full bg-cream" />
                  </div>
                ) : <div />}
                <div>
                  <p className="text-[16px]">{item.name} {item.quantity > 1 && <span className="text-taupe-ink">× {item.quantity}</span>}</p>
                  <table className="mt-3 w-full text-[12.5px]">
                    <tbody className="divide-y divide-line">
                      {item.components.map((c) => (
                        <tr key={c.slot}>
                          <td className="py-1.5 pr-3 capitalize text-taupe-ink">{c.slot}</td>
                          <td className="py-1.5 pr-3">{c.name}</td>
                          <td className="py-1.5 pr-3 font-mono text-[11px] text-taupe-ink">{c.sku}</td>
                          <td className="tabular py-1.5 text-right">{c.priceMinor ? formatEGP(c.priceMinor) : ""}</td>
                        </tr>
                      ))}
                      {item.lines.filter((l) => !item.components.some((c) => c.slot === l.key)).map((l) => (
                        <tr key={l.key}><td className="py-1.5 pr-3 text-taupe-ink">{l.label}</td><td className="py-1.5" colSpan={2}>{l.name}</td><td className="tabular py-1.5 text-right">{formatEGP(l.amountMinor)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                  {item.engraving && <p className="mt-3 border border-line bg-cream p-3 text-[13px]">Engraving ({item.engraving.style}): <strong>“{item.engraving.text}”</strong></p>}
                  <p className="tabular mt-3 text-right text-[14px]">Unit {formatEGP(item.unitMinor)}</p>
                </div>
              </div>
            </Card>
          ))}
          <Card title="Totals">
            <dl className="space-y-1 text-[13.5px]">
              <div className="flex justify-between"><dt>Subtotal</dt><dd className="tabular">{formatEGP(o.totals.subtotalMinor)}</dd></div>
              {o.totals.discountMinor > 0 && <div className="flex justify-between"><dt>{o.totals.discountLabel} ({o.promoCode})</dt><dd className="tabular">− {formatEGP(o.totals.discountMinor)}</dd></div>}
              <div className="flex justify-between"><dt>Delivery</dt><dd className="tabular">{formatEGP(o.totals.shippingMinor)}</dd></div>
              {o.totals.taxMinor > 0 && <div className="flex justify-between"><dt>Tax</dt><dd className="tabular">{formatEGP(o.totals.taxMinor)}</dd></div>}
              <div className="flex justify-between border-t border-line pt-2 text-[15px] font-medium"><dt>Total</dt><dd className="tabular">{formatEGP(o.totals.totalMinor)}</dd></div>
            </dl>
          </Card>
          <Card title="History">
            <ol className="space-y-2 text-[13px]">
              {[...o.history].reverse().map((h, i) => (
                <li key={i} className="grid grid-cols-[10rem_1fr] gap-3"><span className="text-taupe-ink">{fmtDate(h.at)}</span><span>{ORDER_STATUS_LABEL[h.status]} · {h.by}{h.note && <span className="text-taupe-ink"> — {h.note}</span>}</span></li>
              ))}
            </ol>
          </Card>
          <Card title="Internal notes">
            <ul className="mb-4 space-y-2 text-[13px]">
              {o.internalNotes.map((n, i) => <li key={i}><span className="text-taupe-ink">{fmtDate(n.at)} · {n.by}:</span> {n.text}</li>)}
            </ul>
            <NoteControl refId={o.ref} />
          </Card>
        </div>
        <div className="space-y-6">
          <Card title="Customer">
            <p className="text-[15px]">{o.customer.name}</p>
            <ul className="mt-2 space-y-1 text-[13px]">
              <li><a className="underline" href={`tel:${o.customer.phone}`}>{formatPhone(o.customer.phone)}</a> · <a className="underline" href={`https://wa.me/${wa}`} rel="noopener">WhatsApp</a></li>
              {o.customer.altPhone && <li>Alt: {o.customer.altPhone}</li>}
              <li><a className="underline" href={`mailto:${o.customer.email}?subject=Your NIVORÉ order ${o.ref}`}>{o.customer.email}</a></li>
              <li className="text-taupe-ink">Marketing consent: {o.customer.marketingConsent ? "yes" : "no"}</li>
              <li><Link className="underline" href={`/admin/customers/${o.customerId}`}>Customer record</Link></li>
            </ul>
            {o.customerNote && <p className="mt-3 bg-cream p-3 text-[13px]">“{o.customerNote}”</p>}
          </Card>
          <Card title={`Payment · ${PAYMENT_METHOD_LABEL[o.payment.method]}`}>
            {o.payment.reference && <p className="mb-2 text-[13px]">Reference: <span className="font-mono">{o.payment.reference}</span></p>}
            {o.payment.evidence.map((e) => <p key={e.id} className="mb-2 text-[13px]"><a className="underline" href={`/api/admin/evidence/${e.id}`} target="_blank">View evidence ({e.name})</a></p>)}
            {o.payment.confirmedAt && <p className="mb-2 text-[12.5px] text-ok">Confirmed {fmtDate(o.payment.confirmedAt)} by {o.payment.confirmedBy}</p>}
            <PaymentControl refId={o.ref} method={o.payment.method} status={o.payment.status} />
          </Card>
          <Card title="Status"><StatusControl refId={o.ref} status={o.status} /></Card>
          <Card title={o.fulfilment.method === "pickup" ? "Pickup" : "Delivery"}>
            <FulfilmentControl refId={o.ref} initial={{ governorate: o.fulfilment.governorate, city: o.fulfilment.city, address: o.fulfilment.address, landmark: o.fulfilment.landmark, carrier: o.fulfilment.carrier, trackingNumber: o.fulfilment.trackingNumber }} />
          </Card>
        </div>
      </div>
    </>
  );
}
