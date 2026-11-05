import type { Metadata } from "next";
import Link from "next/link";
import { CheckoutForm } from "@/components/commerce/Checkout";
import { getSettings, getStorefront, isDevDriver } from "@/server/catalog";

/** Depends on live storefront locks, so it is never served from cache. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

export default async function CheckoutPage() {
  const [s, sf] = await Promise.all([getSettings(), getStorefront()]);
  return (
    <div className="mx-auto max-w-[1200px] px-5 pt-12 md:px-10 md:pt-16">
      <h1 className="display mb-10 text-[3rem]">Checkout</h1>
      {sf.checkoutOpen ? (
        <CheckoutForm
          cfg={{
            delivery: { enabled: s.shipping.delivery.enabled, note: s.shipping.delivery.note },
            pickup: s.shipping.pickup,
            payments: { cod: s.payments.cod, cop: s.payments.cop, instapay: s.payments.instapay },
            devMode: isDevDriver(),
            notificationsConnected: s.notifications.emailProvider !== "none",
          }}
        />
      ) : (
        <div className="border border-line bg-cream p-8">
          <p className="text-[15px]">{s.storefront.checkoutLockedMessage}</p>
          <Link href="/bag" className="btn btn-outline mt-6">Back to your bag</Link>
        </div>
      )}
    </div>
  );
}
