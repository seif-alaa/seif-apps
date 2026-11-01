"use client";

import { memo, useEffect, useRef, useState, type CSSProperties } from "react";
import { DEFAULT_TIME, handAngles, partSrc, type Layers } from "@/lib/parts";
import { BRACELET_FADE, CASE_SHADOW, FILL, GLARE } from "./stack";

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
    <img key={src} src={partSrc(src)} alt="" width={1024} height={1024} draggable={false} decoding="async" className={fade ? "layer-fade" : undefined} style={{ ...FILL, ...style }} />
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

  return (
    <div className="relative h-full w-full" style={{ containerType: "size" }} role="img" aria-label={label}>
      <div
        className="absolute left-1/2 top-1/2"
        style={{ width: "min(100cqw, 100cqh)", aspectRatio: "1", transform: `translate(-50%, -50%) scale(${camera})`, transition: "transform 700ms var(--ease-settle)" }}
      >
        <FadeLayer id={layers.bracelet} style={BRACELET_FADE} />
        <FadeLayer id={layers.case} style={{ filter: CASE_SHADOW }} />
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
