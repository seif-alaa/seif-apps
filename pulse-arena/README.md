# Pulse Arena (working title)

A real-time multiplayer block puzzle survival game for 2 to 5 players, on the web, iOS and Android.

Every player works their own 9x9 board on a shared clock. Each round offers three pieces and you place two. Clear rows and columns to score, build chains, spend Pulse to swap a bad piece, and time your clears for Surge windows. When no piece fits, you are out. When time runs out, the best score among players still in wins. Opponents' boards update live beside your own.

> **The name "Pulse Arena" is provisional and conflicts with an existing registered trademark.** Do not publish under it. See [`docs/ip-risk-notes.md`](docs/ip-risk-notes.md).

## Quick start

Requirements: Node.js 20.11 or newer (22 recommended) and npm 10.

```bash
npm install
```

```bash
npm run dev
```

This starts the game server on `http://localhost:8787` and the web client on `http://localhost:5173`. Open the client in two browser windows, or on a phone on the same network at `http://<your-computer-IP>:5173`, create a private match in one and join it from the other with the code.

No accounts, paid services or credentials are needed for local development.

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Server and client with hot reload |
| `npm test` | Engine unit tests and real-socket multiplayer integration tests |
| `npm run test:e2e` | Real browsers play complete 2-player and 5-player matches through the UI |
| `npm run typecheck` | Strict TypeScript across every package |
| `npm run build` | Production web client (`apps/client/dist`) and bundled server (`apps/server/dist`) |
| `npm start` | Run the built server (set `STATIC_DIR=../client/dist` to also serve the web app) |
| `npm run multi -- 3` | Open 3 independent visible browser windows against the dev client |
| `npm run loadtest -- 40 25` | 40 rooms x 5 clients playing 25-second matches; reports latency |
| `npx tsx scripts/simulate.ts 200` | Balance simulation across skill levels |
| `npm run icons` | Regenerate web and native icons and splash screens from `assets/icon.svg` |
| `npm run cap:sync` | Build the web app and copy it into the iOS and Android projects |

Run the production build locally:

```bash
npm run build
```

```bash
cd apps/server && SESSION_SECRET=dev-only-secret STATIC_DIR=../client/dist node dist/index.js
```

Then open `http://localhost:8787`.

## Repository layout

```
packages/engine     Deterministic rules shared by server and client (pure TypeScript)
packages/protocol   Wire types and input sanitizers
apps/server         Node + Socket.IO authoritative game server
apps/client         React + Vite client, Canvas renderer, Web Audio, Capacitor iOS/Android
e2e                 Multi-browser end-to-end test
scripts             Dev runner, simulation, load test, icons, multi-window helper
docs                Design, architecture, IP, deployment, mobile, testing, checklists
```

## Documentation

- [Game design specification](docs/game-design.md): rules, scoring, Pulse, Surge, Static, win conditions, ties, fairness
- [Competitor analysis](docs/competitor-analysis.md)
- [IP risk notes](docs/ip-risk-notes.md) and [brand clearance checklist](docs/brand-clearance-checklist.md)
- [Visual and audio direction](docs/visual-and-audio-direction.md)
- [Architecture](docs/architecture.md): authority model, prediction, clock sync, connection handling, scaling
- [Deployment](docs/deployment.md): environment variables, Docker, Fly.io, cost estimates
- [iOS and Android](docs/mobile.md): build, signing, deep links, current blockers
- [Testing](docs/testing.md): coverage map and latest results
- [Implementation plan and status](docs/implementation-plan.md)
- [Launch checklists](docs/launch-checklists.md): production and store submission
- [Roadmap](docs/roadmap.md)

## Current status

Working and tested:
- Single-player engine, practice and tutorial.
- Private rooms and Quick Play.
- Live 2 to 5 player matches with server authority, reconnects and rematches.
- Every screen, animation and the synthesized audio.
- Production build and Postgres persistence.

Not yet done:
- Building and testing the native apps on real devices (no Android SDK or Xcode in the build environment).
- Human playtest tuning.
- Legal clearance of the name.
- Store submission.

See [`docs/implementation-plan.md`](docs/implementation-plan.md).
