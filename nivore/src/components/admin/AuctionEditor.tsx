"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { auctionAction, saveAuction } from "@/app/admin/actions";
import type { Auction } from "@/domain/auction";
import { minorToPoundsString, poundsToMinor } from "@/domain/money";
import { cairoLocalToUtc, utcToCairoLocal } from "@/domain/storefront";
import { SaveBar, useSave } from "./SaveBar";

export function AuctionEditor({ initial, isNew }: { initial: Auction; isNew: boolean }) {
  const router = useRouter();
  const [a, setA] = useState(initial);
  const [m, setM] = useState({ start: minorToPoundsString(initial.startingBidMinor), inc: minorToPoundsString(initial.incrementMinor), reserve: initial.reserveMinor == null ? "" : minorToPoundsString(initial.reserveMinor), opens: utcToCairoLocal(initial.opensAt), closes: utcToCairoLocal(initial.closesAt) });
  const { pending, msg, save, setMsg } = useSave(async (v: Auction) => {
    const r = await saveAuction(v, isNew);
    if (r.ok && isNew) router.replace(`/admin/auctions/${v.id}`);
    else if (r.ok) router.refresh();
    return r;
  });
  const set = <K extends keyof Auction>(k: K, v: Auction[K]) => setA({ ...a, [k]: v });
  const text = (label: string, value: string, onChange: (v: string) => void, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="block"><span className="field-label">{label}</span><input className="field text-[14px]" value={value} onChange={(e) => onChange(e.target.value)} {...props} /></label>
  );
  const submit = () => {
    try {
      save({ ...a, startingBidMinor: poundsToMinor(m.start), incrementMinor: poundsToMinor(m.inc), reserveMinor: m.reserve.trim() ? poundsToMinor(m.reserve) : null, opensAt: cairoLocalToUtc(m.opens), closesAt: cairoLocalToUtc(m.closes) });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
  };
  return (
    <div className="space-y-8">
      <section className="grid gap-4 border border-line p-5 md:grid-cols-2">
        {text("Title", a.title, (v) => set("title", v), { placeholder: "N° 03 · ALBA 36" })}
        {text("URL slug", a.slug, (v) => set("slug", v.toLowerCase().replace(/[^a-z0-9-]/g, "-")))}
        {text("Subtitle", a.subtitle, (v) => set("subtitle", v))}
        {text("Preview build (builder link query, e.g. b=M1.D01…)", a.previewBuild ?? "", (v) => set("previewBuild", v.replace(/^.*\?/, "") || null))}
        <label className="block md:col-span-2"><span className="field-label">Description</span><textarea className="field min-h-32 text-[14px]" value={a.description} onChange={(e) => set("description", e.target.value)} /></label>
        <fieldset className="md:col-span-2">
          <legend className="field-label">Specification lines</legend>
          {a.specs.map((s, i) => (
            <div key={i} className="mb-2 grid grid-cols-[10rem_1fr_auto] gap-2">
              <input className="field text-[13px]" value={s.label} onChange={(e) => set("specs", a.specs.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
              <input className="field text-[13px]" value={s.value} onChange={(e) => set("specs", a.specs.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} />
              <button type="button" className="text-[12px] text-err" onClick={() => set("specs", a.specs.filter((_, j) => j !== i))}>Remove</button>
            </div>
          ))}
          <button type="button" className="btn btn-outline !min-h-9" onClick={() => set("specs", [...a.specs, { label: "", value: "" }])}>Add line</button>
        </fieldset>
      </section>
      <section className="grid gap-4 border border-line p-5 md:grid-cols-3">
        <h2 className="eyebrow md:col-span-3">Bidding</h2>
        {text("Starting bid (EGP)", m.start, (v) => setM({ ...m, start: v }), { inputMode: "decimal" })}
        {text("Increment (EGP)", m.inc, (v) => setM({ ...m, inc: v }), { inputMode: "decimal" })}
        {text("Reserve (EGP, private, optional)", m.reserve, (v) => setM({ ...m, reserve: v }), { inputMode: "decimal" })}
        <label className="block"><span className="field-label">Opens (Cairo)</span><input type="datetime-local" className="field text-[14px]" value={m.opens} onChange={(e) => setM({ ...m, opens: e.target.value })} /></label>
        <label className="block"><span className="field-label">Closes (Cairo)</span><input type="datetime-local" className="field text-[14px]" value={m.closes} onChange={(e) => setM({ ...m, closes: e.target.value })} /></label>
        <label className="block"><span className="field-label">Mode</span><select className="field text-[14px]" value={a.mode} onChange={(e) => set("mode", e.target.value as Auction["mode"])}><option value="demonstration">Demonstration (non-binding)</option><option value="live">Live (requires production backend)</option></select></label>
        <label className="flex items-center gap-3 text-[14px]"><input type="checkbox" className="h-4 w-4 accent-[var(--color-espresso)]" checked={a.antiSnipe.enabled} onChange={(e) => set("antiSnipe", { ...a.antiSnipe, enabled: e.target.checked })} />Extend on late bids</label>
        {text("Late-bid window (min)", String(a.antiSnipe.windowMinutes), (v) => set("antiSnipe", { ...a.antiSnipe, windowMinutes: Math.max(1, Number(v) || 1) }), { inputMode: "numeric" })}
        {text("Extend by (min)", String(a.antiSnipe.extendMinutes), (v) => set("antiSnipe", { ...a.antiSnipe, extendMinutes: Math.max(1, Number(v) || 1) }), { inputMode: "numeric" })}
        <label className="flex items-center gap-3 text-[14px]"><input type="checkbox" className="h-4 w-4 accent-[var(--color-espresso)]" checked={a.published} onChange={(e) => set("published", e.target.checked)} />Published</label>
        <label className="block md:col-span-3"><span className="field-label">Terms for this piece (leave empty to use the site auction terms)</span><textarea className="field text-[14px]" value={a.terms} onChange={(e) => set("terms", e.target.value)} /></label>
      </section>
      <SaveBar pending={pending} msg={msg} onSave={submit} label={isNew ? "Create auction" : "Save auction"} />
    </div>
  );
}

export function AuctionActions({ id, hasWinner }: { id: string; hasWinner: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const act = (k: Parameters<typeof auctionAction>[1]) => start(async () => { const r = await auctionAction(id, k); setMsg(r.ok ? "Done." : r.error ?? "Failed."); router.refresh(); });
  return (
    <div className="flex flex-wrap gap-2">
      <button className="btn btn-outline" disabled={pending} onClick={() => act("settle")}>Close & select winner</button>
      {hasWinner && <button className="btn btn-outline" disabled={pending} onClick={() => act("confirm-winner")}>Confirm winner contacted</button>}
      {hasWinner && <button className="btn btn-outline" disabled={pending} onClick={() => act("payment-confirmed")}>Payment received</button>}
      <button className="btn btn-outline" disabled={pending} onClick={() => act("sold")}>Mark sold</button>
      <button className="btn btn-outline" disabled={pending} onClick={() => act("unsold")}>Mark unsold</button>
      <button className="btn btn-outline" disabled={pending} onClick={() => act("cancel")}>Cancel</button>
      <button className="btn btn-ghost" disabled={pending} onClick={() => act("archive")}>Archive</button>
      {msg && <p role="status" className="basis-full text-[13px] text-taupe-ink">{msg}</p>}
    </div>
  );
}
