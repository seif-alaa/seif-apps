import { Bar, BarChart, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { useI18n } from "@/i18n";
import { ChartTooltip } from "./Tooltip";

/** Spending per day. One quiet colour; today in accent; a dashed line marks the daily average. */
export function DailyBars({ data, height = 140 }: { data: { day: number; date: Date; spending: number | null }[]; height?: number }) {
  const { t, day } = useI18n();
  const rows = data.map((d) => ({ ...d, value: d.spending === null ? null : d.spending / 100 }));
  const past = rows.filter((r) => r.value !== null);
  const avg = past.length ? past.reduce((s, r) => s + (r.value ?? 0), 0) / past.length : 0;
  const today = new Date().toDateString();
  return (
    <div style={{ height }} dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 6, right: 0, bottom: 0, left: 0 }} barCategoryGap={2}>
          <XAxis dataKey="day" tickLine={false} axisLine={{ stroke: "hsl(var(--rule))" }} ticks={[1, 8, 15, 22, rows.length]} interval={0} tick={{ fill: "hsl(var(--ink-3))", fontSize: 11 }} dy={4} />
          <Tooltip cursor={{ fill: "hsl(var(--sunken))" }} content={<ChartTooltip title={(r) => day((r.date as Date).getTime())} names={{ value: t("insights.spent") }} />} />
          {avg > 0 && <ReferenceLine y={avg} stroke="hsl(var(--ink-3))" strokeDasharray="3 4" strokeWidth={1} />}
          <Bar dataKey="value" radius={[2, 2, 0, 0]} isAnimationActive={false}>
            {rows.map((r) => (
              <Cell key={r.day} fill={r.date.toDateString() === today ? "hsl(var(--accent))" : "hsl(var(--ink) / 0.78)"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
