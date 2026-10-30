"use client";

import Link from "next/link";
import { useEffect } from "react";
import { formatEGP } from "@/domain/money";
import { useBag } from "@/lib/cart";
import { useQuote } from "./useQuote";

export function BagView({ checkoutOpen, lockedMessage }: { checkoutOpen: boolean; lockedMessage: string }) {
  const { items, hydrated, hydrate, remove, setQuantity } = useBag();
  useEffect(() => hydrate(), [hydrate]);
  const { quote, loading, error } = useQuote(items, {}, hydrated);

  if (!hydrated) return <div className="h-64" aria-busy="true" />;
  if (!items.length) {
    return (
      <div className="py-16 text-center">
        <p className="display text-[2.2rem]">Your bag is empty.</p>
        <p className="mt-2 text-[14.5px] text-taupe-ink">Begin with a finished piece, or compose your own.</p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/build" className="btn btn-primary">Build your watch</Link>
          <Link href="/timepieces" className="btn btn-outline">Explore timepieces</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-12 lg:grid-cols-[1.5fr_1fr]">
      <ul className="divide-y divide-line border-y border-line" data-testid="bag-items">
        {items.map((item, i) => {
          const line = quote?.lines[i];
          const query = item.kind === "custom" ? line?.encoded : null;
          return (
            <li key={item.id} className="grid grid-cols-[96px_1fr] gap-5 py-6 sm:grid-cols-[120px_1fr]">
              <div className="relative aspect-[600/860] bg-cream">
                {/* eslint-disable-next-line @next/next/no-img-element -- server-rendered SVG thumbnail */}
                {query ? <img src={`/api/render?${query}`} alt="" className="absolute inset-0 h-full w-full" loading="lazy" /> : item.kind === "catalog" ? <span className="absolute inset-0 grid place-items-center text-[10px] text-taupe-ink">NIVORÉ</span> : null}
              </div>
              <div className="flex min-w-0 flex-col">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="eyebrow">{item.kind === "custom" ? "Your composition" : "Timepiece"}</p>
                    <p className="mt-1 text-[16px]">{line?.name ?? item.name}</p>
                    <p className="mt-0.5 text-[12.5px] text-taupe-ink">{item.detail}</p>
                    {item.buildRef && <p className="tabular mt-0.5 text-[11.5px] tracking-[0.08em] text-taupe-ink">{item.buildRef}</p>}
                  </div>
                  <p className="tabular shrink-0 text-[14px]">{line ? formatEGP(line.unitMinor * item.quantity) : formatEGP(item.displayMinor * item.quantity)}</p>
                </div>
                {line?.error && (
                  <p role="alert" className="mt-3 text-[13px] text-err">
                    {line.error}
                  </p>
                )}
                {line && line.unitMinor !== item.displayMinor && !line.error && <p className="mt-2 text-[12px] text-warn">The price has been updated since you added this piece.</p>}
                <div className="mt-auto flex flex-wrap items-center gap-x-5 gap-y-2 pt-4 text-[12.5px]">
                  {item.kind === "catalog" ? (
                    <label className="flex items-center gap-2">
                      <span className="text-taupe-ink">Qty</span>
                      <select className="field !min-h-9 !w-auto !py-1 !pl-3 text-sm" value={item.quantity} onChange={(e) => setQuantity(item.id, Number(e.target.value))}>
                        {[1, 2, 3].map((n) => (
                          <option key={n}>{n}</option>
                        ))}
                      </select>
                    </label>
                  ) : (
                    query && (
                      <Link href={`/build?${query}&edit=${item.id}`} className="underline underline-offset-4">
                        Edit composition
                      </Link>
                    )
                  )}
                  <button type="button" className="text-taupe-ink underline underline-offset-4 hover:text-espresso" onClick={() => remove(item.id)}>
                    Remove
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <aside className="h-fit bg-cream p-6 lg:sticky lg:top-24">
        <h2 className="eyebrow">Summary</h2>
        <dl className="mt-4 space-y-2 text-[14px]">
          <div className="flex justify-between">
            <dt>Subtotal</dt>
            <dd className="tabular">{quote ? formatEGP(quote.totals.subtotalMinor) : "—"}</dd>
          </div>
          <div className="flex justify-between text-taupe-ink">
            <dt>Delivery</dt>
            <dd>Calculated at checkout</dd>
          </div>
        </dl>
        <p className="mt-4 text-[12px] text-taupe-ink" aria-live="polite">
          {loading ? "Confirming prices with the atelier…" : error ? error : "Prices confirmed by the atelier’s server."}
        </p>
        {checkoutOpen ? (
          <Link
            href="/checkout"
            aria-disabled={!quote?.ok}
            className={`btn btn-primary mt-6 w-full ${!quote?.ok ? "pointer-events-none opacity-45" : ""}`}
            data-testid="to-checkout"
          >
            Checkout
          </Link>
        ) : (
          <p className="mt-6 border border-line bg-ivory p-4 text-[13px]">{lockedMessage}</p>
        )}
        {quote && !quote.ok && <p className="mt-3 text-[12.5px] text-err">Resolve the highlighted pieces to continue.</p>}
      </aside>
    </div>
  );
}
