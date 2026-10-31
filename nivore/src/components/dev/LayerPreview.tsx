"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { cn } from "@/lib/cn";

/**
 * Developer preview of the photo layers (public/parts). Stacks them in the
 * order from the brief and lets the alignment be checked against guides.
 * Not part of the storefront.
 */

export interface DialMeta {
  id: string;
  label: string;
  window: { x: number; y: number; w: number; h: number };
}
export interface StrapMeta {
  id: string;
  label: string;
}

const CANVAS = 1024;
const SPRING_BAR_TOP = 114;
const SPRING_BAR_BOTTOM = 908;
const SPEC_GAP: [number, number] = [322, 702];
// Strap ends tucked under the case: hidden by the case body, so the curved end links leave no gap.
const TUCK_GAP: [number, number] = [170, 854];

// 10:08:35
const SECONDS = 35;
const MINUTES = 8;
const HOURS = 10;
const ANGLES = {
  hour: ((HOURS % 12) + MINUTES / 60 + SECONDS / 3600) * 30,
  minute: (MINUTES + SECONDS / 60) * 6,
  second: SECONDS * 6,
};

const src = (name: string) => `/parts/${name}.webp`;
const fill: CSSProperties = { position: "absolute", inset: 0, width: "100%", height: "100%", userSelect: "none", pointerEvents: "none" };

