import { repos } from "@/data/repositories";
import { computeMetrics, csvEscape, parseRange } from "@/server/analytics";
import { currentAdmin } from "@/server/auth";

export async function GET(req: Request) {
  if (!(await currentAdmin())) return new Response("Unauthorised", { status: 401 });
  const url = new URL(req.url);
  const m = computeMetrics(await repos().orders.list(), parseRange({ from: url.searchParams.get("from") ?? undefined, to: url.searchParams.get("to") ?? undefined }));
  const rows = [["day", "orders", "placed_egp", "confirmed_egp"], ...m.byDay.map(([d, v]) => [d, v.count, v.placed / 100, v.paid / 100])];
  return new Response(rows.map((r) => r.map(csvEscape).join(",")).join("\n"), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="nivore-analytics.csv"', "Cache-Control": "no-store" } });
}
