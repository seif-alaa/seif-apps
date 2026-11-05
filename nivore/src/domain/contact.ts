import { normalizeEgyptianMobile } from "./egypt";

/** First-visit offer: 5% off the first order, for a contact on the subscriber list. */
export const WELCOME_CODE = "WELCOME5";
export const WELCOME_BASIS_POINTS = 500;

export interface Contact {
  type: "email" | "phone";
  /** Lower-cased email, or an Egyptian mobile as +201XXXXXXXXX. */
  value: string;
}

/** One input, two kinds of answer: an email address or an Egyptian mobile number (01[0125] + 8 digits; +20 and spaces are fine). */
export function parseContact(raw: string): Contact | null {
  const t = raw.trim();
  if (!t || t.length > 120) return null;
  if (t.includes("@")) return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(t) ? { type: "email", value: t.toLowerCase() } : null;
  const phone = normalizeEgyptianMobile(t);
  return phone ? { type: "phone", value: phone } : null;
}
