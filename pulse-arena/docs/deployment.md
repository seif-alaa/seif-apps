# Deployment

One Node process serves the WebSocket game server **and** the built web client. Native apps connect to the same server.

## Environment variables

Server (`apps/server/.env.example`):

| Variable | Required | Default | Notes |
|---|---|---|---|
| `NODE_ENV` | yes in prod | | `production` enables strict checks |
| `PORT` | no | 8787 | |
| `SESSION_SECRET` | **yes in prod** | random per boot in dev | 32+ random characters. Rotating it resets all guest identities. |
| `CORS_ORIGINS` | yes in prod | `*` in dev | Comma separated. Include your web origin plus `capacitor://localhost,https://localhost` for the native apps. |
| `STATIC_DIR` | no | | Path to `apps/client/dist`. The Docker image sets it. |
| `DATABASE_URL` | no | | PostgreSQL for match history. The table is created automatically. |
| `MATCH_DURATION_SEC` | no | 180 | 60 to 600 in production |
| `RECONNECT_WINDOW_SEC` | no | 30 | |
| `QUICKPLAY_FILL_SEC` | no | 8 | Fill window after two players are waiting |
| `QUICKPLAY_TIMEOUT_SEC` | no | 45 | Lone searcher timeout |
| `TRUST_PROXY` | no | false | `true` behind Fly, Render or NGINX so per-IP limits use `X-Forwarded-For` |
| `MAX_SOCKETS_PER_IP` | no | 24 | Raise this for event venues behind a single NAT |

Client build-time (`apps/client/.env.example`):

| Variable | Notes |
|---|---|
| `VITE_SERVER_URL` | Empty on the web (same origin). **Required for native builds**, e.g. `https://play.example.com`. |
| `VITE_PUBLIC_URL` | Web origin used in invite links shared from the native apps. |

## Option A: Docker (any host)

```bash
docker build -t pulse-arena .
```

```bash
docker run -d -p 8787:8787 \
  -e SESSION_SECRET="$(openssl rand -hex 32)" \
  -e CORS_ORIGINS="https://play.example.com,capacitor://localhost,https://localhost" \
  -e TRUST_PROXY=true \
  pulse-arena
```

Put TLS in front of it (Caddy, NGINX, or the platform's edge) and make sure WebSocket upgrades are allowed. The image health check calls `/healthz`.

> Verification status: the Docker daemon was not available in the build environment, so the image itself has not been built yet. Each stage was verified separately: `npm run build` produces both bundles, and the runtime stage's install and start commands were run by hand and served `/healthz` and the client. Run `docker build` once in CI before the first deploy.

## Option B: Fly.io

```bash
cp fly.toml.example fly.toml
```

```bash
fly launch --no-deploy
```

```bash
fly secrets set SESSION_SECRET="$(openssl rand -hex 32)" CORS_ORIGINS="https://your-app.fly.dev,capacitor://localhost,https://localhost"
```

```bash
fly deploy
```

Keep `min_machines_running = 1` and `auto_stop_machines = "off"`. Rooms live in memory, so a machine that sleeps ends every match on it.

## Option C: plain Node (VPS)

```bash
npm ci
```

```bash
npm run build
```

```bash
cd apps/server && NODE_ENV=production SESSION_SECRET=... STATIC_DIR=../client/dist node dist/index.js
```

Run under systemd or pm2 with restart on failure.

## Deploys and restarts

Matches are in memory. A restart ends in-progress matches; clients reconnect and return home. To deploy without dropping matches:
1. Stop routing new rooms to the old instance (or deploy at low traffic).
2. Wait for in-progress matches to finish (at most 10 minutes).
3. Shut down with SIGTERM. The server closes cleanly.

Blue/green with room draining is on the roadmap.

## Cost estimates

Prices are typical public list prices at the time of writing and **must be re-checked** before budgeting. Traffic assumptions come from the load test: about 2.8 KiB/s per active player, so about 0.5 MB per player per 3-minute match.

| Stage | Setup | Approx. monthly cost |
|---|---|---|
| Prototype and friends testing | 1 small VM (Fly shared-cpu-1x 512 MB, Hetzner CX22, or similar). No database. | **$4 to $8** |
| Soft launch (up to ~1,000 concurrent) | 1 VM with 1 to 2 vCPU and 1 GB, managed Postgres starter tier, uptime monitoring | **$15 to $40** |
| Growth (~5,000 concurrent) | 3 to 4 game VMs, Redis for routing and matchmaking, Postgres with backups, log shipping | **$120 to $300** plus bandwidth |
| Bandwidth | 10,000 matches/day x 4 players x 0.5 MB, about 600 GB/month | about $0 to $12 (many hosts include 1 to 20 TB; Fly charges about $0.02/GB) |

Where free tiers stop being enough:
- **Free web hosts that sleep** (Render free, Railway trial, and others) end matches when they sleep and add cold-start delay. They are not suitable for live play.
- **Free Postgres** (Neon, Supabase) is fine for match history at small scale. Supabase pauses inactive free projects, and storage caps (about 0.5 GB) hold roughly 1 to 2 million match rows.
- **Free Redis** (Upstash free) has daily command limits that a busy matchmaker exceeds quickly. Budget about $10/month once Redis is introduced.

One-time and annual platform costs: Apple Developer Program $99/year, Google Play developer registration $25 once. Optional: domain (about $12/year) and a trademark filing (government fees from about $250 to $350 per class in the US, plus counsel).

## Monitoring

- `/healthz` for liveness. `/api/stats` for real online counts (also shown in the home screen).
- Logs are JSON lines (`server.listening`, `room.created`, `match.start`, `match.end`, `member.removed`, `handler.failed`, ...). Ship them to any log service.
- Alert on: process restarts, `handler.failed` or `room.tick_failed`, event loop delay, and `/healthz` failures.
