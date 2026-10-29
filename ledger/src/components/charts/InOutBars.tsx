import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { useI18n } from "@/i18n";
import { ChartTooltip } from "./Tooltip";

type Row = { key: string; month: Date; income: number; spending: number };

/** Money in vs spending per month. Selected month at full strength, others recede. */
export function InOutBars({ data, selected, onSelect, height = 170 }: { data: Row[]; selected: string; onSelect: (key: string) => void; height?: number }) {
  const { t, date } = useI18n();
  const rows = data.map((d) => ({ ...d, label: date(d.month, "MMM"), inV: d.income / 100, outV: d.spending / 100 }));
  return (
    <div>
      <div className="mb-3 flex gap-4 text-xs text-ink-2">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-[2px] bg-pos" /> {t("insights.moneyIn")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-[2px] bg-ink" /> {t("insights.spent")}
        </span>
      </div>
      <div style={{ height }} dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} barGap={2} barCategoryGap="28%" margin={{ top: 4, right: 0, bottom: 0, left: 0 }} onClick={(s) => s?.activePayload?.[0] && onSelect((s.activePayload[0].payload as Row).key)}>
            <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "hsl(var(--rule))" }} tick={{ fill: "hsl(var(--ink-3))", fontSize: 11 }} dy={4} />
            <Tooltip cursor={{ fill: "hsl(var(--sunken))" }} content={<ChartTooltip title={(r) => date(r.month as Date, "MMMM yyyy")} names={{ inV: t("insights.moneyIn"), outV: t("insights.spent") }} />} />
            {(["inV", "outV"] as const).map((k) => (
              <Bar
                key={k}
                dataKey={k}
                maxBarSize={14}
                isAnimationActive={false}
                shape={(props: unknown) => {
                  const p = props as { x: number; y: number; width: number; height: number; payload: Row };
                  if (!p.height || p.height <= 0) return <g />;
                  const dim = p.payload.key !== selected;
                  return <rect x={p.x} y={p.y} width={p.width} height={p.height} rx={2} fill={k === "inV" ? "hsl(var(--pos))" : "hsl(var(--ink))"} opacity={dim ? 0.28 : 1} />;
                }}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
