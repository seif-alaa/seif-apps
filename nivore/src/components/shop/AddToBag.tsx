"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useBag } from "@/lib/cart";

export function AddToBag({ productId, name, detail, image, priceMinor, available, unavailableLabel = "Sold", maxQuantity }: { productId: string; name: string; detail: string; image?: string; priceMinor: number; available: boolean; unavailableLabel?: string; maxQuantity: number }) {
  const add = useBag((s) => s.add);
  const hydrate = useBag((s) => s.hydrate);
  const [added, setAdded] = useState(false);
  useEffect(() => hydrate(), [hydrate]);
  if (!available) {
    return (
      <button type="button" className="btn btn-primary w-full" disabled>
        {unavailableLabel}
      </button>
    );
  }
  return (
    <div className="space-y-2">
      <button
        type="button"
        className="btn btn-primary w-full"
        data-testid="pdp-add"
        onClick={() => {
          add({ kind: "catalog", productId, name, detail, image, quantity: 1, displayMinor: priceMinor });
          setAdded(true);
        }}
      >
        Add to bag
      </button>
      <p className="min-h-5 text-center text-[12px] text-taupe-ink" role="status">
        {added ? (
          <>
            Added. <Link href="/bag" className="underline underline-offset-4">View your bag</Link>
          </>
        ) : maxQuantity === 1 ? (
          "One per order."
        ) : null}
      </p>
    </div>
  );
}
