import type { TooltipProps } from "recharts";
import { useI18n } from "@/i18n";

export function ChartTooltip({ active, payload, title, names }: TooltipProps<number, string> & { title?: (p: Record<string, unknown>) => string; names?: Record<string, string> }) {
  const { money } = useI18n();
  if (!active || !payload?.length) return null;
  const row = payload[0].payload as Record<string, unknown>;
  return (
    <div className="min-w-[140px] rounded bg-raised px-3 py-2 text-xs shadow-pop ring-1 ring-rule">
      {title && <div className="mb-1 font-medium text-ink-3">{title(row)}</div>}
      {payload.map((p) => (
        <div key={String(p.dataKey)} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-ink-2">
            <span className="size-2 rounded-[2px]" style={{ background: p.color }} />
            {names?.[String(p.dataKey)] ?? p.name}
          </span>
          <span className="fig font-medium text-ink">{money(Number(p.value) * 100, undefined, { cents: false })}</span>
        </div>
      ))}
    </div>
  );
}
