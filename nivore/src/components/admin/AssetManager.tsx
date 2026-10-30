"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { deleteAsset, saveAsset } from "@/app/admin/actions";
import type { AssetSlot, ComponentType, PreviewAsset, PublicCatalog } from "@/domain/catalog";
import { createEngine } from "@/domain/compatibility";
import type { Configuration, Slot } from "@/domain/configuration";
import { resolveBuild } from "@/components/watch/geometry";
import { WatchStage } from "@/components/watch/WatchStage";
import { cn } from "@/lib/cn";
import { SaveBar, useSave } from "./SaveBar";
import { UploadButton } from "./Upload";

const SLOTS_FOR: Partial<Record<ComponentType, AssetSlot[]>> = {
  case: ["case"],
  bezel: ["bezel"],
  insert: ["insert"],
  chapterRing: ["chapterRing"],
  dial: ["dial"],
  hands: ["hand-hour", "hand-minute", "hand-seconds", "hand-gmt"],
  crystal: ["crystal"],
  band: ["band-top", "band-bottom"],
  caseback: ["caseback"],
};

const ANCHOR_HELP: Record<string, string> = {
  case: "Centre of the case (dial centre).",
  bezel: "Centre of the bezel.",
  insert: "Centre of the insert.",
  chapterRing: "Centre of the ring.",
  dial: "Centre of the dial (pinion hole).",
  "hand-hour": "Pinion hole. Draw the hand pointing to 12; the renderer rotates it.",
  "hand-minute": "Pinion hole, hand pointing to 12.",
  "hand-seconds": "Pinion hole, hand pointing to 12.",
  "hand-gmt": "Pinion hole, hand pointing to 12.",
  crystal: "Centre of the crystal.",
  "band-top": "Centre of the spring bar where it meets the case.",
  "band-bottom": "Centre of the spring bar where it meets the case.",
  caseback: "Centre of the caseback.",
};

const blank = (): Omit<PreviewAsset, "id" | "updatedAt"> & { id?: string } => ({
  componentId: "",
  view: "front",
  slot: "dial",
  src: "",
  widthPx: 0,
  heightPx: 0,
  pxPerMm: 20,
  anchorX: 0,
  anchorY: 0,
  rotationDeg: 0,
  opacity: 1,
  zOffset: 0,
  status: "draft",
  note: "",
});

