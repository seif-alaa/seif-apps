/**
 * Money is always an integer number of minor units (piastres; 100 per EGP).
 * Never use floating-point pounds for anything that reaches a total.
 */
export type Minor = number;

export const CURRENCY = "EGP" as const;

export function assertMinor(value: number, label = "amount"): Minor {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`${label} must be a safe integer of minor units, got ${value}`);
  }
  return value;
}

/** Convert a whole/decimal pound figure typed by an admin into minor units. */
export function poundsToMinor(input: string | number): Minor {
  const text = String(input).trim().replace(/[,\s]/g, "").replace(/^EGP/i, "");
  if (!/^-?\d+(\.\d{1,2})?$/.test(text)) throw new RangeError(`Invalid EGP amount: ${input}`);
  const negative = text.startsWith("-");
  const [whole, frac = ""] = text.replace("-", "").split(".");
  const minor = Number(whole) * 100 + Number((frac + "00").slice(0, 2));
  return assertMinor(negative ? -minor : minor);
}

export function minorToPoundsString(minor: Minor): string {
  const negative = minor < 0;
  const abs = Math.abs(minor);
  const whole = Math.floor(abs / 100);
  const frac = abs % 100;
  return `${negative ? "-" : ""}${whole}${frac ? "." + String(frac).padStart(2, "0") : ""}`;
}

export function sumMinor(values: readonly Minor[]): Minor {
  let total = 0;
  for (const v of values) total = assertMinor(total + assertMinor(v));
  return total;
}

/** Percentage expressed in basis points (1% = 100 bp), rounded half-up to the piastre. */
export function percentOf(amount: Minor, basisPoints: number): Minor {
  assertMinor(amount);
  if (!Number.isInteger(basisPoints) || basisPoints < 0 || basisPoints > 10_000) {
    throw new RangeError("basisPoints must be an integer between 0 and 10000");
  }
  // Integer arithmetic: amount * bp / 10000 with half-up rounding.
  return Math.floor((amount * basisPoints + 5_000) / 10_000);
}

const groupFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

/** "EGP 12,450" — piastres shown only when non-zero ("EGP 12,450.50"). */
export function formatEGP(minor: Minor, opts: { sign?: boolean } = {}): string {
  const negative = minor < 0;
  const abs = Math.abs(minor);
  const whole = Math.floor(abs / 100);
  const frac = abs % 100;
  const body = groupFormatter.format(whole) + (frac ? "." + String(frac).padStart(2, "0") : "");
  const sign = negative ? "−" : opts.sign ? "+" : "";
  return `${sign}EGP ${body}`;
}

/** Compact difference label used on option cards: "+ EGP 450", "Included". */
export function formatDelta(minor: Minor): string {
  if (minor === 0) return "Included";
  return minor > 0 ? `+ ${formatEGP(minor)}` : `− ${formatEGP(-minor)}`;
}
