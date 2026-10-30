import { z } from "zod";
import { PricingSettingsSchema, ShippingSettingsSchema } from "./pricing";
import { StorefrontSettingsSchema } from "./storefront";

/**
 * Website settings and editable content. Policy bodies are `null` until the
 * business supplies them; the storefront then shows a clear "pending" notice
 * instead of invented terms.
 */

const PolicySchema = z.object({ title: z.string(), body: z.string().nullable(), updatedAt: z.string().nullable() });

export const POLICY_KEYS = ["shipping", "returns", "care", "privacy", "terms", "auction-terms"] as const;
export type PolicyKey = (typeof POLICY_KEYS)[number];

export const BusinessSettingsSchema = z.object({
  displayName: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  whatsapp: z.string().nullable(),
  instagram: z.string().nullable(),
  city: z.string(),
  hours: z.string().nullable(),
  /** Reply-time promise; null shows nothing rather than an invented figure. */
  replyWithinDays: z.number().int().positive().nullable(),
  assemblyLeadTime: z.string().nullable(),
});

export const PaymentSettingsSchema = z.object({
  cod: z.object({ enabled: z.boolean(), note: z.string().max(240) }),
  cop: z.object({ enabled: z.boolean(), note: z.string().max(240) }),
  instapay: z.object({
    enabled: z.boolean(),
    /** InstaPay address / handle the business publishes (e.g. name@instapay). */
    handle: z.string().max(80).nullable(),
    accountName: z.string().max(80).nullable(),
    instructions: z.string().max(1200),
    evidenceUploadEnabled: z.boolean(),
  }),
});

export const NotificationSettingsSchema = z.object({
  /** No provider is connected yet. The UI must never claim a message was sent. */
  emailProvider: z.enum(["none", "resend", "smtp"]),
  orderAlertsTo: z.string().nullable(),
  customerConfirmations: z.boolean(),
});

export const SettingsSchema = z.object({
  business: BusinessSettingsSchema,
  payments: PaymentSettingsSchema,
  shipping: ShippingSettingsSchema,
  pricing: PricingSettingsSchema,
  storefront: StorefrontSettingsSchema,
  notifications: NotificationSettingsSchema,
  seo: z.object({ title: z.string().max(70), description: z.string().max(170) }),
  policies: z.record(z.enum(POLICY_KEYS), PolicySchema),
  /** Show the "preview build / sample data" ribbon on the storefront. */
  previewNotice: z.boolean(),
  allowInternationalPhones: z.boolean(),
});
export type Settings = z.infer<typeof SettingsSchema>;

export const ContentSchema = z.object({
  banner: z.object({ enabled: z.boolean(), text: z.string().max(140), href: z.string().nullable() }),
  hero: z.object({
    eyebrow: z.string(),
    headline: z.string(),
    body: z.string(),
    image: z.string().nullable(),
    imageAlt: z.string(),
  }),
  intro: z.object({ headline: z.string(), body: z.string(), body2: z.string() }),
  process: z.array(z.object({ title: z.string(), body: z.string() })),
  craft: z.object({ eyebrow: z.string(), headline: z.string(), points: z.array(z.object({ title: z.string(), body: z.string() })) }),
  packaging: z.object({ headline: z.string(), body: z.string(), image: z.string().nullable() }),
  ordering: z.array(z.object({ title: z.string(), body: z.string() })),
  featuredProductIds: z.array(z.string()),
  featuredAuctionId: z.string().nullable(),
  collectionBanner: z.object({ headline: z.string(), body: z.string() }),
  atelier: z.object({
    headline: z.string(),
    paragraphs: z.array(z.string()),
    values: z.array(z.object({ title: z.string(), body: z.string() })),
  }),
  faq: z.array(z.object({ q: z.string(), a: z.string() })),
  footer: z.object({ tagline: z.string(), disclosure: z.string() }),
  announcement: z.object({ enabled: z.boolean(), headline: z.string(), body: z.string() }),
});
export type Content = z.infer<typeof ContentSchema>;
