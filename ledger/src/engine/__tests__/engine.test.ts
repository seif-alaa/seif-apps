import Dexie from "dexie";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db, uid, type Account } from "@/db/db";
import { ensureCategories } from "@/db/defaults";
import { ingest } from "../pipeline";
import { parseAlert } from "../sms";
import { DEFAULT_CONFIG } from "../config";
import { confirmClassification, deleteTransaction, mergeDuplicate, reopen, resolveWithAdjustment, restore, startReconciliation } from "../actions";
import { accountBalance, budgetLines, monthSummary, netWorth } from "../ledger";
import { detectMapping, parseCsv, statementToEvents } from "../csv";
import { fromNativePayload } from "../bridge";
import { SOURCES } from "../sources";
import { detectRecurring } from "../recurring";
import type { IncomingEvent, SourceKind } from "../model";

const T0 = new Date(2026, 9, 20, 12, 0).getTime();
let accounts: Record<string, Account>;

async function setup() {
  await Promise.all(db.tables.map((t) => t.clear()));
  await ensureCategories();
  const mk = (name: string, institution: string, kind: Account["kind"], last4: string | null, startingBalance: number): Account => ({
    id: uid(), name, institution, kind, last4, currency: "EGP", startingBalance, archived: false, createdAt: Date.now(),
  });
  accounts = {
    cib: mk("CIB", "cib", "bank", "1234", 1_000_000),
    telda: mk("Telda", "telda", "card", "5678", 200_000),
    nbe: mk("NBE", "nbe", "bank", "9090", 500_000),
    cash: mk("Cash", "cash", "cash", null, 0),
  };
  await db.accounts.bulkAdd(Object.values(accounts));
}

function sms(text: string, at = T0, sourceKind: SourceKind = "sms_paste", externalId?: string): IncomingEvent {
  const r = parseAlert(text, at);
  if (!r.ok) throw new Error(`unparseable: ${r.reason}`);
  return { sourceKind, receivedAt: at, parsed: { ...r.fields, occurredAt: r.fields.occurredAt ?? at }, rawText: text, externalId };
}

const cat = async (key: string) => (await db.categories.where("key").equals(key).first())!;
const all = () => db.transactions.toArray();
const bal = async (a: Account) => accountBalance((await db.accounts.get(a.id))!, await all());
const worth = async () => netWorth(await db.accounts.toArray(), await all(), "EGP").total;
const month = async () => monthSummary(await all(), new Date(T0), "EGP", await db.accounts.toArray());

beforeAll(async () => {
  await db.open();
});
beforeEach(setup);

describe("1–3 detection and classification", () => {
  it("detects an expense, debits the account and asks for the category", async () => {
    const r = await ingest(sms("Telda: You spent EGP 245.00 at CARREFOUR MAADI with card ending 5678."));
    expect(r.outcome).toBe("created");
    const t = (await db.transactions.get(r.transactionId!))!;
    expect(t.accountId).toBe(accounts.telda.id);
    expect(t.kind).toBe("expense");
    expect(t.categoryId).toBe((await cat("groceries")).id); // built-in suggestion…
    expect(t.review).toBe("needs_review"); // …but a rule alone never auto-files
    expect(await bal(accounts.telda)).toBe(200_000 - 24_500);
  });

  it("detects incoming money without calling it income", async () => {
    const r = await ingest(sms("InstaPay: You received EGP 4,000.00 from AHMED SAMIR to your account ****1234."));
    const t = (await db.transactions.get(r.transactionId!))!;
    expect(t.kind).toBe("unknown");
    expect(t.reviewReason).toBe("unknown_income");
    const s = await month();
    expect(s.income).toBe(0);
    expect(s.unknownIn).toBe(400_000);
    expect(await bal(accounts.cib)).toBe(1_400_000);
  });

  it("classifying an unknown payment updates budgets but never the balance", async () => {
    const r = await ingest(sms("CIB: Purchase of EGP 420.00 at ABOU TAREK 0193 on card ****1234."));
    const before = await bal(accounts.cib);
    const dining = await cat("dining");
    await db.budgets.put({ categoryId: dining.id, amount: 100_000, updatedAt: 0 });
    await confirmClassification(r.transactionId!, { kind: "expense", categoryId: dining.id });
    await confirmClassification(r.transactionId!, { kind: "expense", categoryId: dining.id }); // twice on purpose
    expect(await bal(accounts.cib)).toBe(before);
    const lines = budgetLines(await db.budgets.toArray(), await db.categories.toArray(), await all(), new Date(T0), "EGP");
    expect(lines[0].spent).toBe(42_000);
    expect((await month()).spending).toBe(42_000);
  });
});

