"use server";

import { randomBytes, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { repos } from "@/data/repositories";
import { AuctionSchema, type Auction } from "@/domain/auction";
import { CompatRecordSchema, ComponentSchema, MovementFamilySchema, PreviewAssetSchema } from "@/domain/catalog";
import { ORDER_STATUSES, PaymentStatus, ProductSchema, type OrderStatus } from "@/domain/models";
import { PricingSettingsSchema, ShippingSettingsSchema } from "@/domain/pricing";
import { ContentSchema, SettingsSchema } from "@/domain/settings";
import { StorefrontSettingsSchema } from "@/domain/storefront";
import { assertSameOrigin, requireAdmin } from "@/server/auth";
import { sha256Hex } from "@/server/session";

type Result = { ok: boolean; error?: string };

async function guard() {
  await assertSameOrigin();
  return requireAdmin();
}

function issues(e: z.ZodError): string {
  return e.issues
    .slice(0, 4)
    .map((i) => `${i.path.join(".") || "value"}: ${i.message}`)
    .join(" · ");
}

function refreshStorefront() {
  revalidatePath("/", "layout");
}

/* ── Components & catalogue ───────────────────────────────────────────── */

export async function saveComponent(input: unknown, isNew: boolean): Promise<Result> {
  const actor = await guard();
  const parsed = ComponentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: issues(parsed.error) };
  const catalog = await repos().catalog.get();
  const clashId = catalog.components.find((c) => c.id === parsed.data.id);
  if (isNew && clashId) return { ok: false, error: "A component with this id already exists." };
  if (catalog.components.some((c) => c.code === parsed.data.code && c.id !== parsed.data.id)) return { ok: false, error: "This share code is already used by another component." };
  if (!isNew && clashId && clashId.type !== parsed.data.type) return { ok: false, error: "A component's type cannot be changed." };
  await repos().catalog.upsertComponent(parsed.data, actor);
  refreshStorefront();
  return { ok: true };
}

export async function setComponentActive(id: string, active: boolean): Promise<Result> {
  const actor = await guard();
  await repos().catalog.setComponentActive(id, active, actor);
  refreshStorefront();
  return { ok: true };
}

export async function saveMovementFamily(input: unknown): Promise<Result> {
  const actor = await guard();
  const parsed = MovementFamilySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: issues(parsed.error) };
  await repos().catalog.upsertMovementFamily(parsed.data, actor);
  refreshStorefront();
  return { ok: true };
}

export async function saveCompat(input: unknown): Promise<Result> {
  const actor = await guard();
  const parsed = CompatRecordSchema.safeParse({ updatedAt: new Date().toISOString(), id: randomUUID(), ...(input as object) });
  if (!parsed.success) return { ok: false, error: issues(parsed.error) };
  if (parsed.data.aId === parsed.data.bId) return { ok: false, error: "Choose two different components." };
  const catalog = await repos().catalog.get();
  const existing = catalog.compat.find((r) => (r.aId === parsed.data.aId && r.bId === parsed.data.bId) || (r.aId === parsed.data.bId && r.bId === parsed.data.aId));
  await repos().catalog.upsertCompat({ ...parsed.data, id: existing?.id ?? parsed.data.id }, actor);
  refreshStorefront();
  return { ok: true };
}

export async function deleteCompat(id: string): Promise<Result> {
  const actor = await guard();
  await repos().catalog.deleteCompat(id, actor);
  refreshStorefront();
  return { ok: true };
}

export async function saveAsset(input: unknown): Promise<Result> {
  const actor = await guard();
  const parsed = PreviewAssetSchema.safeParse({ id: randomUUID(), updatedAt: new Date().toISOString(), ...(input as object) });
  if (!parsed.success) return { ok: false, error: issues(parsed.error) };
  if (!parsed.data.src.startsWith("/uploads/")) return { ok: false, error: "Upload the image through the asset manager." };
  await repos().catalog.upsertAsset(parsed.data, actor);
  refreshStorefront();
  return { ok: true };
}

export async function deleteAsset(id: string): Promise<Result> {
  const actor = await guard();
  await repos().catalog.deleteAsset(id, actor);
  refreshStorefront();
  return { ok: true };
}

/* ── Products ────────────────────────────────────────────────────────── */

