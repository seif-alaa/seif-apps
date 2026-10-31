"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatEGP } from "@/domain/money";
import { cn } from "@/lib/cn";
import { useSaved } from "@/lib/saved";

/** Saved compositions on this device, with a light side-by-side comparison. */
export function SavedList() {
  const { designs, hydrated, hydrate, remove } = useSaved();
  const [compare, setCompare] = useState<string[]>([]);
  useEffect(() => hydrate(), [hydrate]);
  if (!hydrated) return <div className="h-64" aria-busy="true" />;
  if (!designs.length) {
    return (
      <div className="py-16 text-center">
        <p className="display text-[2.2rem]">Nothing saved yet.</p>
        <p className="mt-2 text-taupe-ink">In the builder&rsquo;s review step, choose &ldquo;Save this design&rdquo;.</p>
        <Link href="/build" className="btn btn-primary mt-8">Build your watch</Link>
      </div>
    );
  }
  const chosen = designs.filter((d) => compare.includes(d.ref));
  const toggle = (ref: string) => setCompare((c) => (c.includes(ref) ? c.filter((x) => x !== ref) : [...c, ref].slice(-2)));
  return (
    <div className="space-y-14">
      <p className="text-[13px] text-taupe-ink">Saved on this device only. Prices shown are from when you saved; current prices appear when you open a composition.</p>
      <ul className="grid gap-x-6 gap-y-10 xs:grid-cols-2 lg:grid-cols-4">
        {designs.map((d) => (
          <li key={d.ref} className={cn("group", compare.includes(d.ref) && "outline outline-1 outline-offset-8 outline-espresso")}>
            <Link href={`/build?${d.query}`} className="block">
              <div className="relative aspect-[600/860] bg-cream">
                {/* eslint-disable-next-line @next/next/no-img-element -- server-rendered SVG */}
                <img src={`/api/render?${d.query}`} alt={`${d.name}, illustrative`} className="absolute inset-[4%] h-[92%] w-[92%]" loading="lazy" />
              </div>
              <p className="mt-3 text-[14px]">{d.name}</p>
              <p className="tabular text-[12px] tracking-[0.06em] text-taupe-ink">{d.ref} · {formatEGP(d.totalMinorAtSave)}</p>
            </Link>
            <div className="mt-2 flex gap-4 text-[12px]">
              <button type="button" className="underline underline-offset-4" aria-pressed={compare.includes(d.ref)} onClick={() => toggle(d.ref)}>
                {compare.includes(d.ref) ? "Comparing" : "Compare"}
              </button>
              <button type="button" className="text-taupe-ink underline underline-offset-4" onClick={() => remove(d.ref)}>Remove</button>
            </div>
          </li>
        ))}
      </ul>
      {chosen.length === 2 && (
        <section aria-label="Comparison" className="border-t border-line pt-10">
          <h2 className="display text-[2rem]">Side by side</h2>
          <div className="mt-6 grid grid-cols-2 gap-6">
            {chosen.map((d) => (
              <div key={d.ref}>
                <div className="relative mx-auto aspect-[600/860] max-w-[260px] bg-cream">
                  {/* eslint-disable-next-line @next/next/no-img-element -- server-rendered SVG */}
                  <img src={`/api/render?${d.query}`} alt="" className="absolute inset-0 h-full w-full" />
                </div>
                <p className="mt-3 text-center text-[14px]">{d.name}</p>
                <p className="tabular text-center text-[13px] text-taupe-ink">{formatEGP(d.totalMinorAtSave)}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
