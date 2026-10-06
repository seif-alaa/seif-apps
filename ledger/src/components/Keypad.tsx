import { motion } from "framer-motion";
import { Delete } from "lucide-react";
import { haptic } from "@/lib/haptics";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "del"] as const;

/** Apply a keypad press to an amount string like "12.5". */
export function pressKey(value: string, key: string, maxDecimals = 2) {
  if (key === "del") return value.slice(0, -1);
  if (key === ".") return maxDecimals === 0 || value.includes(".") ? value : (value || "0") + ".";
  const [, dec] = value.split(".");
  if (dec !== undefined && dec.length >= maxDecimals) return value;
  if (value.replace(".", "").length >= 9) return value;
  if (value === "0") return key;
  return value + key;
}

export const toMinor = (v: string) => Math.round((parseFloat(v || "0") || 0) * 100);
export const fromMinor = (n: number) => {
  const s = (n / 100).toFixed(2);
  return s.endsWith(".00") ? s.slice(0, -3) : s.replace(/0$/, "");
};

export function Keypad({ onKey, className }: { onKey: (k: string) => void; className?: string }) {
  return (
    <div className={`grid grid-cols-3 gap-1.5 ${className ?? ""}`}>
      {KEYS.map((k) => (
        <motion.button
          key={k}
          type="button"
          whileTap={{ scale: 0.88, backgroundColor: "hsl(var(--accent))" }}
          transition={{ type: "spring", stiffness: 700, damping: 28 }}
          onClick={() => {
            haptic("light");
            onKey(k);
          }}
          className="num flex h-11 items-center justify-center rounded-2xl bg-muted/60 text-[22px] font-medium text-foreground"
          aria-label={k === "del" ? "Delete digit" : k}
        >
          {k === "del" ? <Delete className="size-6" /> : k}
        </motion.button>
      ))}
    </div>
  );
}
