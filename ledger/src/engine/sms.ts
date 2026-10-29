import type { Direction, ParsedFields, PostingStatus } from "./model";
import { detectInstitution } from "./institutions";
import { normalizeText, parseAmountToMinor } from "./text";

/**
 * Parser for Egyptian bank / wallet transaction alerts (English and Arabic).
 *
 * It is deliberately template-free: it looks for amounts, currencies, direction
 * words, masked account numbers, merchants and references. Anything it cannot
 * read is left null rather than guessed. Real alert formats change; add test
 * fixtures from real (redacted) messages before trusting a new institution.
 *
 * Security: messages that look like OTPs / passwords / auth codes are rejected
 * before any field is extracted, and callers must not store them.
 */

export type ParseResult = { ok: true; fields: ParsedFields } | { ok: false; reason: "sensitive" | "unreadable" };

const SENSITIVE = [
  /\b(otp|one[- ]?time|verification code|activation code|passcode|password|pin code|security code|auth(entication)? code|cvv)\b/i,
  /\bcode\b.{0,20}\b\d{4,8}\b/i,
  /رمز التحقق|رمز التفعيل|كود التحقق|كود التفعيل|كلمة المرور|كلمة السر|الرقم السري|رمز الدخول|كود الدخول|الرمز السري|لا تشارك|لا تفصح/,
];

const CUR_MAP: Record<string, string> = {
  egp: "EGP", le: "EGP", "l.e": "EGP", "l.e.": "EGP", "e.g.p": "EGP", "جنيه": "EGP", "جنيها": "EGP", "جنيهات": "EGP", "ج.م": "EGP", "ج.م.": "EGP", "جم": "EGP",
  usd: "USD", "us$": "USD", $: "USD", eur: "EUR", "€": "EUR", sar: "SAR", aed: "AED", gbp: "GBP",
};
const NUM = "([0-9][0-9,]*(?:\\.[0-9]{1,2})?)";
const CUR_BEFORE = new RegExp(`(^|[^A-Za-z])(EGP|E\\.G\\.P|L\\.E\\.?|LE|USD|US\\$|EUR|SAR|AED|GBP|€|\\$)\\s?${NUM}`, "gi");
const CUR_AFTER = new RegExp(`${NUM}\\s?(EGP|L\\.E\\.?|LE|USD|EUR|SAR|AED|GBP|جنيهات|جنيها|جنيه|ج\\.م\\.?|جم)(?![A-Za-z])`, "gi");
const BARE_AMOUNT = new RegExp(`(?:amount|amt|مبلغ|بمبلغ|قيمة|بقيمة|بقيمه)\\s*:?\\s*${NUM}`, "i");
const BALANCE_WORDS = /(balance|bal\b|avl|available|الرصيد|رصيد|رصيدك)/i;

const OUT_STRONG = [/from your (account|card|wallet)/i, /من حسابك|من حساب حضرتك|من بطاقتك|من محفظتك/];
const IN_STRONG = [/to your (account|card|wallet)/i, /(?:إلى|الى|ل)\s?حسابك|(?:إلى|الى)\s?محفظتك|في حسابك/];
const OUT_WORDS = [
  /\b(debited|purchase|purchased|spent|paid|payment (of|to|for)|withdrawn|withdrawal|sent|transferred to|transfer to|deducted|charged|pos\b)/i,
  /خصم|تم سحب|سحب|شراء|دفع|سداد|تحويل إلى|تحويل الى|إرسال|ارسال|مدين/,
];
const IN_WORDS = [
  /\b(credited|credit of|received|deposited|deposit|refund(ed)?|reversed|reversal|transfer(red)? from|added to|incoming|cashback)\b/i,
  /إضافة|اضافة|إيداع|ايداع|استلام|استلمت|استرداد|تحويل من|وارد|دائن|أضيف|اضيف|تم إضافة/,
];

const FAILED = /\b(declined|failed|unsuccessful|rejected|not completed|insufficient)\b|مرفوض|رفض|فشل|لم تتم|غير ناجح/i;
const REVERSED = /\b(reversed|reversal|cancell?ed|voided)\b|تم إلغاء|إلغاء العملية|الغاء العملية|عكس العملية/i;
const PENDING = /\b(pending|authori[sz]ation hold|on hold|being processed)\b|قيد التنفيذ|معلق|قيد المراجعة/i;

