# Testing

| Layer | Command | What it proves |
|---|---|---|
| Engine unit tests | `npm test` | Rules are correct and deterministic |
| Multiplayer integration | `npm test` | A real server with real Socket.IO clients over WebSocket |
| Postgres persistence | `PULSE_TEST_DATABASE_URL=postgres://... npm test` | Match history round-trips through PostgreSQL |
| Multi-browser end-to-end | `npm run test:e2e` | Real browsers play complete 2- and 5-player matches through the UI |
| Load | `npm run loadtest -- 40 25` | 200 concurrent clients play full matches; latency and memory |
| Balance | `npx tsx scripts/simulate.ts 200` | Match length, survival and Pulse use across skill levels |
| Types | `npm run typecheck` | Strict TypeScript across all packages |

## Requirement coverage

| Requirement | Test |
|---|---|
| Valid placement | engine: `accepts a valid placement...` |
| Invalid placement (bounds, overlap, fractions, bad slot) | engine: `rejects out-of-bounds...`; server: `rejects impossible and duplicate placements` |
| Line clearing | engine: `clears a completed row` |
| Simultaneous row + column | engine: `clears a row and column simultaneously with a cross bonus` |
| Combo (chain) scoring | engine: `builds chain multipliers and breaks after two misses` |
| Pulse accumulation and spending | engine: `accumulates from clears and caps`, `spends Pulse to swap a piece, once per cycle` |
| Piece selection and regeneration | engine: `advances after two placements and discards the third piece`, deal determinism tests |
| No-move detection | engine: `detects when no offered piece fits` |
| Elimination | engine: elimination tests; server: `eliminates a player with no legal moves...` |
| Resource abuse cannot prevent elimination | engine: `cannot loop Pulse swaps...`, Last Chance expiry |
| Winner determination and ties | engine: `ends immediately when one player remains`, `awards the highest surviving score at time expiry`, `last eliminated player`, `breaks exact ties deterministically` |
| Simultaneous actions | server: `accepts simultaneous actions from different players` |
| Timer expiry | engine: time outcome; server: full two-player match ending by time; e2e |
| Reconnection | server: `restores the board on reconnect within the window`, `forfeits a player who does not return` |
| Five-player match | engine simulation; server: five-player match with rank consistency; e2e with 5 browsers |
| Sixth player rejected | server: `accepts five players and rejects a sixth` |
| Invalid room codes | server: `rejects malformed and unknown room codes` |
| Forged score events | server: forged `score` and `board` fields ignored |
| Duplicate placement events | server: replayed `seq` rejected as `duplicate`, score unchanged |
| Rematch and state reset | server: `resets state for a rematch`; e2e rematch |
| Equal pieces regardless of pace | engine: `gives every player the same piece sequence regardless of pace` |
| Duplicate connection | server: `replaces a duplicate connection for the same player` |
| Forged identity | server: `issues a fresh identity for a forged token` |
| Rate limiting | server: `rate limits floods without disconnecting normal play` |
| Host departure | server: `hands the host role over when the host leaves` |
| Leaving mid-match | server: `keeps the match running when a player leaves mid-game` |
| Honest quick play | server: queue matching and lone-player timeout; UI walkthrough |

## End-to-end harness

`e2e/run-e2e.ts` starts the real server and Vite client on spare ports, then opens N **separate browser contexts**. Each has its own storage and therefore its own guest identity; contexts alternate between desktop and phone viewports.

1. Host clicks **Private Match** and reads the code from the screen.
2. Every other browser clicks **Join Room**, types the code, joins and clicks **Ready**.
3. Host clicks **Start Match**.
4. Each browser plays by **dragging pieces with the mouse** (move choice uses a heuristic with per-client noise).
5. Mid-match it asserts that every browser's view of every opponent's board and score equals that opponent's own authoritative state.
6. After time expires it asserts that all browsers show identical standings, that the winner is first, and that the highest surviving score won.
7. It clicks **Rematch** and checks that the room returns to the lobby.
8. It fails on any browser console error or page error.

Screenshots are written to `test-results/e2e/`.

For manual play on one computer: start `npm run dev`, then run `npm run multi -- 3` to open three independent visible windows. To use two real devices on the same network, open `http://<computer-LAN-IP>:5173` on each phone. The Vite proxy forwards the socket to the game server.

## Latest results (this repository, 2026-10-28)

- Unit and integration: 52 tests passing (30 engine, 22 server including the Postgres test against PostgreSQL 16).
- E2E: 2 players, 92 drag moves, sync verified, `PASS`. 5 players, 135 drag moves, sync verified, `PASS`.
- Load: 40 rooms x 5 = 200 concurrent clients, 3,622 placements. Action round trip p50 0.4 ms, p99 1.9 ms, max 5.3 ms (in-process, loopback). About 2.8 KiB/s downstream per client. 161 MiB RSS with clients and server in one process.
- UI walkthrough (mobile viewport): tutorial completed by keyboard only, honest Quick Play timeout, practice, settings. No console errors.

## Not yet tested

- Physical iOS and Android devices (no SDK or Xcode available in the build environment).
- Real-world mobile networks (packet loss, cell handover). Socket.IO reconnection is covered on loopback only.
- Screen readers (VoiceOver, TalkBack). Labels and live regions exist but have not been verified with assistive technology.
- Frame-rate profiling on a real mid-range phone.
- Load beyond a single process, and across machines.
