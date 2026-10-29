import { addDays, startOfDay, startOfMonth, subMonths } from "date-fns";
import {
  db,
  uid,
  upgradeV1Account,
  upgradeV1Category,
  upgradeV1Transaction,
  type Account,
  type Budget,
  type Category,
  type MerchantMemory,
  type Reconciliation,
  type SourceConnection,
  type Transaction,
} from "./db";
import { buildDefaultCategories, ensureCategories } from "./defaults";
import { ingest } from "@/engine/pipeline";
import { parseAlert } from "@/engine/sms";
import { merchantKey, merchantLabel } from "@/engine/merchants";
import type { Direction, TxnKind } from "@/engine/model";

const ALL = () => [db.accounts, db.categories, db.transactions, db.budgets, db.events, db.merchants, db.reconciliations, db.sources];

/** New device: built-in categories and a cash wallet. */
export async function ensureBasics() {
  await ensureCategories();
  if ((await db.accounts.count()) === 0) {
    await db.accounts.add({ id: uid(), name: "Cash", kind: "cash", institution: "cash", last4: null, currency: "EGP", startingBalance: 0, archived: false, createdAt: Date.now() });
  }
}

export async function wipeAll() {
  await db.transaction("rw", ALL(), async () => {
    await Promise.all(ALL().map((t) => t.clear()));
  });
}

/** Remove everything that isn't the user's real data (sample mode, simulator runs). */
export async function clearNonReal() {
  const { usePrefs } = await import("@/store/ui");
  if (usePrefs.getState().sampleMode) {
    await wipeAll();
    await ensureBasics();
    usePrefs.getState().setPrefs({ sampleMode: false });
    return;
  }
  await db.transaction("rw", ALL(), async () => {
    const fake = await db.transactions.filter((t) => t.origin !== "real").toArray();
    await db.transactions.bulkDelete(fake.map((t) => t.id));
    const fakeEvents = await db.events.filter((e) => e.origin !== "real").toArray();
    await db.events.bulkDelete(fakeEvents.map((e) => e.id));
    const fakeAccounts = await db.accounts.filter((a) => !!a.origin && a.origin !== "real").toArray();
    await db.accounts.bulkDelete(fakeAccounts.map((a) => a.id));
    await db.sources.where("kind").equals("simulator").delete();
  });
}

/**
 * Three months of clearly-labelled sample data, built the way real data is:
 * history the user "confirmed", merchant memory learned from it, and a few
 * fresh alerts run through the real pipeline so the review queue has work.
 */
