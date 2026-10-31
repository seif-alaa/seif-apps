// Lab performance measurement: LCP, CLS, interaction latency (Event Timing), transfer sizes.
// Usage: node e2e/perf.mjs <baseUrl> [cpuThrottle]
import { chromium } from "playwright";
const base = process.argv[2] ?? "http://localhost:3300";
const throttle = Number(process.argv[3] ?? 1);
const browser = await chromium.launch();

async function newPage(mobile) {
  const ctx = await browser.newContext(mobile ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true } : { viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  if (throttle > 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate: throttle });
  await page.addInitScript(() => {
    window.__perf = { lcp: 0, cls: 0, events: [] };
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__perf.lcp = e.startTime; }).observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__perf.cls += e.value; }).observe({ type: "layout-shift", buffered: true });
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (e.interactionId) window.__perf.events.push({ name: e.name, d: e.duration }); }).observe({ type: "event", buffered: true, durationThreshold: 16 });
  });
  let bytes = 0, js = 0;
  page.on("response", async (r) => {
    const len = Number((await r.allHeaders())["content-length"] ?? 0) || (await r.body().catch(() => Buffer.alloc(0))).length;
    bytes += len;
    if (r.url().endsWith(".js")) js += len;
  });
  return { page, ctx, sizes: () => ({ kb: Math.round(bytes / 1024), jsKb: Math.round(js / 1024) }) };
}

for (const mobile of [false, true]) {
  for (const path of ["/", "/timepieces", "/timepieces/alba-36-ivory", "/build"]) {
    const { page, ctx, sizes } = await newPage(mobile);
    await page.goto(base + path, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    const p = await page.evaluate(() => window.__perf);
    console.log(`${mobile ? "mobile " : "desktop"} ${path.padEnd(28)} LCP ${Math.round(p.lcp)}ms  CLS ${p.cls.toFixed(3)}  transfer ${sizes().kb}KB (JS ${sizes().jsKb}KB uncompressed-or-wire)`);
    await ctx.close();
  }
}

// Interaction latency in the configurator.
for (const mobile of [false, true]) {
  const { page, ctx } = await newPage(mobile);
  await page.goto(base + "/build", { waitUntil: "networkidle" });
  if (mobile) await page.getByRole("button", { name: "Expand options" }).click();
  await page.getByTestId("continue").click();
  await page.waitForTimeout(400);
  for (const id of ["dial-rose-linen", "dial-teal-explorer", "dial-cognac-roman", "dial-ivory-date", "dial-champagne-30"]) {
    await page.getByTestId(`opt-${id}`).click();
    if (id === "dial-champagne-30") await page.getByTestId("confirm-changes").click().catch(() => {});
    await page.waitForTimeout(700);
  }
  await page.getByTestId("continue").click();
  await page.waitForTimeout(400);
  const ev = await page.evaluate(() => window.__perf.events);
  const byInteraction = ev.map((e) => Math.round(e.d)).sort((a, b) => b - a);
  console.log(`${mobile ? "mobile " : "desktop"} configurator interactions (ms, worst first): ${byInteraction.slice(0, 12).join(", ")}`);
  await ctx.close();
}
await browser.close();
