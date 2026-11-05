import { TRUST_CLAIMS } from "@/config/site";

/** Four short claims under the hero. The wording lives in src/config/site.ts. */
export function TrustStrip() {
  return (
    <section aria-label="Why order from NIVORÉ" className="border-y border-line bg-cream/60">
      <ul className="mx-auto grid max-w-[1440px] grid-cols-2 gap-x-6 gap-y-3 px-5 py-4 text-center text-[11px] uppercase tracking-[0.14em] text-espresso md:flex md:items-center md:justify-between md:px-10 md:text-[11.5px]">
        {TRUST_CLAIMS.map((c) => (
          <li key={c} className="flex items-center justify-center gap-2">
            <span aria-hidden="true" className="h-1 w-1 shrink-0 rounded-full bg-taupe" />
            {c}
          </li>
        ))}
      </ul>
    </section>
  );
}
