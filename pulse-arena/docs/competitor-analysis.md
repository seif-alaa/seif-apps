# Competitor Analysis: Casual Block-Placement Puzzles

Scope: publicly observable gameplay and publicly available descriptions and reviews of the block-placement genre (for example *1010!*, *Block Blast*, *Woodoku* and similar "block puzzle" titles). No software was decompiled and no assets were extracted. This document describes design principles only.

Sources consulted were mostly public gameplay descriptions and strategy pages. Many are low-quality fan or SEO sites that contradict each other on exact numbers, so this analysis relies on **observable mechanics**, not claimed point values. Before any marketing claim refers to competitors, verify against the developers' official store listings.

## What the genre gets right

**1. Zero-friction rules.** "Put shapes on a grid, full lines disappear" can be learned by watching once. There is no rotation, gravity or timer in the core loop, so the only skill is spatial planning.

**2. Drag and drop as the whole interface.** Direct manipulation makes every move tactile. A correct preview (the shape snaps and highlights before release) removes doubt, so mistakes feel like the player's own planning errors rather than input failures.

**3. Clears as instant reward.** Every clear is a small, visible and audible payoff. The board gets *emptier*, which feels like relief as well as points. Multi-line clears are rare enough to feel special.

**4. Combos encourage risk.** Rewarding consecutive clears turns a safe placement into a gamble: do I set up a bigger clear and risk filling up? That tension is where most of the depth comes from.

**5. Simple rules, real depth.** A fixed piece set on a small grid creates many situations. Good players keep the board "open" (few isolated holes, long empty lanes) and plan around shapes they cannot place well, such as long lines and big squares.

**6. Readable feedback.** Effects and sound scale with the size of the achievement. Players learn the value of an action without reading numbers.

**7. The high-score loop.** Every run ends in a single number that is easy to beat. Games are short and restarting is instant.

## What the genre does poorly

- **Solitary.** Competition is asynchronous at best (leaderboards). There is no shared moment and little reason to invite a friend.
- **Long, low-stakes sessions.** Strong players can play for a very long time, and late-game tension fades into routine.
- **Monetization pressure.** Many titles are heavily ad-supported. Reviews commonly complain about interstitials and "revive" prompts that undercut the satisfaction of a run.
- **Hidden randomness.** Players often suspect the piece generator is unfair ("it never gives me the line I need"), and there is no transparency.
- **Interchangeable presentation.** Wood textures and glossy candy blocks make many titles hard to tell apart.

## How our game is distinct

| Genre convention | Our approach |
|---|---|
| Solo high score | Live 2 to 5 player survival match with visible opponents |
| Must place every offered piece | Place **two of three** each round; choosing what to skip is the core decision |
| Endless run | Fixed 2 to 5 minute match with a shared, synchronized clock |
| Ad-based revives | **Pulse**: an earned, capped, once-per-round piece swap; skill-based, never purchasable |
| Steady pacing | **Surge**: predictable double-score windows that create shared moments |
| Idle play is safe | **Static**: idle boards slowly fill, so a leader cannot freeze to protect a score |
| Opaque randomness | Deterministic seeded deals; every player gets the same pieces per round |
| Combo resets on any miss | Chain survives one miss, matching the "setup, then clear" rhythm |
| Wood or candy visuals | Graphite and midnight interface, original "cored tile" blocks, competitive HUD |
| Standard polyominoes only | Adds an original diagonal "Spark" family |

## Principles we keep

- Direct, forgiving drag and drop with an accurate preview, plus a touch lift so the finger never hides the piece.
- Clears are the main reward, and feedback scales with clear size.
- Rules fit in one sentence. Each extra mechanic (Pulse, Surge, Static) is one line of tutorial text.
- Fast replay: Rematch returns everyone to the same lobby in one tap.

## Principles we deliberately reject

- No forced ads, revives or paid advantages.
- No fake opponents or bots presented as people. Quick Play shows the real queue count and says so honestly when nobody is available.
- No difficulty adjusted per player.