export async function saveProduct(input: unknown, isNew: boolean): Promise<Result & { id?: string }> {
  const actor = await guard();
  const now = new Date().toISOString();
  const parsed = ProductSchema.safeParse({ createdAt: now, updatedAt: now, ...(input as object) });
  if (!parsed.success) return { ok: false, error: issues(parsed.error) };
  const existing = await repos().products.get(parsed.data.id);
  if (isNew && existing) return { ok: false, error: "A product with this id already exists." };
  if (parsed.data.status === "scheduled" && !parsed.data.releaseAt) return { ok: false, error: "Scheduled products need a release time." };
  try {
    await repos().products.upsert(parsed.data, actor);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  refreshStorefront();
  return { ok: true, id: parsed.data.id };
}

export async function duplicateProduct(id: string): Promise<Result & { id?: string }> {
  const actor = await guard();
  const p = await repos().products.get(id);
  if (!p) return { ok: false, error: "Not found." };
  const suffix = randomBytes(2).toString("hex");
  const copy = { ...p, id: `${p.id}-${suffix}`, slug: `${p.slug}-copy-${suffix}`, status: "draft" as const, featured: false, createdAt: new Date().toISOString() };
  await repos().products.upsert(copy, actor);
  revalidatePath("/admin/products");
  return { ok: true, id: copy.id };
}

/* ── Settings, pricing, content, storefront ──────────────────────────── */

export async function savePricing(input: { pricing: unknown; shipping: unknown }): Promise<Result> {
  const actor = await guard();
  const pricing = PricingSettingsSchema.safeParse(input.pricing);
  if (!pricing.success) return { ok: false, error: issues(pricing.error) };
  const shipping = ShippingSettingsSchema.safeParse(input.shipping);
  if (!shipping.success) return { ok: false, error: issues(shipping.error) };
  const codes = pricing.data.promos.map((p) => p.code);
  if (new Set(codes).size !== codes.length) return { ok: false, error: "Promo codes must be unique." };
  const s = await repos().settings.get();
  await repos().settings.update({ ...s, pricing: pricing.data, shipping: shipping.data }, actor, "Pricing and delivery updated");
  refreshStorefront();
  return { ok: true };
}

const SETTINGS_SECTIONS = ["business", "payments", "notifications", "seo", "policies", "previewNotice", "allowInternationalPhones"] as const;

export async function saveSettings(input: Record<string, unknown>): Promise<Result> {
  const actor = await guard();
  const s = await repos().settings.get();
  const next = { ...s };
  for (const k of SETTINGS_SECTIONS) if (k in input) (next as Record<string, unknown>)[k] = input[k];
  const parsed = SettingsSchema.safeParse(next);
  if (!parsed.success) return { ok: false, error: issues(parsed.error) };
  if (parsed.data.payments.instapay.enabled && !parsed.data.payments.instapay.handle) return { ok: false, error: "Add the InstaPay address before enabling InstaPay." };
  await repos().settings.update(parsed.data, actor, "Website settings updated");
  refreshStorefront();
  return { ok: true };
}

export async function saveContent(input: unknown): Promise<Result> {
  const actor = await guard();
  const parsed = ContentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: issues(parsed.error) };
  await repos().content.update(parsed.data, actor);
  refreshStorefront();
  return { ok: true };
}

export async function saveStorefront(input: unknown): Promise<Result> {
  const actor = await guard();
  const s = await repos().settings.get();
  const parsed = StorefrontSettingsSchema.safeParse({ ...(input as object), accessCodes: s.storefront.accessCodes });
  if (!parsed.success) return { ok: false, error: issues(parsed.error) };
  if (parsed.data.mode === "scheduled" && !parsed.data.launchAt) return { ok: false, error: "Scheduled launch needs a launch date and time." };
  await repos().settings.update({ ...s, storefront: parsed.data }, actor, `Storefront mode: ${parsed.data.mode}${parsed.data.checkoutLocked ? " (checkout locked)" : ""}`);
  refreshStorefront();
  return { ok: true };
}

export async function createAccessCode(label: string): Promise<Result & { code?: string }> {
  const actor = await guard();
  const code = randomBytes(5).toString("hex").toUpperCase();
  const s = await repos().settings.get();
  const entry = { id: randomUUID(), label: label.slice(0, 60) || "Guest", codeHash: await sha256Hex(code), active: true, createdAt: new Date().toISOString() };
  await repos().settings.update({ ...s, storefront: { ...s.storefront, accessCodes: [...s.storefront.accessCodes, entry] } }, actor, `Access code created: ${entry.label}`);
  revalidatePath("/admin/storefront");
  return { ok: true, code };
}

export async function revokeAccessCode(id: string): Promise<Result> {
  const actor = await guard();
  const s = await repos().settings.get();
  await repos().settings.update({ ...s, storefront: { ...s.storefront, accessCodes: s.storefront.accessCodes.map((c) => (c.id === id ? { ...c, active: false } : c)) } }, actor, "Access code revoked");
  revalidatePath("/admin/storefront");
  return { ok: true };
}

/* ── Orders & customers ──────────────────────────────────────────────── */

export async function setOrderStatus(ref: string, status: string, note: string): Promise<Result> {
  const actor = await guard();
  if (!ORDER_STATUSES.includes(status as OrderStatus)) return { ok: false, error: "Unknown status." };
  await repos().orders.setStatus(ref, status as OrderStatus, note.slice(0, 280), actor);
  revalidatePath(`/admin/orders/${ref}`);
  return { ok: true };
}

export async function setPaymentStatus(ref: string, status: string): Promise<Result> {
  const actor = await guard();
  const parsed = PaymentStatus.safeParse(status);
  if (!parsed.success) return { ok: false, error: "Unknown payment status." };
  const r = repos();
  await r.orders.setPaymentStatus(ref, parsed.data, actor);
  const order = await r.orders.get(ref);
  // Confirming an InstaPay transfer moves an unpaid order forward, with a history entry.
  if (parsed.data === "confirmed" && order && ["awaiting_payment", "payment_under_review"].includes(order.status)) {
    await r.orders.setStatus(ref, "payment_confirmed", "Transfer confirmed received by the atelier", actor);
  }
  revalidatePath(`/admin/orders/${ref}`);
  return { ok: true };
}

