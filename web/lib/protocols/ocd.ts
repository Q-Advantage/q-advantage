// web/lib/protocols/ocd.ts
//
// Operating Cost Delta, per component and signed.
//
// WHY IT IS NEVER ONE NUMBER. `qshield-update-spec.md` §16.4.3 is emphatic, and
// the reason is specific to our own data rather than general caution:
//
//   Pure ML-KEM is FASTER than X25519 on CPU while being HEAVIER on the wire.
//
// Those two components have opposite signs. Any single blended "PQC costs X%
// more" figure has to pick a weighting between microseconds and bytes to
// collapse them — and whatever weighting it picks, it destroys the most
// interesting finding this product has. CFDIR itself notes costs may be
// negative; a model that cannot represent one cannot consume ours.
//
// So this module produces components with their signs intact and no total. A
// caller that wants a single number must supply its own prices, which is the
// TCM's job and not this layer's.

import type { ComposedSuite } from "./types";
import { vsBaselinePct } from "./metrics";
import { detectSuiteAnomaly } from "./anomaly";

export type ComponentDirection = "cost" | "saving" | "neutral";

export interface OcdComponent {
  /** Machine-readable component key: `cpu` or `bytes`. */
  component: "cpu" | "bytes";
  label: string;
  /** Signed. Negative means the post-quantum option is cheaper on this axis. */
  delta: number;
  unit: string;
  /** Signed relative change against the classical baseline, where meaningful. */
  deltaPct: number | null;
  direction: ComponentDirection;
}

export interface OperatingCostDelta {
  suite: string;
  baselineSuite: string;
  components: OcdComponent[];
  /**
   * True when the components disagree in sign — the case a blended figure
   * would erase, and the one worth surfacing on its own.
   */
  mixedSigns: boolean;
  /**
   * Deliberately absent. Present as a field so the omission is explicit rather
   * than looking like something nobody got round to.
   */
  blendedTotal: null;
  blendedTotalReason: string;
}

const BLENDED_REASON =
  "No blended total is emitted. The CPU and wire components can have opposite signs — pure ML-KEM " +
  "is faster than X25519 while being heavier on the wire — so collapsing them requires a price for " +
  "microseconds against bytes. That price belongs to whoever is doing the costing, not to the " +
  "measurement.";

function direction(delta: number): ComponentDirection {
  if (delta > 0) return "cost";
  if (delta < 0) return "saving";
  return "neutral";
}

/**
 * The per-component delta for one suite against its same-run classical baseline.
 *
 * Returns null when the comparison is unavailable or structurally impossible —
 * the anomaly gate applies here exactly as it does to the headline percentage,
 * because a cost model fed an impossible delta produces a confident wrong
 * answer rather than an obvious one.
 */
export function operatingCostDelta(
  suite: ComposedSuite,
  suitesInSameFile: Record<string, ComposedSuite> | undefined,
): OperatingCostDelta | null {
  const baselineName = suite.baseline?.baseline_suite;
  if (!baselineName || !suitesInSameFile) return null;

  const baseline = suitesInSameFile[baselineName];
  if (!baseline) return null;
  if (detectSuiteAnomaly(suite, suitesInSameFile)) return null;

  const cpuPct = vsBaselinePct(suite, suitesInSameFile);
  const suiteUs = suite.timing?.median_us;
  const baseUs = baseline.timing?.median_us;
  const suiteBytes = suite.size?.bytes_total;
  const baseBytes = baseline.size?.bytes_total;

  const components: OcdComponent[] = [];

  if (suiteUs != null && baseUs != null && Number.isFinite(suiteUs) && Number.isFinite(baseUs)) {
    const delta = suiteUs - baseUs;
    components.push({
      component: "cpu",
      label: "CPU per handshake",
      delta,
      unit: "µs",
      deltaPct: cpuPct,
      direction: direction(delta),
    });
  }

  if (
    suiteBytes != null &&
    baseBytes != null &&
    Number.isFinite(suiteBytes) &&
    Number.isFinite(baseBytes)
  ) {
    const delta = suiteBytes - baseBytes;
    components.push({
      component: "bytes",
      label: "Key-exchange payload on the wire",
      delta,
      unit: "B",
      deltaPct: baseBytes > 0 ? (delta / baseBytes) * 100 : null,
      direction: direction(delta),
    });
  }

  if (components.length === 0) return null;

  const signs = new Set(components.map((c) => c.direction).filter((d) => d !== "neutral"));

  return {
    suite: suite.identity.suite,
    baselineSuite: baselineName,
    components,
    mixedSigns: signs.size > 1,
    blendedTotal: null,
    blendedTotalReason: BLENDED_REASON,
  };
}

/**
 * Every suite in one file that has a baseline to compare against.
 *
 * The baseline suite itself is excluded: comparing it to itself would emit a
 * row of zeroes that reads as a measured finding.
 */
export function fileOperatingCostDeltas(
  suites: Record<string, ComposedSuite> | undefined,
): OperatingCostDelta[] {
  if (!suites) return [];
  const out: OperatingCostDelta[] = [];
  for (const suite of Object.values(suites)) {
    const d = operatingCostDelta(suite, suites);
    if (d) out.push(d);
  }
  return out;
}

/**
 * The finding worth leading with: a suite whose components disagree in sign.
 *
 * This is what a blended number would hide, so it gets its own accessor rather
 * than being left for a component to notice.
 */
export function mixedSignDeltas(deltas: OperatingCostDelta[]): OperatingCostDelta[] {
  return deltas.filter((d) => d.mixedSigns);
}

export function formatSignedDelta(c: OcdComponent): string {
  const sign = c.delta > 0 ? "+" : c.delta < 0 ? "−" : "";
  const magnitude = Math.abs(c.delta);
  const rendered = c.unit === "B" ? magnitude.toLocaleString() : magnitude.toFixed(1);
  return `${sign}${rendered} ${c.unit}`;
}
