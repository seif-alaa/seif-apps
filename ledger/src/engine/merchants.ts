import { normalizeText } from "./text";

/**
 * Merchant identity. Card descriptors are noisy ("CARREFOUR MAADI 0423 CAIRO EG"),
 * so we reduce them to a stable key that Ledger's memory can learn against.
 */

interface Brand {
  key: string;
  label: string;
  match: RegExp;
  /** Built-in category key suggestion. Suggestions only — never auto-applied on their own. */
  category: string;
}

/** A starter list of common Egyptian merchants. Users' own corrections always win. */
export const BRANDS: Brand[] = [
  { key: "carrefour", label: "Carrefour", match: /carrefour|كارفور/i, category: "groceries" },
  { key: "spinneys", label: "Spinneys", match: /spinneys|سبينيس/i, category: "groceries" },
  { key: "seoudi", label: "Seoudi", match: /seoudi|سعودي ماركت/i, category: "groceries" },
  { key: "kazyon", label: "Kazyon", match: /kazyon|كازيون/i, category: "groceries" },
  { key: "hyperone", label: "HyperOne", match: /hyper\s?one/i, category: "groceries" },
  { key: "metro", label: "Metro Market", match: /metro\s?market|مترو ماركت/i, category: "groceries" },
  { key: "gourmet", label: "Gourmet Egypt", match: /gourmet/i, category: "groceries" },
  { key: "breadfast", label: "Breadfast", match: /breadfast|بريدفاست/i, category: "groceries" },
  { key: "rabbit", label: "Rabbit", match: /\brabbit\b/i, category: "groceries" },
  { key: "talabat", label: "Talabat", match: /talabat|طلبات/i, category: "dining" },
  { key: "elmenus", label: "elmenus", match: /elmenus/i, category: "dining" },
  { key: "mcdonalds", label: "McDonald's", match: /mcdonald|ماكدونالدز/i, category: "dining" },
  { key: "kfc", label: "KFC", match: /\bkfc\b/i, category: "dining" },
  { key: "starbucks", label: "Starbucks", match: /starbucks|ستاربكس/i, category: "coffee" },
  { key: "costa", label: "Costa Coffee", match: /costa coffee|\bcosta\b/i, category: "coffee" },
  { key: "cilantro", label: "Cilantro", match: /cilantro|سيلانترو/i, category: "coffee" },
  { key: "beanos", label: "Beano's", match: /beano/i, category: "coffee" },
  { key: "uber", label: "Uber", match: /\buber\b(?!\s*eats)|اوبر|أوبر/i, category: "transport" },
  { key: "careem", label: "Careem", match: /careem/i, category: "transport" },
  { key: "didi", label: "DiDi", match: /\bdidi\b/i, category: "transport" },
  { key: "indrive", label: "inDrive", match: /indrive/i, category: "transport" },
  { key: "swvl", label: "Swvl", match: /swvl/i, category: "transport" },
  { key: "fuel", label: "Fuel", match: /totalenergies|\btotal\b.*station|mobil|wataniya|وطنية|chillout|misr petroleum|مصر للبترول/i, category: "transport" },
  { key: "vodafone", label: "Vodafone", match: /vodafone(?!\s*cash)|فودافون(?! كاش)/i, category: "bills" },
  { key: "orange", label: "Orange", match: /\borange\b(?!\s*cash)/i, category: "bills" },
  { key: "we", label: "WE", match: /\bwe\b.*(telecom|internet)|telecom egypt|المصرية للاتصالات/i, category: "bills" },
  { key: "electricity", label: "Electricity", match: /electric|كهرباء/i, category: "bills" },
  { key: "amazon", label: "Amazon", match: /amazon|أمازون|امازون/i, category: "shopping" },
  { key: "noon", label: "noon", match: /\bnoon\b/i, category: "shopping" },
  { key: "jumia", label: "Jumia", match: /jumia|جوميا/i, category: "shopping" },
  { key: "ikea", label: "IKEA", match: /ikea|ايكيا/i, category: "shopping" },
  { key: "netflix", label: "Netflix", match: /netflix|نتفليكس/i, category: "entertainment" },
  { key: "spotify", label: "Spotify", match: /spotify/i, category: "entertainment" },
  { key: "anghami", label: "Anghami", match: /anghami|أنغامي/i, category: "entertainment" },
  { key: "shahid", label: "Shahid", match: /shahid/i, category: "entertainment" },
  { key: "watchit", label: "WATCH IT", match: /watch\s?it/i, category: "entertainment" },
  { key: "ezaby", label: "El Ezaby Pharmacy", match: /ezaby|العزبي/i, category: "health" },
  { key: "seifpharmacy", label: "Seif Pharmacy", match: /seif pharm|صيدليات سيف/i, category: "health" },
  { key: "pharmacy", label: "Pharmacy", match: /pharmac|صيدلي/i, category: "health" },
];

const NOISE = /\b(egypt|eg|egy|cairo|giza|alex(andria)?|new cairo|branch|br|pos|ecom|online|www|com|llc|co|sae|s\.a\.e|ltd|store|shop|mall)\b|القاهرة|الجيزة|فرع|مصر/gi;

export function findBrand(raw: string | null | undefined) {
  if (!raw) return null;
  const t = normalizeText(raw);
  return BRANDS.find((b) => b.match.test(t)) ?? null;
}

/** Stable key for a merchant or counterparty, or null if there's nothing usable. */
export function merchantKey(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const brand = findBrand(raw);
  if (brand) return brand.key;
  const cleaned = normalizeText(raw)
    .toLowerCase()
    .replace(/@instapay$/, "")
    .replace(/[*#_]/g, " ")
    .replace(/\d+/g, " ")
    .replace(NOISE, " ")
    .replace(/[^\p{L}\s&'-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length < 2) return null;
  return cleaned.split(" ").slice(0, 3).join(" ");
}

/** Human label for display: known brand name, else title-cased descriptor. */
export function merchantLabel(raw: string | null | undefined) {
  if (!raw) return null;
  const brand = findBrand(raw);
  if (brand) return brand.label;
  const t = normalizeText(raw).replace(/\s*[*#]+\s*/g, " ").replace(/\s\d{3,}.*$/, "").trim();
  if (/[A-Z]{3,}/.test(t) && t === t.toUpperCase()) return t.toLowerCase().replace(/\b\p{L}/gu, (c) => c.toUpperCase());
  return t;
}
