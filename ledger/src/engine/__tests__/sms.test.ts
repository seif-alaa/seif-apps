import { describe, expect, it } from "vitest";
import { isSensitive, parseAlert, splitMessages } from "../sms";
import { merchantKey, merchantLabel } from "../merchants";

const NOW = new Date(2026, 9, 20, 15, 0).getTime();
const ok = (text: string) => {
  const r = parseAlert(text, NOW);
  if (!r.ok) throw new Error(`expected parse, got ${r.reason}`);
  return r.fields;
};

describe("parseAlert", () => {
  it("reads a card purchase", () => {
    const f = ok("CIB: Your card ****4821 was charged EGP 1,245.50 at CARREFOUR MAADI on 19/10/2026 14:32. Available balance EGP 3,200.00");
    expect(f.amount).toBe(124550);
    expect(f.currency).toBe("EGP");
    expect(f.direction).toBe("out");
    expect(f.last4).toBe("4821");
    expect(f.institution).toBe("cib");
    expect(f.merchant).toBe("CARREFOUR MAADI");
    expect(f.balanceAfter).toBe(320000);
    expect(new Date(f.occurredAt!).getDate()).toBe(19);
    expect(f.status).toBe("posted");
  });

  it("reads incoming InstaPay with sender", () => {
    const f = ok("InstaPay: You received EGP 4,000.00 from AHMED SAMIR to your account ****1234.");
    expect(f.direction).toBe("in");
    expect(f.amount).toBe(400000);
    expect(f.counterparty).toBe("AHMED SAMIR");
    expect(f.hints.instapay).toBe(true);
  });

  it("treats 'transferred from your account' as money out", () => {
    const f = ok("CIB: EGP 1,000.00 transferred from your account ****1234 via InstaPay.");
    expect(f.direction).toBe("out");
  });

  it("reads Arabic alerts with Arabic-Indic digits", () => {
    const f = ok("تم خصم مبلغ ١٥٠٫٠٠ جنيه من محفظتك فودافون كاش لدى سوبر ماركت الحمد. رصيدك الحالي ٢٣٤٠٫٥٠ جنيه");
    expect(f.amount).toBe(15000);
    expect(f.currency).toBe("EGP");
    expect(f.direction).toBe("out");
    expect(f.institution).toBe("vodafonecash");
    expect(f.merchant).toBe("سوبر ماركت الحمد");
    expect(f.balanceAfter).toBe(234050);
  });

  it("reads Arabic incoming money", () => {
    const f = ok("تم إيداع مبلغ 2,500 جنيه في حسابك رقم ****7788 تحويل من محمد علي");
    expect(f.direction).toBe("in");
    expect(f.amount).toBe(250000);
    expect(f.last4).toBe("7788");
  });

  it("flags status: declined, reversed, pending", () => {
    expect(ok("CIB: Transaction of EGP 5,600 at NOON.COM on card ****1111 was declined").status).toBe("failed");
    expect(ok("CIB: Purchase of EGP 300 at UBER on card ****1111 has been reversed").status).toBe("reversed");
    expect(ok("Telda: EGP 99.00 at NETFLIX is pending on card ending 2222").status).toBe("pending");
  });

  it("detects ATM, salary and refund hints", () => {
    expect(ok("NBE: Cash withdrawal of EGP 2,000 from ATM using card ****9090").hints.atm).toBe(true);
    expect(ok("Your account ****1 has been credited with EGP 28,500 SALARY OCT").hints.salary).toBe(true);
    expect(ok("Refund of EGP 300.00 from AMAZON credited to card ending 2222").hints.refund).toBe(true);
  });

  it("rejects OTPs and auth codes without extracting anything", () => {
    expect(parseAlert("Your OTP for EGP 1,250.00 purchase at JUMIA is 482913. Do not share.", NOW)).toEqual({ ok: false, reason: "sensitive" });
    expect(parseAlert("رمز التحقق الخاص بك هو 5521 لعملية بقيمة 300 جنيه", NOW)).toEqual({ ok: false, reason: "sensitive" });
    expect(isSensitive("Your verification code is 1234")).toBe(true);
    expect(isSensitive("You spent EGP 50 at Costa")).toBe(false);
  });

  it("ignores non-financial messages", () => {
    expect(parseAlert("Your parcel will arrive tomorrow between 2 and 5pm", NOW)).toEqual({ ok: false, reason: "unreadable" });
  });

  it("leaves direction unknown rather than guessing", () => {
    expect(ok("CIB: EGP 700.00 card ****1234 transaction").direction).toBeNull();
  });

  it("splits pasted blocks", () => {
    expect(splitMessages("a EGP 1\n\nb EGP 2\n \nc")).toHaveLength(3);
  });
});

describe("merchants", () => {
  it("normalises noisy descriptors to stable keys", () => {
    expect(merchantKey("CARREFOUR MAADI 0423 CAIRO EG")).toBe("carrefour");
    expect(merchantKey("BEANOS ZAMALEK")).toBe("beanos");
    expect(merchantKey("ABOU TAREK 0193")).toBe("abou tarek");
    expect(merchantKey("ahmed.samir@instapay")).toBe("ahmed samir");
    expect(merchantLabel("ABOU TAREK 0193")).toBe("Abou Tarek");
  });
});
