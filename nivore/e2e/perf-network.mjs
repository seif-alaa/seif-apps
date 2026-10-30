// LCP/CLS under simulated slow 4G (150 ms RTT, 1.6 Mbps down) and 4x CPU on a phone viewport.
import { chromium } from "playwright";
const base = process.argv[2] ?? "http://localhost:3300";
const browser = await chromium.launch();
for (const path of ["/", "/timepieces", "/timepieces/alba-36-ivory", "/build", "/rare-pieces"]) {
  const runs = [];
  for (let r = 0; r < 3; r++) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await page.addInitScript(() => {
      window.__p = { lcp: 0, cls: 0 };
      new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__p.lcp = e.startTime; }).observe({ type: "largest-contentful-paint", buffered: true });
      new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__p.cls += e.value; }).observe({ type: "layout-shift", buffered: true });
    });
    await page.goto(base + path, { waitUntil: "load", timeout: 90_000 });
    await page.waitForTimeout(1500);
    runs.push(await page.evaluate(() => window.__p));
    await ctx.close();
  }
  const lcps = runs.map((r) => Math.round(r.lcp)).sort((a, b) => a - b);
  console.log(`${path.padEnd(28)} LCP median ${lcps[1]} ms (runs ${lcps.join(", ")})  CLS max ${Math.max(...runs.map((r) => r.cls)).toFixed(3)}`);
}
await browser.close();