export function AssetManager({ assets, catalog, sample }: { assets: PreviewAsset[]; catalog: PublicCatalog; sample: Configuration }) {
  const router = useRouter();
  const [a, setA] = useState<ReturnType<typeof blank>>(blank());
  const [knownMm, setKnownMm] = useState("");
  const { pending, msg, save } = useSave(async (v: typeof a) => {
    const r = await saveAsset(v);
    if (r.ok) router.refresh();
    return r;
  });
  const component = catalog.components.find((c) => c.id === a.componentId);
  const slots = component ? (SLOTS_FOR[component.type] ?? []) : [];

  const preview = useMemo(() => {
    const engine = createEngine(catalog);
    let cfg = engine.normalize(sample);
    if (component) cfg = engine.propose(cfg, component.type as Slot, component.id).next;
    const draft: PreviewAsset | null = a.src && component ? { ...(a as PreviewAsset), id: a.id ?? "draft", updatedAt: "" } : null;
    const list = [...assets.filter((x) => x.status === "published" && x.id !== a.id), ...(draft ? [draft] : [])];
    return { build: resolveBuild(cfg, engine.get, engine.family), list };
  }, [a, assets, catalog, component, sample]);

  return (
    <div className="space-y-10">
      <div className="grid gap-8 xl:grid-cols-[1.2fr_1fr]">
        <div className="space-y-6">
          <section className="grid gap-4 border border-line p-5 md:grid-cols-2">
            <h2 className="eyebrow md:col-span-2">{a.id ? "Edit asset" : "New preview layer"}</h2>
            <label className="block md:col-span-2">
              <span className="field-label">Component</span>
              <select className="field text-[14px]" value={a.componentId} onChange={(e) => {
                const c = catalog.components.find((x) => x.id === e.target.value);
                const s = c ? SLOTS_FOR[c.type]?.[0] : undefined;
                setA({ ...a, componentId: e.target.value, slot: s ?? a.slot, view: c?.type === "caseback" ? "rear" : "front" });
              }}>
                <option value="">Choose…</option>
                {catalog.components.filter((c) => SLOTS_FOR[c.type]).map((c) => <option key={c.id} value={c.id}>{c.type} · {c.name}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="field-label">Layer</span>
              <select className="field text-[14px]" value={a.slot} onChange={(e) => setA({ ...a, slot: e.target.value as AssetSlot })}>{slots.map((s) => <option key={s}>{s}</option>)}</select>
            </label>
            <label className="block">
              <span className="field-label">View</span>
              <select className="field text-[14px]" value={a.view} onChange={(e) => setA({ ...a, view: e.target.value as "front" | "rear" })}><option value="front">Front</option><option value="rear">Rear</option></select>
            </label>
            <div className="md:col-span-2">
              <UploadButton label={a.src ? "Replace image" : "Upload transparent PNG or WebP"} onUploaded={(u) => setA({ ...a, src: u.src, widthPx: u.width, heightPx: u.height, anchorX: Math.round(u.width / 2), anchorY: Math.round(u.height / 2) })} />
              <p className="mt-2 text-[12px] text-taupe-ink">Shoot or render straight-on, on a transparent background, at a known scale. Prefer WebP with alpha around 1500–2000 px.</p>
            </div>
          </section>

          {a.src && (
            <section className="border border-line p-5">
              <h2 className="eyebrow">Alignment</h2>
              <p className="mb-3 mt-1 text-[12.5px] text-taupe-ink">Click the image to set the anchor. {ANCHOR_HELP[a.slot]}</p>
              <div className="relative inline-block max-w-full cursor-crosshair bg-[repeating-conic-gradient(#e8e2d6_0_25%,#f7f4ee_0_50%)] [background-size:16px_16px]">
                {/* eslint-disable-next-line @next/next/no-img-element -- alignment canvas */}
                <img
                  src={a.src}
                  alt="Asset being aligned"
                  className="block max-h-[420px] max-w-full"
                  onClick={(e) => {
                    const r = e.currentTarget.getBoundingClientRect();
                    setA({ ...a, anchorX: Math.round(((e.clientX - r.left) / r.width) * a.widthPx), anchorY: Math.round(((e.clientY - r.top) / r.height) * a.heightPx) });
                  }}
                />
                <span className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-err" style={{ left: `${(a.anchorX / a.widthPx) * 100}%`, top: `${(a.anchorY / a.heightPx) * 100}%` }} />
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <label className="block"><span className="field-label">Anchor X (px)</span><input className="field tabular text-[14px]" value={a.anchorX} onChange={(e) => setA({ ...a, anchorX: Number(e.target.value) || 0 })} /></label>
                <label className="block"><span className="field-label">Anchor Y (px)</span><input className="field tabular text-[14px]" value={a.anchorY} onChange={(e) => setA({ ...a, anchorY: Number(e.target.value) || 0 })} /></label>
                <label className="block"><span className="field-label">Pixels per mm</span><input className="field tabular text-[14px]" value={a.pxPerMm} onChange={(e) => setA({ ...a, pxPerMm: Math.max(0.1, Number(e.target.value) || 1) })} /></label>
                <label className="block md:col-span-2"><span className="field-label">Or: the image spans this many mm across</span><input className="field tabular text-[14px]" value={knownMm} placeholder="e.g. 46" onChange={(e) => { setKnownMm(e.target.value); const mm = Number(e.target.value); if (mm > 0) setA({ ...a, pxPerMm: Math.round((a.widthPx / mm) * 100) / 100 }); }} /></label>
                <label className="block"><span className="field-label">Rotation (°)</span><input className="field tabular text-[14px]" value={a.rotationDeg} onChange={(e) => setA({ ...a, rotationDeg: Math.max(-180, Math.min(180, Number(e.target.value) || 0)) })} /></label>
                <label className="block"><span className="field-label">Opacity</span><input type="range" min={0} max={1} step={0.05} className="w-full" value={a.opacity} onChange={(e) => setA({ ...a, opacity: Number(e.target.value) })} /></label>
                <label className="block"><span className="field-label">Layer order offset</span><input className="field tabular text-[14px]" value={a.zOffset} onChange={(e) => setA({ ...a, zOffset: Math.max(-5, Math.min(5, Math.round(Number(e.target.value) || 0))) })} /></label>
                <label className="block">
                  <span className="field-label">Status</span>
                  <select className="field text-[14px]" value={a.status} onChange={(e) => setA({ ...a, status: e.target.value as PreviewAsset["status"] })}>
                    <option value="draft">Draft (admin only)</option><option value="validated">Validated (checked, not live)</option><option value="published">Published (live in the builder)</option>
                  </select>
                </label>
                <label className="block md:col-span-3"><span className="field-label">Note</span><input className="field text-[14px]" value={a.note} onChange={(e) => setA({ ...a, note: e.target.value })} /></label>
              </div>
            </section>
          )}
        </div>
        <aside className="space-y-3 xl:sticky xl:top-6 xl:self-start">
          <h2 className="eyebrow">Preview validation</h2>
          <div className="relative aspect-[600/860] bg-cream"><WatchStage build={preview.build} assets={preview.list} view={a.view} sweep={false} /></div>
          <p className="text-[12px] text-taupe-ink">The draft layer is shown in a sample build alongside published layers. Check that it sits exactly over the illustrated outline before publishing.</p>
        </aside>
      </div>
      <SaveBar pending={pending} msg={msg} onSave={() => save(a)} label={a.id ? "Save asset" : "Add asset"} extra={a.id ? <button type="button" className="btn btn-ghost" onClick={() => setA(blank())}>New</button> : undefined} />

      <section>
        <h2 className="eyebrow mb-3">All preview layers</h2>
        {assets.length === 0 ? (
          <p className="border border-dashed border-line p-6 text-[13px] text-taupe-ink">No photographic layers yet. Every part is currently drawn procedurally from its measurements and labelled as an illustration.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {assets.map((x) => (
              <li key={x.id} className={cn("border p-3", a.id === x.id ? "border-espresso" : "border-line")}>
                {/* eslint-disable-next-line @next/next/no-img-element -- admin thumbnail */}
                <img src={x.src} alt="" className="h-28 w-full bg-cream object-contain" />
                <p className="mt-2 truncate text-[12.5px]">{catalog.components.find((c) => c.id === x.componentId)?.name ?? x.componentId}</p>
                <p className="text-[11.5px] text-taupe-ink">{x.slot} · {x.view} · {x.status}</p>
                <div className="mt-2 flex gap-3 text-[12px]">
                  <button type="button" className="underline" onClick={() => setA(x)}>Edit</button>
                  <button type="button" className="text-err underline" onClick={async () => { await deleteAsset(x.id); router.refresh(); }}>Delete</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
