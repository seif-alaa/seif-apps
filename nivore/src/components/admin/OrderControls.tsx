"use client";

import { useState, useTransition } from "react";
import { addOrderNote, setOrderStatus, setPaymentStatus, updateFulfilment } from "@/app/admin/actions";
import { ORDER_STATUS_LABEL, ORDER_STATUSES, PAYMENT_STATUS_LABEL, type PaymentStatus } from "@/domain/models";

function useAct() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, ok = "Saved.") => start(async () => {
    const r = await fn();
    setMsg(r.ok ? ok : r.error ?? "Could not save.");
  });
  return { pending, msg, run };
}

export function StatusControl({ refId, status }: { refId: string; status: string }) {
  const { pending, msg, run } = useAct();
  const [next, setNext] = useState(status);
  const [note, setNote] = useState("");
  return (
    <div className="space-y-3">
      <select className="field text-sm" value={next} onChange={(e) => setNext(e.target.value)} aria-label="Order status">
        {ORDER_STATUSES.map((s) => <option key={s} value={s}>{ORDER_STATUS_LABEL[s]}</option>)}
      </select>
      <input className="field text-sm" placeholder="Note for the history (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
      <button className="btn btn-primary w-full" disabled={pending || next === status} onClick={() => run(() => setOrderStatus(refId, next, note), "Status updated.")}>Update status</button>
      {msg && <p role="status" className="text-[12px] text-taupe-ink">{msg}</p>}
    </div>
  );
}

export function PaymentControl({ refId, method, status }: { refId: string; method: string; status: PaymentStatus }) {
  const { pending, msg, run } = useAct();
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="space-y-3">
      {status !== "confirmed" && (
        confirming ? (
          <div className="space-y-2 border border-warn/40 bg-cream p-3 text-[12.5px]">
            <p>Only confirm after checking the money has arrived in the account{method === "instapay" ? " (InstaPay app or bank statement)" : ""}. A screenshot is not proof.</p>
            <div className="flex gap-2">
              <button className="btn btn-primary !min-h-9" disabled={pending} onClick={() => run(() => setPaymentStatus(refId, "confirmed"), "Payment confirmed.")} data-testid="confirm-payment">I have received it</button>
              <button className="btn btn-ghost !min-h-9" onClick={() => setConfirming(false)}>Cancel</button>
            </div>
          </div>
        ) : (
          <button className="btn btn-primary w-full" onClick={() => setConfirming(true)}>Confirm payment received</button>
        )
      )}
      <select className="field text-sm" defaultValue={status} aria-label="Payment status" onChange={(e) => run(() => setPaymentStatus(refId, e.target.value), "Payment status updated.")}>
        {(Object.keys(PAYMENT_STATUS_LABEL) as PaymentStatus[]).map((s) => <option key={s} value={s}>{PAYMENT_STATUS_LABEL[s]}</option>)}
      </select>
      {msg && <p role="status" className="text-[12px] text-taupe-ink">{msg}</p>}
    </div>
  );
}

export function NoteControl({ refId }: { refId: string }) {
  const { pending, msg, run } = useAct();
  const [text, setText] = useState("");
  return (
    <div className="space-y-2">
      <textarea className="field text-sm" placeholder="Internal note (never shown to the customer)" value={text} onChange={(e) => setText(e.target.value)} />
      <button className="btn btn-outline" disabled={pending || !text.trim()} onClick={() => run(async () => { const r = await addOrderNote(refId, text); if (r.ok) setText(""); return r; }, "Note added.")}>Add note</button>
      {msg && <p role="status" className="text-[12px] text-taupe-ink">{msg}</p>}
    </div>
  );
}

export function FulfilmentControl({ refId, initial }: { refId: string; initial: Record<string, string | null> }) {
  const { pending, msg, run } = useAct();
  const [v, setV] = useState<Record<string, string>>(Object.fromEntries(Object.entries(initial).map(([k, x]) => [k, x ?? ""])));
  const field = (k: string, label: string) => (
    <label className="block"><span className="field-label">{label}</span><input className="field text-sm" value={v[k] ?? ""} onChange={(e) => setV({ ...v, [k]: e.target.value })} /></label>
  );
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">{field("governorate", "Governorate")}{field("city", "City / area")}</div>
      {field("address", "Address")}
      {field("landmark", "Landmark")}
      <div className="grid gap-3 sm:grid-cols-2">{field("carrier", "Courier")}{field("trackingNumber", "Tracking number")}</div>
      <button className="btn btn-outline" disabled={pending} onClick={() => run(() => updateFulfilment(refId, v), "Delivery details saved.")}>Save delivery details</button>
      {msg && <p role="status" className="text-[12px] text-taupe-ink">{msg}</p>}
    </div>
  );
}
