import { animate, useMotionValue, useMotionValueEvent, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { moneyParts, type MoneyOpts, useI18n } from "@/i18n";
import { usePrefs } from "@/store/ui";
import { cn } from "@/lib/utils";

interface Props extends MoneyOpts {
  value: number;
  currency?: string;
  className?: string;
  /** Visual size: decimals and currency code are set smaller than the integer. */
  size?: "sm" | "md" | "lg" | "hero";
  tone?: "auto" | "ink" | "muted" | "pos" | "neg";
  /** Smoothly tween when the value changes (balances). Off for lists. */
  animateChanges?: boolean;
}

const SIZE = {
  sm: { int: "text-sm", minor: "text-sm", cur: "text-2xs" },
  md: { int: "text-base", minor: "text-base", cur: "text-2xs" },
  lg: { int: "text-xl", minor: "text-md", cur: "text-xs" },
  hero: { int: "text-figure font-normal", minor: "text-xl font-normal", cur: "text-sm" },
};

/**
 * Money is always: tabular figures, a real minus sign, the currency code set
 * small and quiet, decimals lighter than the whole units.
 */
export function Money({ value, currency, className, size = "md", tone = "ink", animateChanges, ...opts }: Props) {
  const { locale, currency: base, dir } = useI18n();
  const hidden = usePrefs((s) => s.hideAmounts);
  const reduce = useReducedMotion();
  const shown = useTween(value, !!animateChanges && !reduce);
  const p = moneyParts(Math.round(shown), currency ?? base, locale, opts);
  const s = SIZE[size];
  const color = tone === "auto" ? (value > 0 && opts.signed ? "text-pos" : "text-ink") : { ink: "text-ink", muted: "text-ink-3", pos: "text-pos", neg: "text-neg" }[tone];
  const cur = <span className={cn(s.cur, "font-medium text-ink-3", p.currencyFirst ? "me-1" : "ms-1")}>{p.currency}</span>;
  return (
    <span className={cn("fig inline-flex items-baseline whitespace-nowrap", color, className)} dir={dir}>
      {/* "−EGP 640" in LTR; in RTL the sign stays attached to the digits: "−٦٤٠ ج.م." */}
      {p.sign && p.currencyFirst && <span className={cn(s.int, "me-px")}>{p.sign}</span>}
      {p.currencyFirst && cur}
      {/* Digits always run left-to-right, even inside an RTL sentence. */}
      <span dir="ltr" className="inline-flex items-baseline">
        {p.sign && !p.currencyFirst && <span className={cn(s.int, "me-px")}>{p.sign}</span>}
        {hidden ? (
          <span className={s.int} aria-label="hidden">
            ••••
          </span>
        ) : (
          <>
            <span className={s.int}>{p.integer}</span>
            {p.fraction && <span className={cn(s.minor, "opacity-55")}>{p.fraction}</span>}
          </>
        )}
      </span>
      {!p.currencyFirst && cur}
    </span>
  );
}

function useTween(value: number, enabled: boolean) {
  const mv = useMotionValue(value);
  const [v, setV] = useState(value);
  const first = useRef(true);
  useMotionValueEvent(mv, "change", (x) => setV(x));
  useEffect(() => {
    if (first.current || !enabled) {
      first.current = false;
      mv.jump(value);
      setV(value);
      return;
    }
    const c = animate(mv, value, { duration: 0.45, ease: [0.2, 0.8, 0.2, 1] });
    return c.stop;
  }, [value, enabled, mv]);
  return v;
}
