// Long tasks (>50 ms) after opening each configurator step. Usage: node e2e/perf-longtasks.mjs <base>
import { chromium } from "playwright";
const base = process.argv[2] ?? "http://localhost:3300";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.addInitScript(() => {
  window.__lt = [];
  new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt.push(Math.round(e.duration)); }).observe({ type: "longtask", buffered: true });
});
await page.goto(base + "/build", { waitUntil: "networkidle" });
await page.waitForTimeout(800);
console.log("after load:", await page.evaluate(() => window.__lt.splice(0)));
for (const step of ["Dial", "Case", "Hands", "Bezel & crystal", "Bracelet or strap", "Personalisation", "Review"]) {
  await page.getByTestId("continue").click();
  await page.waitForTimeout(1500);
  console.log(step.padEnd(18), await page.evaluate(() => window.__lt.splice(0)));
}
await browser.close();
