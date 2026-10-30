import { z } from "zod";
import { GOVERNORATES } from "./egypt";
import { ConfigurationSchema, EngravingSchema } from "./configuration";
import type { QuoteLine } from "./pricing";

/* ── Products (completed NIVORÉ builds) ───────────────────────────────── */

export const ProductStatus = z.enum(["draft", "active", "scheduled", "hidden", "archived"]);

export const ProductSchema = z.object({
  id: z.string(),
  slug: z.string().regex(/^[a-z0-9-]{2,80}$/),
  name: z.string().min(2).max(80), // "ALBA 38"
  dialLabel: z.string().max(40), // "Ivory"
  subtitle: z.string().max(140),
  description: z.string().max(4000),
  collectionIds: z.array(z.string()),
  priceMinor: z.number().int().nonnegative(),
  compareAtMinor: z.number().int().nonnegative().nullable(),
  /** Component configuration this piece is built from (drives specs and preview). */
  configuration: ConfigurationSchema,
  images: z.array(z.object({ src: z.string(), alt: z.string(), width: z.number().int(), height: z.number().int() })),
  extraSpecs: z.array(z.object({ label: z.string().max(40), value: z.string().max(120) })),
  stockQuantity: z.number().int().nonnegative(),
  status: ProductStatus,
  releaseAt: z.string().nullable(),
  featured: z.boolean(),
  soldOut: z.boolean(),
  allowCustomization: z.boolean(),
  maxPerOrder: z.number().int().min(1).max(10),
  seo: z.object({ title: z.string().max(70), description: z.string().max(170) }),
  sortOrder: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Product = z.infer<typeof ProductSchema>;

export const CollectionSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  description: z.string(),
  sortOrder: z.number().int(),
});
export type Collection = z.infer<typeof CollectionSchema>;

export function isProductVisible(p: Product, now: Date): boolean {
  if (p.status === "active") return true;
  if (p.status === "scheduled" && p.releaseAt) return now.getTime() >= Date.parse(p.releaseAt);
  return false;
}

/* ── Orders ────────────────────────────────────────────────────────────── */

export const ORDER_STATUSES = [
  "pending_submission",
  "received",
  "awaiting_payment",
  "payment_under_review",
  "payment_confirmed",
  "confirmed",
  "components_preparing",
  "assembly",
  "quality_check",
  "ready_for_dispatch",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending_submission: "Pending submission",
  received: "Received — awaiting atelier review",
  awaiting_payment: "Awaiting payment",
  payment_under_review: "Payment under review",
  payment_confirmed: "Payment confirmed",
  confirmed: "Confirmed",
  components_preparing: "Components being prepared",
  assembly: "Assembly in progress",
  quality_check: "Quality check",
  ready_for_dispatch: "Ready for dispatch",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

/** Customer-facing wording for the order-status page. */
export const ORDER_STATUS_PUBLIC: Record<OrderStatus, string> = {
  ...ORDER_STATUS_LABEL,
  received: "Received. The atelier will review and contact you.",
  payment_under_review: "We are checking your transfer. Nothing is needed from you.",
};

export const PAYMENT_METHODS = ["cod", "cop", "instapay"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  cod: "Cash on delivery",
  cop: "Cash on pickup",
  instapay: "InstaPay transfer",
};

export const PaymentStatus = z.enum(["awaiting", "under_review", "confirmed", "due_on_delivery", "due_on_pickup", "refunded", "void"]);
export type PaymentStatus = z.infer<typeof PaymentStatus>;
export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  awaiting: "Awaiting payment",
  under_review: "Under review",
  confirmed: "Confirmed received",
  due_on_delivery: "Due on delivery",
  due_on_pickup: "Due on pickup",
  refunded: "Refunded",
  void: "Void",
};

export interface ComponentSnapshot {
  slot: string;
  componentId: string;
  name: string;
  sku: string;
  priceMinor: number;
  /** Server-only: cost at time of order, for margin reporting. */
  costMinor: number | null;
  spec: Record<string, unknown>;
}

export interface OrderItem {
  id: string;
  kind: "custom" | "catalog";
  name: string;
  buildRef: string | null;
  encoded: string | null; // share-URL query for custom builds
  productId: string | null;
  quantity: number;
  unitMinor: number;
  lines: QuoteLine[];
  components: ComponentSnapshot[];
  engraving: z.infer<typeof EngravingSchema> | null;
}

export interface StatusEvent {
  status: OrderStatus;
  at: string;
  by: string;
  note: string;
}

