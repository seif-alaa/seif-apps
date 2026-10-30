"use client";

import { memo, useEffect, useId, useMemo, useRef, useState, type CSSProperties } from "react";
import type { PreviewAsset } from "@/domain/catalog";
import { CANVAS_H, CANVAS_W, type ResolvedBuild } from "./geometry";
import { buildLayers, isIllustrative, type Enter, type Layer, type LayerSlot, type View } from "./layers";

/**
 * The live preview. Every part is its own absolutely positioned layer, so a
 * change animates only that part: an opacity/transform crossfade that the
 * browser composites on the GPU. Layers are only promoted while animating
 * (no permanent will-change), which keeps memory low on phones.
 */

const SLOTS: LayerSlot[] = ["shadow", "band", "case", "caseback", "bezel", "insert", "chapterRing", "dial", "hands", "seconds", "crystal"];

const ENTER_VARS: Record<Enter, CSSProperties> = {
  fade: {},
  rise: { ["--ly" as string]: "2.2%" },
  scale: { ["--ls" as string]: "0.955" },
  settle: { ["--ls" as string]: "1.018" },
};

interface Item {
  layer: Layer;
  phase: "idle" | "in" | "out";
  n: number;
}

/**
 * A layer's key fully determines its appearance, so its SVG/raster tree is
 * rendered once and skipped on every later re-render (keeps interactions fast).
 */