describe("4 learning from the user", () => {
  it("auto-files a merchant after three consistent confirmations", async () => {
    const coffee = await cat("coffee");
    for (let i = 0; i < 3; i++) {
      const r = await ingest(sms(`CIB: Your card ****1234 was charged EGP 85.00 at BEANOS ZAMALEK. Ref BN${i}0001`, T0 + i * 86_400_000));
      const t = (await db.transactions.get(r.transactionId!))!;
      expect(t.review).toBe("needs_review");
      await confirmClassification(t.id, { kind: "expense", categoryId: coffee.id });
    }
    const r = await ingest(sms("CIB: Your card ****1234 was charged EGP 92.00 at BEANOS ZAMALEK. Ref BN40001", T0 + 4 * 86_400_000));
    const t = (await db.transactions.get(r.transactionId!))!;
    expect(t.categoryId).toBe(coffee.id);
    expect(t.method).toBe("merchant_memory");
    expect(t.review).toBe("auto_accepted");
    expect(r.needsReview).toBe(false);
  });

  it("respects the user turning auto-categorisation off", async () => {
    const coffee = await cat("coffee");
    for (let i = 0; i < 4; i++) {
      const r = await ingest(sms(`CIB: Your card ****1234 was charged EGP 85.00 at BEANOS. Ref Q${i}1234`, T0 + i * 86_400_000), { ...DEFAULT_CONFIG, autoCategorize: false });
      const t = (await db.transactions.get(r.transactionId!))!;
      expect(t.review).toBe("needs_review");
      await confirmClassification(t.id, { kind: "expense", categoryId: coffee.id });
    }
  });

  it("resolves waiting items from the same merchant once confident", async () => {
    const coffee = await cat("coffee");
    const ids: string[] = [];
    for (let i = 0; i < 4; i++) ids.push((await ingest(sms(`CIB: Your card ****1234 was charged EGP 60.00 at CILANTRO. Ref C${i}9999`, T0 + i * 3_600_000))).transactionId!);
    for (const id of ids.slice(0, 3)) await confirmClassification(id, { kind: "expense", categoryId: coffee.id });
    const last = (await db.transactions.get(ids[3]))!;
    expect(last.review).toBe("auto_accepted");
    expect(last.categoryId).toBe(coffee.id);
  });
});

describe("5 & 15 duplicates and idempotency", () => {
  it("the same alert twice creates one transaction and one balance change", async () => {
    const text = "CIB: Your card ****1234 was charged EGP 310.00 at UBER TRIP. Ref UB99172";
    const a = await ingest(sms(text));
    const b = await ingest(sms(text));
    expect(b.outcome).toBe("duplicate");
    expect(await db.transactions.count()).toBe(1);
    expect(await bal(accounts.cib)).toBe(1_000_000 - 31_000);
    expect(a.transactionId).toBe(b.transactionId);
  });

  it("one payment reported by two senders is merged", async () => {
    await ingest(sms("CIB: Your card ****1234 was charged EGP 150.00 at TALABAT", T0));
    const r = await ingest(sms("InstaPay CIB alert: EGP 150.00 paid to TALABAT from your account ****1234", T0 + 60_000, "share_target"));
    expect(r.outcome).toBe("merged");
    expect(await db.transactions.count()).toBe(1);
    expect((await db.transactions.toArray())[0].sourceEventIds).toHaveLength(2);
  });

  it("flags look-alike alerts from the same sender instead of silently merging", async () => {
    await ingest(sms("CIB: Your card ****1234 was charged EGP 40.00 at KIOSK 12:01", T0));
    const r = await ingest(sms("CIB: Your card ****1234 was charged EGP 40.00 at KIOSK 12:04", T0 + 3 * 60_000));
    const t = (await db.transactions.get(r.transactionId!))!;
    expect(t.reviewReason).toBe("possible_duplicate");
    await mergeDuplicate(t.id);
    expect(await db.transactions.count()).toBe(1);
    expect(await bal(accounts.cib)).toBe(1_000_000 - 4_000);
  });
});