export interface Order {
  id: string;
  ref: string;
  environment: "development" | "production";
  createdAt: string;
  updatedAt: string;
  status: OrderStatus;
  history: StatusEvent[];
  customerId: string;
  customer: {
    name: string;
    phone: string;
    altPhone: string | null;
    email: string;
    marketingConsent: boolean;
    privacyAcceptedAt: string;
  };
  fulfilment: {
    method: "delivery" | "pickup";
    governorate: string | null;
    city: string | null;
    address: string | null;
    landmark: string | null;
    carrier: string | null;
    trackingNumber: string | null;
  };
  payment: {
    method: PaymentMethod;
    status: PaymentStatus;
    reference: string | null;
    evidence: { id: string; name: string; type: string; size: number; uploadedAt: string }[];
    confirmedAt: string | null;
    confirmedBy: string | null;
  };
  items: OrderItem[];
  totals: {
    subtotalMinor: number;
    discountMinor: number;
    discountLabel: string | null;
    shippingMinor: number;
    taxMinor: number;
    totalMinor: number;
  };
  promoCode: string | null;
  customerNote: string | null;
  internalNotes: { at: string; by: string; text: string }[];
}

/* ── Checkout input (shared by client form and server route) ─────────── */

export const CheckoutItemSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("custom"), configuration: ConfigurationSchema, quantity: z.number().int().min(1).max(10) }),
  z.object({ kind: z.literal("catalog"), productId: z.string().min(1), quantity: z.number().int().min(1).max(10) }),
]);
export type CheckoutItem = z.infer<typeof CheckoutItemSchema>;

export const CheckoutSchema = z
  .object({
    items: z.array(CheckoutItemSchema).min(1, "Your bag is empty.").max(10),
    name: z.string().trim().min(3, "Please enter your full name.").max(80),
    phone: z.string().trim().min(8, "Please enter a mobile number.").max(24),
    altPhone: z.string().trim().max(24).optional().or(z.literal("")),
    email: z.email("Please enter a valid email address.").max(120),
    method: z.enum(["delivery", "pickup"]),
    governorate: z.enum(GOVERNORATES).optional(),
    city: z.string().trim().max(80).optional().or(z.literal("")),
    address: z.string().trim().max(240).optional().or(z.literal("")),
    landmark: z.string().trim().max(120).optional().or(z.literal("")),
    notes: z.string().trim().max(600).optional().or(z.literal("")),
    payment: z.enum(PAYMENT_METHODS),
    transferReference: z.string().trim().max(60).optional().or(z.literal("")),
    promoCode: z.string().trim().max(24).optional().or(z.literal("")),
    privacyAccepted: z.literal(true, { error: "Please accept the privacy notice to continue." }),
    marketingConsent: z.boolean(),
    /** Honeypot. Must be empty. */
    website: z.string().max(0).optional().or(z.literal("")),
    idempotencyKey: z.string().min(8).max(64),
  })
  .superRefine((v, ctx) => {
    if (v.method === "delivery") {
      if (!v.governorate) ctx.addIssue({ code: "custom", path: ["governorate"], message: "Please choose a governorate." });
      if (!v.city || v.city.length < 2) ctx.addIssue({ code: "custom", path: ["city"], message: "Please enter your city or area." });
      if (!v.address || v.address.length < 6) ctx.addIssue({ code: "custom", path: ["address"], message: "Please enter the street, building and apartment." });
      if (v.payment === "cop") ctx.addIssue({ code: "custom", path: ["payment"], message: "Cash on pickup needs the pickup option." });
    } else if (v.payment === "cod") {
      ctx.addIssue({ code: "custom", path: ["payment"], message: "Cash on delivery needs the delivery option." });
    }
  });
export type CheckoutInput = z.infer<typeof CheckoutSchema>;

/* ── Customers ─────────────────────────────────────────────────────────── */

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  createdAt: string;
  lastOrderAt: string | null;
  orderRefs: string[];
  marketingConsent: boolean;
  addresses: { governorate: string | null; city: string | null; address: string | null; landmark: string | null }[];
  notes: { at: string; by: string; text: string }[];
}

/* ── Misc records ─────────────────────────────────────────────────────── */

export interface Inquiry {
  id: string;
  kind: "contact" | "commission";
  createdAt: string;
  name: string;
  email: string;
  phone: string | null;
  message: string;
  details: Record<string, string>;
  status: "new" | "replied" | "closed";
}

export interface WaitlistEntry {
  id: string;
  email: string;
  createdAt: string;
  source: string;
}

export interface AuditEntry {
  id: string;
  at: string;
  actor: string;
  action: string;
  entity: string;
  entityId: string;
  summary: string;
  before?: unknown;
  after?: unknown;
}

export interface BidderProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  verified: boolean;
  createdAt: string;
  publicLabel: string;
}
