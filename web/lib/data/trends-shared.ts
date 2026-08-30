// web/lib/data/trends-shared.ts
//
// Types and pure helpers for the historical series.
//
// Split out of trends.ts because the chart is a client component: trends.ts
// imports the run loader, which reads the filesystem, and pulling that into the
// browser bundle fails the build. Anything both sides need lives here.
//
// The rule this module exists to enforce: **measured points only**. There is
// no value between two runs. If a run is missing — the box was down, a scheme
// was not yet tracked, a build failed — the series has a hole, and the hole
// stays. Nothing here fills, smooths, carries forward, or resamples.
//
// That is the deliberate difference from how other benchmark publishers build
// this view. InferenceX's historical trends are explicitly "interpolated
// performance metrics over time"; under CLAUDE.md guardrail 1 an interpolated
// figure is an authored number, so ours are not. A reader who wants a value
// between two of our runs is told we do not have one.

import type { NormalizedAlgorithm } from "./types";

/** Hues are assigned in fixed order and never cycled, so the chart caps here. */
export const MAX_SERIES = 4;

export const RANGES = [
  { id: "30", label: "30 days", days: 30 },
  { id: "90", label: "90 days", days: 90 },
  { id: "all", label: "All", days: null as number | null },
] as const;

export type RangeId = (typeof RANGES)[number]["id"];

export interface TrendPoint {
  date: string;
  commit: string;
  run_url: string;
  value: number;
  /**
   * Hardware era this point was measured on (lib/data/hosts.ts). Points in
   * different eras came off different machines: a chart must break the line
   * between them rather than draw a step change as though it were a trend.
   */
  era_id: string;
}

export interface TrendSeries {
  id: string;
  label: string;
  family: NormalizedAlgorithm["family"];
  points: TrendPoint[];
  /** Runs in range where this algorithm/operation had no measurement. */
  gaps: number;
  /** Observed extremes across the series — the context a change figure needs. */
  min: number;
  max: number;
}

/** A hardware change falling inside the rendered range. */
export interface TrendBreak {
  /** First date measured on the new hardware — where the line stops. */
  date: string;
  fromLabel: string;
  toLabel: string;
  note: string;
}

export interface TrendsResult {
  series: TrendSeries[];
  metricLabel: string;
  unit: string;
  /** Every run date in range, oldest first — the x domain. */
  dates: string[];
  runsInRange: number;
  /** Ids requested that had no data at all, so the UI can name them. */
  empty: string[];
  /**
   * Hardware changes inside the range. Non-empty means no single line spans
   * the whole chart, and every change figure must be read per era.
   */
  breaks: TrendBreak[];
}

export function rangeDays(id: string): number | null {
  return RANGES.find((r) => r.id === id)?.days ?? null;
}

/**
 * Change across a series, first measured point to last.
 *
 * Returns null for a single-point series: one measurement is not a trend, and
 * rendering "0%" would assert stability we did not observe.
 *
 * Read this next to `spreadPct`. Some series on this hardware are bimodal
 * rather than drifting — ML-KEM-768 keygen alternates between roughly 19 µs
 * and 32 µs from run to run — and for those, first-to-last says only which
 * mode each endpoint happened to land in. It is not a trend, and the UI must
 * not present it as one on its own.
 */
export function seriesChangePct(s: TrendSeries): number | null {
  if (s.points.length < 2) return null;
  const first = s.points[0].value;
  const last = s.points[s.points.length - 1].value;
  if (first <= 0) return null;
  return ((last - first) / first) * 100;
}

/**
 * Observed spread as a percentage of the minimum.
 *
 * The honest companion to a change figure: when the spread dwarfs the change,
 * the change is noise. Pure description of what was measured — no model, no
 * distributional assumption.
 */
export function spreadPct(s: TrendSeries): number | null {
  if (s.points.length < 2 || s.min <= 0) return null;
  return ((s.max - s.min) / s.min) * 100;
}
