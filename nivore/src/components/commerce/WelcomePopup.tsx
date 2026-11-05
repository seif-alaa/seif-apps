"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { parseContact, WELCOME_CODE } from "@/domain/contact";
import { popupAllowed, writeWelcome } from "@/lib/welcome";

const BLOCKED = [/^\/checkout/, /^\/admin/, /^\/gate/, /^\/order/];
const DELAY_MS = 6000;
const IDLE_MS = 3000;
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([tabindex="-1"]), [tabindex]:not([tabindex="-1"])';

/**
 * First-visit offer: 5% off the first order. Opens once, 6 s after the first page load or on desktop
 * exit-intent (whichever comes first), never on /checkout, and never within 3 s of a click (so it
 * does not interrupt the builder). Closing hides it for 14 days; completing hides it for good.
 */
export function WelcomePopup() {
  const pathname = usePathname();
  const blocked = BLOCKED.some((r) => r.test(pathname));
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);
  const lastClick = useRef(0);
  const shown = useRef(false);

  // Opening: timer or exit-intent, whichever comes first, held back while the visitor is mid-interaction.
  useEffect(() => {
    if (blocked || shown.current || !popupAllowed()) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onClick = () => (lastClick.current = Date.now());
    const trigger = () => {
      if (shown.current) return;
      const wait = IDLE_MS - (Date.now() - lastClick.current);
      if (wait > 0) {
        timer = setTimeout(trigger, wait + 50);
        return;
      }
      shown.current = true;
      returnTo.current = document.activeElement as HTMLElement | null;
      setOpen(true);
    };
    const onLeave = (e: MouseEvent) => {
      if (e.clientY <= 0 && !e.relatedTarget && window.matchMedia("(hover: hover)").matches) trigger();
    };
    window.addEventListener("pointerdown", onClick, true);
    document.addEventListener("mouseout", onLeave);
    timer = setTimeout(trigger, DELAY_MS);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("pointerdown", onClick, true);
      document.removeEventListener("mouseout", onLeave);
    };
  }, [blocked]);

  const close = useCallback(
    (completed = false) => {
      setOpen(false);
      if (!completed) writeWelcome({ state: "closed", at: Date.now() });
      requestAnimationFrame(() => returnTo.current?.focus?.({ preventScroll: true }));
    },
    [],
  );

  // Dialog behaviour: focus in, Esc closes, Tab stays inside, page behind does not scroll.
  useEffect(() => {
    if (!open || blocked) return;
    const root = panel.current;
    root?.querySelector<HTMLElement>("input, [data-autofocus]")?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close(Boolean(done));
      } else if (e.key === "Tab" && root) {
        const items = [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) (e.preventDefault(), last.focus());
        else if (!e.shiftKey && document.activeElement === last) (e.preventDefault(), first.focus());
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, blocked, close, done]);

  if (!open || blocked) return null;

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const contact = parseContact(value);
    if (!contact) {
      setError("Enter a valid email address or an Egyptian mobile number, e.g. 010 1234 5678.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contact: value, consent, website: String(fd.get("website") ?? "") }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Something went wrong. Please try again.");
      writeWelcome({ state: "done", at: Date.now(), code: data.code ?? WELCOME_CODE, contact: data.contact ?? contact.value });
      setDone(data.code ?? WELCOME_CODE);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(done ?? WELCOME_CODE);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-6" data-testid="welcome-popup">
      <div className="absolute inset-0 bg-espresso/45" style={{ animation: "layer-fade 200ms ease both" }} onClick={() => close(Boolean(done))} aria-hidden="true" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-title"
        className="relative z-10 max-h-[92dvh] w-full overflow-y-auto bg-ivory px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-7 shadow-[0_-18px_48px_-24px_rgba(58,50,46,0.55)] sm:max-w-[26rem] sm:px-8 sm:pb-8 sm:shadow-[0_24px_64px_-24px_rgba(58,50,46,0.55)]"
        style={{ animation: "fade-up 320ms var(--ease-settle) both" }}
      >
        <button type="button" onClick={() => close(Boolean(done))} aria-label="Close" className="absolute right-3 top-3 grid h-11 w-11 place-items-center text-taupe-ink hover:text-espresso">
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.2" /></svg>
        </button>
        {done ? (
          <div data-testid="welcome-done">
            <p className="eyebrow">Your first order</p>
            <h2 id="welcome-title" className="display mt-2 text-[1.9rem] leading-tight">Your code</h2>
            <div className="mt-5 flex items-stretch gap-2">
              <p className="tabular flex-1 border border-line-strong bg-cream px-4 py-3 text-center text-[1.15rem] font-medium tracking-[0.18em]" data-testid="welcome-code">{done}</p>
              <button type="button" className="btn btn-outline !min-h-12" onClick={copy}>{copied ? "Copied" : "Copy"}</button>
            </div>
            <p className="mt-3 text-[13px] text-taupe-ink">Applied automatically at checkout.</p>
            <button type="button" data-autofocus className="btn btn-primary mt-6 w-full" onClick={() => close(true)}>Continue browsing</button>
          </div>
        ) : (
          <form onSubmit={submit} noValidate>
            <p className="eyebrow">Welcome</p>
            <h2 id="welcome-title" className="display mt-2 text-[1.9rem] leading-tight">5% off your first NIVORÉ</h2>
            <p className="mt-3 text-[14px] leading-relaxed text-taupe-ink">Leave your email or mobile number and we&rsquo;ll send your code.</p>
            <label className="mt-5 block">
              <span className="field-label">Email or mobile number</span>
              <input
                className="field"
                name="contact"
                type="text"
                inputMode="email"
                autoComplete="email"
                placeholder="you@email.com or 010 1234 5678"
                value={value}
                onChange={(e) => (setValue(e.target.value), setError(null))}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "welcome-error" : undefined}
              />
            </label>
            {/* Honeypot: hidden from people and assistive tech */}
            <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 opacity-0" />
            <label className="mt-4 flex min-h-11 items-start gap-3 text-[13px] leading-snug">
              <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-espresso)]" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span>Send me offers and new drops. I can unsubscribe anytime.</span>
            </label>
            {error && <p id="welcome-error" role="alert" className="field-error !mt-2">{error}</p>}
            <button type="submit" className="btn btn-primary mt-5 w-full" disabled={pending}>{pending ? "One moment…" : "Get my 5%"}</button>
            <button type="button" className="mt-2 min-h-11 w-full text-[12.5px] text-taupe-ink underline-offset-4 hover:text-espresso hover:underline" onClick={() => close(false)}>No thanks</button>
          </form>
        )}
      </div>
    </div>
  );
}
