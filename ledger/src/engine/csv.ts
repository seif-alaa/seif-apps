import type { IncomingEvent, ParsedFields } from "./model";
import { hashString, normalizeText, parseAmountToMinor } from "./text";

/**
 * Bank statement (CSV) import. Columns are detected by header name in English
 * or Arabic; the user can override the mapping. Rows become ordinary events, so
 * statement lines that duplicate live alerts are merged instead of double-counted.
 */

export interface CsvMapping {
  date: number;
  description: number;
  amount: number | null;
  debit: number | null;
  credit: number | null;
  reference: number | null;
  /** When there's a single amount column: are expenses negative (default) or positive? */
  negativeIsOut: boolean;
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const delim = guessDelimiter(text);
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === delim) {
      row.push(cell.trim());
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell.trim());
      if (row.some((x) => x !== "")) rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  row.push(cell.trim());
  if (row.some((x) => x !== "")) rows.push(row);
  return rows;
}

function guessDelimiter(text: string) {
  const line = text.split(/\r?\n/)[0] ?? "";
  const counts = [",", ";", "\t"].map((d) => [d, line.split(d).length] as const);
  return counts.sort((a, b) => b[1] - a[1])[0][0];
}

const H = {
  date: /date|posting|value date|تاريخ/i,
  description: /desc|details|narrat|particular|merchant|payee|memo|البيان|الوصف|التفاصيل/i,
  amount: /^amount$|^amt$|المبلغ|القيمة/i,
  debit: /debit|withdraw|out|مدين|سحب|خصم/i,
  credit: /credit|deposit|in\b|دائن|إيداع|ايداع/i,
  reference: /ref|transaction id|txn|رقم العملية|المرجع/i,
};

export function detectMapping(header: string[]): CsvMapping | null {
  const find = (re: RegExp, except: number[] = []) => header.findIndex((h, i) => !except.includes(i) && re.test(normalizeText(h)));
  const date = find(H.date);
  const description = find(H.description, [date]);
  const debit = find(H.debit, [date, description]);
  const credit = find(H.credit, [date, description, debit]);
  const amount = find(H.amount, [date, description, debit, credit]);
  const reference = find(H.reference, [date, description, debit, credit, amount]);
  if (date < 0 || description < 0) return null;
  if (amount < 0 && (debit < 0 || credit < 0)) return null;
  return {
    date,
    description,
    amount: amount >= 0 ? amount : null,
    debit: debit >= 0 ? debit : null,
    credit: credit >= 0 ? credit : null,
    reference: reference >= 0 ? reference : null,
    negativeIsOut: true,
  };
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

export function parseStatementDate(raw: string): number | null {
  const s = normalizeText(raw);
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(s);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3], 12).getTime();
  m = /^(\d{1,2})[-/. ]([A-Za-z]{3})[A-Za-z]*[-/. ](\d{2,4})/.exec(s);
  if (m) {
    const mi = MONTHS.indexOf(m[2].toLowerCase());
    if (mi >= 0) return new Date(+m[3] < 100 ? 2000 + +m[3] : +m[3], mi, +m[1], 12).getTime();
  }
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/.exec(s);
  if (m) return new Date(+m[3] < 100 ? 2000 + +m[3] : +m[3], +m[2] - 1, +m[1], 12).getTime();
  return null;
}

export interface StatementRow {
  index: number;
  event: IncomingEvent | null;
  error: string | null;
}

export function statementToEvents(rows: string[][], mapping: CsvMapping, accountId: string, currency: string, now = Date.now()): StatementRow[] {
  const seen = new Map<string, number>();
  return rows.slice(1).map((r, i) => {
    const occurredAt = parseStatementDate(r[mapping.date] ?? "");
    if (!occurredAt) return { index: i, event: null, error: "date" };
    let amount: number | null = null;
    let direction: "in" | "out" | null = null;
    if (mapping.amount !== null) {
      const raw = (r[mapping.amount] ?? "").replace(/[^\d.,()-]/g, "");
      const neg = raw.startsWith("-") || /^\(.*\)$/.test(raw);
      amount = parseAmountToMinor(raw.replace(/[()-]/g, ""));
      direction = neg === mapping.negativeIsOut ? "out" : "in";
    } else {
      const d = parseAmountToMinor((r[mapping.debit!] ?? "").replace(/[^\d.,]/g, ""));
      const c = parseAmountToMinor((r[mapping.credit!] ?? "").replace(/[^\d.,]/g, ""));
      if (d) {
        amount = d;
        direction = "out";
      } else if (c) {
        amount = c;
        direction = "in";
      }
    }
    if (!amount) return { index: i, event: null, error: "amount" };
    const description = r[mapping.description] ?? "";
    const reference = mapping.reference !== null ? r[mapping.reference] || null : null;
    // Identical rows in one file are distinct transactions: number them, so re-importing the same file is idempotent.
    const base = hashString([r[mapping.date], description, amount, direction, reference].join("|"));
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    const parsed: ParsedFields = {
      amount,
      currency,
      direction,
      status: "posted",
      institution: null,
      last4: null,
      merchant: description || null,
      counterparty: null,
      reference,
      occurredAt,
      balanceAfter: null,
      hints: {
        atm: /\batm\b|cash withdrawal|سحب نقدي/i.test(description) || undefined,
        refund: /refund|reversal|استرداد/i.test(description) || undefined,
        salary: /salary|payroll|راتب|مرتب/i.test(description) || undefined,
        instapay: /instapay/i.test(description) || undefined,
      },
      parseConfidence: 0.9,
    };
    return { index: i, error: null, event: { sourceKind: "statement_csv", externalId: `${accountId}:${base}#${n}`, receivedAt: now, parsed, accountId } };
  });
}
