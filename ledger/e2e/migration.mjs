// Opens the new build on top of a database written by Ledger v1 and checks nothing is lost.
import { chromium, devices } from "playwright";

const BASE = process.argv[2] ?? "http://localhost:4173/";
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const ctx = await browser.newContext({ ...devices["iPhone 13"] });
const page = await ctx.newPage();
await page.goto(`${BASE}sw-actions.js`); // same origin, without booting the app

// Exactly what v1 wrote: Dexie version 1 = IndexedDB version 10, v1 record shapes, v1 prefs.
await page.evaluate(async () => {
  await new Promise((res) => {
    const del = indexedDB.deleteDatabase("ledger");
    del.onsuccess = del.onerror = () => res(null);
  });
  const db = await new Promise((res, rej) => {
    const r = indexedDB.open("ledger", 10);
    r.onupgradeneeded = () => {
      const d = r.result;
      const a = d.createObjectStore("accounts", { keyPath: "id" });
      a.createIndex("createdAt", "createdAt");
      const c = d.createObjectStore("categories", { keyPath: "id" });
      c.createIndex("kind", "kind");
      c.createIndex("createdAt", "createdAt");
      const t = d.createObjectStore("transactions", { keyPath: "id" });
      ["date", "type", "categoryId", "accountId"].forEach((i) => t.createIndex(i, i));
      t.createIndex("[type+date]", ["type", "date"]);
      d.createObjectStore("budgets", { keyPath: "categoryId" });
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  const tx = db.transaction(["accounts", "categories", "transactions", "budgets"], "readwrite");
  const now = Date.now();
  tx.objectStore("accounts").put({ id: "a1", name: "Everyday", type: "checking", emoji: "💳", startingBalance: 500000, createdAt: 1 });
  tx.objectStore("categories").put({ id: "c1", name: "Coffee", emoji: "☕", kind: "expense", slot: 4, createdAt: 1 });
  tx.objectStore("categories").put({ id: "c2", name: "Salary", emoji: "💼", kind: "income", slot: 3, createdAt: 2 });
  tx.objectStore("transactions").put({ id: "t1", type: "expense", amount: 4500, categoryId: "c1", accountId: "a1", note: "Flat white", date: now, createdAt: now });
  tx.objectStore("transactions").put({ id: "t2", type: "income", amount: 1000000, categoryId: "c2", accountId: "a1", note: "", date: now, createdAt: now });
  tx.objectStore("budgets").put({ categoryId: "c1", amount: 70000, updatedAt: 1 });
  await new Promise((res) => (tx.oncomplete = res));
  db.close();
  localStorage.setItem("ledger-prefs", JSON.stringify({ state: { name: "Seif", currency: "EGP", theme: "dark", hideAmounts: false, onboarded: true, installHintDismissed: true }, version: 0 }));
});

await page.goto(BASE);
await page.waitForTimeout(2000);
const body = await page.locator("body").innerText();
const rows = await page.evaluate(() => new Promise((res) => {
  const r = indexedDB.open("ledger");
  r.onsuccess = () => {
    const q = r.result.transaction("transactions").objectStore("transactions").getAll();
    q.onsuccess = () => res(q.result);
  };
}));
const ok = [
  ["still onboarded, name kept", body.includes("Seif")],
  ["balance = 5,000 − 45 + 10,000", /EGP\s*14,955/.test(body)],
  ["records upgraded in place", rows.length === 2 && rows.every((t) => t.direction && t.posting === "posted" && t.review === "confirmed" && !("type" in t))],
  ["note preserved", rows.some((t) => t.note === "Flat white")],
];
for (const [n, v] of ok) console.log(`${v ? "✓" : "✗"} ${n}`);
await browser.close();
process.exit(ok.every(([, v]) => v) ? 0 : 1);
