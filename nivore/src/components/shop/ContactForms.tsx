"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

type Kind = "contact" | "commission";

export function ContactForm({ kind }: { kind: Kind }) {
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [notified, setNotified] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const details: Record<string, string> = {};
    for (const k of ["wrist", "size", "palette", "budget", "occasion"]) {
      const v = fd.get(k);
      if (typeof v === "string" && v) details[k] = v;
    }
    setState("sending");
    setError(null);
    const res = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, name: fd.get("name"), email: fd.get("email"), phone: fd.get("phone"), message: fd.get("message"), details, website: fd.get("website") }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setState("idle");
      setError(data.error ?? "Something went wrong. Please try again.");
      setFields(data.fields ?? {});
      return;
    }
    setNotified(Boolean(data.notified));
    setState("sent");
  }

  if (state === "sent") {
    return (
      <div role="status" className="border border-line bg-cream p-6">
        <p className="display text-2xl">Thank you. Your message is with the atelier.</p>
        <p className="mt-2 text-[14px] text-taupe-ink">{notified ? "We have been notified and will reply to you personally." : "It has been received and saved. We read every message and reply personally."}</p>
      </div>
    );
  }

  const field = (name: string, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="block">
      <span className="field-label">{label}</span>
      <input name={name} className="field" aria-invalid={fields[name] ? true : undefined} {...props} />
      {fields[name] && <span className="field-error">{fields[name]}</span>}
    </label>
  );

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <div className="grid gap-5 sm:grid-cols-2">
        {field("name", "Full name", { autoComplete: "name", required: true })}
        {field("email", "Email", { type: "email", autoComplete: "email", required: true })}
      </div>
      {field("phone", "Mobile (optional)", { type: "tel", autoComplete: "tel", inputMode: "tel" })}
      {kind === "commission" && (
        <div className="grid gap-5 sm:grid-cols-2">
          {field("wrist", "Wrist size (optional)", { placeholder: "e.g. 15.5 cm" })}
          {field("size", "Preferred case size", { placeholder: "e.g. 36 mm" })}
          {field("palette", "Colours or materials", { placeholder: "e.g. ivory dial, brown leather" })}
          {field("occasion", "Occasion (optional)", { placeholder: "A gift, an anniversary…" })}
        </div>
      )}
      <label className="block">
        <span className="field-label">{kind === "commission" ? "Tell us about the watch" : "Message"}</span>
        <textarea name="message" className={cn("field", kind === "commission" && "min-h-40")} aria-invalid={fields.message ? true : undefined} required />
        {fields.message && <span className="field-error">{fields.message}</span>}
      </label>
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      {error && <p role="alert" className="field-error">{error}</p>}
      <p className="text-[12px] text-taupe-ink">We use your details only to reply to you.</p>
      <button type="submit" className="btn btn-primary" disabled={state === "sending"}>
        {state === "sending" ? "Sending…" : kind === "commission" ? "Send commission request" : "Send message"}
      </button>
    </form>
  );
}