export async function addOrderNote(ref: string, text: string): Promise<Result> {
  const actor = await guard();
  if (!text.trim()) return { ok: false, error: "Write a note first." };
  await repos().orders.addNote(ref, text.trim().slice(0, 1000), actor);
  revalidatePath(`/admin/orders/${ref}`);
  return { ok: true };
}

export async function updateFulfilment(ref: string, patch: Record<string, string>): Promise<Result> {
  const actor = await guard();
  const allowed = ["governorate", "city", "address", "landmark", "carrier", "trackingNumber"] as const;
  const clean = Object.fromEntries(allowed.filter((k) => k in patch).map((k) => [k, String(patch[k]).slice(0, 240) || null]));
  await repos().orders.updateFulfilment(ref, clean, actor);
  revalidatePath(`/admin/orders/${ref}`);
  return { ok: true };
}

export async function addCustomerNote(id: string, text: string): Promise<Result> {
  const actor = await guard();
  if (!text.trim()) return { ok: false, error: "Write a note first." };
  await repos().customers.addNote(id, text.trim().slice(0, 1000), actor);
  revalidatePath(`/admin/customers/${id}`);
  return { ok: true };
}

export async function setInquiryStatus(id: string, status: "new" | "replied" | "closed"): Promise<Result> {
  const actor = await guard();
  await repos().misc.setInquiryStatus(id, status, actor);
  revalidatePath("/admin/inquiries");
  return { ok: true };
}

/* ── Auctions ─────────────────────────────────────────────────────────── */

export async function saveAuction(input: unknown, isNew: boolean): Promise<Result & { id?: string }> {
  const actor = await guard();
  const now = new Date().toISOString();
  const base = isNew ? { currentBidMinor: 0, bidCount: 0, leadingBidderId: null, winner: null, version: 0, archived: false, createdAt: now } : {};
  const existing = isNew ? null : await repos().auctions.get((input as { id: string }).id);
  const merged = { ...base, ...(existing ? { currentBidMinor: existing.currentBidMinor, bidCount: existing.bidCount, leadingBidderId: existing.leadingBidderId, winner: existing.winner, version: existing.version, archived: existing.archived, createdAt: existing.createdAt } : {}), ...(input as object), updatedAt: now };
  const parsed = AuctionSchema.safeParse(merged);
  if (!parsed.success) return { ok: false, error: issues(parsed.error) };
  if (Date.parse(parsed.data.closesAt) <= Date.parse(parsed.data.opensAt)) return { ok: false, error: "Closing time must be after opening time." };
  if (existing && existing.bidCount > 0 && (existing.startingBidMinor !== parsed.data.startingBidMinor || existing.incrementMinor !== parsed.data.incrementMinor)) {
    return { ok: false, error: "Starting bid and increment cannot change once bids exist." };
  }
  if (parsed.data.mode === "live" && repos().driver === "dev") return { ok: false, error: "Live mode needs the durable database and bidder verification (see docs/PRODUCTION.md)." };
  try {
    await repos().auctions.upsert(parsed.data, actor);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  revalidatePath("/rare-pieces");
  revalidatePath("/admin/auctions");
  return { ok: true, id: parsed.data.id };
}

export async function auctionAction(id: string, kind: "settle" | "confirm-winner" | "payment-confirmed" | "sold" | "unsold" | "cancel" | "archive" | "reopen-schedule"): Promise<Result> {
  const actor = await guard();
  const r = repos();
  const a = await r.auctions.get(id);
  if (!a) return { ok: false, error: "Not found." };
  if (kind === "settle") {
    const settled = await r.auctions.settle(id, actor);
    if (settled.adminStatus === "scheduled") return { ok: false, error: "The auction has not closed yet." };
  } else {
    const now = new Date().toISOString();
    const patch: Partial<Auction> =
      kind === "confirm-winner"
        ? { winner: a.winner ? { ...a.winner, confirmedAt: now } : null }
        : kind === "payment-confirmed"
          ? { winner: a.winner ? { ...a.winner, paymentConfirmedAt: now } : null }
          : kind === "sold"
            ? { adminStatus: "sold" }
            : kind === "unsold"
              ? { adminStatus: "unsold" }
              : kind === "cancel"
                ? { adminStatus: "cancelled" }
                : kind === "archive"
                  ? { archived: true, published: false }
                  : { adminStatus: "scheduled" };
    if ((kind === "confirm-winner" || kind === "payment-confirmed") && !a.winner) return { ok: false, error: "There is no winner to confirm." };
    if (kind === "sold" && !a.winner?.paymentConfirmedAt) return { ok: false, error: "Confirm the winner's payment before marking the piece sold." };
    await r.auctions.upsert({ ...a, ...patch }, actor);
  }
  revalidatePath(`/admin/auctions/${id}`);
  revalidatePath("/rare-pieces");
  return { ok: true };
}
