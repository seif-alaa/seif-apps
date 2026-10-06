import { addDays, startOfDay, subMonths, startOfMonth } from "date-fns";
import { db, uid, type Account, type Budget, type Category, type Transaction } from "./db";

type CatSeed = Omit<Category, "id" | "createdAt">;

export const DEFAULT_CATEGORIES: CatSeed[] = [
  { name: "Groceries", emoji: "🥑", kind: "expense", slot: 3 },
  { name: "Dining out", emoji: "🍜", kind: "expense", slot: 2 },
  { name: "Coffee", emoji: "☕", kind: "expense", slot: 4 },
  { name: "Transport", emoji: "🚇", kind: "expense", slot: 1 },
  { name: "Home & bills", emoji: "🏡", kind: "expense", slot: 7 },
  { name: "Shopping", emoji: "🛍️", kind: "expense", slot: 5 },
  { name: "Fun", emoji: "🎟️", kind: "expense", slot: 8 },
  { name: "Health", emoji: "🌿", kind: "expense", slot: 6 },
  { name: "Salary", emoji: "💼", kind: "income", slot: 3 },
  { name: "Side hustle", emoji: "✨", kind: "income", slot: 4 },
  { name: "Gifts", emoji: "🎁", kind: "income", slot: 5 },
];

export const DEFAULT_ACCOUNTS: Omit<Account, "id" | "createdAt">[] = [
  { name: "Everyday", type: "checking", emoji: "💳", startingBalance: 0 },
];

/** Make sure a brand-new device has categories and at least one account. */
export async function ensureBasics() {
  await db.transaction("rw", db.categories, db.accounts, async () => {
    if ((await db.categories.count()) === 0) {
      const now = Date.now();
      await db.categories.bulkAdd(DEFAULT_CATEGORIES.map((c, i) => ({ ...c, id: uid(), createdAt: now + i })));
    }
    if ((await db.accounts.count()) === 0) {
      await db.accounts.bulkAdd(DEFAULT_ACCOUNTS.map((a) => ({ ...a, id: uid(), createdAt: Date.now() })));
    }
  });
}

// Deterministic PRNG so sample data looks the same on every device.
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

/** Replace everything with ~4 months of believable sample data. */
export async function loadSampleData() {
  const rand = rng(42);
  const between = (min: number, max: number) => Math.round((min + rand() * (max - min)) * 100);
  const now = Date.now();

  const cats: Category[] = DEFAULT_CATEGORIES.map((c, i) => ({ ...c, id: uid(), createdAt: now + i }));
  const byName = Object.fromEntries(cats.map((c) => [c.name, c]));
  const accounts: Account[] = [
    { id: uid(), name: "Everyday", type: "checking", emoji: "💳", startingBalance: 184000, createdAt: now },
    { id: uid(), name: "Rainy day", type: "savings", emoji: "🌧️", startingBalance: 620000, createdAt: now + 1 },
    { id: uid(), name: "Wallet", type: "cash", emoji: "👛", startingBalance: 8000, createdAt: now + 2 },
  ];
  const [everyday, , wallet] = accounts;

  const txns: Transaction[] = [];
  const push = (cat: string, amount: number, date: Date, note = "", account = everyday) =>
    txns.push({
      id: uid(),
      type: byName[cat].kind,
      amount,
      categoryId: byName[cat].id,
      accountId: account.id,
      note,
      date: startOfDay(date).getTime(),
      createdAt: date.getTime(),
    });

  const today = startOfDay(new Date());
  const start = startOfMonth(subMonths(today, 4));
  for (let d = start; d <= today; d = addDays(d, 1)) {
    const dom = d.getDate();
    const dow = d.getDay();
    if (dom === 1) push("Salary", 520000, d, "Monthly paycheck");
    if (dom === 1) push("Home & bills", 165000, d, "Rent");
    if (dom === 12) push("Home & bills", between(70, 110), d, "Electricity & internet");
    if (dom === 15 && rand() > 0.3) push("Side hustle", between(180, 420), d, "Design gig");
    if (dow === 6 || (dow === 3 && rand() > 0.4)) push("Groceries", between(28, 95), d, rand() > 0.5 ? "Farmers market" : "Weekly shop");
    if (dow >= 1 && dow <= 5 && rand() > 0.35) push("Coffee", between(3.5, 6.5), d, "Flat white", wallet);
    if (dow >= 1 && dow <= 5 && rand() > 0.55) push("Transport", between(2.5, 14), d, rand() > 0.7 ? "Taxi home" : "Metro");
    if ((dow === 5 || dow === 6) && rand() > 0.35) push("Dining out", between(18, 72), d, ["Ramen night", "Brunch", "Tacos with Sam", "Pizza"][Math.floor(rand() * 4)]);
    if (rand() > 0.9) push("Shopping", between(15, 120), d, ["New sneakers", "Books", "Plant pot", "Headphones case"][Math.floor(rand() * 4)]);
    if (rand() > 0.93) push("Fun", between(12, 60), d, ["Cinema", "Concert", "Bowling", "Museum"][Math.floor(rand() * 4)]);
    if (rand() > 0.96) push("Health", between(10, 55), d, "Pharmacy");
    if (dom === 20 && rand() > 0.6) push("Gifts", between(40, 150), d, "Birthday money");
  }

  const budgetsFor: Record<string, number> = {
    Groceries: 42000,
    "Dining out": 22000,
    Coffee: 7000,
    Transport: 9000,
    Shopping: 15000,
    Fun: 10000,
  };
  const budgets: Budget[] = Object.entries(budgetsFor).map(([name, amount]) => ({
    categoryId: byName[name].id,
    amount,
    updatedAt: now,
  }));

  await wipeAll();
  await db.transaction("rw", [db.categories, db.accounts, db.transactions, db.budgets], async () => {
    await db.categories.bulkAdd(cats);
    await db.accounts.bulkAdd(accounts);
    await db.transactions.bulkAdd(txns);
    await db.budgets.bulkAdd(budgets);
  });
}

export async function wipeAll() {
  await db.transaction("rw", [db.categories, db.accounts, db.transactions, db.budgets], async () => {
    await Promise.all([db.categories.clear(), db.accounts.clear(), db.transactions.clear(), db.budgets.clear()]);
  });
}

export interface Backup {
  app: "ledger";
  version: 1;
  exportedAt: string;
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  budgets: Budget[];
}

export async function exportData(): Promise<Backup> {
  const [accounts, categories, transactions, budgets] = await Promise.all([
    db.accounts.toArray(),
    db.categories.toArray(),
    db.transactions.toArray(),
    db.budgets.toArray(),
  ]);
  return { app: "ledger", version: 1, exportedAt: new Date().toISOString(), accounts, categories, transactions, budgets };
}

export async function importData(data: unknown) {
  const b = data as Partial<Backup>;
  if (!b || b.app !== "ledger" || !Array.isArray(b.transactions) || !Array.isArray(b.categories) || !Array.isArray(b.accounts)) {
    throw new Error("That file doesn't look like a Ledger backup.");
  }
  await wipeAll();
  await db.transaction("rw", [db.categories, db.accounts, db.transactions, db.budgets], async () => {
    await db.categories.bulkAdd(b.categories!);
    await db.accounts.bulkAdd(b.accounts!);
    await db.transactions.bulkAdd(b.transactions!);
    await db.budgets.bulkAdd(b.budgets ?? []);
  });
}

