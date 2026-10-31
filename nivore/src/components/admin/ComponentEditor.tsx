"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { saveComponent, setComponentActive } from "@/app/admin/actions";
import { COMPONENT_TYPE_LABEL, type Component, type PublicCatalog } from "@/domain/catalog";
import { createEngine } from "@/domain/compatibility";
import { SLOT_LABEL, SLOT_ORDER, type Configuration, type Slot } from "@/domain/configuration";
import { formatEGP, minorToPoundsString, poundsToMinor } from "@/domain/money";
import { resolveBuild } from "@/components/watch/geometry";
import { WatchStage } from "@/components/watch/WatchStage";
import type { FieldDesc } from "@/server/schema-describe";
import { SaveBar, useSave } from "./SaveBar";
import { UploadButton } from "./Upload";

/**
 * Component editor. Technical fields are generated from the component's
 * Zod spec schema. The live preview drops the draft into a sample build so
 * the atelier can check fit and appearance before activating it.
 */
export function ComponentEditor({ initial, specFields, isNew, catalog, sample }: { initial: Component; specFields: FieldDesc[]; isNew: boolean; catalog: PublicCatalog; sample: Configuration }) {
  const router = useRouter();
  const [c, setC] = useState<Component>(initial);
  const [money, setMoney] = useState({ price: minorToPoundsString(initial.priceMinor), cost: initial.costMinor == null ? "" : minorToPoundsString(initial.costMinor), adj: minorToPoundsString(initial.priceAdjustmentMinor) });
  const { pending, msg, save, setMsg } = useSave(async (v: Component) => {
    const r = await saveComponent(v, isNew);
    if (r.ok && isNew) router.replace(`/admin/components/${v.id}`);
    else if (r.ok) router.refresh();
    return r;
  });
  const set = <K extends keyof Component>(k: K, v: Component[K]) => setC({ ...c, [k]: v } as Component);
  const setSpec = (k: string, v: unknown) => setC({ ...c, spec: { ...c.spec, [k]: v } } as Component);

  // Preview: inject the draft into the catalogue and repair a sample build around it.
  const preview = useMemo(() => {
    const draft = { ...c, active: true } as unknown as PublicCatalog["components"][number];
    const cat: PublicCatalog = { ...catalog, components: [...catalog.components.filter((x) => x.id !== c.id), draft] };
    const engine = createEngine(cat);
    const slot = c.type as Slot;
    const p = engine.propose(engine.normalize(sample), slot, c.id);
    const partners: Record<string, { ok: number; no: number; unknown: number }> = {};
    for (const other of cat.components) {
      if (other.id === c.id || other.type === c.type || !other.active) continue;
      const iss = engine.pairIssues(draft, other);
      const k = SLOT_LABEL[other.type as Slot];
      partners[k] ??= { ok: 0, no: 0, unknown: 0 };
      if (!iss.length) partners[k].ok++;
      else if (iss.some((i) => i.status === "incompatible")) partners[k].no++;
      else partners[k].unknown++;
    }
    return { build: resolveBuild(p.next, engine.get, engine.family), blocked: p.blocked, partners, engine };
  }, [c, catalog, sample]);

  const submit = () => {
    try {
      const v = { ...c, priceMinor: poundsToMinor(money.price || "0"), costMinor: money.cost.trim() ? poundsToMinor(money.cost) : null, priceAdjustmentMinor: poundsToMinor(money.adj || "0") } as Component;
      setC(v);
      save(v);
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
  };

  const text = (label: string, value: string, onChange: (v: string) => void, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="block">
      <span className="field-label">{label}</span>
      <input className="field text-[14px]" value={value} onChange={(e) => onChange(e.target.value)} {...props} />
    </label>
  );

  return (
    <div className="grid gap-8 xl:grid-cols-[1.35fr_1fr]">
      <div className="space-y-8">
        <section className="grid gap-4 border border-line p-5 md:grid-cols-2">
          <h2 className="eyebrow md:col-span-2">{COMPONENT_TYPE_LABEL[c.type]} · identity</h2>
          {text("Name", c.name, (v) => set("name", v))}
          {text("Id (permanent)", c.id, (v) => set("id", v.toLowerCase()), { disabled: !isNew })}
          {text("Share code", c.code, (v) => set("code", v.toUpperCase()))}
          {text("SKU", c.sku, (v) => set("sku", v))}
          {text("Supplier", c.supplier ?? "", (v) => set("supplier", v || null))}
          {text("Supplier reference", c.supplierRef ?? "", (v) => set("supplierRef", v || null))}
          <label className="block md:col-span-2">
            <span className="field-label">Customer description</span>
            <textarea className="field text-[14px]" value={c.description} onChange={(e) => set("description", e.target.value)} />
          </label>
        </section>

        <section className="grid gap-4 border border-line p-5 md:grid-cols-3">
          <h2 className="eyebrow md:col-span-3">Price & stock</h2>
          {text("Selling price (EGP)", money.price, (v) => setMoney({ ...money, price: v }), { inputMode: "decimal" })}
          {text("Supplier cost (EGP, private)", money.cost, (v) => setMoney({ ...money, cost: v }), { inputMode: "decimal", placeholder: "Not entered" })}
          {text("Price adjustment (EGP, ±)", money.adj, (v) => setMoney({ ...money, adj: v }), { inputMode: "decimal" })}
          <label className="block">
            <span className="field-label">Stock status</span>
            <select className="field text-[14px]" value={c.stock.status} onChange={(e) => set("stock", { ...c.stock, status: e.target.value as Component["stock"]["status"] })}>
              <option value="in_stock">In stock</option>
              <option value="low">Low</option>
              <option value="made_to_order">Ordered in per build</option>
              <option value="out_of_stock">Out of stock</option>
            </select>
          </label>
          {text("Quantity", c.stock.quantity == null ? "" : String(c.stock.quantity), (v) => set("stock", { ...c.stock, quantity: v === "" ? null : Math.max(0, Math.floor(Number(v) || 0)) }), { inputMode: "numeric", placeholder: "Untracked" })}
          {text("Lead time (days)", c.stock.leadTimeDays == null ? "" : String(c.stock.leadTimeDays), (v) => set("stock", { ...c.stock, leadTimeDays: v === "" ? null : Math.max(0, Math.floor(Number(v) || 0)) }), { inputMode: "numeric" })}
          <label className="flex items-center gap-3 text-[14px]"><input type="checkbox" className="h-4 w-4 accent-[var(--color-espresso)]" checked={c.discountEligible} onChange={(e) => set("discountEligible", e.target.checked)} />Eligible for promo codes</label>
          <label className="flex items-center gap-3 text-[14px]"><input type="checkbox" className="h-4 w-4 accent-[var(--color-espresso)]" checked={c.active} onChange={(e) => set("active", e.target.checked)} />Active in the builder</label>
          {text("Sort order", String(c.sortOrder), (v) => set("sortOrder", Math.floor(Number(v) || 0)), { inputMode: "numeric" })}
        </section>

        <section className="border border-line p-5">
          <h2 className="eyebrow">Technical specification & fitment</h2>
          <p className="mb-4 mt-1 text-[12.5px] text-taupe-ink">These values drive compatibility. Leave measurements empty when unknown; the builder treats missing data as &ldquo;not confirmed&rdquo;, never as a fit.</p>
          <div className="grid gap-4 md:grid-cols-2">
            {specFields.map((f) => (
              <SpecField key={f.key} f={f} value={(c.spec as Record<string, unknown>)[f.key]} onChange={(v) => setSpec(f.key, v)} movementFamilies={catalog.movementFamilies.map((m) => m.id)} />
            ))}
          </div>
        </section>

        <section className="border border-line p-5">
          <h2 className="eyebrow mb-3">Product photographs</h2>
          <div className="flex flex-wrap gap-3">
            {c.images.map((src) => (
              <div key={src} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element -- admin preview */}
                <img src={src} alt="" className="h-24 w-24 bg-cream object-cover" />
                <button type="button" className="absolute right-1 top-1 bg-ivory px-1 text-[11px] text-err" onClick={() => set("images", c.images.filter((x) => x !== src))}>Remove</button>
              </div>
            ))}
            <UploadButton onUploaded={(u) => set("images", [...c.images, u.src])} />
          </div>
          <p className="mt-3 text-[12px] text-taupe-ink">Transparent layers for the live preview are managed in Preview assets, with alignment metadata.</p>
        </section>
      </div>

      <aside className="space-y-6 xl:sticky xl:top-6 xl:self-start">
        <section className="border border-line p-5">
          <h2 className="eyebrow mb-3">Preview in a sample build</h2>
          <div className="relative aspect-[600/860] w-full bg-cream">
            <WatchStage build={preview.build} assets={catalog.assets} view={c.type === "caseback" ? "rear" : "front"} sweep={false} showBadge={false} />
          </div>
          {preview.blocked.length > 0 && <p className="mt-3 text-[12.5px] text-warn">The sample build could not be completed around this part: {preview.blocked[0].message}</p>}
        </section>
        <section className="border border-line p-5">
          <h2 className="eyebrow mb-3">Fit against active components</h2>
          <table className="w-full text-[12.5px]">
            <thead><tr className="text-left text-taupe-ink"><th className="font-normal">Type</th><th className="font-normal">Fits</th><th className="font-normal">No</th><th className="font-normal">Unconfirmed</th></tr></thead>
            <tbody>
              {SLOT_ORDER.map((s) => SLOT_LABEL[s]).filter((k) => preview.partners[k]).map((k) => {
                const p = preview.partners[k];
                return <tr key={k} className="border-t border-line"><td className="py-1.5">{k}</td><td className="tabular text-ok">{p.ok}</td><td className="tabular">{p.no}</td><td className="tabular text-warn">{p.unknown}</td></tr>;
              })}
            </tbody>
          </table>
          <p className="mt-3 text-[12px] text-taupe-ink">Price now: {formatEGP(Math.max(0, (Number(money.price) || 0) * 100 + (Number(money.adj) || 0) * 100))}</p>
        </section>
        {!isNew && (
          <button type="button" className="btn btn-outline w-full" onClick={async () => { await setComponentActive(c.id, !initial.active); router.refresh(); }}>
            {initial.active ? "Deactivate (hide from builder)" : "Activate"}
          </button>
        )}
      </aside>
      <div className="xl:col-span-2">
        <SaveBar pending={pending} msg={msg} onSave={submit} label={isNew ? "Create component" : "Save component"} />
      </div>
    </div>
  );
}

