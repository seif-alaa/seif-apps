import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { PullToRefresh } from "./PullToRefresh";

/** Route wrapper: one scroll container, a short fade between routes. */
export function Page({ children, onRefresh }: { children: ReactNode; onRefresh?: () => Promise<unknown> | void }) {
  return (
    <motion.div className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.08 } }} transition={{ duration: 0.16 }}>
      <PullToRefresh onRefresh={onRefresh}>
        <div className="mx-auto max-w-[560px] pb-28">{children}</div>
      </PullToRefresh>
    </motion.div>
  );
}

export function TopBar({ title, leading, actions, sub }: { title: ReactNode; leading?: ReactNode; actions?: ReactNode; sub?: ReactNode }) {
  return (
    <header className="flex items-end justify-between gap-3 px-5 pb-3 pt-[calc(env(safe-area-inset-top)+14px)]">
      <div className="flex min-w-0 items-center gap-1">
        {leading}
        <div className="min-w-0">
          {sub && <div className="eyebrow mb-0.5">{sub}</div>}
          <h1 className="truncate text-xl font-semibold">{title}</h1>
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
    </header>
  );
}

/** A section is a label and a hairline — not a card. */
export function Section({ title, action, children, className, flush }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; flush?: boolean }) {
  return (
    <section className={cn("pt-7", className)}>
      {(title || action) && (
        <div className="flex items-baseline justify-between px-5 pb-2">
          {title && <h2 className="eyebrow">{title}</h2>}
          {action}
        </div>
      )}
      <div className={cn(!flush && "border-y border-rule bg-surface")}>{children}</div>
    </section>
  );
}

export function SectionLink({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-0.5 text-sm font-medium text-accent-ink">
      {children}
      <ChevronRight className="size-4 rtl:rotate-180" />
    </button>
  );
}

/** Standard list row: leading mark, title/subtitle, trailing value. Rows are divided by inset hairlines. */
export function Row({
  leading,
  title,
  subtitle,
  trailing,
  onClick,
  chevron,
  className,
}: {
  leading?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  onClick?: () => void;
  chevron?: boolean;
  className?: string;
}) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp onClick={onClick} className={cn("group relative flex w-full min-h-[56px] items-center gap-3 px-5 py-2.5 text-start", onClick && "tap", className)}>
      {leading}
      <div className="min-w-0 flex-1">
        <div className="truncate text-base font-medium leading-snug">{title}</div>
        {subtitle && <div className="truncate text-sm text-ink-3">{subtitle}</div>}
      </div>
      {trailing && <div className="shrink-0 text-end">{trailing}</div>}
      {chevron && <ChevronRight className="size-4 shrink-0 text-ink-4 rtl:rotate-180" />}
      <span className="pointer-events-none absolute bottom-0 end-0 start-[68px] h-px bg-rule group-last:hidden" />
    </Comp>
  );
}

export function Tag({ children, tone = "neutral", className }: { children: ReactNode; tone?: "neutral" | "accent" | "pos" | "neg" | "warn" | "outline"; className?: string }) {
  const tones = {
    neutral: "bg-sunken text-ink-2",
    accent: "bg-accent-wash text-accent-ink",
    pos: "bg-pos-wash text-pos",
    neg: "bg-neg-wash text-neg",
    warn: "bg-warn-wash text-warn",
    outline: "border border-rule-strong text-ink-3",
  };
  return <span className={cn("inline-flex h-[18px] items-center gap-1 rounded-xs px-1.5 text-2xs font-medium", tones[tone], className)}>{children}</span>;
}

/** Thin meter with an optional pace tick (where even spending would be today). */
export function Meter({ value, pace, status = "on_track", className }: { value: number; pace?: number; status?: "on_track" | "watch" | "over"; className?: string }) {
  const color = { on_track: "bg-ink", watch: "bg-warn", over: "bg-neg" }[status];
  return (
    <div className={cn("relative h-1 w-full rounded-full bg-rule", className)}>
      <motion.div className={cn("absolute inset-y-0 start-0 rounded-full", color)} initial={false} animate={{ width: `${Math.min(1, Math.max(0, value)) * 100}%` }} transition={{ type: "spring", stiffness: 200, damping: 30 }} />
      {pace !== undefined && pace > 0 && pace < 1 && <span className="absolute -top-1 h-3 w-px bg-ink-3" style={{ insetInlineStart: `${pace * 100}%` }} aria-hidden />}
    </div>
  );
}

export function Empty({ icon, title, body, action }: { icon: ReactNode; title: string; body: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-8 py-12 text-center">
      <div className="mb-4 text-ink-4 [&_svg]:size-7">{icon}</div>
      <div className="text-md font-semibold">{title}</div>
      <p className="mt-1 max-w-[300px] text-sm leading-relaxed text-ink-3">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
