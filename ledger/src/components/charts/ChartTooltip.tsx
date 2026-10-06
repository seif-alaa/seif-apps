import type { TooltipProps } from "recharts";
import { formatMoney } from "@/lib/format";
import { usePrefs } from "@/store/ui";

/** Glassy tooltip shared by all charts. Values are in major units. */
export function ChartTooltip({ active, payload, label, names }: TooltipProps<number, string> & { names?: Record<string, string> }) {
  const currency = usePrefs((s) => s.currency);
  if (!active || !payload?.length) return null;
  const rows = payload.filter((p) => p.value !== null && p.value !== undefined);
  if (!rows.length) return null;
  return (
    <div className="glass min-w-[140px] rounded-2xl px-3 py-2.5 text-[13px] shadow-lift">
      <div className="mb-1 font-medium text-muted-foreground">{rows[0]?.payload?.label ?? label}</div>
      {rows.map((p) => (
        <div key={String(p.dataKey)} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-foreground/80">
            <span className="size-2 rounded-full" style={{ background: p.color }} />
            {names?.[String(p.dataKey)] ?? p.name}
          </span>
          <span className="num font-semibold text-foreground">{formatMoney(Math.round(Number(p.value) * 100), currency, { cents: false })}</span>
        </div>
      ))}
    </div>
  );
}