describe("6 & 13 transfers between own accounts", () => {
  it("CIB → Telda is a transfer: no spending, no income, net worth unchanged", async () => {
    const w0 = await worth();
    await ingest(sms("CIB: EGP 1,000.00 transferred from your account ****1234 via InstaPay.", T0));
    await ingest(sms("Telda: EGP 1,000.00 was added to your Telda card ending 5678.", T0 + 120_000));
    const txns = await all();
    expect(txns.every((t) => t.kind === "transfer")).toBe(true);
    expect(new Set(txns.map((t) => t.transferGroupId)).size).toBe(1);
    expect(txns.every((t) => t.review !== "needs_review")).toBe(true);
    const s = await month();
    expect(s.spending).toBe(0);
    expect(s.income).toBe(0);
    expect(await worth()).toBe(w0);
    expect(await bal(accounts.cib)).toBe(900_000);
    expect(await bal(accounts.telda)).toBe(300_000);
  });

  it("matches legs that arrive out of order and counts the fee as spending", async () => {
    const w0 = await worth();
    const first = await ingest(sms("Telda: EGP 500.00 was added to your Telda card ending 5678.", T0));
    expect((await db.transactions.get(first.transactionId!))!.review).toBe("needs_review");
    await ingest(sms("CIB: EGP 502.00 transferred from your account ****1234 via InstaPay.", T0 + 30 * 60_000));
    const inLeg = (await db.transactions.get(first.transactionId!))!;
    expect(inLeg.kind).toBe("transfer");
    expect(inLeg.review).toBe("auto_accepted");
    const s = await month();
    expect(s.fees).toBe(200);
    expect(s.spending).toBe(200);
    expect(s.income).toBe(0);
    expect(await worth()).toBe(w0 - 200);
  });

  it("doesn't pair amounts that differ by more than a plausible fee", async () => {
    await ingest(sms("CIB: EGP 1,000.00 transferred from your account ****1234.", T0));
    await ingest(sms("Telda: EGP 700.00 was added to your Telda card ending 5678.", T0 + 60_000));
    expect((await all()).some((t) => t.kind === "transfer")).toBe(false);
  });

  it("asks instead of guessing when two accounts could be the destination", async () => {
    await ingest(sms("Telda: EGP 300.00 was added to your Telda card ending 5678.", T0));
    await ingest(sms("NBE: EGP 300.00 credited to your account ****9090", T0 + 60_000));
    const r = await ingest(sms("CIB: EGP 300.00 transferred from your account ****1234", T0 + 120_000));
    const t = (await db.transactions.get(r.transactionId!))!;
    expect(t.transferGroupId).toBeNull();
    expect(t.reviewReason).toBe("ambiguous_transfer");
  });

  it("user-declared transfer pairs with the other leg", async () => {
    const out = await ingest(sms("CIB: EGP 750.00 transferred from your account ****1234 to AHMED", T0));
    // 100h later: outside the automatic matching window, so it isn't paired on its own.
    const inn = await ingest(sms("Telda: EGP 750.00 was added to your Telda card ending 5678.", T0 + 100 * 3_600_000));
    expect((await db.transactions.get(inn.transactionId!))!.transferGroupId).toBeNull();
    await confirmClassification(out.transactionId!, { kind: "transfer", categoryId: null, counterAccountId: accounts.telda.id });
    expect((await db.transactions.get(out.transactionId!))!.counterAccountId).toBe(accounts.telda.id);
  });
});

