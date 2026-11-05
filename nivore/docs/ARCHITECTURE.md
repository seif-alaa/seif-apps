# Architecture

## Principles

- **Domain first.** Compatibility, pricing, configuration identity, auctions and storefront modes are pure TypeScript in `src/domain`, with unit tests. The UI, API routes and (later) database transactions call the same functions.
- **Server is the authority.** Prices, compatibility, stock, storefront locks and bids are re-checked on the server. Client values are hints only.
- **Repository boundary.** Everything persistent goes through `src/data/repositories/types.ts`. The development JSON store implements it today; a Postgres implementation replaces it without UI changes.
- **Honesty in data.** Missing measurements mean *unconfirmed*, never *compatible*. Policy pages stay empty until the business writes them. Placeholder imagery is labelled.

## Stack

Next.js 16 (App Router, Turbopack), React 19, TypeScript, Tailwind CSS 4, Zod 4, Zustand (bag and saved designs only), Vitest, Playwright. No animation library: transitions are CSS on the GPU-friendly `opacity`/`transform` properties, plus one small `requestAnimationFrame` tween for the price.

## Request flow

```
browser ──► proxy.ts ──► admin? verify signed cookie (HMAC, Web Crypto)
                    └──► storefront gate (mode, launch time, access pass) ──► rewrite to /gate/*  or 503 for APIs
         ──► page (RSC, cached ≤60 s, revalidated on every admin edit) ──► repositories
         ──► /api/quote, /api/orders ──► pricing-service (re-price + validate) ──► repositories
```

## Configurator

- **Configuration** = one component id per slot (`movement, dial, case, hands, bezel, insert, crystal, chapterRing, band, clasp, caseback`), plus engraving and options. Share links encode it as short component codes (`/build?b=M1.D01.C4…`). The build reference (`NV-XXXX-XXXX`) is a deterministic hash, so identical builds share a reference.
- **Compatibility engine** (`domain/compatibility.ts`):
  - Pairwise attribute rules run first. Examples: date window ↔ movement complications; crown position; dial diameter and feet; movement height ↔ case clearance; hand fit and GMT hand; bezel system; insert size; crystal size; chapter ring; lug width and fitted end links; clasp width; caseback thread.
  - An admin record for a pair overrides the attribute rules.
  - **Earlier steps constrain later ones.** Changing an earlier part runs `propose()`, a bounded depth-first repair that keeps or closely matches each later part. If anything the customer chose would change, the UI asks first.
  - **Lookahead:** an option is offered only if a complete, valid watch still exists with it.
  - An exhaustive test checks that every offered option leads to an orderable build.
- **Pricing** (`domain/pricing.ts`): component prices + adjustments, assembly, engraving, options, promo codes (percentage or fixed; scope; minimum spend; time window; usage limit), delivery by governorate, and tax (off by default). Everything is integer piastres.

## Renderer

`components/watch/` draws every part as SVG from its recorded millimetres at 10 units/mm on a 600×860 template. A 36 mm case is therefore genuinely smaller than a 40 mm one, and lug width, crown position, dial size and strap width follow the data.

- Each part is its own absolutely positioned layer. A change crossfades only the affected layer; layer trees are memoised by key.
- **Photographic layers** uploaded in the admin replace the drawing part by part. Each carries `pxPerMm` and an anchor point (case centre, hand pinion, spring-bar centre), so it aligns with any template. Hands are rotated by the renderer.
- When any layer is procedural, the stage is labelled "Illustrative rendering".
- `/api/render` serialises the same layers to a cacheable SVG for catalogue cards, the bag, saved designs and order sheets.

WebGL/3D was deliberately not used: there are no accurate 3D models, and a layered 2.5D stack is lighter on Egyptian mid-range phones. The asset model can grow to multiple angles later.

## Security

- Signed, `httpOnly`, `SameSite=Strict` admin session (12 h). Authorisation is checked in the proxy, in every admin page (`requireAdmin`) and in every server action.
- Same-origin checks on all mutations. Zod validation on every input. Honeypots on public forms.
- Rate limits on login (failed attempts only), checkout, quote, contact, waitlist, status lookup and bids. These are in-memory in development; production needs a shared store.
- Uploads are identified by magic bytes, size-limited and renamed. **Payment evidence is stored outside `public/`** and served only to admins.
- No card data is ever collected. Customer data is visible only in the admin. Order confirmation links carry a signed token. Status lookup needs the reference **and** the phone number, and reveals only a first name.
- CSV exports neutralise spreadsheet formula injection. Security headers are set in `next.config.ts`.
