// Renders public/favicon.svg into the PNG icons iOS and the manifest need.
// Uses Playwright's Chromium so no native image deps are required.
import { chromium } from "playwright";
import { readFile } from "node:fs/promises";

const svg = await readFile(new URL("../public/favicon.svg", import.meta.url), "utf8");
const out = (f) => new URL(`../public/${f}`, import.meta.url).pathname;
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await browser.newPage();

async function render(file, size, { pad = 0, bg = "transparent", square = false } = {}) {
  await page.setViewportSize({ width: size, height: size });
  // iOS rounds the corners itself, so the touch icon is a full-bleed square.
  const art = square ? svg.replace(/rx="112"/g, 'rx="0"') : svg;
  await page.setContent(`<html><body style="margin:0;background:${bg};display:grid;place-items:center;width:${size}px;height:${size}px">
    <div style="width:${size - pad * 2}px;height:${size - pad * 2}px">${art.replace("<svg ", '<svg width="100%" height="100%" ')}</div></body></html>`);
  await page.screenshot({ path: out(file), omitBackground: bg === "transparent" });
}

await render("apple-touch-icon.png", 180, { square: true });
await render("pwa-192x192.png", 192);
await render("pwa-512x512.png", 512);
await render("maskable-512x512.png", 512, { square: true });
await browser.close();
console.log("icons written");
