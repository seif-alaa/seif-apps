"use client";

import { useEffect, useState } from "react";
import type { BagItem } from "@/lib/cart";

export interface QuoteResponse {
  ok: boolean;
  totals: { subtotalMinor: number; discountMinor: number; discountLabel: string | null; shippingMinor: number | null; taxMinor: number; totalMinor: number; promoError: string | null };
  lines: { index: number; ok: boolean; error: string | null; name: string; detail: string; quantity: number; unitMinor: number; buildRef: string | null; encoded: string | null; lines: { key: string; label: string; name: string; amountMinor: number }[]; leadTimeDays: number | null }[];
}

export function toCheckoutItems(items: BagItem[]) {
  return items.map((i) => (i.kind === "custom" ? { kind: "custom" as const, configuration: i.configuration!, quantity: i.quantity } : { kind: "catalog" as const, productId: i.productId!, quantity: i.quantity }));
}

/** Server-authoritative price for the bag; debounced, cancels stale requests. */
export function useQuote(items: BagItem[], opts: { promoCode?: string; method?: string | null; governorate?: string | null }, enabled = true) {
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const key = JSON.stringify([toCheckoutItems(items), opts]);
  useEffect(() => {
    if (!enabled || !items.length) {
      setQuote(null);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/quote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: toCheckoutItems(items), ...opts }), signal: ctrl.signal });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Prices could not be confirmed.");
        setQuote(await res.json());
        setError(null);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setError((e as Error).message);
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 200);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);
  return { quote, loading, error };
}