const ATM = /\batm\b|cash withdrawal|سحب نقدي|ماكينة|ماكينه|صراف/i;
const SALARY = /\b(salary|payroll)\b|راتب|مرتب/i;
const REFUND = /\b(refund(ed)?|reversal|cashback|chargeback)\b|استرداد|مرتجع/i;
const INSTAPAY = /instapay|انستاباي|إنستاباي|انستا باي|ipn/i;

const LAST4 = /(?:card|account|acct|a\/c|wallet|ending|بطاقة|بطاقتك|حساب|حسابك|كارت|محفظة|المنتهية|المنتهي)[^0-9]{0,24}?[0-9*xX•]{0,16}?([0-9]{4})(?![0-9])/gi;
const MASKED = /[*xX•]{2,}([0-9]{4})(?![0-9])/g;
const REF = /(?:ref(?:erence)?(?:\s*no\.?)?|txn(?:\s*id)?|transaction\s*(?:id|no\.?)|رقم العملية|رقم المرجع|مرجع)\s*[:#.]?\s*([A-Za-z0-9-]{4,})/i;

const STOP = /\s(on|to|for|dated|ref|reference|txn|at|via|using|with|avl|available|balance|bal|في|بتاريخ|يوم|رقم|الرصيد|عبر|من خلال)(?=\s|$)|[.,،;|(]|\s-\s|$/i;
const NOT_A_PARTY = /^(your|the|a|an|account|card|wallet|حسابك|بطاقتك|محفظتك|حساب|بطاقة)(?=\s|$)/i;

/** Text following `re` up to the next stop word, skipping matches that aren't names. */
function grab(text: string, re: RegExp): string | null {
  const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
  for (const m of text.matchAll(g)) {
    const rest = text.slice(m.index! + m[0].length);
    const stop = STOP.exec(rest);
    let v = (stop ? rest.slice(0, stop.index) : rest).trim();
    v = v.replace(/\s*[*xX•]*\d{3,}$/, "").replace(/^[:\-\s]+/, "").trim();
    if (v.length < 2 || NOT_A_PARTY.test(v) || /^[\d*xX•]/.test(v)) continue;
    return v.slice(0, 40);
  }
  return null;
}

function findMoney(text: string) {
  const hits: { index: number; amount: number; currency: string | null; isBalance: boolean }[] = [];
  const push = (index: number, raw: string, cur: string | null) => {
    const amount = parseAmountToMinor(raw);
    if (amount === null) return;
    const before = text.slice(Math.max(0, index - 32), index);
    hits.push({ index, amount, currency: cur ? CUR_MAP[cur.toLowerCase()] ?? cur.toUpperCase() : null, isBalance: BALANCE_WORDS.test(before) });
  };
  for (const m of text.matchAll(CUR_BEFORE)) push(m.index! + m[1].length, m[3], m[2]);
  for (const m of text.matchAll(CUR_AFTER)) push(m.index!, m[1], m[2]);
  hits.sort((a, b) => a.index - b.index);
  // Drop overlapping duplicates (same number matched by both patterns).
  return hits.filter((h, i) => i === 0 || Math.abs(h.index - hits[i - 1].index) > 3 || h.amount !== hits[i - 1].amount);
}

function score(text: string, res: RegExp[]) {
  let first = Infinity;
  let n = 0;
  for (const r of res) {
    const m = r.exec(text);
    if (m) {
      n++;
      first = Math.min(first, m.index);
    }
  }
  return { n, first };
}

function detectDirection(text: string): Direction | null {
  const os = score(text, OUT_STRONG);
  const is = score(text, IN_STRONG);
  if (os.n && !is.n) return "out";
  if (is.n && !os.n) return "in";
  const o = score(text, OUT_WORDS);
  const i = score(text, IN_WORDS);
  if (o.n && !i.n) return "out";
  if (i.n && !o.n) return "in";
  if (o.n && i.n) return o.first < i.first ? "out" : i.first < o.first ? "in" : null;
  return null;
}

function detectDate(text: string, now: number): number | null {
  const iso = /(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2}))?/.exec(text);
  const dmy = /(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})(?:\D{1,6}(\d{1,2}):(\d{2}))?/.exec(text);
  let d: Date | null = null;
  if (iso) d = new Date(+iso[1], +iso[2] - 1, +iso[3], +(iso[4] ?? 12), +(iso[5] ?? 0));
  else if (dmy) {
    const y = +dmy[3] < 100 ? 2000 + +dmy[3] : +dmy[3];
    // Egyptian alerts use day/month order.
    d = new Date(y, +dmy[2] - 1, +dmy[1], +(dmy[4] ?? 12), +(dmy[5] ?? 0));
  } else {
    const t = /\b(\d{1,2}):(\d{2})\b/.exec(text);
    if (t && +t[1] < 24) {
      d = new Date(now);
      d.setHours(+t[1], +t[2], 0, 0);
      if (d.getTime() > now + 5 * 60_000) d.setDate(d.getDate() - 1);
    }
  }
  if (!d || Number.isNaN(d.getTime())) return null;
  const ts = d.getTime();
  if (ts > now + 60 * 60_000 || ts < now - 400 * 86_400_000) return null;
  return ts;
}

