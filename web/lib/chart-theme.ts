/**
 * Chart colours, resolved through theme tokens.
 *
 * Recharts wants concrete colour strings for SVG `fill` / `stroke`, which is
 * why chart internals historically ended up holding hex literals — and why
 * every one of them silently assumed a dark background. CSS custom properties
 * work fine in SVG paint attributes, so the strings below stay live: they
 * re-resolve when `data-theme` changes, with no re-render and no JS.
 *
 * Every chart in the app reads from here. If a chart needs a colour that
 * isn't in this file, the answer is a new token, not a literal.
 */

/** Series identity is stable across themes — series 1 is always series 1. */
export const SERIES = [
  "rgb(var(--color-series-1))",
  "rgb(var(--color-series-2))",
  "rgb(var(--color-series-3))",
  "rgb(var(--color-series-4))",
  "rgb(var(--color-series-5))",
  "rgb(var(--color-series-6))",
] as const;

export function seriesColor(i: number): string {
  return SERIES[i % SERIES.length];
}

export const CHART = {
  /** Interior gridlines — present enough to read against, quiet enough to ignore. */
  grid: "rgb(var(--color-chart-grid) / 0.26)",
  /** Axis lines sit a step stronger than the grid. */
  axis: "rgb(var(--color-chart-grid) / 0.42)",
  /** Axis labels. */
  tick: "rgb(var(--color-chart-tick))",
  /** Hover band behind the focused category. */
  cursor: "rgb(var(--color-chart-grid) / 0.10)",
  tooltipBg: "rgb(var(--color-bg-elevated))",
  tooltipBorder: "rgb(var(--color-chart-grid) / 0.35)",
  tooltipFg: "rgb(var(--color-fg))",
  /**
   * One face across the whole site, charts included. This previously pointed
   * at `--font-geist-mono`, which no longer exists — the ticks were falling
   * back to a browser default.
   */
  font: "var(--font-sans)",
} as const;
