# Phase 6: production integrations

Nothing here is enabled. Each item lists what it depends on and the exact steps to activate it. Recommended low-cost stack: **Supabase** (Postgres, Auth, Storage, cron) + **Vercel** (hosting, image optimisation) + **Resend** (email). All three have free tiers suitable for launch volume; paid tiers start at roughly USD 20–25/month each. Confirm current pricing before committing.

## 1. Durable database (blocks everything below)
1. Create a Supabase project (region closest to Egypt, e.g. eu-central).
2. Run the migration in `docs/DATABASE.md`.
3. Implement `src/data/repositories/supabase.ts` against `types.ts` (server-only; use the service-role key from `SUPABASE_SERVICE_ROLE_KEY`, never `NEXT_PUBLIC_`).
4. Register it in `src/data/repositories/index.ts` for `DATA_DRIVER=supabase`.
5. Seed the real catalogue, or migrate approved records from the development store.
6. Run `npm test` and the e2e suite against a staging database.

## 2. Admin authentication
1. Use Supabase Auth with email + password and **TOTP two-factor** for admins.
2. Create `admin_users` rows (owner / staff roles).
3. Replace `checkCredentials` / `startAdminSession` in `src/server/auth.ts` with Supabase sessions; keep `requireAdmin()` as the single check used by pages and actions.
4. Keep the proxy check; have it verify the Supabase session cookie.

## 3. Image and asset storage
1. Create buckets: `catalogue` (public read), `preview-layers` (public read), `payment-evidence` (**private**).
2. Point `/api/admin/upload` at Storage, and order evidence uploads at the private bucket.
3. Serve evidence to admins through short-lived signed URLs.
4. Add the Supabase hostname to `images.remotePatterns` in `next.config.ts`.

## 4. Orders, inventory and manual payments
1. Make order creation transactional (see DATABASE.md), with stock checks and discount usage limits.
2. Rate limits move from memory to Postgres (or Upstash Redis) so they hold across instances.
3. InstaPay stays **manual**: the admin confirms on the order page after checking the bank app. Do not describe it as an integration.
4. Before launch, set real values in Admin → Settings: InstaPay address and account name, delivery rates, which cash options are offered, contact details.

## 5. Notifications
1. Create a Resend account, verify the sending domain (SPF/DKIM), and set `RESEND_API_KEY`.
2. Send messages from the order and payment server actions *after* the database commit. Record the delivery status.
3. Switch Admin → Settings → Notifications → provider to `resend` only once sending is verified. Until then the site states that no message was sent.
4. Optional: WhatsApp Business API, which requires Meta business verification.

## 6. Live auctions
Requires 1, 2 and 5, plus:
1. Bidder verification by email or SMS one-time code before a bidder's first bid (`bidders.verified_at`).
2. Transactional `placeBid` with a row lock (DATABASE.md).
3. A closing job every minute.
4. Published, lawyer-reviewed auction terms in Admin → Settings → Policies → auction terms.
5. Set `AUCTIONS_LIVE=1`. Only then can an auction's mode be switched to `live`; the API refuses live bids otherwise.

## 7. Analytics and performance monitoring
- Vercel Speed Insights for field Core Web Vitals (LCP, INP, CLS at the 75th percentile).
- A privacy-respecting analytics tool for the conversion funnel (e.g. Plausible or Vercel Analytics). Update the privacy policy first.

## 8. Deployment
1. Create a Vercel project with root directory `nivore`.
2. Set env vars: `SESSION_SECRET`, `NEXT_PUBLIC_SITE_URL`, `DATA_DRIVER=supabase`, the Supabase keys, `RESEND_API_KEY`.
3. Connect the domain and enable HTTPS (automatic).
4. Set the storefront to **Coming soon** or **Password** before the first public deployment. Launch by switching to **Live** or **Scheduled**.

**Do not deploy publicly, take real payments or open bidding without the owner's explicit approval.**

## Launch checklist (business inputs still needed)
- [ ] Vector wordmark redrawn from the master artwork (Brand Book p.5 and p.23)
- [ ] Trademark search for NIVORÉ and the collection names; confirm @nivore.atelier and the domain
- [ ] Real component catalogue: suppliers, costs, prices, stock, measured dimensions; verify movement figures against datasheets
- [ ] Photography (Brand Book p.13) and transparent preview layers (docs/ASSETS.md)
- [ ] Policies written or approved by the business: shipping, returns and cancellation, privacy, terms, auction terms, warranty
- [ ] InstaPay address, account name and instructions; cash options offered; delivery rates by governorate
- [ ] Confirm engraving can be provided (Admin → Pricing → engraving); otherwise disable it
- [ ] Contact email, phone, WhatsApp, reply time and assembly lead time
- [ ] Turn off the preview ribbon (Admin → Settings)
