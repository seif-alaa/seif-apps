"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function WaitlistForm() {
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setState("busy");
    const res = await fetch("/api/waitlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: fd.get("email"), website: fd.get("website") }) });
    if (res.ok) setState("done");
    else {
      setState("idle");
      setError((await res.json().catch(() => ({}))).error ?? "Please try again.");
    }
  }
  if (state === "done") return <p role="status" className="serif text-xl italic">Thank you. We will write once, when we open.</p>;
  return (
    <form onSubmit={submit} className="flex w-full max-w-md flex-col gap-3 sm:flex-row">
      <label className="flex-1">
        <span className="sr-only">Email</span>
        <input type="email" name="email" required placeholder="Your email" className="field !bg-ivory/80" />
      </label>
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      <button className="btn btn-primary" disabled={state === "busy"}>Notify me</button>
      {error && <p role="alert" className="field-error sm:basis-full">{error}</p>}
    </form>
  );
}

export function AccessForm({ next }: { next: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch("/api/gate/access", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: new FormData(e.currentTarget).get("code") }) });
    setBusy(false);
    if (res.ok) {
      router.replace(next.startsWith("/") && !next.startsWith("//") ? next : "/");
      router.refresh();
    } else setError((await res.json().catch(() => ({}))).error ?? "That code is not recognised.");
  }
  return (
    <form onSubmit={submit} className="flex w-full max-w-md flex-col gap-3 sm:flex-row">
      <label className="flex-1">
        <span className="sr-only">Access code</span>
        <input name="code" required autoComplete="off" placeholder="Access code" className="field uppercase tracking-[0.2em]" />
      </label>
      <button className="btn btn-primary" disabled={busy}>Enter</button>
      {error && <p role="alert" className="field-error sm:basis-full">{error}</p>}
    </form>
  );
}
