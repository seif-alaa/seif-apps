"use client";

import { memo, useEffect, useState, type ReactNode } from "react";
import type { PreviewAsset } from "@/domain/catalog";
import { CX, CY, type ResolvedBuild } from "@/components/watch/geometry";
import { buildLayers, type LayerSlot, type View } from "@/components/watch/layers";

/**
 * Option thumbnails drawn with the same renderer as the main preview, using
 * the customer's current build: hands appear on their chosen dial, cases at
 * true relative size, straps in the right width.
 */

export type ThumbKind = "dial" | "hands" | "case" | "bezel" | "insert" | "chapterRing" | "crystal" | "band" | "caseback";

const CROPS: Record<ThumbKind, { box: [number, number, number, number]; slots: LayerSlot[]; view: View }> = {
  dial: { box: [CX - 152, CY - 152, 304, 304], slots: ["dial"], view: "front" },
  hands: { box: [CX - 152, CY - 152, 304, 304], slots: ["dial", "hands", "seconds"], view: "front" },
  case: { box: [CX - 268, CY - 268, 536, 536], slots: ["shadow", "case", "bezel", "insert", "chapterRing", "dial"], view: "front" },
  // Bezel and insert thumbnails omit the dial: it adds cost without helping the choice.
  bezel: { box: [CX - 212, CY - 212, 424, 424], slots: ["case", "bezel", "insert"], view: "front" },
  insert: { box: [CX - 200, CY - 200, 400, 400], slots: ["bezel", "insert"], view: "front" },
  chapterRing: { box: [CX - 168, CY - 168, 336, 336], slots: ["chapterRing", "dial"], view: "front" },
  crystal: { box: [CX - 168, CY - 168, 336, 336], slots: ["chapterRing", "dial", "hands", "crystal"], view: "front" },
  band: { box: [CX - 125, 30, 250, 250], slots: ["band"], view: "front" },
  caseback: { box: [CX - 240, CY - 240, 480, 480], slots: ["case", "caseback"], view: "rear" },
};

export const PartThumb = memo(function PartThumb({ build, kind, assets, uid }: { build: ResolvedBuild; kind: ThumbKind; assets: readonly PreviewAsset[]; uid: string }) {
  const crop = CROPS[kind];
  const layers = buildLayers(build, crop.view, assets).filter((l) => crop.slots.includes(l.slot));
  return (
    <svg viewBox={crop.box.join(" ")} className="absolute inset-0 h-full w-full" aria-hidden="true">
      {layers.map((l) => (
        <g key={l.slot} transform={l.slot === "seconds" ? `rotate(216 ${CX} ${CY})` : undefined}>
          {l.svg
            ? l.svg(`t${uid}${l.slot}`)
            : l.assets?.map((p) => (
                <image
                  key={p.asset.id}
                  href={p.asset.src}
                  x={p.left}
                  y={p.top}
                  width={p.width}
                  height={p.height}
                  transform={p.rotate ? `rotate(${p.rotate} ${p.left + p.originX} ${p.top + p.originY})` : undefined}
                />
              ))}
        </g>
      ))}
    </svg>
  );
});

/**
 * Progressive mounting: thumbnails show a light swatch first and mount their
 * SVG a few at a time in idle periods, so opening a step never produces one
 * long commit that would delay the customer's next tap.
 */
const queue: (() => void)[] = [];
let scheduled = false;
const idle: (cb: (d: { timeRemaining(): number }) => void) => void =
  typeof window !== "undefined" && "requestIdleCallback" in window
    ? (cb) => window.requestIdleCallback(cb, { timeout: 120 })
    : (cb) => setTimeout(() => cb({ timeRemaining: () => 8 }), 16);

function pump() {
  scheduled = true;
  idle((deadline) => {
    let n = 0;
    while (queue.length && (n < 2 || deadline.timeRemaining() > 6) && n < 4) {
      queue.shift()!();
      n++;
    }
    if (queue.length) pump();
    else scheduled = false;
  });
}

export function LazyThumb({ children, swatch }: { children: ReactNode; swatch?: string }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    queue.push(() => alive && setReady(true));
    if (!scheduled) pump();
    return () => {
      alive = false;
    };
  }, []);
  if (ready) return <>{children}</>;
  return (
    <span className="absolute inset-0 grid place-items-center" aria-hidden="true">
      {swatch && <span className="h-[62%] w-[62%] rounded-full opacity-80" style={{ background: swatch }} />}
    </span>
  );
}

/** Complication diagram for movement cards: a tiny dial showing what the movement displays. */
export function ComplicationGlyph({ complications }: { complications: readonly string[] }) {
  const date = complications.includes("date");
  const day = complications.includes("day");
  const gmt = complications.includes("gmt");
  return (
    <svg viewBox="0 0 64 64" className="h-full w-full" aria-hidden="true">
      <circle cx="32" cy="32" r="27" fill="var(--color-ivory)" stroke="var(--color-taupe)" strokeWidth="1" />
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i * 30 * Math.PI) / 180;
        const r2 = (n: number) => Math.round(n * 100) / 100;
        return <line key={i} x1={r2(32 + Math.sin(a) * 22)} y1={r2(32 - Math.cos(a) * 22)} x2={r2(32 + Math.sin(a) * 25)} y2={r2(32 - Math.cos(a) * 25)} stroke="var(--color-taupe)" strokeWidth={i % 3 === 0 ? 1.4 : 0.8} />;
      })}
      {date && !day && <rect x="40" y="28.5" width="9" height="7" fill="none" stroke="var(--color-espresso)" strokeWidth="1" />}
      {day && <rect x="33" y="28.5" width="16" height="7" fill="none" stroke="var(--color-espresso)" strokeWidth="1" />}
      <line x1="32" y1="32" x2="22" y2="24" stroke="var(--color-espresso)" strokeWidth="2" strokeLinecap="round" />
      <line x1="32" y1="32" x2="40" y2="12" stroke="var(--color-espresso)" strokeWidth="1.4" strokeLinecap="round" />
      {gmt && (
        <g>
          <line x1="32" y1="32" x2="14" y2="42" stroke="var(--color-champagne)" strokeWidth="1.2" />
          <path d="M12,43 L16.5,38.5 L17.5,44 Z" fill="var(--color-champagne)" />
        </g>
      )}
      <circle cx="32" cy="32" r="1.8" fill="var(--color-espresso)" />
    </svg>
  );
}
