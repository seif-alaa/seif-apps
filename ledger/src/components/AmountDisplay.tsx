import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n";

/** Entry amount. Shakes once if the user tries to save zero. */
export function AmountDisplay({ value, currency, tone, shakeKey }: { value: string; currency: string; tone: "in" | "out" | "neutral"; shakeKey: number }) {
  const { num } = useI18n();
  const [int, dec] = (value || "0").split(".");
  const shown = num(Number(int || 0));
  return (
    <motion.div
      key={shakeKey}
      animate={shakeKey ? { x: [0, -8, 7, -4, 0] } : undefined}
      transition={{ duration: 0.3 }}
      className={cn("fig flex items-baseline justify-center gap-2 leading-none", !value && "opacity-40")}
      dir="ltr"
    >
      <span className="text-sm font-medium text-ink-3">{currency}</span>
      <span className={cn("text-[44px] font-light tracking-tight", tone === "in" ? "text-pos" : "text-ink")}>
        {shown}
        {dec !== undefined && <span className="opacity-55">.{dec}</span>}
      </span>
    </motion.div>
  );
}