export function isSensitive(text: string) {
  const t = normalizeText(text);
  return SENSITIVE.some((r) => r.test(t));
}

export function parseAlert(raw: string, now = Date.now()): ParseResult {
  if (isSensitive(raw)) return { ok: false, reason: "sensitive" };
  const text = normalizeText(raw);

  const money = findMoney(text);
  const main = money.find((m) => !m.isBalance);
  const balance = money.find((m) => m.isBalance && m !== main);
  let amount = main?.amount ?? null;
  let currency = main?.currency ?? null;
  if (amount === null) {
    const b = BARE_AMOUNT.exec(text);
    if (b) amount = parseAmountToMinor(b[1]);
  }
  if (amount === null || amount === 0) return { ok: false, reason: "unreadable" };

  const status: PostingStatus = FAILED.test(text) ? "failed" : REVERSED.test(text) && !/refund/i.test(text) ? "reversed" : PENDING.test(text) ? "pending" : "posted";
  let direction = detectDirection(text);
  if (status === "reversed" && direction === null) direction = "in";

  const last4s = new Set<string>();
  for (const m of text.matchAll(LAST4)) last4s.add(m[1]);
  for (const m of text.matchAll(MASKED)) last4s.add(m[1]);
  const [last4 = null, otherLast4 = null] = [...last4s];

  const merchant = grab(text, /\b(?:at|@)\s+/i) ?? grab(text, /(?:لدى|لدي|عند)\s+/);
  // Money spent "at" a merchant only ever leaves the account (e.g. pending card authorisations).
  if (direction === null && merchant && status !== "reversed") direction = "out";
  let counterparty: string | null = null;
  if (direction === "in") counterparty = grab(text, /\bfrom\s+/i) ?? grab(text, /\sمن\s+/);
  if (direction === "out") counterparty = grab(text, /\bto\s+/i) ?? grab(text, /\s(?:إلى|الى)\s+/);
  const ipa = /([a-z0-9._-]+@instapay)/i.exec(text);
  if (ipa) counterparty = ipa[1].toLowerCase();

  const ref = REF.exec(text)?.[1] ?? null;
  const occurredAt = detectDate(text, now);

  let conf = 0.35;
  if (direction) conf += 0.3;
  if (last4 || detectInstitution(text)) conf += 0.15;
  if (merchant || counterparty) conf += 0.1;
  if (currency) conf += 0.1;

  return {
    ok: true,
    fields: {
      amount,
      currency,
      direction,
      status,
      institution: detectInstitution(text),
      last4,
      merchant: merchant ?? null,
      counterparty,
      reference: ref,
      occurredAt,
      balanceAfter: balance?.amount ?? null,
      hints: {
        atm: ATM.test(text) || undefined,
        refund: REFUND.test(text) || undefined,
        salary: SALARY.test(text) || undefined,
        instapay: INSTAPAY.test(text) || undefined,
        otherLast4,
      },
      parseConfidence: Math.min(1, conf),
    },
  };
}

/** Split a pasted block that may contain several alerts. */
export function splitMessages(block: string) {
  return block
    .split(/\n\s*\n|\r\n\s*\r\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}
