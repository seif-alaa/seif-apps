/** Egypt-specific reference data and validation. */

export const GOVERNORATES = [
  "Cairo",
  "Giza",
  "Alexandria",
  "Qalyubia",
  "Sharqia",
  "Dakahlia",
  "Beheira",
  "Gharbia",
  "Monufia",
  "Kafr El Sheikh",
  "Damietta",
  "Port Said",
  "Ismailia",
  "Suez",
  "Faiyum",
  "Beni Suef",
  "Minya",
  "Asyut",
  "Sohag",
  "Qena",
  "Luxor",
  "Aswan",
  "Red Sea",
  "New Valley",
  "Matrouh",
  "North Sinai",
  "South Sinai",
] as const;
export type Governorate = (typeof GOVERNORATES)[number];

/**
 * Egyptian mobile numbers: 010, 011, 012, 015 followed by 8 digits.
 * Accepts local (01xxxxxxxxx), +20 and 0020 prefixes, with spaces or dashes.
 * Returns E.164 (+201xxxxxxxxx) or null.
 */
export function normalizeEgyptianMobile(input: string): string | null {
  const digits = input.replace(/[\s\-().]/g, "");
  const m = /^(?:\+20|0020|20)?0?(1[0125]\d{8})$/.exec(digits);
  return m ? `+20${m[1]}` : null;
}

/**
 * International numbers are accepted when explicitly allowed (future use):
 * E.164 with a leading +, 8–15 digits.
 */
export function normalizePhone(input: string, opts: { allowInternational: boolean }): string | null {
  const eg = normalizeEgyptianMobile(input);
  if (eg) return eg;
  if (!opts.allowInternational) return null;
  const digits = input.replace(/[\s\-().]/g, "");
  return /^\+[1-9]\d{7,14}$/.test(digits) && !digits.startsWith("+20") ? digits : null;
}

export function formatPhone(e164: string): string {
  const m = /^\+20(1\d)(\d{4})(\d{4})$/.exec(e164);
  return m ? `+20 ${m[1]} ${m[2]} ${m[3]}` : e164;
}
