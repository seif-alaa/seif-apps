import { z } from "zod";
import { repos } from "@/data/repositories";
import { normalizePhone } from "@/domain/egypt";
import { ORDER_STATUS_PUBLIC, PAYMENT_STATUS_LABEL } from "@/domain/models";
import { json, readJson, requestIp, sameOrigin } from "@/server/http";
import { rateLimit } from "@/server/rate-limit";

const Body = z.object({ ref: z.string().trim().max(20), phone: z.string().trim().max(24) });

/** Status lookup by reference + phone. Returns no personal data beyond a first name. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "Refused." }, 403);
  if (!rateLimit(`status:${requestIp(req)}`, 10, 10 * 60_000).ok) return json({ error: "Too many attempts. Please try again later." }, 429);
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) return json({ error: "Enter your order reference and mobile number." }, 400);
  const phone = normalizePhone(parsed.data.phone, { allowInternational: true });
  const order = await repos().orders.get(parsed.data.ref.toUpperCase());
  // Same response for "not found" and "wrong phone" to avoid confirming references.
  if (!order || !phone || order.customer.phone !== phone) return json({ error: "We could not find an order with those details." }, 404);
  return json({
    ref: order.ref,
    firstName: order.customer.name.split(" ")[0],
    status: order.status,
    statusLabel: ORDER_STATUS_PUBLIC[order.status],
    payment: PAYMENT_STATUS_LABEL[order.payment.status],
    placedAt: order.createdAt,
    history: order.history.map((h) => ({ label: ORDER_STATUS_PUBLIC[h.status], at: h.at })),
    items: order.items.map((i) => ({ name: i.name, quantity: i.quantity })),
    development: order.environment === "development",
  });
}
