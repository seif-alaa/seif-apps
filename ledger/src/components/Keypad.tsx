import { Delete } from "lucide-react";
import { haptic } from "@/lib/haptics";
import { useI18n } from "@/i18n";

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

export function Keypad({ onKey, className }: { onKey: (k: string) => void; className?: string }) {
  const { num, lang } = useI18n();
  return (
    <div className={`grid grid-cols-3 gap-px overflow-hidden rounded border border-rule bg-rule ${className ?? ""}`} dir="ltr">
      {KEYS.map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => {
            haptic("light");
            onKey(k);
          }}
          className="fig flex h-11 items-center [@media(max-height:700px)]:h-10 justify-center bg-raised text-xl text-ink transition-colors active:bg-sunken"
          aria-label={k === "del" ? "Delete digit" : k}
        >
          {k === "del" ? <Delete className="size-5" strokeWidth={1.75} /> : k === "." ? (lang === "ar" ? "٫" : ".") : num(Number(k))}
        </button>
      ))}
    </div>
  );
}
