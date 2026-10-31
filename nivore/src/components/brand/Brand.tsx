import type { CSSProperties } from "react";

/**
 * NIVORÉ wordmark — working reconstruction per the Brand Book (p.5):
 * Inter SemiBold wordmark; Inter Regular "TIMEPIECES" descriptor at 49% of
 * the wordmark cap height, 82% of its width, gap 0.9 × cap height, centred.
 * The accent is never removed. Below 120 px wide, use `secondary` (no descriptor).
 * Replace with outlined vector artwork once the master is redrawn.
 */
export function Wordmark({
  secondary = false,
  className,
  tone = "default",
  title = "NIVORÉ Timepieces",
}: {
  secondary?: boolean;
  className?: string;
  tone?: "default" | "reversed" | "champagne";
  title?: string;
}) {
  const ink = tone === "reversed" ? "#f7f4ee" : tone === "champagne" ? "#c2aa83" : "#3a322e";
  const desc = tone === "reversed" ? "#c5b9a6" : tone === "champagne" ? "#c2aa83" : "#766a5d";
  // Units: wordmark set at 100; Inter cap height ≈ 72.7. Measured advance of "NIVORÉ" ≈ 401.
  const W = 401;
  const cap = 72.7;
  const descSize = 100 * 0.49;
  const gap = cap * 0.9;
  const height = secondary ? 100 : 100 + gap + descSize * 0.727 + 4;
  return (
    <svg viewBox={`0 ${-14} ${W} ${height + 14}`} className={className} role="img" aria-label={title} style={{ overflow: "visible" }}>
      <text x={W / 2} y={cap + 2} textAnchor="middle" fontSize="100" fontWeight="600" fill={ink} style={{ fontFamily: "var(--font-inter), Inter, sans-serif", letterSpacing: "0.01em" }}>
        NIVORÉ
      </text>
      {!secondary && (
        <text
          x={W / 2}
          y={cap + 2 + gap + descSize * 0.727}
          textAnchor="middle"
          fontSize={descSize}
          fontWeight="400"
          fill={desc}
          textLength={W * 0.82}
          lengthAdjust="spacing"
          style={{ fontFamily: "var(--font-inter), Inter, sans-serif" }}
        >
          TIMEPIECES
        </text>
      )}
    </svg>
  );
}

/** N1 hallmark ring (recommended monogram): outer 1 unit, inner 0.5 unit, gap 6.5% of diameter, cap height 34%. */
export function Monogram({ size = 40, className, color = "currentColor" }: { size?: number; className?: string; color?: string }) {
  const d = 100;
  return (
    <svg viewBox={`0 0 ${d} ${d}`} width={size} height={size} className={className} aria-hidden="true">
      <circle cx="50" cy="50" r="48" fill="none" stroke={color} strokeWidth="2" />
      <circle cx="50" cy="50" r={48 - 6.5} fill="none" stroke={color} strokeWidth="1" />
      <text x="50" y="50" dy="0.36em" textAnchor="middle" fontSize={34 / 0.727} fontWeight="600" fill={color} style={{ fontFamily: "var(--font-inter), Inter, sans-serif" }}>
        N
      </text>
    </svg>
  );
}

/** Minute track — the Brand Book's divider rule. Deterministic rhythm of ticks. */
export function MinuteTrack({ className, count = 60, style }: { className?: string; count?: number; style?: CSSProperties }) {
  const ticks = Array.from({ length: count }, (_, i) => {
    const major = i % 5 === 0;
    const h = major ? 14 : i % 5 === 2 ? 9 : 6;
    return { x: i * 10 + 1, h, major };
  });
  return (
    <svg viewBox={`0 0 ${count * 10} 16`} preserveAspectRatio="none" className={className} style={style} aria-hidden="true">
      {ticks.map((t) => (
        <rect key={t.x} x={t.x} y={16 - t.h} width={t.major ? 1.4 : 1} height={t.h} fill="currentColor" opacity={t.major ? 0.9 : 0.55} />
      ))}
    </svg>
  );
}

/**
 * Photography placeholder (Brand Book convention): hatched field with a
 * mono caption describing the intended shot. Always visibly a placeholder.
 */
export function PhotoPlaceholder({ label, className, style }: { label: string; className?: string; style?: CSSProperties }) {
  return (
    <div className={`photo-placeholder ${className ?? ""}`} style={style} role="img" aria-label={`Photograph to come: ${label}`}>
      <span className="absolute bottom-3 left-3 right-3 font-mono text-[10px] uppercase leading-snug tracking-[0.08em] text-taupe-ink/90">
        Photo — {label}
      </span>
    </div>
  );
}

/** "N° 01" index numeral. */
export function IndexNumeral({ n, className }: { n: number | string; className?: string }) {
  return (
    <span className={`serif font-light tabular ${className ?? ""}`}>
      N° {typeof n === "number" ? String(n).padStart(2, "0") : n}
    </span>
  );
}
