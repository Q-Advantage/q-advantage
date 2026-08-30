// web/lib/protocols/anomaly.ts
//
// A structural-validity gate on composed-suite comparisons.
//
// WHY THIS EXISTS. On 2026-08-29 the committed record served
// `SecP256r1MLKEM768` at −19.4% against the X25519 baseline: the site was
// telling readers that a P-256 + ML-KEM-768 hybrid handshake is 19% FASTER
// than doing a classical key exchange alone. A hybrid suite performs a
// classical exchange AND a KEM exchange, so that is not a surprising result,
// it is an impossible one.
//
// The cause is not the comparison — metrics.ts already recomputes it same-run,
// which fixed the 2026-08-16 cross-pass bug. The cause is that the BASELINE
// ITSELF was measured in a degraded mode inside that same run. From 2026-08-17
// the x86 host's X25519 floor became bimodal: `min_us` sat at 160.2–160.8 µs
// every day for the previous 68 runs, then began alternating between ~161 µs
// and ~186–193 µs. Steal time does not explain it — the affected runs report
// 0.0–0.5% steal while several unaffected runs report 3–4%. Same-run
// recomputation cannot save a comparison whose denominator is wrong.
//
// So this module does not try to correct the number. It refuses to publish it.
// A suite whose comparison is structurally impossible is surfaced as a labelled
// anomaly with its own figures shown, never as a green "faster than classical"
// stat. That is the same posture the rest of this codebase already takes toward
// absent data: say what is wrong, never render a number that cannot be true.
//
// Pure projection of committed measurements. No result file is read or written
// here, and nothing is interpolated, smoothed, or suppressed silently.

import type { ComposedSuite } from "./types";
import { vsBaselinePct } from "./metrics";

export type SuiteAnomalyKind = "hybrid-faster-than-classical";

export interface SuiteAnomaly {
  kind: SuiteAnomalyKind;
  /** Suite whose published comparison is not trustworthy. */
  suite: string;
  /** The classical baseline it was compared against, from the same file. */
  baselineSuite: string;
  suiteMedianUs: number;
  baselineMedianUs: number;
  /** The impossible figure, kept so the anomaly can be reported precisely. */
  pct: number;
  /** Reader-facing explanation. Stated plainly, no jargon, no blame-shifting. */
  reason: string;
}

/**
 * A hybrid suite carries both a KEM phase and a classical phase.
 *
 * Detected from the measured `phases` block rather than by parsing the suite
 * name, because the name is a wire-format identifier that can change and the
 * phase block is what the harness actually measured. Pure-PQC suites are
 * legitimately faster than a classical baseline — ML-KEM-768 beats X25519 by
 * roughly 60%, which is one of this product's own published findings — so this
 * predicate must never widen to include them.
 */
export function isHybridSuite(suite: ComposedSuite): boolean {
  const phases = suite.phases ?? {};
  const keys = Object.keys(phases);
  return keys.some((k) => k.startsWith("kem_")) && keys.some((k) => k.startsWith("classical_"));
}

/**
 * Returns the anomaly when a suite's same-run comparison is structurally
 * impossible, otherwise null.
 *
 * Only one kind is detected today. The shape is an enum rather than a boolean
 * so a second structural check can be added without changing every caller.
 */
export function detectSuiteAnomaly(
  suite: ComposedSuite,
  suitesInSameFile: Record<string, ComposedSuite> | undefined,
): SuiteAnomaly | null {
  if (!isHybridSuite(suite)) return null;

  const baselineName = suite.baseline?.baseline_suite;
  if (!baselineName || !suitesInSameFile) return null;

  const baselineMedian = suitesInSameFile[baselineName]?.timing?.median_us;
  const median = suite.timing?.median_us;
  if (baselineMedian == null || median == null) return null;
  if (!Number.isFinite(baselineMedian) || !Number.isFinite(median)) return null;
  if (baselineMedian <= 0) return null;

  if (median > baselineMedian) return null;

  const pct = vsBaselinePct(suite, suitesInSameFile);
  if (pct == null) return null;

  return {
    kind: "hybrid-faster-than-classical",
    suite: suite.identity.suite,
    baselineSuite: baselineName,
    suiteMedianUs: median,
    baselineMedianUs: baselineMedian,
    pct,
    reason:
      `${suite.identity.suite} performs a classical key exchange and a KEM exchange, so it cannot ` +
      `be faster than ${baselineName} alone. This run measured it at ${median.toFixed(1)} µs ` +
      `against a ${baselineName} baseline of ${baselineMedian.toFixed(1)} µs, which means the ` +
      `baseline was measured in a degraded mode in this run, not that the hybrid is cheap. The ` +
      `comparison is withheld rather than published; the suite's own timing is still shown.`,
  };
}

/** Every structurally impossible comparison in one file's suite set. */
export function detectFileAnomalies(
  suites: Record<string, ComposedSuite> | undefined,
): SuiteAnomaly[] {
  if (!suites) return [];
  const out: SuiteAnomaly[] = [];
  for (const suite of Object.values(suites)) {
    const a = detectSuiteAnomaly(suite, suites);
    if (a) out.push(a);
  }
  return out;
}

/**
 * The comparison figure a UI is allowed to render: the same-run recomputation,
 * or null when that comparison is structurally impossible.
 *
 * Every rendering surface must use this, not `vsBaselinePct` directly.
 * `vsBaselinePct` remains the raw projection for analysis and for the smoke
 * tests that need to see the bad value in order to report it.
 */
export function publishableVsBaselinePct(
  suite: ComposedSuite,
  suitesInSameFile: Record<string, ComposedSuite> | undefined,
): number | null {
  if (detectSuiteAnomaly(suite, suitesInSameFile)) return null;
  return vsBaselinePct(suite, suitesInSameFile);
}
