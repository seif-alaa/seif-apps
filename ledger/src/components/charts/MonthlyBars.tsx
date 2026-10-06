import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { useId } from "react";
import { ChartTooltip } from "./ChartTooltip";

type Row = { key: string; label: string; income: number; expense: number };

/** Income vs spending per month: rounded, gradient bars and no gridlines. */
export function MonthlyBars({ data, activeKey, onSelect, height = 190 }: { data: Row[]; activeKey?: string; onSelect?: (key: string) => void; height?: number }) {
  const id = useId().replace(/:/g, "");
  return (
    <div>
      <div className="mb-2 flex gap-4 text-[13px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-emerald" /> Money in
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-coral" /> Money out
        </span>
      </div>
      <div style={{ height }} className="-mx-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            barGap={2}
            barCategoryGap="22%"
            margin={{ top: 8, right: 4, bottom: 0, left: 4 }}
            onClick={(s) => s?.activePayload?.[0] && onSelect?.((s.activePayload[0].payload as Row).key)}
          >
            <defs>
              <linearGradient id={`in-${id}`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--emerald))" />
                <stop offset="100%" stopColor="hsl(var(--emerald))" stopOpacity={0.55} />
              </linearGradient>
              <linearGradient id={`out-${id}`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--coral))" />
                <stop offset="100%" stopColor="hsl(var(--coral))" stopOpacity={0.55} />
              </linearGradient>
            </defs>
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} dy={4} />
            <Tooltip cursor={{ fill: "hsl(var(--muted) / 0.6)", radius: 12 } as object} content={<ChartTooltip names={{ income: "Money in", expense: "Money out" }} />} />
            {(["income", "expense"] as const).map((k) => (
              <Bar
                key={k}
                dataKey={k}
                radius={[8, 8, 8, 8]}
                maxBarSize={18}
                fill={`url(#${k === "income" ? "in" : "out"}-${id})`}
                animationDuration={900}
                animationEasing="ease-out"
                // Fade months that aren't selected so the chosen one pops.
                shape={(props: any) => {
                  const { x, y, width, height: h, payload, fill } = props;
                  const dim = activeKey && payload.key !== activeKey;
                  if (!h || h <= 0) return <g />;
                  const r = Math.min(8, width / 2, h / 2);
                  return <rect x={x} y={y} width={width} height={h} rx={r} ry={r} fill={fill} opacity={dim ? 0.35 : 1} style={{ transition: "opacity .25s" }} />;
                }}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
