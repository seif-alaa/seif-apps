// Usage: node e2e/shot.mjs <url> <out.png> [width] [height] [fullPage]
import { chromium } from "playwright";
const [url, out, w = "1440", h = "900", full = "0"] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await page.goto(url, { waitUntil: "networkidle" });
await page.waitForTimeout(600);
await page.screenshot({ path: out, fullPage: full === "1" });
if (errors.length) console.log("ERRORS:\n" + errors.map((e) => e.slice(0, 400)).join("\n---\n"));
await browser.close();
