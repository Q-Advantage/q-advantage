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
 *  - Near-black background; near-white text; muted neutral borders.
 *  - GREEN accent (#4ADE80) for: chart highlights, hover states, "latest run"
 *    pills, brand mark, primary CTAs, live pulses. NOT for body chrome.
 *  - Data palette: sequential teal/blue ramp for chart series (multi-series).
 *  - Status colors: green/amber/red, used sparingly in the audit strip.
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
        // Surface ramp
        bg: {
          DEFAULT: "#0a0a0b",
          surface: "#111114",
          card: "#0e0e11",
          elevated: "#17171a",
          inset: "#08080a",
        },
        // Foreground ramp
        fg: {
          DEFAULT: "#ededed",
          muted: "#a1a1a6",
          subtle: "#6b6b72",
          faint: "#404048",
        },
        // Border ramp — tuned to marketing site's tokens
        border: {
          DEFAULT: "rgba(255, 255, 255, 0.08)",
          strong: "rgba(255, 255, 255, 0.14)",
          subtle: "rgba(255, 255, 255, 0.04)",
        },
        // Brand accent — Q-Advantage green
        accent: {
          DEFAULT: "#4ade80",
          dim: "#2d9d5f",
          glow: "rgba(74, 222, 128, 0.4)",
          soft: "rgba(74, 222, 128, 0.08)",
        },
        // Data viz palette — sequential teal/blue ramp for chart series.
        data: {
          1: "#7cd4d4",
          2: "#4fb3c4",
          3: "#2a8aae",
          4: "#1f5f8a",
          5: "#173f66",
        },
        // Status colors
        status: {
          ok: "#4ade80",
          warn: "#fbbf24",
          err: "#f87171",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        serif: ["var(--font-serif)", "ui-serif", "Georgia", "serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
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
