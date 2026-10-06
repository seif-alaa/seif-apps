import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

/** Big entry amount: each new digit springs in, and the whole thing shrinks as it grows. */
export function AmountDisplay({ value, symbol, tone, shakeKey }: { value: string; symbol: string; tone: "expense" | "income"; shakeKey: number }) {
  const chars = (value || "0").split("");
  const len = chars.length;
  const size = len > 8 ? "text-[40px]" : len > 6 ? "text-[48px]" : "text-[52px]";
  return (
    <motion.div
      key={shakeKey}
      animate={shakeKey ? { x: [0, -10, 9, -6, 4, 0] } : undefined}
      transition={{ duration: 0.4 }}
      className={cn("num flex items-baseline justify-center font-semibold leading-none", size, tone === "income" ? "text-emerald" : "text-foreground", !value && "opacity-40")}
    >
      <span className="mr-1 text-[0.5em] font-medium text-muted-foreground">{symbol}</span>
      <AnimatePresence initial={false} mode="popLayout">
        {chars.map((c, i) => (
          <motion.span
            key={`${i}-${c}`}
            layout
            initial={{ y: 18, opacity: 0, scale: 0.7 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -14, opacity: 0, scale: 0.7 }}
            transition={{ type: "spring", stiffness: 600, damping: 30 }}
          >
            {c}
          </motion.span>
        ))}
      </AnimatePresence>
    </motion.div>
  );
}