describe("7 refunds, reversals, failures, pending", () => {
  it("a refund links to the purchase and cancels the spending", async () => {
    await ingest(sms("Telda: You spent EGP 1,299.00 at AMAZON.EG with card ending 5678.", T0));
    const r = await ingest(sms("Telda: Refund of EGP 1,299.00 from AMAZON.EG credited to your card ending 5678.", T0 + 86_400_000));
    const t = (await db.transactions.get(r.transactionId!))!;
    expect(t.kind).toBe("refund");
    expect(t.refundOf).not.toBeNull();
    const s = await month();
    expect(s.spending).toBe(0);
    expect(s.income).toBe(0);
    expect(await bal(accounts.telda)).toBe(200_000);
  });

  it("a reversal marks the original as reversed (no balance effect, no spending)", async () => {
    await ingest(sms("CIB: Your card ****1234 was charged EGP 300.00 at UBER", T0));
    const r = await ingest(sms("CIB: Purchase of EGP 300.00 at UBER on card ****1234 has been reversed", T0 + 3_600_000));
    expect(r.outcome).toBe("status_update");
    expect(await db.transactions.count()).toBe(1);
    expect((await all())[0].posting).toBe("reversed");
    expect(await bal(accounts.cib)).toBe(1_000_000);
    expect((await month()).spending).toBe(0);
  });

  it("a declined payment never touches the ledger", async () => {
    const r = await ingest(sms("CIB: Transaction of EGP 5,600 at NOON.COM on card ****1234 was declined - insufficient funds.", T0));
    expect(r.outcome).toBe("no_effect");
    expect(await db.transactions.count()).toBe(0);
  });

  it("pending authorisation posts once, not twice", async () => {
    await ingest(sms("Telda: EGP 99.00 at NETFLIX is pending on card ending 5678", T0));
    expect(await bal(accounts.telda)).toBe(200_000); // pending isn't in the posted balance
    expect((await month()).expenses + (await month()).unknownOut).toBeGreaterThan(0);
    const r = await ingest(sms("Telda: You spent EGP 99.00 at NETFLIX with card ending 5678.", T0 + 86_400_000));
    expect(r.outcome).toBe("merged");
    expect(await db.transactions.count()).toBe(1);
    expect(await bal(accounts.telda)).toBe(200_000 - 9_900);
  });
});

describe("8 ATM withdrawals", () => {
  it("moves money from the bank to the cash wallet", async () => {
    const w0 = await worth();
    await ingest(sms("NBE: Cash withdrawal of EGP 2,000.00 from ATM using card ****9090.", T0));
    expect(await bal(accounts.nbe)).toBe(300_000);
    expect(await bal(accounts.cash)).toBe(200_000);
    expect(await worth()).toBe(w0);
    const s = await month();
    expect(s.spending).toBe(0);
    expect(s.cashWithdrawn).toBe(200_000);
  });
});