export async function loadSampleData() {
  await wipeAll();
  const now = Date.now();
  const cats = buildDefaultCategories(now);
  const byKey = (k: string) => cats.find((c) => c.key === k)!.id;
  const acc = (name: string, institution: string, kind: Account["kind"], last4: string | null, startingBalance: number, i: number): Account => ({
    id: uid(), name, institution, kind, last4, currency: "EGP", startingBalance, archived: false, createdAt: now + i, origin: "sample",
  });
  const cib = acc("CIB", "cib", "bank", "4821", 1_850_000, 0);
  const telda = acc("Telda", "telda", "card", "3307", 200_000, 1);
  const vf = acc("Vodafone Cash", "vodafonecash", "wallet", null, 60_000, 2);
  const cash = acc("Cash", "cash", "cash", null, 120_000, 3);

  let seed = 7;
  const rand = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
  const between = (a: number, b: number) => Math.round((a + rand() * (b - a)) * 100);
  const txns: Transaction[] = [];
  const add = (o: { amount: number; dir: Direction; kind: TxnKind; cat?: string; account: Account; at: number; merchant?: string; counter?: Account | null; group?: string; source?: Transaction["source"]; note?: string }) => {
    const t: Transaction = {
      id: uid(),
      amount: o.amount,
      currency: "EGP",
      direction: o.dir,
      kind: o.kind,
      accountId: o.account.id,
      counterAccountId: o.counter?.id ?? null,
      transferGroupId: o.group ?? null,
      refundOf: null,
      categoryId: o.cat ? byKey(o.cat) : null,
      merchant: merchantLabel(o.merchant) ?? null,
      merchantKey: merchantKey(o.merchant),
      note: o.note ?? "",
      occurredAt: o.at,
      date: startOfDay(o.at).getTime(),
      detectedAt: o.at + 60_000,
      source: o.source ?? "sms_paste",
      sourceEventIds: [],
      reference: null,
      posting: "posted",
      classification: "classified",
      method: "user",
      confidence: 1,
      review: "confirmed",
      reviewReason: null,
      origin: "sample",
      createdAt: o.at,
      updatedAt: o.at,
    };
    txns.push(t);
    return t;
  };
  const transfer = (amount: number, fee: number, from: Account, to: Account, at: number, merchant?: string) => {
    const g = uid();
    add({ amount: amount + fee, dir: "out", kind: "transfer", account: from, counter: to, group: g, at, merchant });
    add({ amount, dir: "in", kind: "transfer", account: to, counter: from, group: g, at: at + 90_000, merchant, source: to.kind === "cash" ? "derived" : "sms_paste" });
  };

  const today = startOfDay(new Date());
  const start = startOfMonth(subMonths(today, 3));
  for (let d = start; d < addDays(today, -2); d = addDays(d, 1)) {
    const t = d.getTime();
    const h = (hh: number) => t + hh * 3_600_000 + Math.floor(rand() * 50) * 60_000;
    const dom = d.getDate();
    const dow = d.getDay();
    if (dom === 1) add({ amount: 3_200_000, dir: "in", kind: "income", cat: "salary", account: cib, at: h(9), merchant: "ACME SOFTWARE PAYROLL" });
    if (dom === 2) transfer(1_500_000, 200, cib, telda, h(10), "InstaPay");
    if (dom === 3) add({ amount: 950_000, dir: "out", kind: "expense", cat: "bills", account: cib, at: h(11), note: "Rent", merchant: "Rent" , source: "manual" });
    if (dom === 5) add({ amount: 49_900, dir: "out", kind: "expense", cat: "bills", account: vf, at: h(12), merchant: "Vodafone" });
    if (dom === 14) add({ amount: 19_900, dir: "out", kind: "expense", cat: "entertainment", account: telda, at: h(20), merchant: "NETFLIX.COM" });
    if (dom === 18 && rand() > 0.4) add({ amount: between(3000, 6500), dir: "in", kind: "income", cat: "freelance", account: cib, at: h(15), merchant: "UPWORK" });
    if (dom === 10 || dom === 24) transfer(200_000, 0, cib, cash, h(18), "ATM");
    if (dow === 5 || (dow === 2 && rand() > 0.5)) add({ amount: between(350, 1400), dir: "out", kind: "expense", cat: "groceries", account: telda, at: h(17), merchant: rand() > 0.5 ? "CARREFOUR MAADI" : "SEOUDI MARKET" });
    if (dow !== 5 && rand() > 0.45) add({ amount: between(65, 120), dir: "out", kind: "expense", cat: "coffee", account: telda, at: h(9), merchant: "BEANOS ZAMALEK" });
    if (rand() > 0.5) add({ amount: between(45, 220), dir: "out", kind: "expense", cat: "transport", account: telda, at: h(8), merchant: rand() > 0.3 ? "UBER TRIP" : "CAREEM" });
    if ((dow === 4 || dow === 5) && rand() > 0.4) add({ amount: between(220, 780), dir: "out", kind: "expense", cat: "dining", account: telda, at: h(21), merchant: "TALABAT" });
    if (rand() > 0.8) add({ amount: between(15, 80), dir: "out", kind: "expense", cat: "dining", account: cash, at: h(14), merchant: "Koshary Abou Tarek", source: "manual" });
    if (rand() > 0.94) add({ amount: between(250, 2200), dir: "out", kind: "expense", cat: "shopping", account: telda, at: h(19), merchant: rand() > 0.5 ? "AMAZON.EG" : "NOON.COM" });
    if (rand() > 0.96) add({ amount: between(120, 600), dir: "out", kind: "expense", cat: "health", account: telda, at: h(13), merchant: "EL EZABY PHARMACY" });
  }

  // Learned merchant memory = what the user "confirmed" above.
  const memory = new Map<string, MerchantMemory>();
  for (const t of txns) {
    if (!t.merchantKey || t.kind === "transfer") continue;
    const m = memory.get(t.merchantKey) ?? { merchantKey: t.merchantKey, label: t.merchant ?? t.merchantKey, counts: {}, updatedAt: now };
    const slot = t.categoryId ?? `kind:${t.kind}`;
    m.counts[slot] = (m.counts[slot] ?? 0) + 1;
    memory.set(t.merchantKey, m);
  }

  const budgets: Budget[] = [
    ["groceries", 450_000],
    ["dining", 300_000],
    ["coffee", 180_000],
    ["transport", 250_000],
    ["entertainment", 60_000],
    ["bills", 1_050_000],
  ].map(([k, amount]) => ({ categoryId: byKey(k as string), amount: amount as number, updatedAt: now }));

  await db.transaction("rw", ALL(), async () => {
    await db.categories.bulkAdd(cats);
    await db.accounts.bulkAdd([cib, telda, vf, cash]);
    await db.transactions.bulkAdd(txns);
    await db.merchants.bulkAdd([...memory.values()]);
    await db.budgets.bulkAdd(budgets);
  });

  // Fresh alerts through the real pipeline: one auto-filed, three that need the user.
  const recent: [string, number][] = [
    ["Telda: You spent EGP 92.00 at BEANOS ZAMALEK with card ending 3307.", 2],
    ["CIB: Purchase of EGP 640.00 at ZOOBA ZAMALEK on card ****4821.", 1],
    ["InstaPay: You received EGP 1,500.00 from MARIAM HASSAN to your account ****4821.", 1],
    ["Telda: You spent EGP 1,180.00 at CARREFOUR MAADI with card ending 3307.", 0],
  ];
  for (const [text, daysAgo] of recent) {
    const at = today.getTime() - daysAgo * 86_400_000 + 13 * 3_600_000;
    const p = parseAlert(text, at);
    if (p.ok) await ingest({ sourceKind: "sms_paste", receivedAt: at, parsed: { ...p.fields, occurredAt: at }, rawText: text, origin: "sample" });
  }
}

