import type { ReactNode } from "react";
import type { PreviewAsset } from "@/domain/catalog";
import { CANVAS_H, CANVAS_W, caseGeometry, CX, CY, HOUR_ANGLE, MINUTE_ANGLE, PX_PER_MM, type ResolvedBuild } from "./geometry";
import {
  BandFront,
  BezelFront,
  CaseFront,
  CasebackRear,
  ChapterRingFront,
  CrystalFront,
  DialFront,
  HandsFront,
  InsertFront,
  SecondsHand,
  Shadow,
} from "./parts";

export type View = "front" | "rear";
export type LayerSlot = "shadow" | "band" | "case" | "bezel" | "insert" | "chapterRing" | "dial" | "hands" | "seconds" | "crystal" | "caseback";
export type Enter = "fade" | "rise" | "scale" | "settle";

export interface Layer {
  slot: LayerSlot;
  /** Changes whenever this layer's appearance changes; drives the crossfade. */
  key: string;
  z: number;
  enter: Enter;
  /** Procedural SVG content (in canvas units). */
  svg?: (uid: string) => ReactNode;
  /** Photographic asset(s) replacing the procedural drawing. */
  assets?: PlacedAsset[];
}

export interface PlacedAsset {
  asset: PreviewAsset;
  /** Canvas-unit placement. */
  left: number;
  top: number;
  width: number;
  height: number;
  rotate: number;
  originX: number;
  originY: number;
}

/** Position a raster asset by its physical scale and anchor. */
export function placeAsset(asset: PreviewAsset, anchorX: number, anchorY: number, extraRotate = 0): PlacedAsset {
  const scale = PX_PER_MM / asset.pxPerMm;
  const width = asset.widthPx * scale;
  const height = asset.heightPx * scale;
  const left = anchorX - asset.anchorX * scale;
  const top = anchorY - asset.anchorY * scale;
  return { asset, left, top, width, height, rotate: asset.rotationDeg + extraRotate, originX: asset.anchorX * scale, originY: asset.anchorY * scale };
}

function findAsset(assets: readonly PreviewAsset[], componentId: string | undefined, view: View, slot: PreviewAsset["slot"]) {
  if (!componentId) return undefined;
  return assets.find((a) => a.componentId === componentId && a.view === view && a.slot === slot);
}

/**
 * Build the ordered layer list for a configuration. Each layer re-keys only
 * when the parts it depends on change, so swapping hands crossfades only the
 * hands, while swapping the case re-draws everything that depends on its geometry.
 */
