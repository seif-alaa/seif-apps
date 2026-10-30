"use client";

import { useState, useTransition } from "react";
import { createAccessCode, revokeAccessCode, saveStorefront } from "@/app/admin/actions";
import { cairoLocalToUtc, STOREFRONT_MODE_LABEL, utcToCairoLocal, type StorefrontMode, type StorefrontSettings } from "@/domain/storefront";
import { cn } from "@/lib/cn";
import { SaveBar, useSave } from "./SaveBar";

const MODES = Object.keys(STOREFRONT_MODE_LABEL) as StorefrontMode[];

export function StorefrontForm({ initial }: { initial: StorefrontSettings }) {
  const [s, setS] = useState(initial);
  const [launchLocal, setLaunchLocal] = useState(utcToCairoLocal(initial.launchAt));
  const { pending, msg, save, setMsg } = useSave(saveStorefront);
  const [label, setLabel] = useState("");
  const [newCode, setNewCode] = useState<string | null>(null);
  const [codePending, start] = useTransition();
  const set = <K extends keyof StorefrontSettings>(k: K, v: StorefrontSettings[K]) => setS({ ...s, [k]: v });

  const submit = () => {
    let launchAt: string | null = null;
    if (launchLocal) {
      try {
        launchAt = cairoLocalToUtc(launchLocal);
      } catch {
        setMsg({ ok: false, text: "Enter a valid launch date and time." });
        return;
      }
    }
    const { accessCodes: _a, ...rest } = { ...s, launchAt };
    save(rest as StorefrontSettings, "Storefront updated. The change applies to the next request.");
  };

  return (
    <div className="space-y-10">
      <section>
        <h2 className="eyebrow mb-3">Mode</h2>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3" role="radiogroup" aria-label="Storefront mode">
          {MODES.map((m) => (
            <label key={m} className={cn("cursor-pointer border p-4 transition-colors", s.mode === m ? "border-espresso shadow-[inset_0_0_0_1px_var(--color-espresso)]" : "border-line hover:border-line-strong")}>
              <input type="radio" name="mode" className="sr-only" checked={s.mode === m} onChange={() => set("mode", m)} data-testid={`mode-${m}`} />
              <span className="block text-[14.5px]">{STOREFRONT_MODE_LABEL[m].title}</span>
              <span className="mt-1 block text-[12.5px] text-taupe-ink">{STOREFRONT_MODE_LABEL[m].detail}</span>
            </label>
          ))}
        </div>
        <p className="mt-3 text-[12.5px] text-taupe-ink">Enforced on the server for every page and API. You stay signed in and can browse the full site in any mode.</p>
      </section>

      <section className="grid gap-5 border border-line p-5 md:grid-cols-2">
        <h2 className="eyebrow md:col-span-2">Launch page</h2>
        <label className="block">
          <span className="field-label">Launch date & time (Cairo)</span>
          <input type="datetime-local" className="field" value={launchLocal} onChange={(e) => setLaunchLocal(e.target.value)} data-testid="launch-at" />
          <span className="mt-1 block text-[12px] text-taupe-ink">Used by the countdown, and by Scheduled launch to open automatically.</span>
        </label>
        <div className="space-y-2 pt-6">
          <label className="flex items-center gap-3 text-[14px]"><input type="checkbox" className="h-4 w-4 accent-[var(--color-espresso)]" checked={s.countdownVisible} onChange={(e) => set("countdownVisible", e.target.checked)} /> Show the countdown</label>
          <label className="flex items-center gap-3 text-[14px]"><input type="checkbox" className="h-4 w-4 accent-[var(--color-espresso)]" checked={s.waitlistEnabled} onChange={(e) => set("waitlistEnabled", e.target.checked)} /> Collect launch-list emails</label>
        </div>
        <label className="block md:col-span-2"><span className="field-label">Headline</span><input className="field" value={s.headline} onChange={(e) => set("headline", e.target.value)} /></label>
        <label className="block md:col-span-2"><span className="field-label">Supporting line</span><input className="field" value={s.subheadline} onChange={(e) => set("subheadline", e.target.value)} /></label>
        <label className="block md:col-span-2"><span className="field-label">Announcement (optional)</span><input className="field" value={s.announcement} onChange={(e) => set("announcement", e.target.value)} /></label>
        <label className="block"><span className="field-label">Background image path (optional)</span><input className="field" value={s.backgroundImage ?? ""} placeholder="/uploads/dev/launch.webp" onChange={(e) => set("backgroundImage", e.target.value || null)} /></label>
        <label className="block"><span className="field-label">Maintenance message</span><input className="field" value={s.maintenanceMessage} onChange={(e) => set("maintenanceMessage", e.target.value)} /></label>
        <p className="text-[12.5px] md:col-span-2"><a href="/gate/coming-soon" target="_blank" className="underline">Preview the launch page</a> (shows saved settings) · <a href="/gate/maintenance" target="_blank" className="underline">Preview maintenance</a></p>
      </section>

      <section className="grid gap-4 border border-line p-5 md:grid-cols-2">
        <h2 className="eyebrow md:col-span-2">Ordering & bidding</h2>
        <label className="flex items-start gap-3 text-[14px]"><input type="checkbox" className="mt-1 h-4 w-4 accent-[var(--color-espresso)]" checked={s.checkoutLocked} onChange={(e) => set("checkoutLocked", e.target.checked)} data-testid="checkout-lock" /><span>Lock checkout only<span className="block text-[12.5px] text-taupe-ink">Browsing and the builder stay open.</span></span></label>
        <label className="flex items-start gap-3 text-[14px]"><input type="checkbox" className="mt-1 h-4 w-4 accent-[var(--color-espresso)]" checked={s.biddingLocked} onChange={(e) => set("biddingLocked", e.target.checked)} /><span>Pause bidding</span></label>
        <label className="block md:col-span-2"><span className="field-label">Message shown when checkout is closed</span><input className="field" value={s.checkoutLockedMessage} onChange={(e) => set("checkoutLockedMessage", e.target.value)} /></label>
      </section>

      <section className="border border-line p-5">
        <h2 className="eyebrow mb-3">Access codes (password mode)</h2>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input className="field sm:max-w-xs" placeholder="Label, e.g. Press preview" value={label} onChange={(e) => setLabel(e.target.value)} />
          <button type="button" className="btn btn-outline" disabled={codePending} onClick={() => start(async () => { const r = await createAccessCode(label); if (r.code) { setNewCode(r.code); setLabel(""); } })}>Create code</button>
        </div>
        {newCode && <p className="mt-3 border border-ok/40 bg-cream p-3 text-[13.5px]">New code: <strong className="font-mono tracking-[0.2em]" data-testid="new-code">{newCode}</strong> — copy it now; it is stored only as a hash and cannot be shown again.</p>}
        <ul className="mt-4 divide-y divide-line text-[13.5px]">
          {initial.accessCodes.map((c) => (
            <li key={c.id} className="flex items-center justify-between py-2">
              <span>{c.label} <span className="text-taupe-ink">· {c.active ? "active" : "revoked"}</span></span>
              {c.active && <button type="button" className="text-[12px] text-err underline" onClick={() => start(async () => { await revokeAccessCode(c.id); })}>Revoke</button>}
            </li>
          ))}
        </ul>
      </section>

      <SaveBar pending={pending} msg={msg} onSave={submit} label="Apply" />
    </div>
  );
}
