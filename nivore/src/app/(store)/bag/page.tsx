import type { Metadata } from "next";
import { BagView } from "@/components/commerce/Bag";
import { getSettings, getStorefront } from "@/server/catalog";

/** Depends on live storefront locks, so it is never served from cache. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Your bag", robots: { index: false } };

export default async function BagPage() {
  const [sf, s] = await Promise.all([getStorefront(), getSettings()]);
  return (
    <div className="mx-auto max-w-[1200px] px-5 pt-12 md:px-10 md:pt-16">
      <h1 className="display mb-10 text-[3rem]">Your bag</h1>
      <BagView checkoutOpen={sf.checkoutOpen} lockedMessage={s.storefront.checkoutLockedMessage} />
    </div>
  );
}
