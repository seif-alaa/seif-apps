# Architecture

## Overview

```
pulse-arena/
  packages/
    engine/      Pure, deterministic game rules (no I/O). Shared by server and client.
    protocol/    Wire types, event names, input sanitizers. Shared.
  apps/
    server/      Node + Socket.IO. Authoritative rooms, matches, matchmaking, persistence.
    client/      React + Vite web app, Canvas 2D renderer, Web Audio, Capacitor shells.
      android/   Capacitor Android project
      ios/       Capacitor iOS project
  e2e/           Playwright multi-browser end-to-end test (real server + real client)
  scripts/       dev runner, balance simulation, load test, icon generation, multi-window helper
  docs/
```

npm workspaces. TypeScript strict mode everywhere (`noUncheckedIndexedAccess` included). Workspace packages are consumed as TypeScript source: Vite bundles them for the client, and esbuild bundles them into `apps/server/dist/index.js`.

## Stack decisions and tradeoffs

| Decision | Choice | Why |
|---|---|---|
| Transport | Socket.IO 4 | WebSocket with automatic fallback, acks, rooms and reconnection built in. Proven on mobile networks. Raw `ws` is lighter, but we would rebuild acks and reconnect logic. |
| Board rendering | **Canvas 2D (custom), not Phaser** | Deviation from the suggested stack. A 9x9 board, one dragged piece and a few hundred particles do not need a game framework. Phaser adds about 1 MB minified and a second scene graph and input system to reconcile with React. The custom renderer (`game/boardRenderer.ts`, about 450 lines) keeps the whole client JS bundle at about 372 KB (118 KB gzipped). It starts instantly on mid-range phones and runs at display refresh rate. Revisit Phaser if we add scrolling scenes, physics or skeletal animation. |
| UI | React 19 + plain CSS design tokens | Menus, HUD and lobby are document-like UI where React shines. No CSS framework, to keep the visual system fully custom. |
| State | Tiny external stores + `useSyncExternalStore` | Two stores (app and match). Frequent match updates never re-render menus. No dependency needed. |
| Audio | Web Audio synthesis | Original sounds with no licensing risk, about 0 KB of assets, and sounds that scale with combo size. |
| Mobile | Capacitor 7 | One codebase. Native haptics, share sheet, deep links, status bar, splash. |
| Persistence | Optional PostgreSQL (`pg`) | Match history only. Gameplay never waits on the database. In-memory fallback for local development. |
| Server build | esbuild bundle | One file plus two runtime dependencies (socket.io, pg). Small Docker image. |

## Server-authoritative model

The client sends **intents only**:

```
game:place { seq, slot, col, row }
game:swap  { seq, slot }
```

The server owns the match seed, every board, tray, score, chain, Pulse value and timer, and all elimination and outcome logic. It validates, in order:

1. **Identity:** the socket handshake carries an HMAC-signed guest token (`identity.ts`). Forged tokens get a new identity; they cannot impersonate.
2. **Room membership:** the action is routed only to the player's current room.
3. **Phase:** actions are rejected before the countdown ends (`not-started`), after the match (`match-over`), and from non-participants.
4. **Replay protection:** `seq` must be a positive safe integer strictly greater than the last accepted one. Duplicates and replays are ignored.
5. **Payload shape:** non-numbers, fractions and out-of-range values are rejected.
6. **Rules:** the engine checks that the slot still holds a piece, the placement is in bounds and non-overlapping, and that a swap has enough Pulse and is within the per-cycle limit.

Any extra fields a modified client sends (score, board, etc.) are ignored; the integration tests send forged scores to prove it.

Rate limiting: token bucket per socket (40 burst, 20 per second refill). Sockets that keep flooding are disconnected. Connection cap per IP (`MAX_SOCKETS_PER_IP`). Payload cap of 16 KB per message.

## Match runtime

```
Room (lobby/countdown/playing/results)
  └─ MatchRuntime (server/matchRuntime.ts)
       └─ MatchState (engine/match.ts)  ← pure functions: matchPlace, matchSwap, matchTick, checkEnd
```

