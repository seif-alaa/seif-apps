/**
 * Business details the site shows in several places. Change them here, in one file.
 * Everything marked TODO is a placeholder that must be replaced before launch.
 */

/** TODO: the real WhatsApp number, international format, digits only (Egypt: 20 + 10 digits, e.g. 201012345678). */
export const WHATSAPP_NUMBER = "20XXXXXXXXXX";

/** TODO: the real Instagram profile and contact email. */
export const INSTAGRAM_URL = "https://instagram.com/nivore.timepieces";
export const CONTACT_EMAIL = "hello@nivore.example";

/** Message the WhatsApp button opens with; the current page address is added after it. */
export const WHATSAPP_GREETING = "Hi NIVORÉ, I'm interested in ";

export const whatsappLink = (pageUrl?: string) => `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_GREETING + (pageUrl ?? ""))}`.trim();

/**
 * Trust strip under the hero. Each claim is shown exactly as written.
 * TODO: confirm every claim is true and is covered by your published policies before launch;
 * in particular the 1-year movement warranty (its terms need a page) and delivery coverage.
 */
export const TRUST_CLAIMS: readonly string[] = [
  "Cash on delivery", // TODO: confirm (also configurable in Admin → Payments)
  "Delivery across Egypt", // TODO: confirm coverage
  "1-year movement warranty", // TODO: confirm the warranty exists and publish its terms
  "Assembled and tested by hand", // TODO: confirm
];
