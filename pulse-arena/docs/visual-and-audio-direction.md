# Visual and Audio Direction

## Visual identity

**Mood:** a late-night arcade cabinet redesigned as a precision instrument. Dark, calm surfaces, with vivid color reserved for the pieces and the moments that matter.

### Palette

| Token | Value | Use |
|---|---|---|
| `--bg-0` | `#07090D` | App background (graphite black) |
| `--bg-1..4` | `#0B0F16` to `#202A3A` | Midnight panel layers |
| `--line` | `#243042` | Hairlines, board frame |
| `--text-0/1/2` | `#EEF2F8` / `#A9B3C4` / `#6C778B` | Text hierarchy |
| `--pulse` | `#3DE0D0` | Brand accent: primary actions, Pulse, chain |
| `--surge` | `#FFB23E` | Surge only |
| `--danger` | `#FF4D5E` | Danger, elimination, invalid |
| `--good` | `#6BE38A` | Ready, positive state |

Piece families use seven well-separated hues: Ember `#FF6A3D`, Amber `#FFC23D`, Lime `#9DDB4E`, Teal `#27CFB0`, Azure `#4C9DFF`, Violet `#9B7BFF`, Rose `#FF5C9A`. Static is matte graphite with a hatch. **Color is never the only signal:** families also differ by shape, Static has a texture, and danger uses motion and text as well as red.

### The cored tile

The signature block (`game/theme.ts`), drawn procedurally and cached as sprites per size:
- Rounded square (17% radius) with a darker **base lip** offset below, for material depth.
- Vertical light falloff on the face, plus a crisp top rim highlight.
- An **inset core plate** with a hairline rim and an inner shadow edge, like a key cap or a chip in a socket. This is the element that makes screenshots recognizable.
- A soft diagonal facet sheen across the upper left.

Empty cells are recessed sockets (dark top edge, faint lower lip), so the board reads as a physical tray.

### Typography

- **Oxanium** (OFL): display, numerals and timers. Squared, technical, and tabular for scores.
- **Manrope** (OFL): interface text. Neutral and highly legible at small sizes.
- Uppercase with letter spacing only for short labels and buttons. Sentence case everywhere else.

### Layout

- Desktop: board first, opponent panel on the right (300 px) with 96 px live mini boards, rank, score and activity.
- Phone portrait: board and tray kept toward the thumb, a 76 px opponent rail on the right, and an expandable opponent sheet.
- Phone landscape: board left, tray right, rail on the far right.
- The opponent UI never overlaps the board or tray. The expanded opponent sheet is user-opened and closes with a tap.

### Motion

| Moment | Treatment |
|---|---|
| Pick up | Piece scales from tray size to board size in 120 ms, with a drop shadow. On touch, it is lifted above the finger. |
| Hover | Translucent preview. Lines that would clear get a lane highlight and pulsing cells. |
| Invalid | Red outline preview. On release, the frame flashes red and the piece eases back to the tray. |
| Place | Cells overshoot and settle (back-ease, 200 ms) with a brief white glow. |
| Clear | White flash, then a light beam sweeps along each line from the placement point, cells shrink away, and shards burst out with gravity. |
| Multi-clear | Larger beams, more shards, a short screen shake, and "Double", "Triple", "Quad", "Overload" or "Cross" labels. |
| Chain | "Chain N" sub-label. Chain indicator and miss dots in the status row. |
| Pulse gain and spend | Meter fills with a glow pulse. A swap shows "Pulse: Piece replaced" with a warp sound. |
| Surge | Amber frame breathing, a scan line sweeping the board, an amber pill, and amber opponent text. |
| Score change | Count-up animation plus a bump. Rank chip jumps on overtakes. |
| Opponent eliminated | Card flashes red, an "Out" stamp slams in, the mini board desaturates, plus a toast. |
| Final 10 seconds | Timer turns red and ticks every second. |
| Victory and defeat | Spring-in title, staggered standings rows, plus music cue. |

**Reduced motion** (system setting or in-game toggle) removes particles, shake, pulsing and countdown pops, and shortens all transitions to effectively instant. Information is never conveyed only by motion.

### What we avoid

No emojis, no stock icon packs (the icon set is original SVG on one grid), no random gradients or glassmorphism stacks, no lorem ipsum, and no exclamation marks in copy.

## Audio direction

All audio is **synthesized at runtime** with Web Audio (`audio/audio.ts`): no samples, so it is fully original and adds no download size.

- **Harmonic frame:** A minor pentatonic. Clear rewards climb the scale with chain level, so long chains audibly rise in pitch and can never sound dissonant.
- **Mix:** compressor on the master bus. Effects and music are separate buses with separate volume controls plus a mute. Preferences persist.
- **Autoplay:** the audio context is created and resumed on the first pointer or key gesture. On mobile it is suspended in the background and resumed in the foreground.

| Event | Recipe |
|---|---|
| Button | Short high sine tick with a triangle under it |
| Pick up | Rising triangle blip with an air click |
| Place | Pitched "thock": a sine drop whose pitch lowers for larger pieces, plus a filtered noise click |
| Invalid | Two soft, low-passed square notes, descending |
| Line clear | 3 to 6 note pentatonic arpeggio (triangle with detuned sine) plus a high-pass whoosh |
| Multi-clear | Adds a sub drop and a low noise thump. 3+ lines add a long top note. |
| Chain | Two square accents above the arpeggio, rising with chain level |
| Pulse ready / gain / spend | Two-note chime / soft upward ping / band-pass sawtooth "warp" with a resolving ping |
| Surge warning / start / end | Three ticks / rising sawtooth chord with a sub swell and a noise riser / falling triangle |
| Static | Short gated digital crackle |
| Danger (Last Chance) | Low double heartbeat each second |
| Opponent eliminated | Descending low-passed triangle with a falling noise tail |
| Overtake | Two-note rising triangle |
| Countdown and Go | Mid ticks then a two-voice "go" chime |
| Final 10 seconds | Woodblock-like tick, higher in the last 3 seconds |
| Victory / defeat | Major arpeggio fanfare with a bass swell / three-note minor resolution |
| Music | Generative i-VI-III-VII pad with a bass pluck and arpeggio at 104 BPM. Intensity opens the filter and adds hats and kick during Surge and the final 30 seconds. |

Haptics mirror the audio hierarchy: selection tap, then light impact for placing, medium for a clear, heavy for multi-clears and Surge, and notification patterns for warnings, elimination and victory.
