/** Text helpers shared by parsers. */

const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

/** Latin digits, Latin separators, single spaces. Keeps Arabic letters intact. */
export function normalizeText(s: string) {
  return s
    .replace(/[٠-٩]/g, (d) => String(ARABIC_DIGITS.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String(PERSIAN_DIGITS.indexOf(d)))
    .replace(/٫/g, ".")
    .replace(/٬/g, ",")
    .replace(/[‎‏؜]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** "1,234.50" / "1234,50"? → minor units. Egyptian alerts use "," for thousands and "." for decimals. */
export function parseAmountToMinor(raw: string): number | null {
  const s = raw.replace(/\s/g, "");
  if (!/\d/.test(s)) return null;
  let cleaned = s;
  // A trailing ",dd" with no "." is a decimal comma (rare, but seen on some EU cards).
  if (/^\d{1,3}(\.\d{3})+,\d{1,2}$/.test(s) || /^\d+,\d{1,2}$/.test(s)) cleaned = s.replace(/\./g, "").replace(",", ".");
  else cleaned = s.replace(/,/g, "");
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

/** Small, stable, non-cryptographic hash for idempotency keys (FNV-1a, 52-bit safe). */
export function hashString(s: string) {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619) >>> 0;
    h2 = Math.imul(h2 ^ c, 2246822519) >>> 0;
  }
  return h1.toString(36) + h2.toString(36);
}

/** Mask anything that looks like an account/card/phone number before storing evidence. */
export function redact(s: string) {
  return normalizeText(s)
    .replace(/\d{5,}/g, (m) => "•".repeat(Math.max(0, m.length - 4)) + m.slice(-4))
    .slice(0, 240);
}
