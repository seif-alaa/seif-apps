import type { AccountKind } from "./model";

export interface Institution {
  key: string;
  name: string;
  nameAr: string;
  kind: AccountKind;
  /** Lowercase patterns found in alert senders / message bodies. */
  patterns: RegExp[];
  /** Short monogram for the account mark. */
  mark: string;
}

/**
 * Egyptian banks and wallets Ledger can recognise in alerts. Recognition is
 * name-based only — no institution here is "connected"; that is a separate,
 * honest status on each account and source.
 */
export const INSTITUTIONS: Institution[] = [
  { key: "cib", name: "CIB", nameAr: "البنك التجاري الدولي", kind: "bank", mark: "CIB", patterns: [/\bcib\b/i, /التجاري الدولي/] },
  { key: "nbe", name: "National Bank of Egypt", nameAr: "البنك الأهلي المصري", kind: "bank", mark: "NBE", patterns: [/\bnbe\b/i, /national bank of egypt/i, /الأهلي|الاهلي/] },
  { key: "banquemisr", name: "Banque Misr", nameAr: "بنك مصر", kind: "bank", mark: "BM", patterns: [/banque\s*misr/i, /\bbm\b/i, /بنك مصر/] },
  { key: "qnb", name: "QNB", nameAr: "بنك قطر الوطني", kind: "bank", mark: "QNB", patterns: [/\bqnb\b/i] },
  { key: "hsbc", name: "HSBC", nameAr: "إتش إس بي سي", kind: "bank", mark: "HS", patterns: [/\bhsbc\b/i] },
  { key: "aaib", name: "AAIB", nameAr: "البنك العربي الأفريقي", kind: "bank", mark: "AA", patterns: [/\baaib\b/i] },
  { key: "bdc", name: "Banque du Caire", nameAr: "بنك القاهرة", kind: "bank", mark: "BdC", patterns: [/banque\s*du\s*caire/i, /بنك القاهرة/] },
  { key: "adib", name: "ADIB", nameAr: "مصرف أبوظبي الإسلامي", kind: "bank", mark: "AD", patterns: [/\badib\b/i] },
  { key: "telda", name: "Telda", nameAr: "تلدا", kind: "card", mark: "T", patterns: [/\btelda\b/i, /تلدا/] },
  { key: "vodafonecash", name: "Vodafone Cash", nameAr: "فودافون كاش", kind: "wallet", mark: "VC", patterns: [/vodafone\s*cash/i, /فودافون كاش/] },
  { key: "etisalatcash", name: "e& cash", nameAr: "اتصالات كاش", kind: "wallet", mark: "e&", patterns: [/etisalat\s*cash|e&\s*cash/i, /اتصالات كاش/] },
  { key: "orangecash", name: "Orange Cash", nameAr: "أورنج كاش", kind: "wallet", mark: "OC", patterns: [/orange\s*cash/i, /اورنج كاش|أورنج كاش/] },
  { key: "valu", name: "valU", nameAr: "ڤاليو", kind: "credit", mark: "vU", patterns: [/\bvalu\b/i] },
  { key: "cash", name: "Cash", nameAr: "نقدي", kind: "cash", mark: "", patterns: [] },
  { key: "other", name: "Other", nameAr: "أخرى", kind: "bank", mark: "", patterns: [] },
];

export const institution = (key: string | null | undefined) => INSTITUTIONS.find((i) => i.key === key) ?? INSTITUTIONS[INSTITUTIONS.length - 1];

export function detectInstitution(text: string): string | null {
  // InstaPay is a payment rail, not where money is held — detected separately as a hint.
  for (const i of INSTITUTIONS) if (i.patterns.some((p) => p.test(text))) return i.key;
  return null;
}
