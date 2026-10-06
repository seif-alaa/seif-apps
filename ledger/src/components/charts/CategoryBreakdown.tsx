import { motion } from "framer-motion";
import type { CategorySpend } from "@/lib/stats";
import { CategoryBadge } from "../CategoryBadge";
import { Money } from "../AnimatedNumber";

/**
 * Labelled horizontal bars — easier to read than a donut and every row
 * carries its emoji + name, so colour is never the only cue.
 */
export function CategoryBreakdown({ rows, limit = 6 }: { rows: CategorySpend[]; limit?: number }) {
  const top = rows.slice(0, limit);
  const rest = rows.slice(limit);
  const max = Math.max(1, ...top.map((r) => r.amount));
  return (
    <div className="space-y-3.5">
      {top.map((r, i) => (
        <div key={r.category.id} className="flex items-center gap-3">
          <CategoryBadge category={r.category} size="sm" />
          <div className="min-w-0 flex-1">
            <div className="mb-1.5 flex items-baseline justify-between gap-2 text-sm">
              <span className="truncate font-medium">{r.category.name}</span>
              <span className="flex items-baseline gap-2">
                <span className="num text-xs text-muted-foreground">{Math.round(r.share * 100)}%</span>
                <Money value={r.amount} cents={false} className="font-semibold" />
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted">
              <motion.div
                className="h-full rounded-full"
                style={{ background: `var(--series-${r.category.slot})` }}
                initial={{ width: 0 }}
                animate={{ width: `${(r.amount / max) * 100}%` }}
                transition={{ type: "spring", stiffness: 80, damping: 18, delay: 0.05 * i }}
              />
            </div>
          </div>
        </div>
      ))}
      {rest.length > 0 && (
        <div className="pl-12 text-[13px] text-muted-foreground">
          + {rest.length} more {rest.length === 1 ? "category" : "categories"} · <Money value={rest.reduce((s, r) => s + r.amount, 0)} cents={false} />
        </div>
      )}
    </div>
  );
}
