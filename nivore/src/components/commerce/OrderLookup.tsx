"use client";

import { useState } from "react";

interface Result {
  ref: string;
  firstName: string;
  statusLabel: string;
  payment: string;
  placedAt: string;
  history: { label: string; at: string }[];
  items: { name: string; quantity: number }[];
  development: boolean;
}

const fmt = (iso: string) => new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Cairo" }).format(new Date(iso));

export function OrderLookup() {
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    const res = await fetch("/api/order-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ref: fd.get("ref"), phone: fd.get("phone") }) });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setResult(null);
      setError(data.error ?? "Something went wrong.");
      return;
    }
    setResult(data);
  }
  return (
    <div className="space-y-10">
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <label className="block">
          <span className="field-label">Order reference</span>
          <input name="ref" className="field uppercase" placeholder="NV2611-0001" required />
        </label>
        <label className="block">
          <span className="field-label">Mobile number</span>
          <input name="phone" type="tel" inputMode="tel" className="field" placeholder="010 1234 5678" required />
        </label>
        <button className="btn btn-primary" disabled={busy}>{busy ? "Checking…" : "Check"}</button>
      </form>
      {error && <p role="alert" className="field-error">{error}</p>}
      {result && (
        <div role="status" className="border border-line p-6">
          <p className="eyebrow">Order {result.ref}</p>
          <p className="display mt-2 text-[1.8rem]">{result.statusLabel}</p>
          <p className="mt-1 text-[13px] text-taupe-ink">Payment: {result.payment} · Placed {fmt(result.placedAt)}</p>
          {result.development && <p className="mt-3 text-[12px] text-warn">Development order (test store).</p>}
          <ol className="mt-6 space-y-3 border-l border-line pl-5">
            {result.history.map((h, i) => (
              <li key={i} className="text-[14px]">
                {h.label}
                <span className="block text-[12px] text-taupe-ink">{fmt(h.at)}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
