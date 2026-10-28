// Renders assets/icon.svg into every icon size the web app and native projects need.
// Uses the locally installed Playwright Chromium; no external services.
import { chromium } from 'playwright';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const svg = readFileSync(join(root, 'assets/icon.svg'), 'utf8');
const client = join(root, 'apps/client');

const targets = [
  ['public/icons/icon-180.png', 180],
  ['public/icons/icon-192.png', 192],
  ['public/icons/icon-512.png', 512],
  ['public/icons/icon-maskable-512.png', 512, 0.8],
  ['../../assets/icon-1024.png', 1024],
];

// Native targets are written only when the Capacitor platforms exist.
const android = join(client, 'android/app/src/main/res');
if (existsSync(android)) {
  const densities = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
  for (const [d, size] of Object.entries(densities)) {
    targets.push([`android/app/src/main/res/mipmap-${d}/ic_launcher.png`, size]);
    targets.push([`android/app/src/main/res/mipmap-${d}/ic_launcher_round.png`, size, 1, true]);
    targets.push([`android/app/src/main/res/mipmap-${d}/ic_launcher_foreground.png`, Math.round(size * 2.25), 0.62]);
  }
}
const ios = join(client, 'ios/App/App/Assets.xcassets/AppIcon.appiconset');
if (existsSync(ios)) targets.push(['ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png', 1024]);

const browser = await chromium.launch();
const page = await browser.newPage();
for (const [rel, size, scale = 1, round = false] of targets) {
  const inner = Math.round(size * scale);
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:${scale < 1 ? '#07090d' : 'transparent'};display:grid;place-items:center;width:${size}px;height:${size}px;overflow:hidden">
    <div style="width:${inner}px;height:${inner}px;${round ? 'border-radius:50%;overflow:hidden;' : ''}">${svg.replace('<svg ', `<svg width="${inner}" height="${inner}" `)}</div></body></html>`);
  const out = join(client, rel);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, await page.screenshot({ omitBackground: scale >= 1 && !round, type: 'png' }));
  console.log(`icon ${rel} ${size}px`);
}
await browser.close();
