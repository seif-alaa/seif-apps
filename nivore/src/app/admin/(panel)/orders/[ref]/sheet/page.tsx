import { notFound } from "next/navigation";
import { Monogram, Wordmark } from "@/components/brand/Brand";
import { PrintButton } from "@/components/admin/PrintButton";
import { repos } from "@/data/repositories";
import { formatEGP } from "@/domain/money";
import { PAYMENT_METHOD_LABEL } from "@/domain/models";

/** Printable order summary and build specification ("Certificate of Composition" layout from the Brand Book). */
export default async function Sheet({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  const o = await repos().orders.get(ref);
  if (!o) notFound();
  return (
    <div className="mx-auto max-w-3xl bg-ivory print:max-w-none">
      <div className="mb-6 flex justify-end print:hidden"><PrintButton /></div>
      {o.items.map((item, idx) => (
        <section key={item.id} className="mb-10 break-after-page border border-line p-10 print:border-0">
          <div className="flex items-start justify-between">
            <Wordmark className="h-12 w-auto" />
            <p className="serif text-lg">N° <span className="tabular">{o.ref}{o.items.length > 1 ? `/${idx + 1}` : ""}</span></p>
          </div>
          <h1 className="display mt-8 text-[2.2rem]">Certificate of Composition</h1>
          <p className="mt-1 text-[13px] text-taupe-ink">{item.name}{item.buildRef ? ` · ${item.buildRef}` : ""}</p>
          <div className="mt-8 grid grid-cols-[1fr_180px] gap-8">
            <dl className="grid grid-cols-1 gap-y-3 text-[13px]">
              {item.components.map((c) => (
                <div key={c.slot} className="border-b border-line pb-1.5">
                  <dt className="eyebrow">{c.slot === "band" ? "Bracelet / strap" : c.slot}</dt>
                  <dd>{c.name} <span className="font-mono text-[11px] text-taupe-ink">{c.sku}</span></dd>
                </div>
              ))}
              {item.engraving && <div className="border-b border-line pb-1.5"><dt className="eyebrow">Engraving</dt><dd>“{item.engraving.text}” ({item.engraving.style})</dd></div>}
              <div className="border-b border-line pb-1.5"><dt className="eyebrow">Assembled by</dt><dd>&nbsp;</dd></div>
              <div className="border-b border-line pb-1.5"><dt className="eyebrow">Date</dt><dd>&nbsp;</dd></div>
            </dl>
            {/* eslint-disable-next-line @next/next/no-img-element -- server-rendered SVG */}
            {item.encoded && <img src={`/api/render?${item.encoded}`} alt="" className="w-full" />}
          </div>
          <div className="mt-10 flex items-end justify-between gap-8">
            <p className="max-w-md text-[10.5px] leading-relaxed text-taupe-ink">A record of the components chosen for this timepiece. NIVORÉ is an independent atelier; third-party parts are named as supplied by their makers.</p>
            <Monogram size={58} className="text-champagne" />
          </div>
        </section>
      ))}
      <section className="border border-line p-10 text-[13px] print:border-0">
        <h2 className="eyebrow">Order summary · {o.ref}</h2>
        <p className="mt-3">{o.customer.name} · {o.customer.phone} · {o.customer.email}</p>
        <p>{o.fulfilment.method === "delivery" ? [o.fulfilment.address, o.fulfilment.landmark, o.fulfilment.city, o.fulfilment.governorate].filter(Boolean).join(", ") : "Pickup from the atelier"}</p>
        <p className="mt-3">Payment: {PAYMENT_METHOD_LABEL[o.payment.method]} · Total {formatEGP(o.totals.totalMinor)}</p>
        {o.customerNote && <p className="mt-3">Note: {o.customerNote}</p>}
      </section>
    </div>
  );
}
