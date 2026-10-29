import type { IncomingEvent } from "./model";
import { parseAlert } from "./sms";

/**
 * Development-only event generator. Every event it produces is marked
 * origin: "simulated" and shown with a SIMULATED badge — it can never be
 * mistaken for real money, and "Remove simulated data" deletes it all.
 */

export interface Scenario {
  id: string;
  label: string;
  messages: (ctx: { last4: (inst: string) => string }) => string[];
}

const fmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2 });

export const SCENARIOS: Scenario[] = [
  { id: "purchase", label: "Card purchase (Telda, Carrefour)", messages: ({ last4 }) => [`Telda: You spent EGP ${fmt(245)} at CARREFOUR MAADI with card ending ${last4("telda")}.`] },
  { id: "coffee", label: "Coffee at a recurring merchant", messages: ({ last4 }) => [`CIB: Your card ****${last4("cib")} was charged EGP ${fmt(85)} at BEANOS ZAMALEK. Available balance EGP 12,430.00`] },
  { id: "unknown", label: "Purchase at an unknown merchant", messages: ({ last4 }) => [`CIB: Purchase of EGP ${fmt(420)} at ABOU TAREK 0193 on card ****${last4("cib")}.`] },
  { id: "salary", label: "Salary received", messages: ({ last4 }) => [`CIB: Your account ****${last4("cib")} has been credited with EGP ${fmt(28500)} - SALARY OCT. Ref 88123401`] },
  { id: "incoming", label: "Incoming InstaPay (unknown sender)", messages: ({ last4 }) => [`InstaPay: You received EGP ${fmt(4000)} from AHMED SAMIR to your account ****${last4("cib")}.`] },
  {
    id: "transfer",
    label: "Own transfer CIB → Telda (two alerts)",
    messages: ({ last4 }) => [
      `CIB: EGP ${fmt(1000)} transferred from your account ****${last4("cib")} via InstaPay. Fee EGP 0.00`,
      `Telda: EGP ${fmt(1000)} was added to your Telda card ending ${last4("telda")}.`,
    ],
  },
  {
    id: "transfer_reverse",
    label: "Own transfer arriving out of order",
    messages: ({ last4 }) => [
      `Telda: EGP ${fmt(500)} was added to your Telda card ending ${last4("telda")}.`,
      `CIB: EGP ${fmt(502)} transferred from your account ****${last4("cib")} via InstaPay.`,
    ],
  },
  { id: "duplicate", label: "Same alert delivered twice", messages: ({ last4 }) => {
    const m = `CIB: Your card ****${last4("cib")} was charged EGP ${fmt(310)} at UBER TRIP. Ref UB99172`;
    return [m, m];
  } },
  { id: "atm", label: "ATM cash withdrawal", messages: ({ last4 }) => [`NBE: Cash withdrawal of EGP ${fmt(2000)} from ATM using card ****${last4("nbe")}.`] },
  {
    id: "refund",
    label: "Purchase then refund (Amazon)",
    messages: ({ last4 }) => [
      `Telda: You spent EGP ${fmt(1299)} at AMAZON.EG with card ending ${last4("telda")}.`,
      `Telda: Refund of EGP ${fmt(1299)} from AMAZON.EG credited to your card ending ${last4("telda")}.`,
    ],
  },
  { id: "declined", label: "Declined payment", messages: ({ last4 }) => [`CIB: Transaction of EGP ${fmt(5600)} at NOON.COM on card ****${last4("cib")} was declined - insufficient funds.`] },
  { id: "otp", label: "OTP message (must be ignored)", messages: () => ["CIB: Your OTP for EGP 1,250.00 purchase at JUMIA is 482913. Do not share this code."] },
  { id: "arabic", label: "Arabic alert (Vodafone Cash)", messages: () => ["تم خصم مبلغ ١٥٠٫٠٠ جنيه من محفظتك فودافون كاش لدى سوبر ماركت الحمد. رصيدك الحالي ٢٣٤٠٫٥٠ جنيه"] },
];

let counter = 0;

export function scenarioEvents(s: Scenario, last4: (inst: string) => string, now = Date.now()): { event: IncomingEvent | null; text: string; reason?: string }[] {
  return s.messages({ last4 }).map((text, i) => {
    const parsed = parseAlert(text, now);
    if (!parsed.ok) return { event: null, text, reason: parsed.reason };
    // The duplicate scenario must reuse the same id; everything else is unique per run.
    const id = s.id === "duplicate" ? `dup-${Math.floor(now / 60_000)}` : `${s.id}-${now}-${counter++}`;
    return {
      text,
      event: {
        sourceKind: "simulator",
        externalId: id,
        receivedAt: now + i * 60_000,
        parsed: { ...parsed.fields, occurredAt: parsed.fields.occurredAt ?? now + i * 60_000 },
        rawText: text,
        origin: "simulated",
      },
    };
  });
}
