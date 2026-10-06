import { format, isToday, isYesterday, isThisYear } from "date-fns";
import { usePrefs } from "@/store/ui";

export const CURRENCIES = [
  { code: "USD", label: "US Dollar" },
  { code: "EUR", label: "Euro" },
  { code: "GBP", label: "British Pound" },
  { code: "EGP", label: "Egyptian Pound" },
  { code: "AED", label: "UAE Dirham" },
  { code: "SAR", label: "Saudi Riyal" },
  { code: "CAD", label: "Canadian Dollar" },
  { code: "AUD", label: "Australian Dollar" },
  { code: "JPY", label: "Japanese Yen" },
  { code: "INR", label: "Indian Rupee" },
];

const cache = new Map<string, Intl.NumberFormat>();
function fmt(currency: string, compact: boolean, cents: boolean) {
  const key = `${currency}|${compact}|${cents}`;
  let f = cache.get(key);
  if (!f) {
    f = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      notation: compact ? "compact" : "standard",
      minimumFractionDigits: compact ? 0 : cents ? 2 : 0,
      maximumFractionDigits: compact ? 1 : cents ? 2 : 0,
    });
    cache.set(key, f);
  }
  return f;
}

export interface MoneyOpts {
  compact?: boolean;
  cents?: boolean;
  signed?: boolean;
}

/** Format minor units (cents) as currency. */
export function formatMoney(minor: number, currency: string, { compact = false, cents = true, signed = false }: MoneyOpts = {}) {
  const s = fmt(currency, compact, cents).format(Math.abs(minor) / 100);
  if (minor < 0) return `−${s}`;
  if (signed && minor > 0) return `+${s}`;
  return s;
}

/** Hook version that reads the user's currency. */
export function useMoney() {
  const currency = usePrefs((s) => s.currency);
  return (minor: number, opts?: MoneyOpts) => formatMoney(minor, currency, opts);
}

export function currencySymbol(currency: string) {
  const parts = fmt(currency, false, false).formatToParts(0);
  return parts.find((p) => p.type === "currency")?.value ?? currency;
}

export function friendlyDay(ts: number) {
  const d = new Date(ts);
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  return format(d, isThisYear(d) ? "EEEE, MMM d" : "MMM d, yyyy");
}

export function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 5) return "Up late";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 22) return "Good evening";
  return "Winding down";
}
