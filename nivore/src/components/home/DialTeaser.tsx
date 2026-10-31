"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";

/**
 * Homepage teaser of the builder. The variants are rendered on the server;
 * this component only switches between them, so it costs almost no JS.
 */
export function DialTeaser({ variants }: { variants: { id: string; label: string; swatch: string; node: ReactNode; query: string }[] }) {
  const [active, setActive] = useState(0);
  return (
    <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_1fr]">
      <div className="relative mx-auto aspect-[600/860] w-full max-w-[380px]">
        {variants.map((v, i) => (
          <div key={v.id} className="absolute inset-0 transition-opacity duration-500" style={{ opacity: i === active ? 1 : 0 }} aria-hidden={i !== active}>
            {v.node}
          </div>
        ))}
      </div>
      <div>
        <p className="eyebrow">Build your watch</p>
        <h2 className="display mt-3 text-[2.5rem] md:text-[3.5rem]">Change one detail. Watch the whole piece answer.</h2>
        <p className="mt-5 max-w-md text-[15px] leading-relaxed text-taupe-ink">
          Choose a movement, then a dial, case, hands, bezel and strap. Every part is drawn to its recorded size, and only parts that fit together are offered.
        </p>
        <div className="mt-7" role="group" aria-label="Try a dial">
          <p className="eyebrow mb-3">Try a dial</p>
          <div className="flex flex-wrap gap-3">
            {variants.map((v, i) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setActive(i)}
                aria-pressed={i === active}
                aria-label={v.label}
                className="group flex flex-col items-center gap-2"
              >
                <span
                  className="block h-11 w-11 rounded-full border transition-[box-shadow] duration-300"
                  style={{ background: v.swatch, borderColor: "rgba(58,50,46,0.15)", boxShadow: i === active ? "0 0 0 2px var(--color-ivory), 0 0 0 3px var(--color-espresso)" : undefined }}
                />
                <span className="text-[11px] text-taupe-ink">{v.label}</span>
              </button>
            ))}
          </div>
        </div>
        <Link href={`/build?${variants[active]?.query ?? ""}`} className="btn btn-primary mt-9">
          Continue in the builder
        </Link>
      </div>
    </div>
  );
}
