import { chromium } from "playwright";
const base = process.argv[2] ?? "http://localhost:3100";
const out = process.argv[3];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(`${page.url()} :: ${String(e).slice(0, 300)}`));
page.on("console", (m) => m.type() === "error" && errors.push(`${page.url()} :: ${m.text().slice(0, 300)}`));
await page.goto(`${base}/admin`);
await page.fill('input[name="email"]', "atelier@nivore.local");
await page.fill('input[name="password"]', "atelier-dev");
await page.click('button:has-text("Sign in")');
await page.waitForURL(`${base}/admin`);
const paths = ["/admin", "/admin/orders", "/admin/customers", "/admin/inquiries", "/admin/auctions", "/admin/auctions/auc-01", "/admin/auctions/new", "/admin/analytics", "/admin/products", "/admin/products/p-alba-36-ivory", "/admin/products/new", "/admin/components", "/admin/components/dial-ivory-date", "/admin/components/new?type=case", "/admin/assets", "/admin/compatibility", "/admin/pricing", "/admin/storefront", "/admin/content", "/admin/settings", "/admin/audit"];
for (const p of paths) {
  const res = await page.goto(base + p, { waitUntil: "networkidle" });
  const status = res?.status();
  const h1 = await page.locator("h1").first().textContent().catch(() => "?");
  console.log(status, p, "→", h1?.trim());
  if (out && ["/admin", "/admin/components/dial-ivory-date", "/admin/storefront", "/admin/assets"].includes(p)) await page.screenshot({ path: `${out}/admin${p.replace(/[/?=]/g, "_")}.png`, fullPage: false });
}
console.log(errors.length ? "ERRORS:\n" + errors.join("\n") : "no console errors");
await browser.close();
