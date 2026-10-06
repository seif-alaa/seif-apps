/**
 * Small hand-drawn-style SVG scenes for empty states. Colours come from the
 * theme tokens so they look at home in both light and dark.
 */
const s = {
  emerald: "hsl(var(--emerald))",
  emeraldSoft: "hsl(var(--emerald-soft))",
  coral: "hsl(var(--coral))",
  amber: "hsl(var(--amber))",
  card: "hsl(var(--card))",
  muted: "hsl(var(--muted))",
  line: "hsl(var(--muted-foreground) / 0.5)",
};

export function PiggyIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 160" className={className} aria-hidden>
      <ellipse cx="100" cy="146" rx="62" ry="7" fill={s.muted} />
      <circle cx="150" cy="30" r="12" fill={s.amber} opacity=".9" />
      <circle cx="150" cy="30" r="7" fill="none" stroke={s.card} strokeWidth="2" opacity=".7" />
      <circle cx="40" cy="44" r="8" fill={s.amber} opacity=".6" />
      <g className="animate-float">
        <ellipse cx="100" cy="92" rx="56" ry="42" fill={s.emerald} />
        <ellipse cx="86" cy="76" rx="22" ry="11" fill="#fff" opacity=".14" />
        <path d="M70 56 L78 38 L90 54Z" fill={s.emerald} />
        <ellipse cx="152" cy="92" rx="12" ry="14" fill={s.emerald} />
        <circle cx="149" cy="88" r="2.4" fill={s.card} />
        <circle cx="155" cy="96" r="2.4" fill={s.card} />
        <circle cx="122" cy="80" r="4" fill={s.card} />
        <path d="M86 52 h28" stroke={s.card} strokeWidth="5" strokeLinecap="round" />
        <rect x="70" y="124" width="12" height="16" rx="5" fill={s.emerald} />
        <rect x="116" y="124" width="12" height="16" rx="5" fill={s.emerald} />
        <path d="M44 92 q-12 -4 -8 -16" stroke={s.emerald} strokeWidth="5" fill="none" strokeLinecap="round" />
      </g>
      <circle cx="100" cy="20" r="9" fill={s.amber} className="animate-float" style={{ animationDelay: "-1.5s" }} />
    </svg>
  );
}

export function ReceiptIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 160" className={className} aria-hidden>
      <ellipse cx="100" cy="148" rx="54" ry="6" fill={s.muted} />
      <g className="animate-float">
        <path d="M60 22 h80 v112 l-10 -7 -10 7 -10 -7 -10 7 -10 -7 -10 7 -10 -7 -10 7z" fill={s.card} stroke={s.line} strokeWidth="1.5" />
        <rect x="74" y="40" width="36" height="7" rx="3.5" fill={s.muted} />
        <rect x="74" y="58" width="52" height="5" rx="2.5" fill={s.muted} />
        <rect x="74" y="72" width="44" height="5" rx="2.5" fill={s.muted} />
        <rect x="74" y="86" width="48" height="5" rx="2.5" fill={s.muted} />
        <rect x="74" y="104" width="52" height="8" rx="4" fill={s.emeraldSoft} />
      </g>
      <circle cx="148" cy="38" r="16" fill={s.emerald} />
      <path d="M141 38 l5 5 9-10" stroke={s.card} strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="46" cy="60" r="5" fill={s.coral} opacity=".7" />
      <circle cx="158" cy="104" r="4" fill={s.amber} opacity=".8" />
    </svg>
  );
}

export function TargetIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 160" className={className} aria-hidden>
      <ellipse cx="100" cy="148" rx="50" ry="6" fill={s.muted} />
      <circle cx="100" cy="82" r="56" fill={s.card} stroke={s.line} strokeWidth="1.5" />
      <circle cx="100" cy="82" r="40" fill={s.emeraldSoft} />
      <circle cx="100" cy="82" r="24" fill={s.card} />
      <circle cx="100" cy="82" r="10" fill={s.coral} />
      <g className="animate-float">
        <path d="M100 82 L152 30" stroke={s.amber} strokeWidth="4" strokeLinecap="round" />
        <path d="M152 30 l-2 -12 m2 12 l12 2" stroke={s.amber} strokeWidth="4" strokeLinecap="round" />
      </g>
      <circle cx="40" cy="36" r="6" fill={s.emerald} opacity=".7" />
    </svg>
  );
}

export function ChartIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 160" className={className} aria-hidden>
      <ellipse cx="100" cy="148" rx="60" ry="6" fill={s.muted} />
      <rect x="40" y="24" width="120" height="112" rx="18" fill={s.card} stroke={s.line} strokeWidth="1.5" />
      <rect x="58" y="92" width="14" height="28" rx="5" fill={s.muted} />
      <rect x="80" y="72" width="14" height="48" rx="5" fill={s.emeraldSoft} />
      <rect x="102" y="58" width="14" height="62" rx="5" fill={s.emerald} className="animate-float" />
      <rect x="124" y="80" width="14" height="40" rx="5" fill={s.muted} />
      <circle cx="60" cy="46" r="8" fill={s.amber} />
      <rect x="74" y="42" width="40" height="7" rx="3.5" fill={s.muted} />
    </svg>
  );
}
