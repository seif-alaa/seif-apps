"use client";

import { memo, useEffect, useRef, useState, type CSSProperties } from "react";
import { DEFAULT_TIME, handAngles, partSrc, type Layers } from "@/lib/parts";
import { BRACELET_ASPECT, FILL, GLARE, strapFade } from "./stack";

/** Soft shadow under the case, sized from the watch box (not the taller stage). */
const STAGE_SHADOW = "drop-shadow(0 calc(var(--box) * 0.042) calc(var(--box) * 0.056) rgba(0, 0, 0, 0.28))";

/** Swaps a layer's image with a 150 ms crossfade: the old image stays underneath until the new one has faded in. */
const FadeLayer = memo(function FadeLayer({ id, style }: { id: string | null; style?: CSSProperties }) {
  const [shown, setShown] = useState(id);
  const [prev, setPrev] = useState<string | null>(null);
  if (id !== shown) {
    setPrev(shown);
    setShown(id);
  }
  useEffect(() => {
    if (!prev) return;
    const t = setTimeout(() => setPrev(null), 170);
    return () => clearTimeout(t);
  }, [prev]);
  const img = (src: string, fade: boolean) => (
    <img key={src} src={partSrc(src)} alt="" width={1024} height={src.includes("bracelet_") || src.includes("strap_") ? 2560 : 1024} draggable={false} decoding="async" className={fade ? "layer-fade" : undefined} style={{ ...FILL, ...style }} />
  );
  return (
    <>
      {prev && img(prev, false)}
      {shown && img(shown, true)}
    </>
  );
});

type HandKey = "hour" | "minute" | "gmt" | "second";

/**
 * The live preview: every part is a square <img> stacked on one box, in the manifest layer order.
 * Hands rotate with CSS transforms about the centre. Default time 10:08:35, or live with a
 * 6-beats-per-second seconds hand (one tick per second under reduced motion).
 */
export function Stage({ layers, camera, live, label }: { layers: Layers; camera: number; live: boolean; label: string }) {
  const refs: Record<HandKey, React.RefObject<HTMLDivElement | null>> = { hour: useRef(null), minute: useRef(null), gmt: useRef(null), second: useRef(null) };

  useEffect(() => {
    const apply = (a: Record<HandKey, number>) => {
      for (const k of Object.keys(refs) as HandKey[]) if (refs[k].current) refs[k].current!.style.transform = `rotate(${a[k]}deg)`;
    };
    if (!live) {
      apply(handAngles(DEFAULT_TIME.h, DEFAULT_TIME.m, DEFAULT_TIME.s));
      return;
    }
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let last = "";
    const loop = () => {
      const d = new Date();
      const secs = d.getSeconds() + (reduce ? 0 : Math.floor(d.getMilliseconds() / (1000 / 6)) / 6);
      const a = handAngles(d.getHours(), d.getMinutes(), secs);
      const key = `${a.second}|${Math.floor(a.minute * 10)}`;
      if (key !== last) {
        last = key;
        apply(a);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refs are stable; re-run when a hand wrapper appears
  }, [live, layers.hour, layers.minute, layers.second, layers.gmt]);

  const d = handAngles(DEFAULT_TIME.h, DEFAULT_TIME.m, DEFAULT_TIME.s);
  const hand = (k: HandKey, id: string | null) =>
    id ? (
      <div ref={refs[k]} style={{ ...FILL, transformOrigin: "50% 50%", transform: `rotate(${d[k]}deg)` }}>
        <FadeLayer id={id} />
      </div>
    ) : null;

  const strap = layers.bracelet
    ? {
        inset: "auto",
        left: "50%",
        top: "50%",
        width: "var(--box)",
        height: `calc(var(--box) * ${BRACELET_ASPECT})`,
        transform: `translate(-50%, -50%) scale(${camera * (layers.braceletScale ?? 1)})`,
        transition: "transform 700ms var(--ease-settle)",
      }
    : undefined;

  return (
    <div className="stage relative h-full w-full overflow-hidden" style={{ containerType: "size" }} role="img" aria-label={label}>
      {/* The strap is a tall image centred on the watch box; it runs above and below the box and fades at the stage ends. */}
      <div className="absolute inset-0 overflow-hidden" style={strapFade(15)}>
        <FadeLayer id={layers.bracelet} style={strap} />
      </div>
      <div
        className="absolute left-1/2 top-1/2"
        style={{ width: "var(--box)", aspectRatio: "1", transform: `translate(-50%, -50%) scale(${camera})`, transition: "transform 700ms var(--ease-settle)" }}
      >
        <FadeLayer id={layers.case} style={{ filter: STAGE_SHADOW }} />
        <FadeLayer id={layers.dial} />
        <FadeLayer id={layers.ring} />
        {hand("hour", layers.hour)}
        {hand("minute", layers.minute)}
        {hand("gmt", layers.gmt)}
        {hand("second", layers.second)}
        <div style={GLARE} aria-hidden="true" />
        <FadeLayer id={layers.bezel} />
      </div>
      <p className="pointer-events-none absolute bottom-1 left-5 text-[10px] uppercase tracking-[0.16em] text-taupe-ink/80 md:bottom-2 md:left-0 md:right-0 md:text-center">Illustrative rendering</p>
    </div>
  );
}
