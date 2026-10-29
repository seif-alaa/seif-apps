import { motion } from "framer-motion";
import { useId } from "react";
import { cn } from "@/lib/utils";
import { haptic } from "@/lib/haptics";

interface Props<T extends string> {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: React.ReactNode; disabled?: boolean }[];
  className?: string;
  size?: "sm" | "md";
}

export function Segmented<T extends string>({ value, onChange, options, className, size = "md" }: Props<T>) {
  const id = useId();
  return (
    <div className={cn("relative flex rounded bg-sunken p-0.5", className)} role="radiogroup">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={o.disabled}
            onClick={() => {
              if (!active) haptic("light");
              onChange(o.value);
            }}
            className={cn(
              "relative z-10 flex-1 rounded-sm px-2 font-medium transition-colors disabled:opacity-35",
              size === "sm" ? "h-8 text-sm" : "h-9 text-sm",
              active ? "text-ink" : "text-ink-3",
            )}
          >
            {active && <motion.span layoutId={`seg-${id}`} className="absolute inset-0 -z-10 rounded-sm bg-raised shadow-[0_1px_2px_hsl(var(--shadow)/0.12)] ring-1 ring-rule" transition={{ type: "spring", stiffness: 600, damping: 45 }} />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
