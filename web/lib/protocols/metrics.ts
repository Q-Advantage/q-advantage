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

import type { AesBaselineRecord, ProtocolsData, TimingBlock } from "./types";

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