function SpecField({ f, value, onChange, movementFamilies }: { f: FieldDesc; value: unknown; onChange: (v: unknown) => void; movementFamilies: string[] }) {
  const label = f.key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (x) => x.toUpperCase())
    .replace(/ Mm$/, " (mm)")
    .replace(/ Hex$/, " (hex)")
    .replace(/Color/g, "Colour");
  if (f.kind === "boolean") {
    return (
      <label className="flex min-h-11 items-center gap-3 text-[14px]">
        <input type="checkbox" className="h-4 w-4 accent-[var(--color-espresso)]" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />
        {label}
      </label>
    );
  }
  if (f.kind === "enum") {
    return (
      <label className="block">
        <span className="field-label">{label}</span>
        <select className="field text-[14px]" value={value == null ? "" : String(value)} onChange={(e) => onChange(e.target.value === "" ? null : typeof f.options[0] === "number" ? Number(e.target.value) : e.target.value)}>
          {f.nullable && <option value="">Not set</option>}
          {f.options.map((o) => <option key={String(o)} value={String(o)}>{String(o)}</option>)}
        </select>
      </label>
    );
  }
  if (f.kind === "string[]" || f.kind === "number[]") {
    const arr = (value as (string | number)[]) ?? [];
    if (f.key === "movementFamilies") {
      return (
        <fieldset className="md:col-span-2">
          <legend className="field-label">{label}</legend>
          <div className="flex flex-wrap gap-4 text-[14px]">
            {movementFamilies.map((m) => (
              <label key={m} className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-[var(--color-espresso)]" checked={arr.includes(m)} onChange={(e) => onChange(e.target.checked ? [...arr, m] : arr.filter((x) => x !== m))} />{m.toUpperCase()}</label>
            ))}
          </div>
        </fieldset>
      );
    }
    return (
      <label className="block md:col-span-2">
        <span className="field-label">{label} (comma separated)</span>
        <input className="field text-[14px]" defaultValue={arr.join(", ")} onBlur={(e) => onChange(e.target.value.split(",").map((x) => x.trim()).filter(Boolean).map((x) => (f.kind === "number[]" ? Number(x) : x)).filter((x) => x !== "" && !(typeof x === "number" && Number.isNaN(x))))} />
      </label>
    );
  }
  if (f.kind === "number") {
    return (
      <label className="block">
        <span className="field-label">{label}</span>
        <input className="field tabular text-[14px]" inputMode="decimal" defaultValue={value == null ? "" : String(value)} placeholder={f.nullable ? "Unknown" : undefined} onChange={(e) => onChange(e.target.value.trim() === "" ? (f.nullable ? null : 0) : Number(e.target.value))} />
      </label>
    );
  }
  const isColour = /hex$/i.test(f.key);
  const textInput = <input className="field text-[14px]" value={value == null ? "" : String(value)} placeholder={f.nullable ? "Not set" : undefined} onChange={(e) => onChange(e.target.value === "" && f.nullable ? null : e.target.value)} />;
  if (!isColour) {
    return (
      <label className={f.kind === "string" && f.multiline ? "block md:col-span-2" : "block"}>
        <span className="field-label">{label}</span>
        {textInput}
      </label>
    );
  }
  return (
    <div className="flex items-end gap-2">
      <input type="color" aria-label={`${label}: picker`} className="h-11 w-11 shrink-0 cursor-pointer border border-line bg-ivory" value={typeof value === "string" ? value : "#000000"} onChange={(e) => onChange(e.target.value)} />
      <label className="block flex-1">
        <span className="field-label">{label}</span>
        {textInput}
      </label>
    </div>
  );
}
