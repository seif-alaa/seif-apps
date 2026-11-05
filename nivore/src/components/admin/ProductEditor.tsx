"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { duplicateProduct, saveProduct } from "@/app/admin/actions";
import { formatEGP, minorToPoundsString, poundsToMinor } from "@/domain/money";
import type { Collection, Product } from "@/domain/models";
import { cairoLocalToUtc, utcToCairoLocal } from "@/domain/storefront";
import { SaveBar, useSave } from "./SaveBar";
import { UploadButton } from "./Upload";

export function ProductEditor({ initial, isNew, collections }: { initial: Product; isNew: boolean; collections: Collection[] }) {
  const router = useRouter();
  const [p, setP] = useState(initial);
  const [price, setPrice] = useState(minorToPoundsString(initial.priceMinor));
  const [compareAt, setCompareAt] = useState(initial.compareAtMinor == null ? "" : minorToPoundsString(initial.compareAtMinor));
  const [release, setRelease] = useState(utcToCairoLocal(initial.releaseAt));
  const set = <K extends keyof Product>(k: K, v: Product[K]) => setP({ ...p, [k]: v });
  const { pending, msg, save, setMsg } = useSave(async (v: Product) => {
    const r = await saveProduct(v, isNew);
    if (r.ok && isNew) router.replace(`/admin/products/${v.id}`);
    else if (r.ok) router.refresh();
    return r;
  });

  const submit = () => {
    try {
      save({ ...p, priceMinor: poundsToMinor(price || "0"), compareAtMinor: compareAt.trim() ? poundsToMinor(compareAt) : null, releaseAt: release ? cairoLocalToUtc(release) : null });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
  };

  const text = (label: string, value: string, onChange: (v: string) => void, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="block"><span className="field-label">{label}</span><input className="field text-[14px]" value={value} onChange={(e) => onChange(e.target.value)} {...props} /></label>
  );

  return (
    <div className="grid gap-8 xl:grid-cols-[1.35fr_1fr]">
      <div className="space-y-8">
        <section className="grid gap-4 border border-line p-5 md:grid-cols-2">
          <h2 className="eyebrow md:col-span-2">Presentation</h2>
          {text("Name (collection + size)", p.name, (v) => set("name", v), { placeholder: "ALBA 38" })}
          {text("Movement", p.movement, (v) => set("movement", v), { placeholder: "NH35 automatic" })}
          {text("URL slug", p.slug, (v) => set("slug", v.toLowerCase().replace(/[^a-z0-9-]/g, "-")))}
          {text("Id", p.id, (v) => set("id", v), { disabled: !isNew })}
          <label className="block md:col-span-2"><span className="field-label">Short line</span><input className="field text-[14px]" value={p.subtitle} onChange={(e) => set("subtitle", e.target.value)} /></label>
          <label className="block md:col-span-2"><span className="field-label">Description</span><textarea className="field min-h-36 text-[14px]" value={p.description} onChange={(e) => set("description", e.target.value)} /></label>
          <fieldset className="md:col-span-2">
            <legend className="field-label">Collections</legend>
            <div className="flex flex-wrap gap-4 text-[14px]">
              {collections.map((c) => (
                <label key={c.id} className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-[var(--color-espresso)]" checked={p.collectionIds.includes(c.id)} onChange={(e) => set("collectionIds", e.target.checked ? [...p.collectionIds, c.id] : p.collectionIds.filter((x) => x !== c.id))} />{c.name}</label>
              ))}
            </div>
          </fieldset>
        </section>

        <section className="grid gap-4 border border-line p-5 md:grid-cols-3">
          <h2 className="eyebrow md:col-span-3">Price, stock & release</h2>
          {text("Price (EGP)", price, setPrice, { inputMode: "decimal" })}
          {text("Compare-at (EGP, optional)", compareAt, setCompareAt, { inputMode: "decimal" })}
          <p className="text-[12.5px] text-taupe-ink md:pt-7">A price of 0 shows &ldquo;Price to be announced&rdquo; and the piece cannot be ordered.</p>
          {text("Stock quantity", String(p.stockQuantity), (v) => set("stockQuantity", Math.max(0, Math.floor(Number(v) || 0))), { inputMode: "numeric" })}
          {text("Max per order", String(p.maxPerOrder), (v) => set("maxPerOrder", Math.min(10, Math.max(1, Math.floor(Number(v) || 1)))), { inputMode: "numeric" })}
          <label className="block">
            <span className="field-label">Status</span>
            <select className="field text-[14px]" value={p.status} onChange={(e) => set("status", e.target.value as Product["status"])}>
              <option value="draft">Draft</option><option value="active">Active</option><option value="scheduled">Scheduled release</option><option value="hidden">Hidden</option><option value="archived">Archived</option>
            </select>
          </label>
          <label className="block"><span className="field-label">Release (Cairo time)</span><input type="datetime-local" className="field text-[14px]" value={release} onChange={(e) => setRelease(e.target.value)} /></label>
          <div className="space-y-2 md:col-span-2 md:pt-6">
            {([["featured", "Featured"], ["soldOut", "Mark sold out"]] as const).map(([k, l]) => (
              <label key={k} className="flex items-center gap-3 text-[14px]"><input type="checkbox" className="h-4 w-4 accent-[var(--color-espresso)]" checked={p[k]} onChange={(e) => set(k, e.target.checked)} />{l}</label>
            ))}
          </div>
        </section>

        <section className="border border-line p-5">
          <h2 className="eyebrow mb-3">Photography</h2>
          <ul className="space-y-3">
            {p.images.map((img, i) => (
              <li key={img.src} className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element -- admin preview */}
                <img src={img.src} alt="" className="h-16 w-16 bg-cream object-cover" />
                <input className="field text-[13px]" placeholder="Alt text: describe the photograph" value={img.alt} onChange={(e) => set("images", p.images.map((x, j) => (j === i ? { ...x, alt: e.target.value } : x)))} />
                <button type="button" className="text-[12px] text-err" onClick={() => set("images", p.images.filter((_, j) => j !== i))}>Remove</button>
              </li>
            ))}
          </ul>
          <div className="mt-3"><UploadButton onUploaded={(u) => set("images", [...p.images, { src: u.src, alt: "", width: u.width, height: u.height }])} /></div>
          <p className="mt-2 text-[12px] text-taupe-ink">Without photographs, the site shows an illustrative rendering clearly labelled as such. Next.js serves AVIF/WebP at responsive sizes automatically.</p>
        </section>

        <section className="grid gap-4 border border-line p-5 md:grid-cols-2">
          <h2 className="eyebrow md:col-span-2">Search & sharing</h2>
          {text("SEO title", p.seo.title, (v) => set("seo", { ...p.seo, title: v }))}
          {text("SEO description", p.seo.description, (v) => set("seo", { ...p.seo, description: v }))}
        </section>
      </div>
      <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
        {!isNew && <button type="button" className="btn btn-outline w-full" onClick={async () => { const r = await duplicateProduct(p.id); if (r.id) router.push(`/admin/products/${r.id}`); }}>Duplicate as draft</button>}
        {!isNew && <a className="btn btn-ghost w-full" href={`/timepieces/${p.slug}`} target="_blank">View on site</a>}
      </aside>
      <div className="xl:col-span-2"><SaveBar pending={pending} msg={msg} onSave={submit} label={isNew ? "Create product" : "Save product"} /></div>
    </div>
  );
}
