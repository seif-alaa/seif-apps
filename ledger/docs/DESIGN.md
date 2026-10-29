# Ledger design language — “ink on paper”

Ledger is a financial instrument, not a dashboard. The visual system borrows from
account books and printed statements: warm paper, deep ink, hairline rules, and
a single ink-blue accent. Colour carries meaning, not decoration.

## Principles

1. **Figures first.** Money is the content. Everything else recedes.
2. **Rules, not boxes.** Sections are a small-caps label plus hairlines, not
   rounded cards. Cards are reserved for things that need the user (review
   prompt, reconciliation).
3. **One accent.** Ledger blue marks “Ledger needs you / this is actionable”.
   Green and red are reserved for money direction and budget state.
4. **Honest states.** Every automated thing shows how it knows (source,
   method, confidence). Sample/simulated data is always labelled.
5. **Motion explains state.** Sheets, queue advance, tab marker, balance
   tween. No decorative loops, no count-up on load.

## Tokens (`src/index.css`, `tailwind.config.ts`)

| Token | Light | Dark | Use |
|---|---|---|---|
| `paper` | `hsl(42 30% 96%)` | `hsl(40 6% 7%)` | App background |
| `surface` | `hsl(42 33% 98.5%)` | `hsl(40 5% 9.5%)` | List bands between rules |
| `raised` | `#fff` | `hsl(40 5% 12%)` | Sheets, dialogs, toasts |
| `sunken` | `hsl(40 20% 92%)` | `hsl(40 5% 15.5%)` | Glyph wells, tracks, chips |
| `ink` / `ink-2/3/4` | `hsl(40 12% 9%)` → 64% | `hsl(40 18% 92%)` → 38% | Text hierarchy (4 steps only) |
| `rule` / `rule-strong` | `hsl(38 16% 87%)` / 78% | `hsl(40 5% 17%)` / 25% | Hairlines, inputs |
| `accent` (Ledger blue) | `hsl(229 64% 47%)` | `hsl(229 100% 76%)` | Needs-you, links, focus, today |
| `pos` | `hsl(152 61% 28%)` | `hsl(150 45% 60%)` | Money in |
| `neg` | `hsl(10 62% 44%)` | `hsl(12 80% 68%)` | Over budget, destructive |
| `warn` | `hsl(36 88% 34%)` | `hsl(40 80% 62%)` | Watch, pending, reconciliation |

Dark mode is a warm graphite with its own steps — not an inversion. Accent and
semantic colours are lifted in dark mode to keep ≥4.5:1 contrast for text.

**Spending is ink, not red.** Red appears only when something is actually wrong
(over budget, destructive actions).

## Type

- **IBM Plex Sans** (variable) for UI, **IBM Plex Sans Arabic** for Arabic,
  **IBM Plex Mono** for references and institution monograms. One family, three
  cuts — precise, slightly engineered, good tabular figures in both scripts.
- Scale: 11 / 12 / 13 / 15 (base) / 17 / 20 / 24 / 40 (figure).
- `.fig` = `tabular-nums lining-nums`. Every amount uses it.
- Money component: currency code small and quiet, integer at full weight,
  decimals at 55% opacity, real minus sign (−), explicit `+` only for inflows.
- `eyebrow`: 11px uppercase tracked labels (Arabic: 12px, no tracking/case).

## Geometry

- Radii: 3 (tags) · 6 (chips, small buttons) · 8 (controls, glyph wells) ·
  14 (rare panels) · 18 (sheet top). Nothing is a pill except switches/dots.
- 20px page gutters; list rows ≥56px tall (≥44px touch targets everywhere).
- Icons: Lucide, 1.75 stroke, always inside a 28/36/44px square well.
  Categories are identified by glyph + label, never colour alone, never emoji.
- Institution mark: monogram in mono caps on an ink square (CIB, NBE, T, VC).

## Components

- `Money` — all amounts. `size`: sm/md/lg/hero. `tone`: ink/muted/pos/neg.
- `Section`, `Row`, `Tag`, `Meter`, `TopBar`, `Empty` — `components/layout.tsx`.
- `Sheet` — vaul bottom sheet; drag to dismiss; background scales slightly.
- `CategoryGrid` — the one-tap classification grid used by Quick Capture.
- `Nav` — flat bottom bar, 4 destinations + inline Add (same geometry, no FAB).

## Motion

| Moment | Motion |
|---|---|
| Route change | 160ms fade |
| Sheet open/close | vaul spring, drag-to-dismiss |
| Review queue advance | 40px horizontal slide + fade |
| Nav selection | accent marker slides (layoutId) |
| Balance change | 450ms tween (not on first render) |
| Press | 0.97 scale, firm spring |

`prefers-reduced-motion` disables all of it (`MotionConfig reducedMotion="user"`
plus a CSS override).

## RTL

Layout uses logical properties (`ms/me/ps/pe/start/end`). Chevrons flip with
`rtl:rotate-180`. Money renders in the locale's order; Arabic users can choose
Arabic-Indic (١٢٣) or Latin digits.
