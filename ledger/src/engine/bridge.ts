import type { IncomingEvent, ParsedFields, SourceKind } from "./model";
import { parseAlert } from "./sms";

/**
 * Contract between Ledger's web core and a future native shell (Android / iOS).
 *
 * The native layer is responsible for collecting events with the platform's
 * permissions (SMS from an allow-list of bank senders, notification listener for
 * allow-listed banking apps, App Intents). It must:
 *   - drop OTP / password / auth-code messages before they reach JS
 *   - only forward messages from senders/packages the user enabled
 *   - pass a stable `externalId` (e.g. SMS _id + sender hash) for idempotency
 *
 * The web app exposes `window.ledgerNative.receive(payload)` and also accepts
 * `postMessage({ type: "ledger:event", payload })`.
 */
export interface NativeEventPayload {
  version: 1;
  source: Extract<SourceKind, "android_sms" | "android_notification" | "native_bridge">;
  externalId: string;
  receivedAt: number;
  /** Either raw alert text (parsed on-device by the shared parser)… */
  text?: string;
  /** …or fields the native side already extracted. */
  fields?: Partial<ParsedFields>;
  /** Sender address or app package, used only for institution detection. Not stored. */
  sender?: string;
}

export type BridgeResult = { ok: true; event: IncomingEvent } | { ok: false; error: string };

const MAX_TEXT = 1000;

/** Validate and normalise a native payload. Never trusts the shape blindly. */
export function fromNativePayload(raw: unknown): BridgeResult {
  if (!raw || typeof raw !== "object") return { ok: false, error: "not_an_object" };
  const p = raw as Partial<NativeEventPayload>;
  if (p.version !== 1) return { ok: false, error: "version" };
  if (!["android_sms", "android_notification", "native_bridge"].includes(String(p.source))) return { ok: false, error: "source" };
  if (typeof p.externalId !== "string" || p.externalId.length < 4 || p.externalId.length > 200) return { ok: false, error: "externalId" };
  if (typeof p.receivedAt !== "number" || !Number.isFinite(p.receivedAt)) return { ok: false, error: "receivedAt" };
  if (p.text !== undefined && (typeof p.text !== "string" || p.text.length > MAX_TEXT)) return { ok: false, error: "text" };

  let fields: ParsedFields | null = null;
  if (p.text) {
    const parsed = parseAlert(`${p.sender ?? ""} ${p.text}`, p.receivedAt);
    if (!parsed.ok) return { ok: false, error: parsed.reason };
    fields = parsed.fields;
  } else if (p.fields && typeof p.fields.amount === "number" && p.fields.amount > 0 && Number.isInteger(p.fields.amount)) {
    const f = p.fields;
    fields = {
      amount: f.amount!,
      currency: typeof f.currency === "string" ? f.currency.slice(0, 3).toUpperCase() : null,
      direction: f.direction === "in" || f.direction === "out" ? f.direction : null,
      status: f.status === "pending" || f.status === "failed" || f.status === "reversed" ? f.status : "posted",
      institution: typeof f.institution === "string" ? f.institution : null,
      last4: typeof f.last4 === "string" && /^\d{4}$/.test(f.last4) ? f.last4 : null,
      merchant: typeof f.merchant === "string" ? f.merchant.slice(0, 60) : null,
      counterparty: typeof f.counterparty === "string" ? f.counterparty.slice(0, 60) : null,
      reference: typeof f.reference === "string" ? f.reference.slice(0, 40) : null,
      occurredAt: typeof f.occurredAt === "number" ? f.occurredAt : null,
      balanceAfter: null,
      hints: {},
      parseConfidence: 0.8,
    };
  }
  if (!fields) return { ok: false, error: "no_content" };
  return { ok: true, event: { sourceKind: p.source!, externalId: p.externalId, receivedAt: p.receivedAt, parsed: fields, rawText: p.text } };
}

/**
 * Text arriving via the Android share sheet (Web Share Target) or an iOS
 * Shortcut that opens `…/?capture=<text>&via=shortcut`.
 */
export function readCaptureParams(search: string): { text: string; via: "share_target" | "ios_shortcut" } | null {
  const q = new URLSearchParams(search);
  const text = q.get("capture") ?? q.get("text") ?? q.get("share_text");
  if (!text) return null;
  return { text: text.slice(0, 4000), via: q.get("via") === "shortcut" ? "ios_shortcut" : "share_target" };
}
