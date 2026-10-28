# Game Design Specification

Working title: **Pulse Arena** (provisional, not cleared; see `ip-risk-notes.md`).

One sentence: up to five players each work their own 9x9 board at the same time, scoring by clearing rows and columns, and the best score among players who still have room to play when the clock runs out wins.

All numbers below come from `packages/engine/src/rules.ts` and `pieces.ts`. Those files are the source of truth, and this document is checked against them.

## 1. The 15-second explanation

Shown on first launch as a 4-step interactive tutorial:

1. Drag a piece onto the board. A full row or column clears.
2. Each round offers three pieces. Place any two and the third is discarded.
3. Clearing on back-to-back moves builds a chain and charges Pulse. Pulse replaces a piece.
4. When no piece fits, you are out. At the end, the top score among players still in wins.

## 2. Board and pieces

- 9x9 grid. Cells are empty, filled with a piece color, or Static.
- Pieces never rotate. Each orientation is its own catalogue entry.
- Seven original families, each with a fixed color:

| Family | Shapes | Color |
|---|---|---|
| Mote | single cell | Ember |
| Rod | straight lines of 2, 3, 4, 5 | Amber |
| Hook | 3-cell corner, 4-cell L and J, 5-cell big corner | Lime |
| Slab | 2x2, 2x3 and 3x2, 3x3 | Teal |
| Step | 4-cell zigzags | Azure |
| Fork | 4-cell three-way junction | Violet |
| Spark | diagonal-only chains of 2 and 3 cells | Rose |

The Spark family (cells that touch only at corners) is a deliberate departure from the genre. Sparks are flexible on a messy board and awkward on a clean one.

## 3. The round (cycle): place two of three

- Each cycle offers **three** pieces.
- The player must place **two** of them, in any order and anywhere legal.
- When the second piece is placed, the remaining piece is **discarded** and a new cycle of three is dealt.

This is the core decision that sets the game apart: every round, the player chooses which piece *not* to play. Players avoid the shape that would hurt their board, or keep the high-scoring shape for later.

## 4. Scoring

| Event | Points |
|---|---|
| Placing a piece | 1 per cell |
| Clearing 1 / 2 / 3 / 4 / 5 lines at once | 10 / 30 / 60 / 100 / 150, then +60 per extra line |
| Cross (a row and a column in one placement) | +20 flat |
| Clean Sweep (board fully empty afterwards) | +200 flat |

Clear points are multiplied by the **chain multiplier** and by **Surge**.

### Chain

- Every placement that clears at least one line adds 1 to the chain.
- The chain **survives one placement without a clear** and breaks on the second consecutive miss (`CHAIN_MISS_LIMIT = 2`).
- Multiplier: `1 + 0.5 x (chain - 1)`, capped at x4.

The one-miss grace means a chain survives the forced "setup" placement that most clears need. The HUD shows remaining misses as dots.

## 5. Pulse (resource)

- Earned by clearing: `12 x lines + 8 x min(chain - 1, 5)` per clearing placement, doubled during Surge.
- Stored up to **200**. A swap costs **100**, so the meter holds at most two charges.
- **Swap:** replace one offered piece with a server-determined compact piece (4 cells or fewer, never the same piece).
- **At most one swap per cycle.**

Why this cannot make elimination meaningless:
- One swap per cycle, at a cost of roughly five line clears, and at most two stored.
- The replacement is drawn from a fixed, deterministic table. A player cannot fish for a perfect piece.
- If the swapped-in piece still does not fit, the player is eliminated: no second swap in that cycle.

Balance simulation (see section 10): an average-skill bot uses about 2 swaps per 3-minute match.

## 6. Surge (timed scoring event)

- Fixed, predictable windows at 25%, 53% and 81% of the match, 10 seconds each. For a 180-second match: 0:45, 1:35 and 2:26 elapsed.
- During Surge, clear points and Pulse gain are doubled.
- The timer bar shows every Surge window from the start of the match. A "Surge in 3" warning precedes each one.
- Presentation: amber board frame and scan line, an amber HUD pill, a dedicated rising synth cue, and amber opponent activity text.

