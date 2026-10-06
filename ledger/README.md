# Ledger

A warm, private personal finance PWA. Everything lives in IndexedDB on your device. There's no backend, no account and no tracking.

**Stack:** Vite · React · TypeScript · Tailwind + shadcn/ui (Radix, vaul, sonner) · Framer Motion · Dexie · Recharts · Zustand · date-fns · Lucide · vite-plugin-pwa · React Router

## Features

- **Home:** total balance hero with count-up numbers, a friendly weekly "vibe" check against your budgets, account cards, a spending-pace chart and recent activity.
- **Activity:** day-grouped transactions with search and in/out filters. Swipe left to delete (with undo) and tap to edit.
- **Budgets:** monthly per-category budgets with a progress ring, pace ticks and gentle status copy.
- **Insights:** a month switcher, income vs spending for the last 6 months, cumulative spend vs budget pace, a category breakdown and auto-generated "little wins".
- **Add sheet:** a custom numeric keypad (no iOS keyboard pop-up), category, date and account chips, and an optional note.
- **Settings:** name, currency, dark/light/auto theme, hide-amounts privacy mode, categories, JSON backup export/import, sample data and erase-all.
- Pull-to-refresh with a rubber-band bounce and haptics (Android vibration; the iOS 18+ switch haptic trick), spring press states everywhere, illustrated empty states, and offline support.

## Develop

```bash
cd ledger
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build into dist/
npm run preview    # serve the production build
npm run icons      # re-render PNG icons from public/favicon.svg (uses Playwright Chromium)
```

## Install on iPhone

1. Deploy `dist/` to any static host over **HTTPS** (Netlify, Vercel, Cloudflare Pages or GitHub Pages all work). The build uses relative paths and hash routing, so sub-paths are fine.
2. Open the URL in **Safari**, tap **Share**, then **Add to Home Screen**.
3. Launch Ledger from the home screen. It runs full-screen and works offline.

> Data is stored only on that device. Use **Settings → Export backup** now and then, because deleting the home-screen app also deletes its data.
