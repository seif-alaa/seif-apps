import type { Metadata } from "next";
import Link from "next/link";
import { Monogram } from "@/components/brand/Brand";
import { repos } from "@/data/repositories";
import { formatEGP } from "@/domain/money";
import { ORDER_STATUS_PUBLIC, PAYMENT_METHOD_LABEL } from "@/domain/models";
import { getSettings } from "@/server/catalog";
import { verifyToken } from "@/server/session";

export const metadata: Metadata = { title: "Order received", robots: { index: false } };

/** Confirmation page. Requires the signed token issued at checkout, so references alone reveal nothing. */
export default async function OrderPage({ params, searchParams }: { params: Promise<{ ref: string }>; searchParams: Promise<{ t?: string }> }) {
  const [{ ref }, { t }] = await Promise.all([params, searchParams]);
  const token = await verifyToken(t, "order");
  const order = token?.sub === ref ? await repos().orders.get(ref) : null;
  const settings = await getSettings();
  if (!order) {
    return (
      <div className="mx-auto max-w-xl px-5 py-24 text-center">
        <h1 className="display text-[2.4rem]">This link has expired.</h1>
        <p className="mt-3 text-taupe-ink">You can still check your order with its reference and your mobile number.</p>
        <Link href="/order-status" className="btn btn-outline mt-8">Check order status</Link>
      </div>
    );
  }
  const instapay = order.payment.method === "instapay";
  return (
    <div className="mx-auto max-w-3xl px-5 pt-14 md:px-10 md:pt-20" data-testid="order-confirmation">
      <Monogram size={48} className="text-taupe" />
      <p className="eyebrow mt-8">Order {order.ref}</p>
      <h1 className="display mt-2 text-[2.8rem] md:text-[3.6rem]">Thank you, {order.customer.name.split(" ")[0]}.</h1>
      {order.environment === "development" && (
        <p className="mt-6 border border-warn/40 bg-cream p-4 text-[13px]">Development order: saved in the local test store only. This is not a real purchase and will not be fulfilled.</p>
      )}
      <p className="mt-6 text-[15.5px] leading-relaxed">{ORDER_STATUS_PUBLIC[order.status]}</p>

      {instapay && order.payment.status !== "confirmed" && (
        <div className="mt-8 border border-line bg-cream p-6 text-[14px] leading-relaxed">
          <p className="font-medium">InstaPay payment</p>
          <p className="mt-2">
            {order.payment.reference ? "We have your transfer reference and will confirm once the money arrives." : `If you have not sent it yet, transfer ${formatEGP(order.totals.totalMinor)} to ${settings.payments.instapay.handle}, then reply with your reference.`}{" "}
            Your order stays pending until the atelier confirms the payment by hand.
          </p>
        </div>
      )}

      <h2 className="eyebrow mt-12">Your order</h2>
      <ul className="mt-3 divide-y divide-line border-y border-line">
        {order.items.map((i) => (
          <li key={i.id} className="flex justify-between gap-4 py-4 text-[14.5px]">
            <span>
              {i.name} {i.quantity > 1 && <span className="text-taupe-ink">× {i.quantity}</span>}
              {i.buildRef && <span className="tabular block text-[12px] tracking-[0.08em] text-taupe-ink">{i.buildRef}</span>}
              {i.engraving && <span className="block text-[12px] text-taupe-ink">Engraving: “{i.engraving.text}”</span>}
            </span>
            <span className="tabular">{formatEGP(i.unitMinor * i.quantity)}</span>
          </li>
        ))}
      </ul>
      <dl className="mt-4 space-y-1.5 text-[14px]">
        {order.totals.discountMinor > 0 && (
          <div className="flex justify-between"><dt className="text-taupe-ink">{order.totals.discountLabel}</dt><dd className="tabular">− {formatEGP(order.totals.discountMinor)}</dd></div>
        )}
        <div className="flex justify-between"><dt className="text-taupe-ink">Delivery</dt><dd className="tabular">{order.totals.shippingMinor ? formatEGP(order.totals.shippingMinor) : "No charge"}</dd></div>
        <div className="flex justify-between text-[16px] font-medium"><dt>Total</dt><dd className="tabular">{formatEGP(order.totals.totalMinor)}</dd></div>
        <div className="flex justify-between"><dt className="text-taupe-ink">Payment</dt><dd>{PAYMENT_METHOD_LABEL[order.payment.method]}</dd></div>
      </dl>

      <h2 className="eyebrow mt-12">What happens next</h2>
      <ol className="mt-3 space-y-2 text-[14.5px] leading-relaxed">
        <li>1. The atelier reviews your order and contacts you on {order.customer.phone}.</li>
        <li>2. {instapay ? "Once your transfer is confirmed, " : ""}we prepare the components and assemble your watch.</li>
        <li>3. It is checked, presented with its certificate of composition, and delivered.</li>
      </ol>
      <p className="mt-8 text-[13px] text-taupe-ink">
        {settings.notifications.emailProvider === "none" ? "No confirmation email has been sent; please keep this reference. " : ""}
        Check progress any time on <Link href="/order-status" className="underline underline-offset-4">order status</Link> with reference <span className="tabular">{order.ref}</span>.
      </p>
    </div>
  );
}
