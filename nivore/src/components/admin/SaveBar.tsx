"use client";

import { useState, useTransition, type ReactNode } from "react";

/** Sticky save bar for admin forms that submit through a server action returning {ok, error}. */
export function useSave<T>(action: (v: T) => Promise<{ ok: boolean; error?: string }>) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const save = (v: T, okText = "Saved.") =>
    start(async () => {
      try {
        const r = await action(v);
        setMsg(r.ok ? { ok: true, text: okText } : { ok: false, text: r.error ?? "Could not save." });
      } catch (e) {
        setMsg({ ok: false, text: (e as Error).message || "Could not save." });
      }
    });
  return { pending, msg, save, setMsg };
}

export function SaveBar({ pending, msg, onSave, label = "Save changes", extra }: { pending: boolean; msg: { ok: boolean; text: string } | null; onSave: () => void; label?: string; extra?: ReactNode }) {
  return (
    <div className="sticky bottom-0 z-10 -mx-5 mt-8 flex items-center justify-between gap-4 border-t border-line bg-ivory/95 px-5 py-3 backdrop-blur md:-mx-8 md:px-8">
      <p role="status" className={msg ? (msg.ok ? "text-[13px] text-ok" : "text-[13px] text-err") : "text-[13px] text-taupe-ink"}>{msg?.text ?? "Changes are not saved until you press save."}</p>
      <div className="flex gap-2">
        {extra}
        <button type="button" className="btn btn-primary" disabled={pending} onClick={onSave} data-testid="admin-save">{pending ? "Saving…" : label}</button>
      </div>
    </div>
  );
}
