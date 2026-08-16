// web/lib/protocols/metrics.ts
//
// Metrics derived from measured timing blocks that no component read before
// work-order 008. Kept in their own module rather than appended to derive.ts
// so this phase does not collide with the stateful-sig helpers landing in
// that file on the work-order 003 branch.
//
// As with derive.ts: pure projections of committed measurements. Nothing here
// interpolates, estimates, or fills a gap — a metric that cannot be computed
// returns null and the UI renders an em-dash.

import type { AesBaselineRecord, ComposedSuite, ProtocolsData, TimingBlock } from "./types";

/**
 * max_us / median_us — how far the worst observed run strays from the typical
 * one.
 *
 * The number a capacity planner actually needs and the site has never shown:
 * X25519MLKEM768 sits at a 226 µs median against a 1198 µs max. Publishing
 * only the mean hides that entirely.
 *
 * Returns null rather than Infinity when median_us is 0, and null when either
 * field is missing — a suite that cannot express a real ratio must say so.
 */
export function tailRatio(t: TimingBlock | null | undefined): number | null {
  if (!t || t.median_us == null || t.max_us == null) return null;
  if (!Number.isFinite(t.median_us) || !Number.isFinite(t.max_us)) return null;
  if (t.median_us <= 0) return null;
  return t.max_us / t.median_us;
}

export function formatTailRatio(ratio: number | null): string {
  return ratio == null ? "—" : `${ratio.toFixed(2)}×`;
}

/**
 * Percentage a suite's median handshake runs over its classical baseline,
 * recomputed from the two suites **in the same file**.
 *
 * Do not use `suite.baseline.pct_over_classical`. That field is emitted by a
 * harness that measured the baseline in one pass and every suite in a second
 * pass, then compared across the two — so on a host with run-to-run variance
 * it compares different samples. Across the six runs to 2026-08-16 the stored
 * value ranged from +46.2% to −17.2% while the same files' own medians gave a
 * stable +36.5% to +46.2%, and on the two most recent runs the sign flipped:
 * the site published "−16.9%" in the good/green style, telling readers hybrid
 * post-quantum TLS is *faster* than classical. It is roughly 40% slower.
 *
 * Recomputing here is a pure projection of committed measurements — no result
 * file is touched — and it corrects every historical run at once, including
 * the ones already committed with the bad field. The harness itself is fixed
 * separately; that only helps runs from here on.
 *
 * Returns null when the suite is itself the baseline, when it names no
 * baseline, or when the named baseline is absent from the same file.
 */
export function vsBaselinePct(
  suite: ComposedSuite,
  suitesInSameFile: Record<string, ComposedSuite> | undefined,
): number | null {
  const baselineName = suite.baseline?.baseline_suite;
  if (!baselineName || !suitesInSameFile) return null;

  const baseline = suitesInSameFile[baselineName];
  const baselineMedian = baseline?.timing?.median_us;
  const median = suite.timing?.median_us;

  if (baselineMedian == null || median == null) return null;
  if (!Number.isFinite(baselineMedian) || !Number.isFinite(median)) return null;
  if (baselineMedian <= 0) return null;

  return ((median - baselineMedian) / baselineMedian) * 100;
}

/**
 * Why the published figure is not the one in the result file. Rendered next to
 * the column so a reader comparing the page against the raw JSON is not left
 * to wonder which is wrong.
 */
export const BASELINE_DELTA_NOTE =
  "Recomputed from the baseline suite measured in the same run. The " +
  "pct_over_classical field in the raw files compares across two measurement " +
  "passes and is unreliable on this host — see the methodology page.";

/**
 * AES-GCM baselines keyed by architecture, or `{}` when no aes-baseline file
 * has landed for any arch.
 *
 * Mirrors the discipline of hasLiveStatefulSigs: absence of data is a state to
 * be handled, not a crash and not something to paper over. This track has been
 * measuring cleanly since 2026-08-14 and reached no page until now.
 */
export function aesBaselinesByArch(data: ProtocolsData): Record<string, AesBaselineRecord> {
  const out: Record<string, AesBaselineRecord> = {};
  for (const [arch, bucket] of Object.entries(data.byArch)) {
    if (bucket.aes?.baseline) out[arch] = bucket.aes.baseline;
  }
  return out;
}
