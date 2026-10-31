import { DATA_DIR } from "@/data/repositories/dev-store";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { repos } from "@/data/repositories";
import { normalizePhone } from "@/domain/egypt";
import { CheckoutSchema, type Order, type OrderStatus, type PaymentStatus } from "@/domain/models";
import { findPromo } from "@/domain/pricing";
import { resolveStorefront } from "@/domain/storefront";
import { ipHash, json, requestIp, sameOrigin } from "@/server/http";
import { priceCart } from "@/server/pricing-service";
import { rateLimit } from "@/server/rate-limit";
import { PASS_COOKIE, signToken, verifyToken } from "@/server/session";

const MAX_EVIDENCE = 5 * 1024 * 1024;

function sniff(bytes: Uint8Array): { ext: string; type: string } | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { ext: "jpg", type: "image/jpeg" };
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return { ext: "png", type: "image/png" };
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45) return { ext: "webp", type: "image/webp" };
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return { ext: "pdf", type: "application/pdf" };
  return null;
}

export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "Refused." }, 403);
  const limit = rateLimit(`order:${requestIp(req)}`, 6, 10 * 60_000);
  if (!limit.ok) return json({ error: `Please wait ${limit.retryAfterS} seconds before trying again.` }, 429);

  const r = repos();
  const settings = await r.settings.get();
  const cookie = req.headers.get("cookie") ?? "";
  const passToken = /(?:^|;\s*)nv_pass=([^;]+)/.exec(cookie)?.[1];
  const pass = await verifyToken(passToken ? decodeURIComponent(passToken) : null, "pass");
  void PASS_COOKIE;
  const sf = resolveStorefront(settings.storefront, new Date(), { hasAccessPass: Boolean(pass) });
  if (!sf.checkoutOpen) return json({ error: settings.storefront.checkoutLockedMessage || "Ordering is paused at the moment." }, 403);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json({ error: "Invalid form." }, 400);
  }
  let payload: unknown;
  try {
    payload = JSON.parse(String(form.get("payload") ?? ""));
  } catch {
    return json({ error: "Invalid form." }, 400);
  }
  const parsed = CheckoutSchema.safeParse(payload);
  if (!parsed.success) {
    return json({ error: "Please check the highlighted fields.", fields: Object.fromEntries(parsed.error.issues.map((i) => [i.path.join("."), i.message])) }, 422);
  }
  const input = parsed.data;
  if (input.website) return json({ error: "Refused." }, 400); // honeypot

  const phone = normalizePhone(input.phone, { allowInternational: settings.allowInternationalPhones });
  if (!phone) return json({ error: "Please check the highlighted fields.", fields: { phone: "Enter an Egyptian mobile number, e.g. 010 1234 5678." } }, 422);
  const altPhone = input.altPhone ? normalizePhone(input.altPhone, { allowInternational: true }) : null;
  if (input.altPhone && !altPhone) return json({ error: "Please check the highlighted fields.", fields: { altPhone: "This number does not look right." } }, 422);

  const pay = settings.payments;
  const methodOk =
    (input.payment === "cod" && pay.cod.enabled && input.method === "delivery") ||
    (input.payment === "cop" && pay.cop.enabled && input.method === "pickup") ||
    (input.payment === "instapay" && pay.instapay.enabled && Boolean(pay.instapay.handle));
  if (!methodOk) return json({ error: "This payment option is not available.", fields: { payment: "Choose another payment option." } }, 422);
  if (input.method === "delivery" && !settings.shipping.delivery.enabled) return json({ error: "Delivery is not available at the moment." }, 422);
  if (input.method === "pickup" && !settings.shipping.pickup.enabled) return json({ error: "Pickup is not available at the moment." }, 422);

  const [catalog, products] = await Promise.all([r.catalog.get(), r.products.list()]);
  const priced = priceCart(input.items, { catalog, products, settings, promoCode: input.promoCode || null, method: input.method, governorate: input.governorate ?? null });
  if (!priced.ok) return json({ error: "Some pieces in your bag need attention.", lines: priced.lines.map((l) => ({ index: l.index, error: l.error })) }, 409);
  if (priced.totals.promoError) return json({ error: priced.totals.promoError, fields: { promoCode: priced.totals.promoError } }, 422);
  if (priced.totals.shippingMinor == null) return json({ error: "Delivery is not available for this address.", fields: { governorate: "Delivery is not available here yet." } }, 422);

  // Payment evidence (InstaPay only). Stored privately, never served publicly.
  const evidence: Order["payment"]["evidence"] = [];
  const file = form.get("evidence");
  if (file && typeof file !== "string" && file.size > 0) {
    if (input.payment !== "instapay" || !pay.instapay.evidenceUploadEnabled) return json({ error: "Evidence upload is not accepted for this payment option." }, 422);
    if (file.size > MAX_EVIDENCE) return json({ error: "The screenshot must be under 5 MB.", fields: { evidence: "Under 5 MB, please." } }, 422);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const kind = sniff(bytes);
    if (!kind) return json({ error: "Upload a JPG, PNG, WebP or PDF.", fields: { evidence: "JPG, PNG, WebP or PDF only." } }, 422);
    const id = randomUUID();
    const dir = path.join(DATA_DIR, "evidence");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, `${id}.${kind.ext}`), bytes);
    evidence.push({ id: `${id}.${kind.ext}`, name: file.name.slice(0, 80), type: kind.type, size: file.size, uploadedAt: new Date().toISOString() });
  }

  const now = new Date().toISOString();
  const reference = input.transferReference?.trim() || null;
  const status: OrderStatus = input.payment === "instapay" ? (reference ? "payment_under_review" : "awaiting_payment") : "received";
  const paymentStatus: PaymentStatus = input.payment === "instapay" ? (reference ? "under_review" : "awaiting") : input.payment === "cod" ? "due_on_delivery" : "due_on_pickup";

  const { order, duplicate } = await r.orders.create(
    {
      environment: r.driver === "dev" ? "development" : "production",
      createdAt: now,
      updatedAt: now,
      status,
      history: [{ status, at: now, by: "Customer", note: "Order placed online" }],
      customerId: randomUUID(),
      customer: { name: input.name, phone, altPhone, email: input.email.toLowerCase(), marketingConsent: input.marketingConsent, privacyAcceptedAt: now },
      fulfilment: {
        method: input.method,
        governorate: input.method === "delivery" ? (input.governorate ?? null) : null,
        city: input.method === "delivery" ? input.city || null : null,
        address: input.method === "delivery" ? input.address || null : null,
        landmark: input.method === "delivery" ? input.landmark || null : null,
        carrier: null,
        trackingNumber: null,
      },
      payment: { method: input.payment, status: paymentStatus, reference, evidence, confirmedAt: null, confirmedBy: null },
      items: priced.lines.map((l) => ({
        id: randomUUID(),
        kind: l.kind,
        name: l.name,
        buildRef: l.buildRef,
        encoded: l.encoded,
        productId: l.productId,
        quantity: l.quantity,
        unitMinor: l.unitMinor,
        lines: l.lines,
        components: l.components,
        engraving: l.configuration?.engraving ?? null,
      })),
      totals: {
        subtotalMinor: priced.totals.subtotalMinor,
        discountMinor: priced.totals.discountMinor,
        discountLabel: priced.totals.discountLabel,
        shippingMinor: priced.totals.shippingMinor,
        taxMinor: priced.totals.taxMinor,
        totalMinor: priced.totals.totalMinor,
      },
      promoCode: priced.totals.discountMinor > 0 ? (input.promoCode || "").toUpperCase() : null,
      customerNote: input.notes || null,
      internalNotes: [{ at: now, by: "System", text: `Submitted from ${await ipHash(req)} (hashed IP)` }],
    },
    input.idempotencyKey,
  );

  if (!duplicate) {
    const actor = { id: "system", label: "System (order)" };
    const componentDeltas = priced.lines.flatMap((l) => l.stock.componentIds.map((id) => ({ id, delta: -l.quantity })));
    await r.catalog.adjustStock(componentDeltas, actor);
    await r.products.adjustStock(priced.lines.filter((l) => l.stock.productId).map((l) => ({ id: l.stock.productId!, delta: -l.quantity })), actor);
    if (order.promoCode) {
      const s = await r.settings.get();
      const { promo } = findPromo(order.promoCode, s.pricing, new Date());
      if (promo) {
        await r.settings.update(
          { ...s, pricing: { ...s.pricing, promos: s.pricing.promos.map((p) => (p.code === promo.code ? { ...p, usedCount: p.usedCount + 1 } : p)) } },
          actor,
          `Promo ${promo.code} used by ${order.ref}`,
        );
      }
    }
  }

  const token = await signToken({ kind: "order", sub: order.ref, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 60 });
  return json({ ref: order.ref, token, duplicate }, duplicate ? 200 : 201);
}