- A 100 ms server tick advances time-based rules (Static, Last Chance expiry), forfeits players whose reconnect window has expired, and checks the time limit.
- Elapsed match time is always `Date.now() - startAt` on the **server**. Clients never supply time.
- After each change, ranks are recomputed first, then the server sends:
  - `match:self` to the acting player: full private state, `ackSeq`, and event summaries for effects.
  - `match:player` to the room: the public board (81-character string), score, rank, danger level, last activity, connection state and a monotonic `version`.

### Network budget

A board update is about 300 bytes of JSON. At a human pace (around one placement per 1.5 s per player), a client in a 5-player room receives about 2 to 3 KiB/s. The load test measured 2.76 KiB/s. No batching or delta compression is needed at this scale.

## Client prediction and reconciliation

The online controller (`client/src/game/controller.ts`):

1. On drop, runs the same engine locally and shows the result immediately (placement, clears, score, sound).
2. Stores the move as pending and sends the intent with `seq`.
3. On every `match:self`, takes the server state as the new base, drops moves with `seq <= ackSeq`, and replays the remaining pending moves on top.
4. If the server rejects a move, the board snaps to the authoritative state with an "invalid" cue.

The client cannot predict a new deal (it has no seed). When a cycle completes, the tray shows a short "dealing" shimmer until the server's state arrives, roughly one round trip. Elimination is shown only when the server confirms it.

## Clock synchronization

The client pings `time:ping` 5 times, keeps the lowest-RTT sample and computes `offset = server - (t0 + rtt/2)`. It resyncs every 15 s. Countdown, timer and Surge windows are displayed from `serverNow - startAt`. The server decides the actual timing, so a mis-synced client can only display slightly wrong numbers; it cannot gain time.

## Connection handling

| Situation | Behaviour |
|---|---|
| Network drop mid-match | Player marked disconnected (visible to opponents as "Reconnecting"). Board keeps running on the server clock. Socket.IO reconnects automatically; the same token restores the session and `game:sync` restores board, tray and `ackSeq`. |
| No return within 30 s (`RECONNECT_WINDOW_SEC`) | Forfeit, reason `disconnected`. The match continues for everyone else. |
| Tab switch or app background | Audio suspended. On resume, the client calls `game:sync`. The server never pauses. |
| Duplicate connection (second tab or device) | The newest connection wins. The old one receives `session:replaced` and shows an explanatory screen with "Use This Device". |
| Host leaves lobby | Host passes to the earliest connected member. |
| Host leaves mid-match | Forfeit for the host. The match continues; the room gets a new host for the rematch. |
| Room full, invalid code, expired code, match in progress | Explicit error codes with human-readable messages. |
| Lobby or results member disconnected for 20 s | Removed from the room. |
| Room with nobody connected for 2 minutes, or empty | Deleted. |
| Unexpected exception in a handler or tick | Caught and logged per handler or room. Other rooms are unaffected. `uncaughtException` is logged rather than crashing the process. |
| Server restart | Rooms are in memory and are lost. Clients show "Reconnecting", then return home. Documented limitation (see scaling). |

## Scaling path

The current design is **single process, rooms in memory**. A single shared vCPU handled 200 concurrent players with p99 action latency under 2 ms in the load test (client and server in the same process). Expected comfortable capacity is about 1,500 to 2,000 concurrent players per vCPU at human pace.

Beyond one process:
1. Run N game server processes. Route by room code with a consistent hash at the load balancer, or redirect clients to the instance that owns the room via a small directory in **Redis**.
2. Move Quick Play queues to Redis (sorted sets per region) so any instance can form matches. The matchmaker interface is already isolated (`matchmaker.ts`).
3. Keep match state in process memory: it is latency-critical and short-lived. Snapshot to Redis every few seconds only if graceful failover is needed.
4. Socket.IO's Redis adapter is **not** required, because each room lives on exactly one instance.

Redis is intentionally not a dependency yet: it adds operational cost before there is traffic to justify it.

## Security notes

- `SESSION_SECRET` is required in production; the server refuses to start without it. Without it in development, a random ephemeral secret is used.
- CORS: explicit origin allow-list in production (including `capacitor://localhost` and `https://localhost` for the native apps).
- No secrets are shipped to clients. Clients never see the match seed.
- Static file serving normalizes paths and refuses traversal outside the build directory. Hashed assets are served as immutable.
- Nicknames are NFKC-normalized, restricted to letters, numbers, space and `_ . -`, and limited to 16 characters. React escapes all rendering.
