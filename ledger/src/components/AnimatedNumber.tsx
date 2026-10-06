import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import { useEffect } from "react";
import { formatMoney, type MoneyOpts } from "@/lib/format";
import { usePrefs } from "@/store/ui";
import { cn } from "@/lib/utils";

interface Props extends MoneyOpts {
  /** Minor units (cents). */
  value: number;
  className?: string;
  /** Start counting from zero on first mount. */
  fromZero?: boolean;
  duration?: number;
}

/** Money that counts up/down smoothly whenever its value changes. */
export function Money({ value, className, fromZero = true, duration = 0.9, ...opts }: Props) {
  const currency = usePrefs((s) => s.currency);
  const hidden = usePrefs((s) => s.hideAmounts);
  const reduce = useReducedMotion();
  const mv = useMotionValue(fromZero && !reduce ? 0 : value);
  const text = useTransform(mv, (v) => formatMoney(Math.round(v), currency, opts));

  useEffect(() => {
    if (reduce) {
      mv.set(value);
      return;
    }
    const c = animate(mv, value, { duration, ease: [0.16, 1, 0.3, 1] });
    return c.stop;
  }, [value, duration, mv, reduce]);

  if (hidden) return <span className={cn("num", className)}>••••</span>;
  return <motion.span className={cn("num", className)}>{text}</motion.span>;
}

/** Plain count-up for non-currency figures (percentages, counts). */
export function CountUp({ value, className, suffix = "", decimals = 0 }: { value: number; className?: string; suffix?: string; decimals?: number }) {
  const mv = useMotionValue(0);
  const text = useTransform(mv, (v) => `${v.toFixed(decimals)}${suffix}`);
  useEffect(() => {
    const c = animate(mv, value, { duration: 0.9, ease: [0.16, 1, 0.3, 1] });
    return c.stop;
  }, [value, mv]);
  return <motion.span className={cn("num", className)}>{text}</motion.span>;
}
