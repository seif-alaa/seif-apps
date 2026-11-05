import type { Metadata } from "next";
import { OrderLookup } from "@/components/commerce/OrderLookup";

export const metadata: Metadata = { title: "Order status", robots: { index: false } };

export default function OrderStatusPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 pt-14 md:px-10 md:pt-20">
      <h1 className="display text-[3rem]">Order status</h1>
      <p className="mt-3 max-w-lg text-[15px] text-taupe-ink">Enter the reference from your confirmation and the mobile number you ordered with.</p>
      <div className="mt-10"><OrderLookup /></div>
    </div>
  );
}
