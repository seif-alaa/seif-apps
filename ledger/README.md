# Ledger

Private, offline-first personal finance for Egypt and beyond. Ledger reads the
transaction alerts your bank already sends, files what it recognizes, and asks
you only about the rest. Everything stays on the device.

**Stack:** Vite · React · TypeScript · Tailwind + shadcn-style components (Radix, vaul, sonner) · Framer Motion · Dexie (IndexedDB) · Recharts · Zustand · date-fns · Lucide · vite-plugin-pwa · Vitest · Playwright

## What's inside

- **Transaction engine** (`src/engine`): EN/AR alert parsing with OTP rejection,
  idempotent ingestion, cross-source dedupe, pending/posted/reversed/failed
  handling, own-transfer matching (either arrival order, fee-aware), refunds,
  ATM → cash, merchant learning, reconciliation. See `docs/ARCHITECTURE.md`.
- **Quick Capture**: a review sheet over any screen. One tap on a category
  files the transaction and moves to the next.
- **Sources** (honest status): paste alerts, Android share sheet, iOS Shortcut
  automation, CSV statements, manual/cash, dev simulator, and a native-bridge
  contract for a future Android app. See `docs/INTEGRATIONS.md`.
- **Screens**: Home, Activity (search + filters), Budgets, Insights (charts,
  recurring, comparisons, Ask Ledger, monthly report), Accounts (+ reconcile),
  Sources, Settings. English and Arabic (RTL), light and dark.
- **AI-ready, AI-optional**: deterministic reports and answers; a provider
  boundary for explanations via your own server. See `docs/AI.md`.
- **Design system**: “ink on paper”. See `docs/DESIGN.md`.

## Develop

```bash
cd ledger
npm install
npm run dev          # http://localhost:5173
npm test             # unit + engine scenario tests (Vitest, fake IndexedDB)
npm run typecheck
npm run build        # type-check + production build into dist/
npm run preview      # serve the build on :4173
npm run e2e          # browser flows against the preview server (Playwright)
node e2e/migration.mjs   # opens the new build on a v1 database
```

Optional: `VITE_LEDGER_AI_ENDPOINT=https://…` enables AI explanations (server-side key only).

## Install on a phone

Deploy `dist/` to any static HTTPS host (relative paths + hash routing, so a sub-path is fine).
- **iPhone:** Safari → Share → Add to Home Screen.
- **Android:** Chrome → menu → Install app. Ledger then appears in the share sheet for SMS alerts.

Data lives only on the device — use Settings → Export backup regularly.