Surge creates shared moments in a match: everyone tries to set up clears for the same 10-second window.

## 7. Static (anti-stalling)

A player who stops placing could otherwise protect a lead, because survivors outrank eliminated players.

- After **10 seconds** without a placement or swap, one **Static** cell drops onto the board, then one more every **3 seconds**.
- Static cells clear like normal cells.
- Static never fills the last empty cell of a row or column, so idling can never award a free clear.
- Static placement is deterministic from the match seed.

## 8. Last Chance and elimination

After any change to a board, the server checks whether any remaining offered piece fits:

- **Fits:** play continues.
- **Nothing fits, a swap is available** (Pulse >= 100 and no swap used this cycle): a **Last Chance** window of 8 seconds opens. Swapping closes the window. When it expires, the player is eliminated.
- **Nothing fits, no swap available:** eliminated immediately.

Eliminated players keep their final board and score, cannot act, and watch the rest of the match.

A player who disconnects keeps playing on the server clock: Static still accumulates. If they do not return within the reconnect window (30 seconds by default), they forfeit with the reason "disconnected".

## 9. Winning and ranking

Evaluated after every action and on every server tick:

1. **One player left alive** (in a match that started with 2 or more): that player wins immediately.
2. **Time expires:** among players still alive, the highest score wins.
3. **Everyone eliminated:** the last player eliminated wins.

### Deterministic ordering (live ranks and final standings)

1. Alive players always rank above eliminated players.
2. Among alive players: higher score, then more lines cleared, then whoever reached their score earlier, then lower seat number (join order).
3. Among eliminated players: eliminated later ranks higher, then higher score, then more lines, then lower seat number.

Two players eliminated in the same server tick have the same elimination time and fall through to the score tie-breakers. The results screen explains the outcome in plain language, for example: "Time ran out. Ana had the highest score among players still in the match. Players who were eliminated rank below everyone who survived."

## 10. Balance notes

`npx tsx scripts/simulate.ts 200` plays bots of three skill levels through full 180-second matches:

| Profile | Survives full match | Median survival | Average score | Swaps per match |
|---|---|---|---|---|
| careful (near-optimal placement) | 96% | 180 s | ~1170 | 0.15 |
| average | 22% | 125 s | ~940 | 1.9 |
| casual | 0% | 40 s | ~300 | 1.0 |

Difficulty escalates by **cycle number**, not by time: large pieces become more common from cycle 2, and from cycle 20 a deal may contain two large pieces. Because escalation is keyed to the cycle, it is identical for everyone. A fast player meets harder deals sooner, but has also scored more by then.

These are bot results. **Human playtesting is still required** before locking numbers. The values most likely to need tuning are `ESCALATION_CYCLES`, `IDLE_GRACE_MS` and `PULSE_COST`.

## 11. Fairness model

- **Same pieces for everyone.** The deal for cycle *n* is `dealCycle(matchSeed, n)`. Players advance through cycles at their own pace, but player A's cycle 12 is identical to player B's cycle 12.
- **Same swap results.** The replacement for a swap is `rerollPiece(seed, cycle, swapIndex, replacedPiece)`. The same decision always yields the same piece for every player.
- **Same Static.** Static cells come from `(seed, staticIndex)`.
- **No hidden difficulty adjustment.** No player-specific input affects generation.
- **No lookahead.** Clients never receive the seed or future deals. A player sees only their current three pieces. Opponents' trays are not broadcast.
- **Known limitation:** a slower player could in theory watch a faster opponent's board to infer which pieces upcoming cycles contain. The information is partial (only placed shapes are visible) and arrives at human speed, so it is accepted for launch. Per-player cycle offsets with a shared seed are a possible future mitigation.

## 12. Match settings

- Default 180 seconds. Hosts choose 2, 3 or 5 minutes. The server accepts 60 to 600 seconds (`MATCH_DURATION_SEC` sets the default).
- 2 to 5 players. The host starts once at least two players, the host included, are ready. Players who are not ready watch.
- Synchronized 3-second countdown from a server timestamp, plus a 0.5-second network margin.
