# Implementation Plan and Status

Status key: **Done** (implemented and tested), **Done, untested on target** (implemented, but the target platform was unavailable in the build environment), **Open**.

## Phase 1: Research and technical plan
| Item | Status | Where |
|---|---|---|
| Competitor research | Done | `competitor-analysis.md` |
| Originality and IP risk notes | Done (preliminary; counsel review open) | `ip-risk-notes.md`, `brand-clearance-checklist.md` |
| Product and gameplay spec | Done | `game-design.md` |
| Architecture | Done | `architecture.md` |
| Visual and audio direction | Done | `visual-and-audio-direction.md` |
| Project setup | Done | npm workspaces, strict TypeScript |

## Phase 2: Working single-player engine
| Item | Status |
|---|---|
| 9x9 board, original piece families, deterministic seeded deals | Done |
| Place two of three, discard, cycles | Done |
| Line clears, cross, sweep, chain scoring | Done |
| Pulse, Surge, Static, Last Chance, elimination | Done |
| Balance simulation | Done (bot-based; human tuning open) |
| Practice mode and interactive tutorial | Done |
| Mouse, touch (with lift offset) and keyboard input | Done |

## Phase 3: Real multiplayer
| Item | Status |
|---|---|
| Guest identity (signed tokens) | Done |
| Private rooms: create, join by code, deep link, ready, host start, durations | Done |
| Quick Play with real queue counts and an honest timeout | Done |
| Server-authoritative matches, synchronized countdown and clock | Done |
| Live opponent boards, scores, ranks, activity and danger | Done |
| Elimination, spectating, results, rematch | Done |
| Reconnect window, duplicate sessions, host handover, cleanup | Done |
| Rate limiting, replay protection, input validation | Done |
| **Milestone:** two real browsers play a complete synchronized match with the correct winner | **Done** (e2e) |
| Five-player match through five browsers | Done (e2e) |

## Phase 4: Premium presentation
| Item | Status |
|---|---|
| Original cored-tile art, icons, logo, app icon, splash | Done |
| Required animations (pick up through victory) | Done |
| Synthesized sound set and music, volume controls, mute, persisted settings | Done |
| Haptics (native and web vibration) | Done, untested on device |
| Responsive desktop, phone portrait and landscape layouts | Done (verified in desktop and phone viewports) |
| All 13 required screens | Done |
| Reduced motion | Done |

## Phase 5: Mobile applications
| Item | Status |
|---|---|
| Capacitor Android and iOS projects | Done |
| Icons, splash, theme, deep links, haptics and share plugins, lifecycle | Done, untested on device |
| Device builds (APK, AAB, IPA) | **Open:** needs Android SDK and Xcode (blocked in the build environment) |

## Phase 6: Testing and launch preparation
| Item | Status |
|---|---|
| Engine and multiplayer test suites | Done (52 tests) |
| Multi-browser e2e harness | Done |
| Load test | Done (single process) |
| Production build and static serving | Done |
| Postgres persistence | Done (tested against PostgreSQL 16) |
| Dockerfile | Written; stages verified separately; full `docker build` open |
| Deployment docs with costs, production checklist, store checklist | Done |
| Physical device, screen reader and real-network testing | Open |
| Store submission | Open (accounts, signing, cleared name required) |
