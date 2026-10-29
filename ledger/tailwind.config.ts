import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

const c = (v: string) => `hsl(var(--${v}) / <alpha-value>)`;

/** Ledger design tokens — see docs/DESIGN.md. */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"IBM Plex Sans Variable"', '"IBM Plex Sans Arabic"', "system-ui", "sans-serif"],
        arabic: ['"IBM Plex Sans Arabic"', '"IBM Plex Sans Variable"', "system-ui", "sans-serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "monospace"],
      },
      fontSize: {
        "2xs": ["11px", { lineHeight: "14px", letterSpacing: "0.02em" }],
        xs: ["12px", { lineHeight: "16px" }],
        sm: ["13px", { lineHeight: "18px" }],
        base: ["15px", { lineHeight: "22px" }],
        md: ["17px", { lineHeight: "24px" }],
        lg: ["20px", { lineHeight: "26px", letterSpacing: "-0.01em" }],
        xl: ["24px", { lineHeight: "30px", letterSpacing: "-0.015em" }],
        figure: ["40px", { lineHeight: "44px", letterSpacing: "-0.03em" }],
      },
      colors: {
        paper: c("paper"),
        surface: c("surface"),
        raised: c("raised"),
        sunken: c("sunken"),
        ink: { DEFAULT: c("ink"), 2: c("ink-2"), 3: c("ink-3"), 4: c("ink-4") },
        rule: { DEFAULT: c("rule"), strong: c("rule-strong") },
        accent: { DEFAULT: c("accent"), ink: c("accent-ink"), wash: c("accent-wash"), contrast: c("accent-contrast") },
        pos: { DEFAULT: c("pos"), wash: c("pos-wash") },
        neg: { DEFAULT: c("neg"), wash: c("neg-wash") },
        warn: { DEFAULT: c("warn"), wash: c("warn-wash") },
        // shadcn compatibility names
        background: c("paper"),
        foreground: c("ink"),
        border: c("rule"),
        input: c("rule-strong"),
        ring: c("accent"),
        muted: { DEFAULT: c("sunken"), foreground: c("ink-3") },
        popover: { DEFAULT: c("raised"), foreground: c("ink") },
      },
      borderRadius: {
        none: "0",
        xs: "3px",
        sm: "6px",
        DEFAULT: "8px",
        md: "10px",
        lg: "14px",
        sheet: "18px",
      },
      boxShadow: {
        sheet: "0 -1px 0 hsl(var(--rule)), 0 -12px 40px -12px hsl(var(--shadow) / 0.35)",
        pop: "0 1px 0 hsl(var(--rule)), 0 10px 30px -10px hsl(var(--shadow) / 0.35)",
      },
      transitionTimingFunction: {
        out: "cubic-bezier(.2,.8,.2,1)",
      },
    },
  },
  plugins: [animate],
} satisfies Config;
