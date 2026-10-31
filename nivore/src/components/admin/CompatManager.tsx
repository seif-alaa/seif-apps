"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { deleteCompat, saveCompat } from "@/app/admin/actions";
import type { CompatRecord, PublicCatalog } from "@/domain/catalog";
import { createEngine, RULES } from "@/domain/compatibility";
import { SLOT_LABEL, type Slot } from "@/domain/configuration";
import { Pill } from "./ui";

export function CompatManager({ catalog, records }: { catalog: PublicCatalog; records: CompatRecord[] }) {
  const router = useRouter();
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [status, setStatus] = useState<CompatRecord["status"]>("compatible");
  const [note, setNote] = useState("");
  const [source, setSource] = useState<CompatRecord["source"]>("atelier-tested");
  const [msg, setMsg] = useState<string | null>(null);
  const engine = useMemo(() => createEngine({ ...catalog, compat: [] }), [catalog]);
  const engineWith = useMemo(() => createEngine(catalog), [catalog]);
  const name = (id: string) => catalog.components.find((c) => c.id === id)?.name ?? id;
  const ca = engine.get(a);
  const cb = engine.get(b);
  const ruleResult = ca && cb ? engine.pairIssues(ca, cb) : null;
  const effective = ca && cb ? engineWith.pairIssues(ca, cb) : null;
  const options = catalog.components.map((c) => <option key={c.id} value={c.id}>{SLOT_LABEL[c.type as Slot]} · {c.name}</option>);

  return (
    <div className="space-y-10">
      <section className="border border-line p-5">
        <h2 className="eyebrow">Check or record a pairing</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="block"><span className="field-label">Component A</span><select className="field text-[13.5px]" value={a} onChange={(e) => setA(e.target.value)}><option value="">Choose…</option>{options}</select></label>
          <label className="block"><span className="field-label">Component B</span><select className="field text-[13.5px]" value={b} onChange={(e) => setB(e.target.value)}><option value="">Choose…</option>{options}</select></label>
        </div>
        {ruleResult && (
          <div className="mt-4 space-y-2 bg-cream p-4 text-[13px]">
            <p><span className="text-taupe-ink">Attribute rules say: </span>{ruleResult.length === 0 ? <Pill tone="ok">compatible</Pill> : ruleResult.map((i, k) => <span key={k} className="mr-2"><Pill tone={i.status === "incompatible" ? "err" : "warn"}>{i.status}</Pill> {i.message}</span>)}</p>
            <p><span className="text-taupe-ink">Customers currently see: </span>{effective!.length === 0 ? <Pill tone="ok">compatible</Pill> : <Pill tone={effective!.some((i) => i.status === "incompatible") ? "err" : "warn"}>{effective![0].status}</Pill>}</p>
            {ruleResult.length === 0 && <p className="text-[12px] text-taupe-ink">No rule connects these two types, or every rule passed with known measurements.</p>}
          </div>
        )}
        <div className="mt-4 grid gap-4 md:grid-cols-[auto_auto_1fr_auto] md:items-end">
          <label className="block"><span className="field-label">Record as</span><select className="field text-[13.5px]" value={status} onChange={(e) => setStatus(e.target.value as CompatRecord["status"])}><option value="compatible">Verified compatible</option><option value="incompatible">Verified incompatible</option><option value="unconfirmed">Not yet confirmed</option></select></label>
          <label className="block"><span className="field-label">Source</span><select className="field text-[13.5px]" value={source} onChange={(e) => setSource(e.target.value as CompatRecord["source"])}><option value="atelier-tested">Atelier-tested</option><option value="supplier">Supplier statement</option><option value="measurement">Measured</option><option value="other">Other</option></select></label>
          <label className="block"><span className="field-label">Note (shown to customers when not compatible)</span><input className="field text-[13.5px]" value={note} onChange={(e) => setNote(e.target.value)} /></label>
          <button className="btn btn-primary" disabled={!a || !b} onClick={async () => { const r = await saveCompat({ aId: a, bId: b, status, note, source }); setMsg(r.ok ? "Recorded. It overrides the attribute rules for this pair." : r.error ?? "Failed."); if (r.ok) router.refresh(); }}>Save record</button>
        </div>
        {msg && <p role="status" className="mt-3 text-[13px] text-taupe-ink">{msg}</p>}
      </section>

      <section>
        <h2 className="eyebrow mb-3">Atelier records ({records.length})</h2>
        <ul className="divide-y divide-line border-y border-line text-[13.5px]">
          {records.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-3 py-3">
              <Pill tone={r.status === "compatible" ? "ok" : r.status === "incompatible" ? "err" : "warn"}>{r.status}</Pill>
              <span className="flex-1">{name(r.aId)} <span className="text-taupe-ink">×</span> {name(r.bId)}<span className="block text-[12px] text-taupe-ink">{r.source} · {r.note}</span></span>
              <button className="text-[12px] text-err underline" onClick={async () => { await deleteCompat(r.id); router.refresh(); }}>Remove</button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="eyebrow mb-3">Attribute rules (always on)</h2>
        <p className="mb-3 text-[12.5px] text-taupe-ink">These rules read each component&rsquo;s measurements. Missing data produces &ldquo;not yet confirmed&rdquo;, never a fit. Edit the measurements on each component to change outcomes.</p>
        <ul className="grid gap-2 text-[13px] md:grid-cols-2">
          {RULES.map((r) => <li key={r.id} className="border border-line px-3 py-2"><span className="font-mono text-[11.5px]">{r.id}</span><span className="block text-taupe-ink">{SLOT_LABEL[r.a as Slot]} × {SLOT_LABEL[r.b as Slot]}</span></li>)}
        </ul>
      </section>
    </div>
  );
}