const LayerContent = memo(
  function LayerContent({ layer: l, uid }: { layer: Layer; uid: string }) {
    if (l.svg) {
      return (
        <svg viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`} className="absolute inset-0 h-full w-full" aria-hidden="true" data-layer={l.slot}>
          {l.svg(uid)}
        </svg>
      );
    }
    return (
      <>
        {l.assets?.map((p) => (
          // eslint-disable-next-line @next/next/no-img-element -- positioned layer with physical alignment; already optimised at upload
          <img
            key={p.asset.id}
            src={p.asset.src}
            alt=""
            decoding="async"
            draggable={false}
            className="absolute max-w-none select-none"
            style={{
              left: `${(p.left / CANVAS_W) * 100}%`,
              top: `${(p.top / CANVAS_H) * 100}%`,
              width: `${(p.width / CANVAS_W) * 100}%`,
              height: `${(p.height / CANVAS_H) * 100}%`,
              opacity: p.asset.opacity,
              transform: p.rotate ? `rotate(${p.rotate}deg)` : undefined,
              transformOrigin: `${p.originX}px ${p.originY}px`,
            }}
          />
        ))}
      </>
    );
  },
  (a, b) => a.layer.key === b.layer.key && a.uid === b.uid,
);

const SlotLayer = memo(function SlotLayer({ layer, stageId, instant, sweepFrom }: { layer: Layer | undefined; stageId: string; instant: boolean; sweepFrom: number | null }) {
  const [items, setItems] = useState<Item[]>(() => (layer ? [{ layer, phase: "idle", n: 0 }] : []));
  const counter = useRef(1);
  const last = items[items.length - 1];

  // Derive new state during render when the layer's key changes (React-sanctioned pattern).
  if ((layer?.key ?? null) !== (last && last.phase !== "out" ? last.layer.key : null)) {
    const n = counter.current++;
    if (instant || !last) setItems(layer ? [{ layer, phase: "idle", n }] : []);
    else {
      const keep = items.filter((i) => i.phase !== "out").slice(-1).map((i) => ({ ...i, phase: "out" as const }));
      setItems(layer ? [...keep, { layer, phase: "in", n }] : keep);
    }
  }

  useEffect(() => {
    if (!items.some((i) => i.phase === "out")) return;
    const t = setTimeout(() => setItems((cur) => cur.filter((i) => i.phase !== "out")), 520);
    return () => clearTimeout(t);
  }, [items]);

  return (
    <>
      {items.map((item) => {
        const { layer: l, phase, n } = item;
        const style: CSSProperties = {
          zIndex: l.z * 2 + (phase === "out" ? 0 : 1),
          ...(phase === "in" ? { ...ENTER_VARS[l.enter], animation: "layer-in 440ms var(--ease-settle) both" } : null),
          ...(phase === "out" ? { animation: "layer-out 320ms var(--ease-atelier) both", pointerEvents: "none" } : null),
        };
        const content = <LayerContent layer={l} uid={`${stageId}${l.slot}${n}`} />;
        return (
          <div key={n} className="absolute inset-0" style={style}>
            {l.slot === "seconds" ? (
              <div
                className="absolute inset-0"
                style={
                  sweepFrom == null
                    ? { transform: "rotate(216deg)" }
                    : ({ ["--from" as string]: `${sweepFrom}deg`, animation: "sweep 60s steps(360, end) infinite" } as CSSProperties)
                }
              >
                {content}
              </div>
            ) : (
              content
            )}
          </div>
        );
      })}
    </>
  );
});

export interface StageProps {
  build: ResolvedBuild;
  assets: readonly PreviewAsset[];
  view?: View;
  camera?: { scale: number; y: number };
  engravingGuide?: boolean;
  sweep?: boolean;
  label?: string;
  className?: string;
  showBadge?: boolean;
}

export function WatchStage({ build, assets, view = "front", camera = { scale: 1, y: 0 }, engravingGuide, sweep = true, label, className, showBadge = true }: StageProps) {
  const stageId = useId().replace(/:/g, "");
  const [shown, setShown] = useState<View>(view);
  const [flip, setFlip] = useState<null | "out" | "in">(null);
  const [sweepFrom, setSweepFrom] = useState<number | null>(null);

  useEffect(() => {
    if (!sweep) return;
    const d = new Date();
    setSweepFrom((d.getSeconds() + Math.floor(d.getMilliseconds() / 166.67) / 6) * 6);
  }, [sweep]);

  useEffect(() => {
    if (view === shown) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setShown(view);
      return;
    }
    setFlip("out");
    const t1 = setTimeout(() => {
      setShown(view);
      setFlip("in");
    }, 230);
    const t2 = setTimeout(() => setFlip(null), 560);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [view, shown]);

  const layers = useMemo(() => buildLayers(build, shown, assets, { engravingGuide }), [build, shown, assets, engravingGuide]);
  const bySlot = useMemo(() => new Map(layers.map((l) => [l.slot, l])), [layers]);
  const illustrative = isIllustrative(layers);

  return (
    <div className={`relative h-full w-full ${className ?? ""}`} style={{ containerType: "size" }} role="img" aria-label={label}>
      <div
        className="absolute left-1/2 top-1/2"
        style={{
          width: `min(100cqw, calc(100cqh * ${CANVAS_W / CANVAS_H}))`,
          aspectRatio: `${CANVAS_W} / ${CANVAS_H}`,
          transform: `translate(-50%, -50%) scale(${camera.scale}) translateY(${camera.y}%)`,
          transition: "transform 760ms var(--ease-settle)",
          perspective: "1600px",
        }}
      >
        <div
          className="absolute inset-0"
          style={{
            transformStyle: "preserve-3d",
            animation: flip === "out" ? "flip-out 230ms var(--ease-atelier) both" : flip === "in" ? "flip-in 330ms var(--ease-settle) both" : undefined,
          }}
        >
          {SLOTS.map((slot) => (
            <SlotLayer key={slot} layer={bySlot.get(slot)} stageId={stageId} instant={flip !== null} sweepFrom={sweep ? sweepFrom : null} />
          ))}
        </div>
      </div>
      {showBadge && illustrative && (
        <p className="pointer-events-none absolute bottom-1 left-5 text-[10px] uppercase tracking-[0.16em] text-taupe-ink/80 md:bottom-2 md:left-0 md:right-0 md:text-center">
          Illustrative rendering<span className="hidden md:inline"> · drawn to recorded dimensions</span>
        </p>
      )}
    </div>
  );
}
