# NIVORÉ Timepieces

Storefront, **Build Your Watch** configurator, private auction room and atelier
admin for NIVORÉ, an independent watch-modification atelier in Egypt.

> Development preview. The catalogue, prices, suppliers and InstaPay details are
> **sample data**. Orders and bids are stored in a local development file and are
> not real. See [PROGRESS.md](PROGRESS.md) for exactly what is production-ready.

## Run it locally

Requirements: Node.js 20.9 or newer (developed on Node 22) and npm.

```bash
cd nivore
```

```bash
npm install
```

```bash
npm run dev
```

Open http://localhost:3000. The first request creates `.data/dev-db.json` from the sample seed.

- Builder: http://localhost:3000/build
- Admin: http://localhost:3000/admin. In development, sign in with `atelier@nivore.local` / `atelier-dev`. To choose your own, copy `.env.example` to `.env.local` and set `ADMIN_EMAIL` and `ADMIN_PASSWORD`.

Start again from the sample data:

```bash
npm run reset-dev-data
```

## Checks

```bash
npm run typecheck
```

```bash
npm test
```

End-to-end tests run against a production build on port 3200, using an isolated store in `.data-e2e`:

```bash
npm run build && npm run e2e
```

## Production server (local)

`next start` refuses the development admin password and session secret, so these must be set:

```bash
npm run build
```

```bash
SESSION_SECRET="$(node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))")" ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='a-long-password' npm start
```

Do not deploy publicly yet: real orders, payments and bidding need the durable backend in [docs/PRODUCTION.md](docs/PRODUCTION.md).

## Map

| Path | What |
| --- | --- |
| `src/domain/` | Pure business logic: catalogue schemas, **compatibility engine**, **pricing engine** (integer piastres), configuration encoding, auctions, storefront modes, Egypt validation |
| `src/data/` | Repository interfaces, the development JSON store, sample seed |
| `src/server/` | Auth, sessions, rate limiting, server pricing service, analytics |
| `src/proxy.ts` | Server-side enforcement of admin auth and storefront modes |
| `src/components/watch/` | To-scale layered watch renderer (SVG + photographic layers) |
| `src/components/configurator/` | Build Your Watch |
| `src/app/(store)` · `(studio)` · `admin` · `gate` · `api` | Routes |
| `docs/` | Architecture, database schema, production plan, asset workflow |
