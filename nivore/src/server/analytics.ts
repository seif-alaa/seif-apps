import "server-only";
import type { Order } from "@/domain/models";

/**
 * Business metrics computed from stored orders only. Three figures are kept
 * strictly apart: value of orders placed, revenue actually confirmed as
 * received, and gross margin (only where every component cost is known).
 */

export interface Range {
  from: Date;
  to: Date;
}

const OPEN_PAYMENT = new Set(["awaiting", "under_review", "due_on_delivery", "due_on_pickup"]);
const IN_WORKSHOP = new Set(["confirmed", "payment_confirmed", "components_preparing", "assembly", "quality_check"]);

export function inRange(o: Order, r: Range) {
  const t = Date.parse(o.createdAt);
  return t >= r.from.getTime() && t <= r.to.getTime();
}

export function computeMetrics(all: Order[], range: Range) {
  const orders = all.filter((o) => inRange(o, range));
  const live = orders.filter((o) => o.status !== "cancelled" && o.status !== "refunded");
  const paid = live.filter((o) => o.payment.status === "confirmed");
  const placedValue = live.reduce((s, o) => s + o.totals.totalMinor, 0);
  const confirmedRevenue = paid.reduce((s, o) => s + o.totals.totalMinor, 0);
  const pendingValue = live.filter((o) => OPEN_PAYMENT.has(o.payment.status)).reduce((s, o) => s + o.totals.totalMinor, 0);

  let marginRevenue = 0;
  let marginCost = 0;
  let marginExcluded = 0;
  for (const o of paid) {
    const costs = o.items.flatMap((i) => i.components.map((c) => (c.costMinor == null ? null : c.costMinor * i.quantity)));
    if (!costs.length || costs.some((c) => c == null)) {
      marginExcluded++;
      continue;
    }
    marginRevenue += o.totals.totalMinor - o.totals.shippingMinor;
    marginCost += costs.reduce<number>((s, c) => s + (c ?? 0), 0);
  }

  const days = new Map<string, { placed: number; paid: number; count: number }>();
  for (const o of live) {
    const d = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(new Date(o.createdAt));
    const cur = days.get(d) ?? { placed: 0, paid: 0, count: 0 };
    cur.placed += o.totals.totalMinor;
    cur.count += 1;
    if (o.payment.status === "confirmed") cur.paid += o.totals.totalMinor;
    days.set(d, cur);
  }

  const tally = (pick: (o: Order) => string[]) => {
    const m = new Map<string, number>();
    for (const o of live) for (const k of pick(o)) m.set(k, (m.get(k) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  };
  const componentOf = (slot: string) => (o: Order) => o.items.flatMap((i) => i.components.filter((c) => c.slot === slot).map((c) => c.name));

  return {
    orderCount: live.length,
    cancelled: orders.filter((o) => o.status === "cancelled").length,
    placedValue,
    confirmedRevenue,
    pendingValue,
    pendingCount: live.filter((o) => OPEN_PAYMENT.has(o.payment.status)).length,
    aov: live.length ? Math.round(placedValue / live.length) : 0,
    margin: { revenue: marginRevenue, cost: marginCost, profit: marginRevenue - marginCost, excluded: marginExcluded },
    inWorkshop: live.filter((o) => IN_WORKSHOP.has(o.status)).length,
    completed: live.filter((o) => o.status === "delivered").length,
    customVsCatalog: {
      custom: live.reduce((s, o) => s + o.items.filter((i) => i.kind === "custom").reduce((n, i) => n + i.quantity, 0), 0),
      catalog: live.reduce((s, o) => s + o.items.filter((i) => i.kind === "catalog").reduce((n, i) => n + i.quantity, 0), 0),
    },
    byDay: [...days.entries()].sort((a, b) => a[0].localeCompare(b[0])),
    topWatches: tally((o) => o.items.map((i) => i.name)),
    topMovements: tally(componentOf("movement")),
    topDials: tally(componentOf("dial")),
    topBands: tally(componentOf("band")),
    developmentOrders: orders.filter((o) => o.environment === "development").length,
  };
}

export function parseRange(params: { from?: string; to?: string }): Range {
  const to = params.to ? new Date(`${params.to}T23:59:59+02:00`) : new Date();
  const from = params.from ? new Date(`${params.from}T00:00:00+02:00`) : new Date(to.getTime() - 29 * 86_400_000);
  return { from: Number.isNaN(from.getTime()) ? new Date(0) : from, to: Number.isNaN(to.getTime()) ? new Date() : to };
}

export function csvEscape(v: unknown): string {
  const s = v == null ? "" : String(v);
  // Neutralise spreadsheet formula injection.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}