export function LayerPreview({ dials, straps }: { dials: DialMeta[]; straps: StrapMeta[] }) {
  const [dialId, setDialId] = useState(dials[0].id);
  const [strapId, setStrapId] = useState(straps[0].id);
  const [guides, setGuides] = useState(false);
  const [placement, setPlacement] = useState<"spec" | "bars">("spec");
  const [order, setOrder] = useState<"spec" | "under">("spec");
  const [dark, setDark] = useState(false);
  const dial = dials.find((d) => d.id === dialId)!;

  const shift = useMemo(() => {
    if (placement === "spec") return { top: 0, bottom: 0 };
    return { top: TUCK_GAP[0] - SPEC_GAP[0], bottom: TUCK_GAP[1] - SPEC_GAP[1] };
  }, [placement]);

  const half = (which: "top" | "bottom", z: number) => (
    // eslint-disable-next-line @next/next/no-img-element -- dev preview of exact pixel layers
    <img
      src={src(strapId)}
      alt=""
      draggable={false}
      style={{
        ...fill,
        zIndex: z,
        clipPath: which === "top" ? "inset(0 0 50% 0)" : "inset(50% 0 0 0)",
        transform: `translateY(${(shift[which] / CANVAS) * 100}%)`,
      }}
    />
  );
  const layer = (name: string, z: number, extra: CSSProperties = {}) => (
    // eslint-disable-next-line @next/next/no-img-element -- dev preview of exact pixel layers
    <img src={src(name)} alt="" draggable={false} style={{ ...fill, zIndex: z, ...extra }} />
  );
  const pct = (v: number) => `${(v / CANVAS) * 100}%`;

  const w = dial.window;
  const stackOrder = order === "spec" ? { bottom: 1, top: 20 } : { bottom: 1, top: 2 };
  const base = order === "spec" ? 0 : 1;

  return (
    <div className="mx-auto grid max-w-[1400px] gap-8 px-5 py-8 lg:grid-cols-[minmax(0,640px)_1fr]">
      <div>
        <div
          data-testid="stage"
          className={cn("relative mx-auto aspect-square w-full max-w-[640px] overflow-hidden", dark ? "bg-espresso" : "bg-cream")}
          style={{ containerType: "inline-size" }}
        >
          {/* 1. bracelet / strap, bottom half */}
          {half("bottom", stackOrder.bottom)}
          {/* under-case mode draws the top half here too */}
          {order === "under" && half("top", stackOrder.top)}
          {/* 2. case */}
          {layer("case_C01", 3 + base)}
          {/* 3. date wheel (drawn in code): backing disc + white square with "16", under the dial */}
          <svg viewBox={`0 0 ${CANVAS} ${CANVAS}`} style={{ ...fill, zIndex: 4 + base }} aria-hidden="true">
            <rect x={w.x - 3} y={w.y - 3} width={w.w + 6} height={w.h + 6} fill="#f6f4ef" />
            <text x={w.x + w.w / 2} y={w.y + w.h / 2} textAnchor="middle" dominantBaseline="central" fontFamily="var(--font-inter), Inter, sans-serif" fontWeight={600} fontSize={w.h * 0.78} fill="#141312">
              16
            </text>
          </svg>
          {/* 4. dial */}
          {layer(dialId, 5 + base)}
          {/* 5. chapter ring */}
          {layer("ring_R01", 6 + base)}
          {/* 6. hands at 10:08:35, rotating about the canvas centre (the pivot) */}
          {layer("hands_H01_hour", 7 + base, { transform: `rotate(${ANGLES.hour}deg)` })}
          {layer("hands_H01_minute", 8 + base, { transform: `rotate(${ANGLES.minute}deg)` })}
          {layer("hands_H01_second", 9 + base, { transform: `rotate(${ANGLES.second}deg)` })}
          {/* 7. bezel + insert */}
          {layer("insert_B01", 10 + base)}
          {/* 8. bracelet / strap, top half (as specified: above everything) */}
          {order === "spec" && half("top", stackOrder.top)}

          {guides && (
            <svg viewBox={`0 0 ${CANVAS} ${CANVAS}`} style={{ ...fill, zIndex: 40 }} aria-hidden="true">
              <g fill="none" strokeWidth="1.5">
                <circle cx="512" cy="512" r={556 / 2} stroke="#e0245e" />
                <circle cx="512" cy="512" r={595 / 2} stroke="#1f8a4c" />
                <circle cx="512" cy="512" r={605 / 2} stroke="#2a62d9" />
                <circle cx="512" cy="512" r={819 / 2} stroke="#c47f00" />
                <line x1="0" y1="512" x2="1024" y2="512" stroke="#e0245e" strokeOpacity="0.5" strokeDasharray="6 6" />
                <line x1="512" y1="0" x2="512" y2="1024" stroke="#e0245e" strokeOpacity="0.5" strokeDasharray="6 6" />
                <line x1="0" y1={SPEC_GAP[0]} x2="1024" y2={SPEC_GAP[0]} stroke="#7a2fd0" strokeDasharray="10 6" />
                <line x1="0" y1={SPEC_GAP[1]} x2="1024" y2={SPEC_GAP[1]} stroke="#7a2fd0" strokeDasharray="10 6" />
                <line x1="0" y1={SPRING_BAR_TOP} x2="1024" y2={SPRING_BAR_TOP} stroke="#0a8" strokeDasharray="3 5" />
                <line x1="0" y1={SPRING_BAR_BOTTOM} x2="1024" y2={SPRING_BAR_BOTTOM} stroke="#0a8" strokeDasharray="3 5" />
                <line x1="0" y1={TUCK_GAP[0]} x2="1024" y2={TUCK_GAP[0]} stroke="#d0307a" strokeDasharray="2 4" />
                <line x1="0" y1={TUCK_GAP[1]} x2="1024" y2={TUCK_GAP[1]} stroke="#d0307a" strokeDasharray="2 4" />
              </g>
            </svg>
          )}
        </div>
        <p className="mt-3 text-center text-[11px] uppercase tracking-[0.16em] text-taupe-ink">Illustrative rendering · 10:08:35</p>
      </div>

      <div className="space-y-8">
        <section>
          <h2 className="eyebrow mb-3">Dial</h2>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Dial">
            {dials.map((d) => (
              <button key={d.id} type="button" className="chip" aria-pressed={d.id === dialId} onClick={() => setDialId(d.id)} data-testid={`dial-${d.id}`}>
                {d.label}
              </button>
            ))}
          </div>
        </section>
        <section>
          <h2 className="eyebrow mb-3">Strap / bracelet</h2>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Strap">
            {straps.map((s) => (
              <button key={s.id} type="button" className="chip" aria-pressed={s.id === strapId} onClick={() => setStrapId(s.id)} data-testid={`strap-${s.id}`}>
                {s.label}
              </button>
            ))}
          </div>
        </section>
        <section className="space-y-3">
          <h2 className="eyebrow">Strap placement (comparison)</h2>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Strap placement">
            <button type="button" className="chip" aria-pressed={placement === "spec"} onClick={() => setPlacement("spec")} data-testid="placement-spec">
              As specified · gap y 322–702
            </button>
            <button type="button" className="chip" aria-pressed={placement === "bars"} onClick={() => setPlacement("bars")} data-testid="placement-bars">
              Tucked under the case · gap y 170–854
            </button>
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Strap order">
            <button type="button" className="chip" aria-pressed={order === "spec"} onClick={() => setOrder("spec")} data-testid="order-spec">
              Top half above everything (as specified)
            </button>
            <button type="button" className="chip" aria-pressed={order === "under"} onClick={() => setOrder("under")} data-testid="order-under">
              Both halves under the case
            </button>
          </div>
        </section>
        <section className="flex flex-wrap gap-6 text-[14px]">
          <label className="flex items-center gap-2">
            <input type="checkbox" className="h-4 w-4 accent-[var(--color-espresso)]" checked={guides} onChange={(e) => setGuides(e.target.checked)} data-testid="guides" /> Alignment guides
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" className="h-4 w-4 accent-[var(--color-espresso)]" checked={dark} onChange={(e) => setDark(e.target.checked)} /> Dark backdrop
          </label>
        </section>
        {guides && (
          <ul className="space-y-1 text-[12.5px] text-taupe-ink">
            <li><span className="font-medium" style={{ color: "#e0245e" }}>Pink</span> dial 556 px · centre cross-hair</li>
            <li><span className="font-medium" style={{ color: "#1f8a4c" }}>Green</span> chapter ring outer 595 px</li>
            <li><span className="font-medium" style={{ color: "#2a62d9" }}>Blue</span> bezel opening 605 px</li>
            <li><span className="font-medium" style={{ color: "#c47f00" }}>Amber</span> case / bezel outer 819 px</li>
            <li><span className="font-medium" style={{ color: "#7a2fd0" }}>Purple</span> strap gap as specified (y 322 and 702)</li>
            <li><span className="font-medium" style={{ color: "#0a8" }}>Teal</span> spring bars in the case image (y ≈ 114 and 908)</li>
            <li><span className="font-medium" style={{ color: "#d0307a" }}>Magenta</span> strap ends tucked under the case (y 170 and 854)</li>
          </ul>
        )}
      </div>
    </div>
  );
}
