import { Area, AreaChart, Line, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { useId } from "react";
import { ChartTooltip } from "./ChartTooltip";

type Point = { day: number; label: string; spent: number | null; pace: number | null };

/**
 * Cumulative spend through the month against an even-pace budget line.
 * The area turns coral once you're ahead of pace, emerald when you're under.
 */
export function SpendingTrend({ data, height = 150 }: { data: Point[]; height?: number }) {
  const id = useId().replace(/:/g, "");
  const last = [...data].reverse().find((d) => d.spent !== null);
  const over = !!(last && last.pace !== null && last.spent! > last.pace);
  const color = over ? "hsl(var(--coral))" : "hsl(var(--emerald))";
  const hasPace = data.some((d) => d.pace);
  return (
    <div style={{ height }} className="-mx-1">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 6, bottom: 0, left: 6 }}>
          <defs>
            <linearGradient id={`g-${id}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.38} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="day"
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
            ticks={[1, 8, 15, 22, data.length]}
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
            dy={4}
          />
          <Tooltip
            cursor={{ stroke: "hsl(var(--muted-foreground) / 0.4)", strokeWidth: 1, strokeDasharray: "3 3" }}
            content={<ChartTooltip names={{ spent: "Spent", pace: "Budget pace" }} />}
          />
          {hasPace && (
            <Line type="linear" dataKey="pace" stroke="hsl(var(--muted-foreground) / 0.55)" strokeDasharray="4 5" strokeWidth={1.5} dot={false} isAnimationActive={false} />
          )}
          <Area
            type="monotone"
            dataKey="spent"
            stroke={color}
            strokeWidth={2}
            fill={`url(#g-${id})`}
            connectNulls={false}
            activeDot={{ r: 5, strokeWidth: 2, stroke: "hsl(var(--card))", fill: color }}
            animationDuration={1100}
            animationEasing="ease-out"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
