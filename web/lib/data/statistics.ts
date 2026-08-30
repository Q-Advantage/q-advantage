// web/lib/data/statistics.ts
//
// Confidence intervals over measurements already committed.
//
// WHY THIS IS WORTH HAVING. `qshield-update-spec.md` §14 names the gap: the
// harness records mean, median, p95, p99, stdev, min, max and n for every
// operation — real rigour, underused. What gets published is a mean next to a
// stdev, and those two invite the wrong arithmetic.
//
// `stdev_us` describes how far individual samples scatter. On this host that
// number is large and mostly describes the machine, not the algorithm. A
// reader comparing two algorithms needs something different: how precisely the
// **mean itself** is pinned down. That is the standard error, and it shrinks
// with sqrt(n) — at n=1000 it is roughly 3% of the stdev.
//
// The whole thing is derivable from fields every committed run already carries,
// so this applies to the entire historical record without a single new
// measurement. Nothing here is a new number in the guardrail-1 sense: it is
// arithmetic over committed measurements, the same category as
// `vsBaselinePct`.

/** 1.96σ. Normal approximation — sound for the mean at n in the hundreds. */
export const Z_95 = 1.959964;

export interface ConfidenceInterval {
  low: number;
  high: number;
  stdError: number;
  /** Half-width as a percentage of the mean — the "±x%" a reader wants. */
  relativeMarginPct: number;
  n: number;
}

export interface StatInput {
  mean_us?: number | null;
  stdev_us?: number | null;
  n_iterations?: number | null;
}

/**
 * A 95% interval on the mean, or null when the inputs cannot support one.
 *
 * Returns null rather than a degenerate zero-width interval when n < 2: one
 * measurement has no interval, and rendering `x ± 0` would read as certainty
 * rather than as absence of evidence.
 */
export function confidenceInterval(stat: StatInput | null | undefined): ConfidenceInterval | null {
  if (!stat) return null;
  const { mean_us: mean, stdev_us: stdev, n_iterations: n } = stat;
  if (mean == null || stdev == null || n == null) return null;
  if (!Number.isFinite(mean) || !Number.isFinite(stdev) || !Number.isFinite(n)) return null;
  if (n < 2 || mean <= 0 || stdev < 0) return null;

  const stdError = stdev / Math.sqrt(n);
  const margin = Z_95 * stdError;
  return {
    low: mean - margin,
    high: mean + margin,
    stdError,
    relativeMarginPct: (margin / mean) * 100,
    n,
  };
}

/**
 * Whether two measured means are separated by more than their intervals.
 *
 * THE POINT OF THIS FUNCTION. Q-Shield publishes comparisons — "A is X% faster
 * than B" — and on a host with this much run-to-run movement some of those
 * differences are not distinguishable from noise. Overlapping 95% intervals
 * are the honest signal that a difference should not be quoted as a finding.
 *
 * Deliberately conservative: non-overlapping intervals is a stricter bar than
 * a two-sample t-test, so this errs toward calling a real difference
 * "indistinguishable" rather than the reverse. Under-claiming is the failure
 * mode this product can afford.
 *
 * Returns null when either side lacks the fields to judge — never `false`,
 * which a caller would reasonably read as "they overlap".
 */
export function separatedBeyondNoise(
  a: StatInput | null | undefined,
  b: StatInput | null | undefined,
): boolean | null {
  const ia = confidenceInterval(a);
  const ib = confidenceInterval(b);
  if (!ia || !ib) return null;
  return ia.high < ib.low || ib.high < ia.low;
}

export function formatInterval(ci: ConfidenceInterval | null, unit = "µs"): string {
  if (!ci) return "—";
  return `${ci.low.toFixed(2)}–${ci.high.toFixed(2)} ${unit}`;
}

/** The compact form: ±x% on the mean. */
export function formatRelativeMargin(ci: ConfidenceInterval | null): string {
  if (!ci) return "—";
  return `±${ci.relativeMarginPct.toFixed(2)}%`;
}

/**
 * The sentence to publish next to an interval.
 *
 * Written once, here, so no page can paraphrase it into the claim that the
 * interval predicts where the next sample will land.
 */
export const CI_MEANING =
  "A 95% confidence interval on the mean, not a prediction interval for a single operation. " +
  "It says how precisely the average is known from this run's samples; the standard deviation " +
  "says how much the individual samples scattered.";
