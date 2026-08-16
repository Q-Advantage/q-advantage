import type { Config } from "tailwindcss";

/**
 * Q-Advantage design tokens — unified across marketing landing (/) and
 * the Q-Shield dashboard (/q-shield/*).
 *
 * Typography:
 *  - Display headings: Instrument Serif (italic for editorial signature phrases)
 *  - Body: Inter Tight
 *  - Numbers / code / mono cells: Geist Mono
 *
 * Color philosophy:
 *  - Three themes, selected at runtime via `[data-theme]` on <html>
 *    (see ThemeToggle + globals.css): "dark" (default, near-black), "light"
 *    (warm paper, SemiAnalysis/Comet-inspired), "navy" (deep blue).
 *  - Every surface/text/border token below resolves through a CSS custom
 *    property so the same Tailwind class (e.g. `bg-bg`, `text-fg-muted`)
 *    repaints correctly under all three themes — see the `--color-*`
 *    variable blocks in globals.css for the actual per-theme values.
 *  - GREEN accent for: chart highlights, hover states, "latest run"
 *    pills, brand mark, primary CTAs, live pulses. NOT for body chrome.
 *    Accent hue stays "green" in all themes but shifts lightness per theme
 *    for contrast (bright mint on dark/navy, deeper green on light/paper).
 *  - `accent.fg` is the text/icon color used ON TOP of an accent-colored
 *    surface (e.g. `bg-accent text-accent-fg` buttons) — always the
 *    correct contrast partner for that theme's accent, independent of
 *    the page background token.
 *  - Data palette: sequential teal/blue ramp for chart series (multi-series),
 *    intentionally constant across themes — chart color-coding shouldn't
 *    shift meaning when the visitor switches theme.
 *  - Status colors: green/amber/red, used sparingly in the audit strip;
 *    also constant across themes.
 *
 * Two design registers coexist:
 *  - Marketing (/) — editorial, serif italic headings, animated gradient bg
 *  - Dashboard (/q-shield/*) — dense Bloomberg-style, no italics in chrome
 *
 * Shared chrome (Header, Footer, Subscribe form) bridges both registers.
 */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Surface ramp — each resolves through a CSS var so it repaints per theme.
        bg: {
          DEFAULT: "rgb(var(--color-bg) / <alpha-value>)",
          surface: "rgb(var(--color-bg-surface) / <alpha-value>)",
          card: "rgb(var(--color-bg-card) / <alpha-value>)",
          elevated: "rgb(var(--color-bg-elevated) / <alpha-value>)",
          inset: "rgb(var(--color-bg-inset) / <alpha-value>)",
        },
        // Foreground ramp
        fg: {
          DEFAULT: "rgb(var(--color-fg) / <alpha-value>)",
          muted: "rgb(var(--color-fg-muted) / <alpha-value>)",
          subtle: "rgb(var(--color-fg-subtle) / <alpha-value>)",
          faint: "rgb(var(--color-fg-faint) / <alpha-value>)",
        },
        // Border ramp — single per-theme base color, fixed alphas per weight.
        // Weights are tuned for the light ground, where a 0.08 hairline is
        // invisible; the dark palette uses a lighter base to compensate.
        border: {
          DEFAULT: "rgb(var(--color-border) / 0.28)",
          strong: "rgb(var(--color-border) / 0.45)",
          subtle: "rgb(var(--color-border) / 0.16)",
        },
        // Brand accent — gold. `accent` is a SURFACE colour (badges, rails,
        // fills). For accent-coloured TEXT use `accent-ink`, which is the
        // contrast-safe partner on each theme's ground.
        accent: {
          DEFAULT: "rgb(var(--color-accent) / <alpha-value>)",
          ink: "rgb(var(--color-accent-ink) / <alpha-value>)",
          dim: "rgb(var(--color-accent-dim) / <alpha-value>)",
          glow: "rgb(var(--color-accent) / 0.4)",
          soft: "rgb(var(--color-accent) / 0.16)",
          fg: "rgb(var(--color-accent-fg) / <alpha-value>)",
        },
        // Link / secondary action — blue. Separate from the brand accent so
        // "clickable" and "branded" never collapse into one signal.
        link: "rgb(var(--color-link) / <alpha-value>)",
        // Data viz palette — sequential teal/blue ramp for chart series.
        // Constant across themes by design; see note above.
        data: {
          1: "#7cd4d4",
          2: "#4fb3c4",
          3: "#2a8aae",
          4: "#1f5f8a",
          5: "#173f66",
        },
        // Status colors — constant across themes.
        status: {
          ok: "rgb(var(--color-status-ok) / <alpha-value>)",
          warn: "rgb(var(--color-status-warn) / <alpha-value>)",
          err: "rgb(var(--color-status-err) / <alpha-value>)",
        },
      },
      fontFamily: {
        // One face for the whole site: DM Sans carries text AND numerals,
        // verified as what InferenceX itself does (tabular figures come from
        // `font-variant-numeric` on body, not from a second family).
        //
        // `serif` and `mono` are deliberately aliased to the same face rather
        // than removed. Both classes are used across ~21 files that predate
        // this system; aliasing repaints them correctly in one move instead of
        // churning every call site. Retire the aliases when those files are
        // next touched.
        sans: ["var(--font-sans)", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        serif: ["var(--font-sans)", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        mono: ["var(--font-sans)", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        // Literal code only (blog post snippets). The one place a real
        // monospace face still earns its keep.
        code: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem", letterSpacing: "0.02em" }],
        xs:   ["0.75rem",   { lineHeight: "1.1rem" }],
        sm:   ["0.8125rem", { lineHeight: "1.25rem" }],
        base: ["0.875rem",  { lineHeight: "1.375rem" }],
        lg:   ["1rem",      { lineHeight: "1.5rem" }],
        xl:   ["1.125rem",  { lineHeight: "1.625rem" }],
        "2xl":["1.375rem",  { lineHeight: "1.75rem", letterSpacing: "-0.01em" }],
        "3xl":["1.75rem",   { lineHeight: "2.125rem", letterSpacing: "-0.015em" }],
        "4xl":["2.25rem",   { lineHeight: "2.625rem", letterSpacing: "-0.02em" }],
        "5xl":["3rem",      { lineHeight: "3.25rem",  letterSpacing: "-0.025em" }],
      },
      letterSpacing: {
        tightest: "-0.03em",
        eyebrow: "0.1em",
      },
      borderRadius: {
        DEFAULT: "6px",
        sm: "3px",
        md: "8px",
        lg: "10px",
        xl: "14px",
      },
      boxShadow: {
        ring: "inset 0 0 0 0.5px rgba(255, 255, 255, 0.08)",
        "ring-strong": "inset 0 0 0 0.5px rgba(255, 255, 255, 0.14)",
        "ring-accent": "inset 0 0 0 1px rgba(74, 222, 128, 0.35)",
        glow: "0 0 8px rgba(74, 222, 128, 0.4)",
      },
      animation: {
        "pulse-soft": "pulse-soft 2s ease-in-out infinite",
        reveal: "reveal 0.7s cubic-bezier(0.2, 0.8, 0.2, 1) forwards",
      },
      keyframes: {
        "pulse-soft": {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.5", transform: "scale(0.85)" },
        },
        reveal: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
