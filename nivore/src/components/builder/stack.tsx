import type { CSSProperties } from "react";
import { cn } from "@/lib/cn";
import { DEFAULT_TIME, handAngles, partSrc, type Layers } from "@/lib/parts";

/** Soft shadow under the case, glare over the dial: both CSS, shared by the builder and static thumbnails. */
export const CASE_SHADOW = "drop-shadow(0 1.4cqmin 2.2cqmin rgba(58, 50, 46, 0.30))";
export const GLARE: CSSProperties = {
  position: "absolute",
  left: "22.2%",
  top: "22.2%",
  width: "55.6%",
  height: "55.6%",
  borderRadius: "50%",
  pointerEvents: "none",
  background: "radial-gradient(ellipse 70% 55% at 30% 22%, rgba(255,255,255,0.30), rgba(255,255,255,0.08) 45%, rgba(255,255,255,0) 70%)",
};
/** The bracelet ends at the edge of the 1024 px canvas; fade it out instead of cutting it. */
export const BRACELET_FADE: CSSProperties = { maskImage: "linear-gradient(to bottom, transparent 0, #000 7%, #000 93%, transparent 100%)", WebkitMaskImage: "linear-gradient(to bottom, transparent 0, #000 7%, #000 93%, transparent 100%)" };
export const FILL: CSSProperties = { position: "absolute", inset: 0, width: "100%", height: "100%", maxWidth: "none", userSelect: "none" };

/**
 * Static stack of the photo layers (server-renderable): bracelet, case, dial,
 * chapter ring, hands at 10:08:35, glare, bezel. Used for bag, saved designs,
 * homepage and admin thumbnails. The interactive builder uses <Stage>.
 */
export function LayerStack({ layers, className, alt, priority = false }: { layers: Layers; className?: string; alt: string; priority?: boolean }) {
  const a = handAngles(DEFAULT_TIME.h, DEFAULT_TIME.m, DEFAULT_TIME.s);
  const img = (id: string | null, style?: CSSProperties) =>
    id ? <img src={partSrc(id)} alt="" width={1024} height={1024} draggable={false} loading={priority ? "eager" : "lazy"} decoding="async" style={{ ...FILL, ...style }} /> : null;
  const rot = (deg: number): CSSProperties => ({ transform: `rotate(${deg}deg)` });
  return (
    <div className={cn("relative aspect-square", className)} style={{ containerType: "size" }} role="img" aria-label={alt}>
      {img(layers.bracelet, BRACELET_FADE)}
      {img(layers.case, { filter: CASE_SHADOW })}
      {img(layers.dial)}
      {img(layers.ring)}
      {img(layers.hour, rot(a.hour))}
      {img(layers.minute, rot(a.minute))}
      {img(layers.gmt, rot(a.gmt))}
      {img(layers.second, rot(a.second))}
      <div style={GLARE} aria-hidden="true" />
      {img(layers.bezel)}
    </div>
  );
}
