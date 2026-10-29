import type { FinancialReport } from "./report";
import { minimizeReport, type SharingOptions } from "./privacy";

/**
 * AI provider boundary. Ledger never calls a model vendor from the browser and
 * never ships an API key in the bundle: the client talks to *your* server
 * endpoint (see docs/AI.md), which holds the key and forwards a minimized report.
 *
 * With no endpoint configured, `getAIProvider()` returns null and the UI shows
 * "not configured" — deterministic reports keep working.
 */

export interface Explanation {
  text: string;
  /** Transaction ids the explanation refers to (must exist in the report). */
  citations: string[];
  model: string;
}

export interface AIProvider {
  id: string;
  explain(input: { report: FinancialReport; question?: string; locale: "en" | "ar" }, sharing: SharingOptions): Promise<Explanation>;
}

class HttpProvider implements AIProvider {
  id = "http";
  constructor(private endpoint: string) {}

  async explain(input: { report: FinancialReport; question?: string; locale: "en" | "ar" }, sharing: SharingOptions): Promise<Explanation> {
    const res = await fetch(this.endpoint, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ version: 1, locale: input.locale, question: input.question?.slice(0, 500), report: minimizeReport(input.report, sharing) }),
    });
    if (!res.ok) throw new Error(`AI endpoint responded ${res.status}`);
    const data = (await res.json()) as Partial<Explanation>;
    if (typeof data.text !== "string") throw new Error("Malformed AI response");
    // Only keep citations that point at transactions actually in the report's evidence.
    const known = new Set([...input.report.unusual.map((u) => u.transactionId), ...input.report.recurring.flatMap((r) => r.transactionIds)]);
    return { text: data.text, citations: (data.citations ?? []).filter((c) => known.has(c)), model: String(data.model ?? "unknown") };
  }
}

export function getAIProvider(): AIProvider | null {
  const endpoint = import.meta.env.VITE_LEDGER_AI_ENDPOINT as string | undefined;
  return endpoint ? new HttpProvider(endpoint) : null;
}
