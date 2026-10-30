// Per-interaction latency in the configurator, labelled. Usage: node e2e/perf-interactions.mjs <base> <cpu>
import { chromium } from "playwright";
const [base = "http://localhost:3300", cpu = "4"] = process.argv.slice(2);
const browser = await chromium.launch();
for (const mobile of [false, true]) {
  const ctx = await browser.newContext(mobile ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true } : { viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: Number(cpu) });
  await page.addInitScript(() => {
    window.__ev = [];
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (e.interactionId && e.name === "click") window.__ev.push(Math.round(e.duration)); }).observe({ type: "event", buffered: true, durationThreshold: 16 });
  });
  await page.goto(base + "/build", { waitUntil: "networkidle" });
  const steps = [];
  const act = async (label, fn) => {
    const before = await page.evaluate(() => window.__ev.length);
    await fn();
    await page.waitForTimeout(900);
    const after = await page.evaluate((n) => window.__ev.slice(n), before);
    steps.push(`${label}=${after.length ? Math.max(...after) : "<16"}`);
  };
  if (mobile) await page.getByRole("button", { name: "Expand options" }).click();
  await act("continue→dial", () => page.getByTestId("continue").click());
  await act("dial rose", () => page.getByTestId("opt-dial-rose-linen").click());
  await act("dial teal", () => page.getByTestId("opt-dial-teal-explorer").click());
  await act("continue→case", () => page.getByTestId("continue").click());
  await act("case field→dress? (petite)", () => page.getByTestId("opt-case-diver-40-3").click());
  await act("confirm", () => page.getByTestId("confirm-changes").click().catch(() => {}));
  await act("continue→hands", () => page.getByTestId("continue").click());
  await act("hands sword", () => page.getByTestId("opt-hands-sword-lume").click());
  await act("continue→bezel", () => page.getByTestId("continue").click());
  await act("continue→band", () => page.getByTestId("continue").click());
  await act("band beads", () => page.getByTestId("opt-br-beads-20").click());
  console.log(`${mobile ? "mobile" : "desktop"} @${cpu}x: ${steps.join("  ")}`);
  await ctx.close();
}
await browser.close();
