"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { formatDelta, formatEGP } from "@/domain/money";
import { cn } from "@/lib/cn";

/** Restrained numeric transition for price changes (≈450 ms, ease-out). */
export function AnimatedPrice({ value, className }: { value: number; className?: string }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  const raf = useRef(0);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || a === value) {
      from.current = value;
      setShown(value);
      return;
    }
    cancelAnimationFrame(raf.current);
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / 480);
      const e = 1 - Math.pow(1 - p, 3);
      const v = Math.round((a + (value - a) * e) / 100) * 100;
      setShown(p === 1 ? value : v);
      from.current = p === 1 ? value : v;
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [value]);
  return (
    <>
      <span className={cn("tabular", className)} aria-hidden="true">
        {formatEGP(shown)}
      </span>
      <span className="sr-only" aria-live="polite">
        Total {formatEGP(value)}
      </span>
    </>
  );
}

export type Availability = "in_stock" | "low" | "made_to_order" | "out_of_stock";

export function StockNote({ status, leadTimeDays }: { status: Availability; leadTimeDays: number | null }) {
  if (status === "in_stock") return null;
  const text =
    status === "low" ? "Few left" : status === "made_to_order" ? `Ordered in${leadTimeDays ? ` · about ${leadTimeDays} days` : ""}` : "Unavailable";
  return <span className={cn("text-[11px]", status === "out_of_stock" ? "text-err" : "text-warn")}>{text}</span>;
}

/** Selectable option card. Disabled options keep their explanation visible. */
export function OptionCard({
  selected,
  disabled,
  onSelect,
  onIntent,
  thumb,
  title,
  meta,
  delta,
  reason,
  footnote,
  layout = "tile",
  testId,
}: {
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
  onIntent?: () => void;
  thumb?: ReactNode;
  title: string;
  meta?: ReactNode;
  delta: number | null;
  reason?: string | null;
  footnote?: ReactNode;
  layout?: "tile" | "row";
  testId?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-disabled={disabled || undefined}
      data-testid={testId}
      onClick={disabled ? undefined : onSelect}
      onPointerEnter={onIntent}
      onFocus={onIntent}
      className={cn(
        "group relative w-full text-left transition-[background-color,border-color,box-shadow] duration-200",
        "border bg-ivory",
        layout === "tile" ? "flex flex-col p-2.5" : "flex items-center gap-4 p-3",
        selected ? "border-espresso shadow-[inset_0_0_0_1px_var(--color-espresso)]" : "border-line hover:border-line-strong",
        disabled && "cursor-not-allowed bg-cream/40 hover:border-line",
      )}
    >
      {thumb && (
        <span className={cn("relative block overflow-hidden bg-cream/60", layout === "tile" ? "aspect-square w-full" : "h-16 w-16 shrink-0", disabled && "opacity-45 grayscale-[35%]")}>
          {thumb}
        </span>
      )}
      <span className={cn("flex min-w-0 flex-1 flex-col", layout === "tile" ? "pt-2.5" : "")}>
        <span className="flex items-start justify-between gap-2">
          <span className={cn("text-[13px] leading-snug", disabled ? "text-taupe-ink" : "text-espresso")}>{title}</span>
          {selected && (
            <span className="mt-0.5 shrink-0" aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 14 14">
                <circle cx="7" cy="7" r="6.5" fill="var(--color-espresso)" />
                <path d="M4 7.2l2 2 4-4.4" stroke="#f7f4ee" strokeWidth="1.4" fill="none" />
              </svg>
            </span>
          )}
        </span>
        {meta && <span className="mt-0.5 text-[11.5px] leading-snug text-taupe-ink">{meta}</span>}
        <span className="mt-1.5 flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5">
          {delta !== null && <span className="tabular text-[12px] text-espresso">{formatDelta(delta)}</span>}
          {footnote}
        </span>
        {disabled && reason && <span className="mt-1.5 text-[11.5px] leading-snug text-taupe-ink">{reason}</span>}
      </span>
    </button>
  );
}

/** Accessible modal dialog with focus trap and Escape to close. */
export function Dialog({ open, onClose, title, children, labelledBy = "dialog-title" }: { open: boolean; onClose: () => void; title: string; children: ReactNode; labelledBy?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const node = ref.current;
    const focusables = () => Array.from(node?.querySelectorAll<HTMLElement>("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])") ?? []).filter((el) => !el.hasAttribute("disabled"));
    focusables()[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const els = focusables();
        if (!els.length) return;
        const first = els[0];
        const last = els[els.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      prev?.focus();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center" role="presentation">
      <div className="absolute inset-0 bg-espresso/35" style={{ animation: "scrim-in 200ms ease both" }} onClick={onClose} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className="relative max-h-[88dvh] w-full overflow-y-auto bg-ivory p-6 shadow-[0_20px_60px_-20px_rgba(58,50,46,0.45)] sm:max-w-lg sm:p-8"
        style={{ animation: "fade-up 360ms var(--ease-settle) both" }}
      >
        <h2 id={labelledBy} className="display mb-4 text-[1.75rem]">
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}

/** Small, quiet notification. */
export function Toast({ message, onDone }: { message: string | null; onDone: () => void }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDone, 3600);
    return () => clearTimeout(t);
  }, [message, onDone]);
  if (!message) return null;
  return (
    <div role="status" className="pointer-events-none fixed inset-x-0 bottom-24 z-[65] flex justify-center px-4 lg:bottom-8">
      <p className="max-w-md bg-espresso px-5 py-3 text-center text-[13px] text-ivory shadow-lg" style={{ animation: "fade-up 320ms var(--ease-settle) both" }}>
        {message}
      </p>
    </div>
  );
}

/** Minute-track progress: one tick group per step. */
export function StepTrack({ steps, current, visited, onJump }: { steps: { id: string; index: string; title: string }[]; current: number; visited: Set<number>; onJump: (i: number) => void }) {
  return (
    <ol className="flex w-full items-end gap-1" aria-label="Steps">
      {steps.map((s, i) => {
        const active = i === current;
        const done = visited.has(i) && !active;
        return (
          <li key={s.id} className="flex-1">
            <button
              type="button"
              onClick={() => onJump(i)}
              aria-current={active ? "step" : undefined}
              aria-label={`Step ${s.index}: ${s.title}${done ? " (visited)" : ""}`}
              className="group flex min-h-9 w-full flex-col justify-end gap-1.5"
            >
              <span className="flex h-3.5 w-full items-end justify-between pr-[18%]" aria-hidden="true">
                {[0, 1, 2, 3, 4].map((t) => (
                  <span
                    key={t}
                    className={cn(
                      "w-px transition-[height,background-color] duration-500",
                      t === 0 ? (active ? "h-3.5" : "h-3") : t === 2 ? "h-2" : "h-1.5",
                      active ? "bg-espresso" : done ? "bg-taupe" : "bg-line-strong group-hover:bg-taupe/70",
                    )}
                  />
                ))}
              </span>
              <span className={cn("h-px w-full transition-colors duration-500", active ? "bg-espresso" : done ? "bg-taupe/60" : "bg-transparent")} aria-hidden="true" />
            </button>
          </li>
        );
      })}
    </ol>
  );
}