describe("9 & 10 unavailable integrations, offline", () => {
  it("native-only and partner sources are not presented as available", () => {
    expect(SOURCES.find((s) => s.kind === "android_sms")!.availability).toBe("needs_native_app");
    expect(SOURCES.find((s) => s.kind === "open_banking")!.availability).toBe("needs_partner");
  });

  it("rejects malformed or sensitive native payloads", () => {
    expect(fromNativePayload({}).ok).toBe(false);
    expect(fromNativePayload({ version: 1, source: "android_sms", externalId: "sms-1", receivedAt: T0, text: "Your OTP is 123456" })).toEqual({ ok: false, error: "sensitive" });
    const good = fromNativePayload({ version: 1, source: "android_sms", externalId: "sms-2", receivedAt: T0, text: "CIB: Your card ****1234 was charged EGP 10.00 at KIOSK" });
    expect(good.ok).toBe(true);
  });

  it("ingests with no network at all", async () => {
    const realFetch = globalThis.fetch;
    globalThis.fetch = (() => Promise.reject(new Error("offline"))) as typeof fetch;
    try {
      const r = await ingest(sms("CIB: Your card ****1234 was charged EGP 10.00 at KIOSK"));
      expect(r.outcome).toBe("created");
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});

describe("11 statement import", () => {
  it("imports rows, merges ones already seen live, and is idempotent", async () => {
    await ingest(sms("CIB: Your card ****1234 was charged EGP 245.00 at CARREFOUR MAADI", new Date(2026, 9, 18, 10).getTime()));
    const csv = `Date,Description,Debit,Credit,Reference
18/10/2026,CARREFOUR MAADI 0423,245.00,,
19/10/2026,VODAFONE BILL,320.00,,
19/10/2026,SALARY OCTOBER,,28500.00,PAY-1001
20/10/2026,TALABAT,180.50,,
20/10/2026,TALABAT,180.50,,`;
    const rows = parseCsv(csv);
    const mapping = detectMapping(rows[0])!;
    expect(mapping).not.toBeNull();
    const events = statementToEvents(rows, mapping, accounts.cib.id, "EGP");
    const outcomes = [];
    for (const r of events) outcomes.push((await ingest(r.event!)).outcome);
    expect(outcomes).toEqual(["merged", "created", "created", "created", "created"]);
    // Two identical TALABAT lines in a statement are two real purchases.
    expect((await all()).filter((t) => t.merchantKey === "talabat")).toHaveLength(2);
    const count = await db.transactions.count();
    for (const r of statementToEvents(rows, mapping, accounts.cib.id, "EGP")) expect((await ingest(r.event!)).outcome).toBe("duplicate");
    expect(await db.transactions.count()).toBe(count);
  });
});

describe("12 reopening and correcting", () => {
  it("a wrong auto-filed category can be reopened and corrected without moving money", async () => {
    const coffee = await cat("coffee");
    const dining = await cat("dining");
    for (let i = 0; i < 3; i++) {
      const r = await ingest(sms(`CIB: Your card ****1234 was charged EGP 120.00 at ZOOBA. Ref Z${i}2345`, T0 + i * 86_400_000));
      await confirmClassification(r.transactionId!, { kind: "expense", categoryId: coffee.id });
    }
    const r = await ingest(sms("CIB: Your card ****1234 was charged EGP 400.00 at ZOOBA. Ref Z92345", T0 + 5 * 86_400_000));
    expect((await db.transactions.get(r.transactionId!))!.review).toBe("auto_accepted");
    const before = await bal(accounts.cib);
    await reopen(r.transactionId!);
    expect((await db.transactions.get(r.transactionId!))!.review).toBe("needs_review");
    await confirmClassification(r.transactionId!, { kind: "expense", categoryId: dining.id });
    const t = (await db.transactions.get(r.transactionId!))!;
    expect(t.categoryId).toBe(dining.id);
    expect(await bal(accounts.cib)).toBe(before);
    // Disagreement lowers confidence below auto-filing.
    const mem = (await db.merchants.get("zooba"))!;
    expect(mem.counts[coffee.id]).toBe(3);
    expect(mem.counts[dining.id]).toBe(1);
  });

  it("delete + undo restores exactly", async () => {
    const r = await ingest(sms("CIB: Your card ****1234 was charged EGP 55.00 at KIOSK"));
    const snap = await deleteTransaction(r.transactionId!);
    expect(await db.transactions.count()).toBe(0);
    await restore(snap!);
    expect(await bal(accounts.cib)).toBe(1_000_000 - 5_500);
  });

  it("deleting one leg of a transfer sends the other back to review", async () => {
    await ingest(sms("CIB: EGP 1,000.00 transferred from your account ****1234 via InstaPay.", T0));
    const inn = await ingest(sms("Telda: EGP 1,000.00 was added to your Telda card ending 5678.", T0 + 60_000));
    const out = (await all()).find((t) => t.direction === "out")!;
    await deleteTransaction(out.id);
    const left = (await db.transactions.get(inn.transactionId!))!;
    expect(left.kind).toBe("unknown");
    expect(left.review).toBe("needs_review");
  });
});

describe("14 budgets and insights stay consistent", () => {
  it("every surface reads the same numbers", async () => {
    const groceries = await cat("groceries");
    await db.budgets.put({ categoryId: groceries.id, amount: 500_000, updatedAt: 0 });
    const a = await ingest(sms("Telda: You spent EGP 245.00 at CARREFOUR with card ending 5678.", T0));
    const b = await ingest(sms("Telda: You spent EGP 1,000.00 at SPINNEYS with card ending 5678.", T0 + 1000));
    await confirmClassification(a.transactionId!, { kind: "expense", categoryId: groceries.id });
    await confirmClassification(b.transactionId!, { kind: "expense", categoryId: groceries.id });
    await ingest(sms("Telda: Refund of EGP 200.00 from SPINNEYS credited to your card ending 5678.", T0 + 2000));
    const s = await month();
    const lines = budgetLines(await db.budgets.toArray(), await db.categories.toArray(), await all(), new Date(T0), "EGP");
    expect(s.byCategory.get(groceries.id)).toBe(124_500 - 20_000);
    expect(lines[0].spent).toBe(s.byCategory.get(groceries.id));
    expect(s.spending).toBe(104_500);
  });
});

describe("reconciliation", () => {
  it("surfaces a discrepancy without inventing transactions", async () => {
    const rec = await startReconciliation(accounts.cib.id, 1_150_000);
    expect(rec.difference).toBe(150_000);
    expect(rec.status).toBe("open");
    expect(await db.transactions.count()).toBe(0);
    const adj = await resolveWithAdjustment(rec.id);
    expect(adj!.kind).toBe("adjustment");
    expect(await bal(accounts.cib)).toBe(1_150_000);
    const s = await month();
    expect(s.income).toBe(0);
    expect(s.spending).toBe(0);
  });
});

describe("recurring", () => {
  it("finds a monthly subscription", async () => {
    const ent = await cat("entertainment");
    for (let i = 0; i < 3; i++) {
      const r = await ingest(sms(`Telda: You spent EGP 199.00 at NETFLIX.COM with card ending 5678. Ref NF${i}777`, T0 - (2 - i) * 30 * 86_400_000));
      await confirmClassification(r.transactionId!, { kind: "expense", categoryId: ent.id });
    }
    const rec = detectRecurring(await all(), T0 + 86_400_000);
    expect(rec).toHaveLength(1);
    expect(rec[0].cadence).toBe("monthly");
  });
});

describe("16 migrating v1 data", () => {
  it("upgrades existing records in place without losing anything", async () => {
    db.close();
    await Dexie.delete("ledger");
    const legacy = new Dexie("ledger");
    legacy.version(1).stores({ accounts: "id, createdAt", categories: "id, kind, createdAt", transactions: "id, date, type, categoryId, accountId, [type+date]", budgets: "categoryId" });
    await legacy.open();
    await legacy.table("accounts").add({ id: "a1", name: "Everyday", type: "checking", emoji: "💳", startingBalance: 10_000, createdAt: 1 });
    await legacy.table("categories").add({ id: "c1", name: "Coffee", emoji: "☕", kind: "expense", slot: 4, createdAt: 1 });
    await legacy.table("transactions").bulkAdd([
      { id: "t1", type: "expense", amount: 450, categoryId: "c1", accountId: "a1", note: "Flat white", date: T0, createdAt: T0 },
      { id: "t2", type: "income", amount: 5_000, categoryId: "c1", accountId: "a1", note: "", date: T0, createdAt: T0 },
    ]);
    await legacy.table("budgets").add({ categoryId: "c1", amount: 7000, updatedAt: 1 });
    legacy.close();

    await db.open();
    const t1 = (await db.transactions.get("t1"))!;
    expect(t1).toMatchObject({ amount: 450, direction: "out", kind: "expense", note: "Flat white", posting: "posted", review: "confirmed", source: "manual", origin: "real" });
    expect((t1 as unknown as Record<string, unknown>).type).toBeUndefined();
    expect((await db.transactions.get("t2"))!.kind).toBe("income");
    expect(await db.accounts.get("a1")).toMatchObject({ name: "Everyday", kind: "bank", startingBalance: 10_000, archived: false });
    expect(await db.categories.get("c1")).toMatchObject({ key: "coffee", icon: "coffee" });
    expect(await db.budgets.get("c1")).toMatchObject({ amount: 7000 });
    expect(accountBalance((await db.accounts.get("a1"))!, await all())).toBe(10_000 - 450 + 5_000);
  });
});
