import { db, ICON_FOR_KEY, uid, type Category } from "./db";

/** Built-in categories. Names are English fallbacks; the UI translates by `key`. */
export const DEFAULT_CATEGORIES: { key: string; name: string; kind: "expense" | "income" }[] = [
  { key: "groceries", name: "Groceries", kind: "expense" },
  { key: "dining", name: "Dining out", kind: "expense" },
  { key: "coffee", name: "Coffee", kind: "expense" },
  { key: "transport", name: "Transport", kind: "expense" },
  { key: "bills", name: "Bills & utilities", kind: "expense" },
  { key: "shopping", name: "Shopping", kind: "expense" },
  { key: "entertainment", name: "Entertainment", kind: "expense" },
  { key: "health", name: "Health", kind: "expense" },
  { key: "education", name: "Education", kind: "expense" },
  { key: "fees", name: "Fees & charges", kind: "expense" },
  { key: "other_expense", name: "Other", kind: "expense" },
  { key: "salary", name: "Salary", kind: "income" },
  { key: "freelance", name: "Freelance", kind: "income" },
  { key: "gifts", name: "Gifts", kind: "income" },
  { key: "interest", name: "Interest & returns", kind: "income" },
  { key: "other_income", name: "Other income", kind: "income" },
];

export function buildDefaultCategories(now = Date.now()): Category[] {
  return DEFAULT_CATEGORIES.map((c, i) => ({ id: uid(), key: c.key, name: c.name, kind: c.kind, icon: ICON_FOR_KEY[c.key] ?? "tag", slot: (i % 8) + 1, createdAt: now + i }));
}

/** Make sure every built-in category exists (also back-fills ones added after v1). */
export async function ensureCategories() {
  const existing = await db.categories.toArray();
  const keys = new Set(existing.map((c) => c.key));
  const missing = buildDefaultCategories().filter((c) => !keys.has(c.key));
  if (missing.length) await db.categories.bulkAdd(missing);
}
