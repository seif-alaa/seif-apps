import { db } from "@/db/db";
import { ingest, type IngestResult } from "@/engine/pipeline";
import { parseAlert, splitMessages } from "@/engine/sms";
import { fromNativePayload } from "@/engine/bridge";
import type { IncomingEvent, SourceKind } from "@/engine/model";
import { engineConfig } from "@/store/ui";
import { notifyResults } from "./notify";

export interface CaptureSummary {
  results: IngestResult[];
  sensitive: number;
  unreadable: number;
}

/**
 * Turn pasted / shared / Shortcut-delivered alert text into ledger events.
 * OTP-like messages are dropped before parsing and never stored.
 */
export async function captureText(text: string, sourceKind: Extract<SourceKind, "sms_paste" | "share_target" | "ios_shortcut">): Promise<CaptureSummary> {
  const now = Date.now();
  const out: CaptureSummary = { results: [], sensitive: 0, unreadable: 0 };
  await ensureSource(sourceKind);
  for (const [i, msg] of splitMessages(text).entries()) {
    const parsed = parseAlert(msg, now);
    if (!parsed.ok) {
      if (parsed.reason === "sensitive") out.sensitive++;
      else out.unreadable++;
      continue;
    }
    const event: IncomingEvent = { sourceKind, receivedAt: now + i, parsed: { ...parsed.fields, occurredAt: parsed.fields.occurredAt ?? now + i }, rawText: msg };
    out.results.push(await ingest(event, engineConfig()));
  }
  void notifyResults(out.results);
  return out;
}

export async function ingestEvents(events: IncomingEvent[]) {
  const results: IngestResult[] = [];
  for (const e of events) results.push(await ingest(e, engineConfig()));
  void notifyResults(results);
  return results;
}

/** Remember that the user set up a source, so Settings can show its real status and last activity. */
export async function ensureSource(kind: SourceKind) {
  const existing = await db.sources.where("kind").equals(kind).first();
  if (existing) {
    if (existing.status !== "active") await db.sources.update(existing.id, { status: "active" });
    return existing.id;
  }
  const id = `${kind}`;
  await db.sources.put({ id, kind, status: "active", connectedAt: Date.now(), lastEventAt: null, lastError: null });
  return id;
}

/**
 * Native shell entry point (see engine/bridge.ts). Exposed on window so an
 * Android/iOS wrapper can deliver events; validated before anything is stored.
 */
export function installNativeBridge() {
  const receive = async (payload: unknown) => {
    const r = fromNativePayload(payload);
    if (!r.ok) return { ok: false, error: r.error };
    await ensureSource(r.event.sourceKind);
    const [res] = await ingestEvents([r.event]);
    return { ok: true, outcome: res.outcome, transactionId: res.transactionId };
  };
  (window as unknown as { ledgerNative: unknown }).ledgerNative = { version: 1, receive };
  window.addEventListener("message", (e) => {
    if (e.origin !== window.location.origin) return;
    if (e.data?.type === "ledger:event") void receive(e.data.payload);
  });
}