export function buildLayers(b: ResolvedBuild, view: View, assets: readonly PreviewAsset[], opts: { engravingGuide?: boolean } = {}): Layer[] {
  const k = b.case?.id ?? "none";
  const g = caseGeometry(b.case);
  const layers: Layer[] = [];
  const bar = g.L - 26;

  layers.push({ slot: "shadow", key: `sh:${k}`, z: 0, enter: "fade", svg: (u) => <Shadow b={b} u={u} /> });

  const bandTop = findAsset(assets, b.band?.id, view, "band-top");
  const bandBottom = findAsset(assets, b.band?.id, view, "band-bottom");
  layers.push({
    slot: "band",
    key: `band:${b.band?.id}:${k}:${view}`,
    z: 1,
    enter: "rise",
    ...(bandTop && bandBottom
      ? { assets: [placeAsset(bandTop, CX, CY - bar), placeAsset(bandBottom, CX, CY + bar)] }
      : { svg: (u: string) => <BandFront b={b} u={u} rear={view === "rear"} /> }),
  });

  const caseAsset = findAsset(assets, b.case?.id, view, "case");
  layers.push({
    slot: "case",
    key: `case:${k}:${view}`,
    z: 2,
    enter: "scale",
    ...(caseAsset ? { assets: [placeAsset(caseAsset, CX, CY)] } : { svg: (u: string) => <CaseFront b={b} u={u} rear={view === "rear"} /> }),
  });

  if (view === "rear") {
    const cbAsset = findAsset(assets, b.caseback?.id, "rear", "caseback");
    layers.push({
      slot: "caseback",
      key: `cb:${b.caseback?.id}:${k}:${b.engraving?.style}:${b.engraving?.text ?? ""}:${opts.engravingGuide ? 1 : 0}`,
      z: 3,
      enter: "fade",
      ...(cbAsset && !b.engraving?.text
        ? { assets: [placeAsset(cbAsset, CX, CY)] }
        : { svg: (u: string) => <CasebackRear b={b} u={u} showEngravingGuide={opts.engravingGuide} /> }),
    });
    return layers;
  }

  const simple = (slot: LayerSlot, assetSlot: PreviewAsset["slot"], id: string | undefined, z: number, enter: Enter, keyExtra: string, svg: (u: string) => ReactNode) => {
    if (!id) return;
    const a = findAsset(assets, id, "front", assetSlot);
    layers.push({ slot, key: `${slot}:${id}:${keyExtra}`, z, enter, ...(a ? { assets: [placeAsset(a, CX, CY)] } : { svg }) });
  };

  simple("bezel", "bezel", b.bezel?.id, 3, "settle", k, (u) => <BezelFront b={b} u={u} />);
  simple("insert", "insert", b.insert?.id, 4, "fade", k, (u) => <InsertFront b={b} u={u} />);
  simple("chapterRing", "chapterRing", b.chapterRing?.id, 5, "fade", k, (u) => <ChapterRingFront b={b} u={u} />);
  simple("dial", "dial", b.dial?.id, 6, "settle", `${b.movement?.spec.dateWheel}`, (u) => <DialFront b={b} u={u} />);

  if (b.hands) {
    const hour = findAsset(assets, b.hands.id, "front", "hand-hour");
    const minute = findAsset(assets, b.hands.id, "front", "hand-minute");
    layers.push({
      slot: "hands",
      key: `hands:${b.hands.id}:${b.dial?.spec.diameterMm}`,
      z: 7,
      enter: "fade",
      ...(hour && minute
        ? { assets: [placeAsset(hour, CX, CY, HOUR_ANGLE), placeAsset(minute, CX, CY, MINUTE_ANGLE)] }
        : { svg: (u: string) => <HandsFront b={b} u={u} /> }),
    });
    const sec = findAsset(assets, b.hands.id, "front", "hand-seconds");
    layers.push({
      slot: "seconds",
      key: `sec:${b.hands.id}:${b.dial?.spec.diameterMm}`,
      z: 8,
      enter: "fade",
      ...(sec ? { assets: [placeAsset(sec, CX, CY)] } : { svg: () => <SecondsHand b={b} /> }),
    });
  }

  simple("crystal", "crystal", b.crystal?.id, 9, "fade", `${k}:${b.dial?.id}:${b.movement?.spec.dateWheel}`, (u) => <CrystalFront b={b} u={u} />);
  return layers;
}

/** True when every visible layer is drawn procedurally or partly so (for the "illustrative" label). */
export function isIllustrative(layers: Layer[]): boolean {
  return layers.some((l) => l.slot !== "shadow" && l.svg);
}

/** Single-SVG rendering of a watch (server-renderable, no JS). Raster assets are embedded as <image>. */
export function StaticWatch({ layers, idPrefix, title, className }: { layers: Layer[]; idPrefix: string; title?: string; className?: string }) {
  return (
    <svg viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`} className={className} role="img" aria-label={title} xmlns="http://www.w3.org/2000/svg">
      {title && <title>{title}</title>}
      {layers.map((l) => (
        <g key={l.slot} transform={l.slot === "seconds" ? `rotate(216 ${CX} ${CY})` : undefined}>
          {l.svg
            ? l.svg(`${idPrefix}-${l.slot}-`)
            : l.assets?.map((p) => (
                <image
                  key={p.asset.id}
                  href={p.asset.src}
                  x={p.left}
                  y={p.top}
                  width={p.width}
                  height={p.height}
                  opacity={p.asset.opacity}
                  transform={p.rotate ? `rotate(${p.rotate} ${p.left + p.originX} ${p.top + p.originY})` : undefined}
                />
              ))}
        </g>
      ))}
    </svg>
  );
}
