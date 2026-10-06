import { motion } from "framer-motion";
import { useId } from "react";
import { cn } from "@/lib/utils";
import { haptic } from "@/lib/haptics";

interface Props<T extends string> {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: React.ReactNode; activeClass?: string }[];
  className?: string;
}

/** iOS-style segmented control with a sliding spring pill. */
export function Segmented<T extends string>({ value, onChange, options, className }: Props<T>) {
  const id = useId();
  return (
    <div className={cn("relative flex rounded-2xl bg-muted p-1", className)} role="tablist">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            onClick={() => {
              if (!active) haptic("light");
              onChange(o.value);
            }}
            className={cn(
              "relative z-10 flex-1 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
              active ? o.activeClass ?? "text-foreground" : "text-muted-foreground",
            )}
          >
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                className="absolute inset-0 -z-10 rounded-xl bg-card shadow-soft dark:bg-input"
                transition={{ type: "spring", stiffness: 500, damping: 38 }}
              />
            )}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
