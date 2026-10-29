// End-to-end checks against a running build (npm run build && npm run preview).
// Usage: node e2e/flows.mjs [baseUrl]
import { chromium, devices } from "playwright";

const BASE = process.argv[2] ?? "http://localhost:4173/";
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const ctx = await browser.newContext({ ...devices["iPhone 13"], colorScheme: "light" });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
};
const wait = (ms) => page.waitForTimeout(ms);
const go = async (hash) => {
  await page.goto(`${BASE}#${hash}`);
  await wait(900);
};
const dialog = () => page.locator("[data-vaul-drawer]").last();
const closeSheet = async () => {
  await page.keyboard.press("Escape");
  await wait(400);
};
const txnCount = () => page.evaluate(() => new Promise((res) => {
  const r = indexedDB.open("ledger");
  r.onsuccess = () => {
    const q = r.result.transaction("transactions").objectStore("transactions").getAll();
    q.onsuccess = () => res(q.result);
  };
}));

// 1. Onboarding: start fresh with CIB •1234 and Telda •5678
await page.goto(BASE);
await wait(800);
await page.getByRole("button", { name: "Continue" }).click();
await page.getByRole("button", { name: "CIB", exact: true }).click();
await page.getByRole("button", { name: "Telda", exact: true }).click();
const last4 = page.getByPlaceholder("Last 4");
await last4.nth(0).fill("1234");
await last4.nth(1).fill("5678");
await page.getByRole("button", { name: "Start using Ledger" }).click();
await wait(1000);
check("onboarding creates accounts", (await page.getByText("Telda").count()) > 0);

// Paste helper (the real "Paste bank alerts" source)
async function paste(text) {
  await go("/sources");
  await page.getByText("Paste bank alerts").click();
  await wait(500);
  await dialog().locator("textarea").fill(text);
  await dialog().getByRole("button", { name: "Add to Ledger" }).click();
  await wait(1200);
}

// 2. Detect an expense + classify it with one tap
await paste("CIB: Your card ****1234 was charged EGP 85.00 at BEANOS ZAMALEK. Ref BN100001");
check("expense detected and review opens", (await dialog().getByText("What was this for?").count()) === 1);
await page.getByRole("button", { name: /^Coffee/ }).click();
await wait(800);
let txns = await txnCount();
check("one tap files it as Coffee", txns.length === 1 && txns[0].review === "confirmed" && txns[0].kind === "expense");
await closeSheet();

// 3. Learning: two more confirmations, then the 4th is filed automatically
for (const ref of ["BN200002", "BN300003"]) {
  await paste(`CIB: Your card ****1234 was charged EGP 90.00 at BEANOS ZAMALEK. Ref ${ref}`);
  await page.getByRole("button", { name: /^Coffee/ }).click();
  await wait(700);
  await closeSheet();
}
await paste("CIB: Your card ****1234 was charged EGP 95.00 at BEANOS ZAMALEK. Ref BN400004");
txns = await txnCount();
const fourth = txns.find((t) => t.reference === "BN400004");
check("recognized merchant is auto-filed", fourth?.review === "auto_accepted", fourth?.review);
await closeSheet();

// 4. Duplicate alert
await paste("CIB: Your card ****1234 was charged EGP 95.00 at BEANOS ZAMALEK. Ref BN400004");
txns = await txnCount();
check("duplicate alert ignored", txns.filter((t) => t.reference === "BN400004").length === 1);
await closeSheet();

// 5. OTP never stored: it is flagged in the preview and can't be added
await go("/sources");
await page.getByText("Paste bank alerts").click();
await wait(500);
await dialog().locator("textarea").fill("Your OTP for EGP 99 at JUMIA is 551234. Do not share.");
await wait(300);
check("OTP flagged in preview", (await dialog().getByText(/looks like an OTP/).count()) === 1);
check("OTP can't be added", await dialog().getByRole("button", { name: "Add to Ledger" }).isDisabled());
txns = await txnCount();
check("OTP message produces nothing", !txns.some((t) => t.amount === 9900));
await closeSheet();

// 6. Own transfer CIB → Telda is not spending or income
await paste("CIB: EGP 1,000.00 transferred from your account ****1234 via InstaPay.\n\nTelda: EGP 1,000.00 was added to your Telda card ending 5678.");
txns = await txnCount();
const legs = txns.filter((t) => t.kind === "transfer");
check("transfer legs matched", legs.length === 2 && legs[0].transferGroupId === legs[1].transferGroupId);
await closeSheet();
await go("/insights");
const spentText = await page.locator(".eyebrow", { hasText: "Spent" }).first().locator("..").innerText();
check("insights spending excludes the transfer", /EGP\s*360\b/.test(spentText) && !spentText.includes("1,360"), spentText.replace(/\s+/g, " "));

// 7. Incoming money is not income until classified
await paste("InstaPay: You received EGP 4,000.00 from AHMED SAMIR to your account ****1234.");
check("incoming asks for source", (await dialog().getByText("Where did this come from?").count()) === 1);
await page.getByRole("button", { name: /^Freelance/ }).click();
await wait(700);
await closeSheet();
txns = await txnCount();
check("classified as income", txns.some((t) => t.kind === "income" && t.amount === 400000));

// 8. Activity shows one row for the transfer
await go("/activity");
check("activity collapses transfer legs", (await page.getByText("CIB → Telda").count()) === 1);

// 9. iOS Shortcut / Android share entry point: the URL carries the alert text
await page.goto(`${BASE}?via=shortcut&capture=${encodeURIComponent("Telda: You spent EGP 245.00 at CARREFOUR MAADI with card ending 5678.")}`);
await page.waitForTimeout(1500);
txns = await txnCount();
check("Shortcut URL captures the alert", txns.some((t) => t.amount === 24500 && t.source === "ios_shortcut"));
check("…and opens Quick Capture", (await dialog().getByText("What was this for?").count()) === 1);
check("…and cleans the URL", !page.url().includes("capture="));
await closeSheet();

// 10. Arabic + RTL
await go("/settings");
await page.getByRole("radio", { name: "العربية" }).click();
await wait(500);
check("Arabic switches direction", (await page.evaluate(() => document.documentElement.dir)) === "rtl");

console.log(`\n${results.filter((r) => r.ok).length}/${results.length} passed${errors.length ? `, page errors: ${errors.join(" | ")}` : ""}`);
await browser.close();
process.exit(results.every((r) => r.ok) && !errors.length ? 0 : 1);
