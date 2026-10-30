import { repos } from "@/data/repositories";
import { csvEscape } from "@/server/analytics";
import { currentAdmin } from "@/server/auth";

/** CSV export (admin only; also guarded by the proxy). */
export async function GET() {
  const admin = await currentAdmin();
  if (!admin) return new Response("Unauthorised", { status: 401 });
  const orders = await repos().orders.list();
  const rows = [
    ["ref", "placed_at", "environment", "status", "payment_method", "payment_status", "customer", "phone", "email", "governorate", "items", "subtotal_egp", "discount_egp", "delivery_egp", "total_egp"],
    ...orders.map((o) => [o.ref, o.createdAt, o.environment, o.status, o.payment.method, o.payment.status, o.customer.name, o.customer.phone, o.customer.email, o.fulfilment.governorate ?? "", o.items.map((i) => `${i.quantity}× ${i.name}${i.buildRef ? ` (${i.buildRef})` : ""}`).join("; "), o.totals.subtotalMinor / 100, o.totals.discountMinor / 100, o.totals.shippingMinor / 100, o.totals.totalMinor / 100]),
  ];
  await repos().misc.log({ actor: admin.label, action: "orders.export", entity: "order", entityId: "*", summary: `Exported ${orders.length} orders` });
  return new Response(rows.map((r) => r.map(csvEscape).join(",")).join("\n"), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="nivore-orders-${new Date().toISOString().slice(0, 10)}.csv"`, "Cache-Control": "no-store" },
  });
}
