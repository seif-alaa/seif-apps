import { useMemo } from "react";
import { format as fmtDate, isThisYear, isToday, isYesterday } from "date-fns";
import { arEG, enUS } from "date-fns/locale";
import { usePrefs, type Language } from "@/store/ui";
import { en, type Dict } from "./en";
import { ar } from "./ar";

const DICTS: Record<Language, Dict> = { en, ar };
export type Key = keyof Dict;

type Vars = Record<string, string | number>;

const plural = { en: new Intl.PluralRules("en"), ar: new Intl.PluralRules("ar") };

/** Translate. `{name}` placeholders are interpolated; `count` selects `key.one` / `key.other` etc. when present. */
export function translate(lang: Language, key: string, vars?: Vars, formatNumber: (n: number) => string = String) {
  const d = DICTS[lang] as Record<string, string>;
  let s: string | undefined;
  if (vars && typeof vars.count === "number") {
    const form = plural[lang].select(vars.count);
    s = d[`${key}.${form}`] ?? d[`${key}.other`];
  }
  s ??= d[key] ?? (en as Record<string, string>)[key] ?? key;
  return vars ? s.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? (typeof vars[k] === "number" ? formatNumber(vars[k] as number) : String(vars[k])) : `{${k}}`)) : s;
}

export function numberLocale(lang: Language, digits: "arab" | "latn") {
  return lang === "ar" ? `ar-EG-u-nu-${digits}` : "en-US";
}

export interface MoneyOpts {
  signed?: boolean;
  cents?: boolean;
  compact?: boolean;
}

const cache = new Map<string, Intl.NumberFormat>();
function nf(locale: string, currency: string, cents: boolean, compact: boolean) {
  const k = `${locale}|${currency}|${cents}|${compact}`;
  let f = cache.get(k);
  if (!f) {
    const digits = cents ? 2 : 0;
    try {
      f = new Intl.NumberFormat(locale, {
        style: "currency",
        currency,
        currencyDisplay: locale.startsWith("ar") ? "symbol" : "code",
        notation: compact ? "compact" : "standard",
        minimumFractionDigits: compact ? 0 : digits,
        maximumFractionDigits: compact ? 1 : digits,
      });
    } catch {
      f = new Intl.NumberFormat(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits });
    }
    cache.set(k, f);
  }
  return f;
}

export interface MoneyParts {
  sign: "" | "+" | "−";
  currency: string;
  integer: string;
  fraction: string;
  currencyFirst: boolean;
}

/** Split a money value so the UI can style currency and decimals separately. */
export function moneyParts(minor: number, currency: string, locale: string, opts: MoneyOpts = {}): MoneyParts {
  const parts = nf(locale, currency, opts.cents ?? true, !!opts.compact).formatToParts(Math.abs(minor) / 100);
  let cur = "";
  let integer = "";
  let fraction = "";
  let seenNumber = false;
  let currencyFirst = false;
  for (const p of parts) {
    if (p.type === "currency") {
      cur = p.value;
      if (!seenNumber) currencyFirst = true;
    } else if (p.type === "integer" || p.type === "group" || p.type === "compact") {
      integer += p.value;
      seenNumber = true;
    } else if (p.type === "decimal" || p.type === "fraction") fraction += p.value;
  }
  const sign = minor < 0 ? "−" : opts.signed && minor > 0 ? "+" : "";
  return { sign, currency: cur || currency, integer, fraction, currencyFirst };
}

export function formatMoneyString(minor: number, currency: string, locale: string, opts: MoneyOpts = {}) {
  const p = moneyParts(minor, currency, locale, opts);
  const num = `${p.integer}${p.fraction}`;
  return p.currencyFirst ? `${p.sign}${p.currency} ${num}` : `${p.sign}${num} ${p.currency}`;
}

export function useI18n() {
  const lang = usePrefs((s) => s.language);
  const digits = usePrefs((s) => s.digits);
  const currency = usePrefs((s) => s.currency);
  return useMemo(() => {
    const locale = numberLocale(lang, digits);
    const dateLocale = lang === "ar" ? arEG : enUS;
    const nfmt = new Intl.NumberFormat(locale);
    const pct = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 });
    // date-fns always emits Latin digits; localise them when the user prefers Arabic-Indic.
    const digitsFix = lang === "ar" && digits === "arab" ? (s: string) => s.replace(/[0-9]/g, (d) => "٠١٢٣٤٥٦٧٨٩"[+d]) : (s: string) => s;
    return {
      lang,
      dir: (lang === "ar" ? "rtl" : "ltr") as "rtl" | "ltr",
      locale,
      currency,
      t: (key: Key | string, vars?: Vars) => translate(lang, key, vars, (n) => nfmt.format(n)),
      money: (minor: number, cur = currency, opts?: MoneyOpts) => formatMoneyString(minor, cur, locale, opts),
      num: (n: number) => nfmt.format(n),
      pct: (n: number) => pct.format(n),
      date: (ts: number | Date, pattern: string) => digitsFix(fmtDate(ts, pattern, { locale: dateLocale })),
      day: (ts: number) => {
        if (isToday(ts)) return translate(lang, "date.today");
        if (isYesterday(ts)) return translate(lang, "date.yesterday");
        return digitsFix(fmtDate(ts, isThisYear(ts) ? "EEEE d MMM" : "d MMM yyyy", { locale: dateLocale }));
      },
      time: (ts: number) => new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }).format(ts),
    };
  }, [lang, digits, currency]);
}

export type I18n = ReturnType<typeof useI18n>;
