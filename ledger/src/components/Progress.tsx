import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export const toneColor = { good: "hsl(var(--emerald))", warn: "hsl(var(--amber))", over: "hsl(var(--coral))", neutral: "hsl(var(--muted-foreground))" } as const;
export type Tone = keyof typeof toneColor;

/** Rounded bar that fills with a spring; a tick marks where even pacing would be. */
export function ProgressBar({ value, tone = "good", pace, className }: { value: number; tone?: Tone; pace?: number; className?: string }) {
  const pct = Math.min(1, Math.max(0, value)) * 100;
  const c = toneColor[tone];
  return (
    <div className={cn("relative h-2.5 w-full overflow-visible rounded-full bg-muted", className)}>
      <motion.div
        className="h-full rounded-full"
        style={{ background: `linear-gradient(90deg, color-mix(in srgb, ${c} 65%, transparent), ${c})` }}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ type: "spring", stiffness: 90, damping: 20, delay: 0.1 }}
      />
      {pace !== undefined && pace > 0 && pace < 1 && (
        <div className="absolute -top-1 h-[18px] w-[2px] rounded-full bg-foreground/35" style={{ left: `${pace * 100}%` }} aria-hidden />
      )}
    </div>
  );
}

export function ProgressRing({ value, size = 120, stroke = 12, tone = "good", children }: { value: number; size?: number; stroke?: number; tone?: Tone; children?: React.ReactNode }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(1, Math.max(0, value));
  const c = toneColor[tone];
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={c}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ * (1 - pct) }}
          transition={{ type: "spring", stiffness: 60, damping: 18, delay: 0.15 }}
          style={{ filter: `drop-shadow(0 0 8px color-mix(in srgb, ${c} 45%, transparent))` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}
