# Roadmap

Ordered by value to players and to launch readiness.

## Before public launch
1. **Brand:** choose and clear the final name, then apply it across code, apps and stores.
2. **Human playtesting** and balance tuning from real match data.
3. **Device testing** on physical iOS and Android devices, then fix platform issues.
4. **Nickname safety:** profanity filter, report player, and a preset-name option for younger audiences.
5. **Verified invite links** (App Links and Universal Links).
6. **CI pipeline** running typecheck, unit tests, e2e tests and the Docker build.
7. **Privacy policy, terms, and store listings.**

## Shortly after launch
- **Room draining for zero-downtime deploys.**
- **Spectate-by-link:** watch a running match without joining it.
- **Friends list and recent players**, so a past opponent can be invited again in one tap.
- **Post-match recap:** a timeline of each player's clears, Surge performance and eliminations.
- **Optional accounts** (Sign in with Apple and Google) to carry stats across devices. Guest play stays the default.
- **Seasonal stats:** wins, average placement, best chain. Personal only, no global pay-to-win ladder.

## Scale
- **Multi-instance routing** by room code (Redis directory) and a Redis-backed Quick Play queue.
- **Regional servers** with latency-based Quick Play.
- **Server metrics:** Prometheus endpoint for rooms, matches, tick time and event loop delay.

## Game modes (each needs its own design and fairness review)
- **Team Survival (2v2 and 3v3):** combined team score, and a team survives while any member is alive.
- **Daily Challenge:** a fixed seed for everyone each day, played solo, compared with friends.
- **Long Match (10 minutes)** with more Surge windows.
- **Custom rooms:** toggle Static, Pulse, Surge and the piece families for house rules.

## Monetization (only after the game is fun and retains players)
- Cosmetic tile styles and board themes, which must keep color-blind-safe distinctions.
- No paid Pulse, no paid revives, no forced ads in matches.
