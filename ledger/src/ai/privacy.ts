import type { FinancialReport } from "./report";

export interface SharingOptions {
  /** Include merchant names (otherwise replaced with "Merchant 1", "Merchant 2"…). */
  merchants: boolean;
}

/**
 * What leaves the device when the user asks for an AI explanation: aggregated
 * report figures only. No notes, references, account numbers, raw messages or
 * full transaction lists — just the report and transaction ids for citations.
 */
export function minimizeReport(r: FinancialReport, opts: SharingOptions): FinancialReport {
  const names = new Map<string, string>();
  const alias = (label: string | null) => {
    if (!label || opts.merchants) return label;
    if (!names.has(label)) names.set(label, `Merchant ${names.size + 1}`);
    return names.get(label)!;
  };
  return {
    ...r,
    recurring: r.recurring.map((x) => ({ ...x, label: alias(x.label) ?? "" })),
    unusual: r.unusual.map((x) => ({ ...x, merchant: alias(x.merchant) })),
    topMerchants: r.topMerchants.map((x) => ({ ...x, label: alias(x.label) ?? "" })),
  };
}
