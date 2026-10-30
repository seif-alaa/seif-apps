import { z } from "zod";
import { repos } from "@/data/repositories";
import { CheckoutItemSchema } from "@/domain/models";
import { json, readJson, requestIp, sameOrigin } from "@/server/http";
import { priceCart } from "@/server/pricing-service";
import { rateLimit } from "@/server/rate-limit";

const Body = z.object({
  items: z.array(CheckoutItemSchema).max(10),
  promoCode: z.string().max(24).optional().nullable(),
  method: z.enum(["delivery", "pickup"]).optional().nullable(),
  governorate: z.string().max(40).optional().nullable(),
});

/** Server-side re-pricing for the bag and checkout. Never trusts client prices. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "Refused." }, 403);
  if (!rateLimit(`quote:${requestIp(req)}`, 60, 60_000).ok) return json({ error: "Too many requests." }, 429);
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) return json({ error: "Invalid request." }, 400);
  const r = repos();
  const [catalog, products, settings] = await Promise.all([r.catalog.get(), r.products.list(), r.settings.get()]);
  const priced = priceCart(parsed.data.items, { catalog, products, settings, promoCode: parsed.data.promoCode, method: parsed.data.method, governorate: parsed.data.governorate });
  return json({
    ok: priced.ok,
    totals: priced.totals,
    lines: priced.lines.map((l) => ({
      index: l.index,
      ok: l.ok,
      error: l.error,
      name: l.name,
      detail: l.detail,
      quantity: l.quantity,
      unitMinor: l.unitMinor,
      buildRef: l.buildRef,
      encoded: l.encoded,
      lines: l.lines,
      leadTimeDays: l.leadTimeDays,
    })),
  });
}
