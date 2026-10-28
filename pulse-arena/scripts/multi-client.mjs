// Opens several independent, visible browser windows against the local dev client so one
// person can play a real multiplayer match against themselves on one computer.
// Each window uses its own storage, so each is a separate guest identity on the server.
//
// Usage: npm run dev        (in one terminal)
//        npm run multi -- 3 (in another; default 2 windows, max 5)
import { chromium } from 'playwright';

const n = Math.min(5, Math.max(2, Number(process.argv[2] ?? 2)));
const url = process.env.PULSE_URL ?? 'http://localhost:5173/';
const names = ['Ana', 'Ben', 'Cleo', 'Dev', 'Eli'];
const browser = await chromium.launch({ headless: false });
for (let i = 0; i < n; i++) {
  const ctx = await browser.newContext({ viewport: { width: 640, height: 820 } });
  await ctx.addInitScript((name) => {
    if (!localStorage.getItem('pulse.settings.v1')) {
      localStorage.setItem('pulse.settings.v1', JSON.stringify({ tutorialDone: true, nickname: name }));
    }
  }, names[i]);
  const page = await ctx.newPage();
  await page.goto(url);
}
console.log(`Opened ${n} players at ${url}. Create a room in one window and join it from the others. Close this process to end.`);
await new Promise(() => undefined);