export interface BackupV2 {
  app: "ledger";
  version: 2;
  exportedAt: string;
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  budgets: Budget[];
  merchants: MerchantMemory[];
  reconciliations: Reconciliation[];
  sources: SourceConnection[];
}

/** Export everything except raw source evidence (which may contain message text). */
export async function exportData(): Promise<BackupV2> {
  const [accounts, categories, transactions, budgets, merchants, reconciliations, sources] = await Promise.all([
    db.accounts.toArray(),
    db.categories.toArray(),
    db.transactions.toArray(),
    db.budgets.toArray(),
    db.merchants.toArray(),
    db.reconciliations.toArray(),
    db.sources.toArray(),
  ]);
  return { app: "ledger", version: 2, exportedAt: new Date().toISOString(), accounts, categories, transactions, budgets, merchants, reconciliations, sources };
}

/** Restores v2 backups, and upgrades v1 backups on the way in. */
export async function importData(data: unknown) {
  const b = data as Omit<Partial<BackupV2>, "version"> & { version?: number };
  if (!b || b.app !== "ledger" || !Array.isArray(b.transactions) || !Array.isArray(b.categories) || !Array.isArray(b.accounts)) throw new Error("not_a_backup");
  let { accounts, categories, transactions } = b as BackupV2;
  if (b.version === 1) {
    const { usePrefs } = await import("@/store/ui");
    const currency = usePrefs.getState().currency;
    accounts = accounts.map((a) => upgradeV1Account({ ...a } as unknown as Record<string, unknown>, currency) as unknown as Account);
    categories = categories.map((c) => upgradeV1Category({ ...c } as unknown as Record<string, unknown>) as unknown as Category);
    transactions = transactions.map((t) => upgradeV1Transaction({ ...t } as unknown as Record<string, unknown>, currency) as unknown as Transaction);
  }
  await wipeAll();
  await db.transaction("rw", ALL(), async () => {
    await db.categories.bulkAdd(categories);
    await db.accounts.bulkAdd(accounts);
    await db.transactions.bulkAdd(transactions);
    await db.budgets.bulkAdd(b.budgets ?? []);
    await db.merchants.bulkAdd(b.merchants ?? []);
    await db.reconciliations.bulkAdd(b.reconciliations ?? []);
    await db.sources.bulkAdd(b.sources ?? []);
  });
  await ensureCategories();
}
