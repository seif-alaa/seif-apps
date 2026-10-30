# NIVORÉ: progress

_Last updated: 30 October 2026._ Status key: ✅ built and tested · 🟡 built, works in development only (simulated or needs a production integration) · ⬜ not started.

## Inputs reviewed
- **Brand Book, Edition 01 (all 23 pages).** Applied palette, Inter/Newsreader type system, wordmark proportions, N1 hallmark, minute-track and hairline motifs, "N° 01" index numerals, photography placeholders, naming formula (ALBA · MERIDIANA · SERA · NOTTE + size + dial), voice rules, the disclosure line, and website direction (one hero, no carousels or pop-ups). Future collections and accessories in the book were ignored, as instructed.
- **Competitor configurator (Circa Watch Labs):** could not be reached from this environment (the network policy blocks the domain), so no research or copying took place. The flow was designed from the brief.

## Status

| Area | Status | Notes |
| --- | --- | --- |
| Design system (tokens, type, brand components) | ✅ | `globals.css`, `components/brand`. Taupe text darkened to `#5f5549` for small text on cream (WCAG AA) |
| Homepage, timepieces (filter, sort, search), product pages, atelier, contact & bespoke, FAQ, policies, saved designs | ✅ | Policies show "being finalised" until the business provides text |
| **Build Your Watch** | ✅ | 8 steps; to-scale renderer; live price; compatibility with lookahead; confirm-before-replace; save (device), share URL, refresh restore, PNG download, edit-from-bag, presets, mobile sheet |
| Compatibility engine | ✅ | 14 attribute rules + admin records; three-state outcome; exhaustive test over every offered option |
| Pricing engine | ✅ | Integer piastres; assembly, engraving, options, promos, delivery by governorate, tax (off) |
| Bag & checkout (guest) | 🟡 | Fully working, with server re-pricing and validation, but orders go to the **development store** and are labelled as development orders |
| Cash on delivery / cash on pickup / InstaPay (manual) | 🟡 | Configurable per method; InstaPay reference + evidence upload; admin confirms by hand. No gateway, and none is claimed |
| Order confirmation (signed link) & status lookup | ✅ | |
| Notifications (email/WhatsApp) | ⬜ | No provider connected; the UI says so explicitly |
| Admin: overview, orders (status, payment confirmation, notes, delivery, print sheet, CSV), customers, inquiries, audit log | 🟡 | Complete UI on the development store; needs the production database and real authentication |
| Admin: products, components (schema-driven forms), preview assets (upload, anchor, scale, validate, publish), compatibility, movement families, pricing, content, settings | 🟡 | As above |
| Storefront modes: live, coming soon + countdown, password, maintenance, browse only, scheduled launch, checkout-only lock, bidding pause, waitlist, access codes | ✅ (dev store) | Enforced in `proxy.ts` and the APIs; Cairo-time scheduling |
| Rare pieces / private auction | 🟡 | Real validation (increments, server time, owner block, rate limit, idempotency, optimistic version, anti-snipe, settlement) on a **demonstration** room; live mode refused until §6 of PRODUCTION.md |
| Analytics | 🟡 | Placed vs confirmed revenue vs margin, by day, top parts, CSV. Conversion funnel needs an analytics tool |
| Admin authentication | 🟡 | Signed-cookie single admin from env vars; production plan uses Supabase Auth + 2FA |
| Database | 🟡 | Development JSON store behind interfaces; full Postgres schema and migration plan in `docs/DATABASE.md` |
| Photography and real configurator layers | ⬜ | Asset pipeline ready (`docs/ASSETS.md`); the site uses labelled illustrations meanwhile |
| Arabic / RTL | ⬜ | `dir`/`lang` set at the root; layouts use logical, flex and grid patterns; no translation yet |

## Tests (all passing at last run)
- **Unit, Vitest (55):** `npm test`. Covers:
  - compatibility rules, override records, propose/repair, lookahead, and the exhaustive "every offered option is orderable" check (>200 combinations);
  - pricing and money (rounding, promos, delivery, tax, adjustments);
  - auctions (status, increments, owner/duplicate/stale/flood refusal, anti-snipe, reserve, settlement);
  - storefront modes and Cairo DST conversion; Egyptian phone numbers;
  - seed integrity; engine speed budget.
- **End-to-end, Playwright (19), against a production build:** `npm run build && npm run e2e`. Covers:
  - dial / movement / case / GMT changes; incompatible options explained; confirm-before-replace; rapid repeated selections; back navigation; refresh restore; share link in a fresh browser; engraving price and limit; save design; add to bag with server price; reduced motion;
  - checkout validation, cash on delivery end-to-end, confirmation, bag cleared, status lookup (right and wrong phone);
  - tampered price ignored; cross-origin refused; InstaPay pending → admin confirmation;
  - admin protection; new component created in the admin appears in the builder; out-of-stock propagates;
  - coming soon + countdown + API 503 while the admin still sees the site; checkout-only lock (page and API);
  - auction bid validation, acceptance, self-outbid / duplicate / not-open refusals;
  - mobile configurator (one-handed, 44 px targets) and no horizontal overflow on 8 pages.
- Typecheck clean (`npm run typecheck`). Production build clean.

## Performance (lab measurements, headless Chromium)
| Measure | Result | Target |
| --- | --- | --- |
| LCP, phone, simulated slow 4G (150 ms RTT, 1.6 Mbps) + 4× CPU, median of 3 | Home 1.02 s · Timepieces 1.00 s · Product 0.93 s · Rare pieces 0.93 s · Builder 1.55 s | < 2.5 s |
| CLS, every page above | 0.000 | < 0.1 |
| Configurator interaction latency (Event Timing, click → next paint), 4× CPU | Phone ≤ 112 ms; desktop ≤ 192 ms; most selections 24–150 ms | < 200 ms |
| JS (gzip) | Store pages ≈ 183 KB; builder ≈ 241 KB | Kept minimal; no animation or 3D library |
| HTML (gzip) | Home 28 KB · Timepieces 10 KB | |

Work done to get there:
- Memoised layer trees, deferred step panels and idle-time thumbnail mounting. Step changes were 256–448 ms before, now ≤ 176 ms at 4× CPU.
- Catalogue renders served as cached SVG images. Home HTML went from 89 KB to 28 KB gzipped.

Known limit: a click made *during* the 0.76 s camera zoom between steps measured up to about 250 ms in headless Chromium, which rasterises SVG in software. Real devices rasterise on the GPU, but this should be confirmed with field data (Speed Insights) after deployment. These are lab numbers, not field guarantees.

## Simulated or sample (must change before launch)
- Catalogue, prices, costs, suppliers and stock are **samples**. Movement figures are commonly published values, flagged "pending verification". The NH34 height is deliberately unknown to demonstrate the unconfirmed state.
- InstaPay address `sample-handle@instapay` and the delivery rates are placeholders.
- Auctions are in demonstration mode. Bids there are not binding and are marked as demonstrations everywhere.
- The development admin password applies only outside production. Production refuses to start sessions without env secrets.

## Next steps (in order)
1. Business inputs from the launch checklist in `docs/PRODUCTION.md` (real catalogue, policies, InstaPay details, rates, contact details).
2. Supabase driver + admin auth (PRODUCTION.md §1–2), then storage (§3) and transactional orders (§4).
3. Photography and first published configurator layers.
4. Email notifications (§5), then live auctions (§6).
5. Arabic translation and RTL pass.
