// web/lib/calculator/model.ts
//
// The cost model. Pure arithmetic over measured inputs and cited defaults.
//
// This is the first surface in the repo that computes a number nobody
// measured. That is legitimate — it is arithmetic, and every input is either
// measured, cited, or supplied by the reader — but it earns its place only if
// the distinction stays visible. Hence `ScenarioResult.inputs`, which carries
// the provenance of every term into the UI so a reader can always see which
// half of the sum is measurement and which is assumption.
//
// What this deliberately does NOT do:
//   - interpolate between measured points (there is no value between two runs)
//   - model the TCP initial-window cliff as a step function (needs packet
//     capture; surfaced as a qualitative note instead)
//   - charge egress on inbound bytes (cloud egress bills outbound only)

import type { ComposedSuite } from "../protocols/types";
import { publishableVsBaselinePct } from "../protocols/anomaly";

/** Average days per month — 365.25/12. Stated rather than a magic 30. */
export const DAYS_PER_MONTH = 30.4375;

const US_PER_HOUR = 3_600_000_000; // µs in an hour
const BYTES_PER_GB = 1_000_000_000; // cloud pricing uses decimal GB

export interface ScenarioInputs {
  /** Full handshakes per second, before session reuse is applied. */
  handshakesPerSecond: number;
  /** 0–100. Resumed sessions skip the full handshake entirely. */
  sessionReusePct: number;
  vcpuHourUsd: number;
  egressGbUsd: number;
  /** Months to project over. */
  months: number;
}

export interface SuiteResult {
  name: string;
  /** Median handshake time, measured. */
  medianUs: number;
  bytesTotal: number | null;
  bytesOut: number | null;
  /** Percent over the classical baseline, recomputed same-run. */
  vsBaselinePct: number | null;
  /** Cost of THIS suite's handshakes over the horizon, absolute. */
  cpuUsd: number;
  egressUsd: number;
  totalUsd: number;
  /** Relative to the baseline suite's total. 1.00 for the baseline itself. */
  multiplier: number | null;
  isBaseline: boolean;
}

export interface ScenarioResult {
  suites: SuiteResult[];
  baselineName: string | null;
  /** Effective full handshakes per second after session reuse. */
  effectiveHandshakesPerSecond: number;
  /** Total handshakes over the horizon. */
  handshakesOverHorizon: number;
  /** The headline: delta of the most expensive selected suite vs baseline. */
  headline: {
    suiteName: string;
    deltaUsd: number;
    /** Share of the delta from CPU time vs bytes on the wire. 0–1. */
    cpuShare: number;
    egressShare: number;
  } | null;
}

/**
 * Handshakes that actually run a full key exchange.
 *
 * Session resumption skips it — this is the field the whole "session reuse
 * hides it, churn exposes it" dynamic controls, so it multiplies everything
 * downstream rather than being a cosmetic input.
 */
export function effectiveHandshakes(perSecond: number, reusePct: number): number {
  const clamped = Math.min(100, Math.max(0, reusePct));
  return Math.max(0, perSecond) * (1 - clamped / 100);
}

function suiteCost(
  suite: ComposedSuite,
  handshakes: number,
  inputs: ScenarioInputs,
): { cpuUsd: number; egressUsd: number } {
  const cpuHours = (suite.timing.median_us * handshakes) / US_PER_HOUR;

  // Egress bills OUTBOUND only. Charging bytes_total would roughly double the
  // egress term by billing the client's request as though we sent it.
  const bytesOut = suite.size?.bytes_server_to_client ?? 0;
  const egressGb = (bytesOut * handshakes) / BYTES_PER_GB;

  return {
    cpuUsd: cpuHours * inputs.vcpuHourUsd,
    egressUsd: egressGb * inputs.egressGbUsd,
  };
}

/**
 * Run the model over a set of measured suites.
 *
 * `suites` must be the record from a single result file — the baseline delta
 * is computed against a sibling in the same file, never across runs. Suites
 * with no measurement are omitted, never costed at zero.
 */
export function runScenario(
  selected: string[],
  allSuites: Record<string, ComposedSuite>,
  inputs: ScenarioInputs,
): ScenarioResult {
  const effPerSecond = effectiveHandshakes(inputs.handshakesPerSecond, inputs.sessionReusePct);
  const handshakes = effPerSecond * 60 * 60 * 24 * DAYS_PER_MONTH * inputs.months;

  // The baseline is whichever selected suite the harness names as one, or the
  // suite that is itself a baseline (classical). Never guessed from the name.
  let baselineName: string | null = null;
  for (const name of selected) {
    const s = allSuites[name];
    if (!s) continue;
    if (s.baseline?.baseline_suite == null) {
      baselineName = name;
      break;
    }
  }
  if (!baselineName) {
    const named = selected.map((n) => allSuites[n]?.baseline?.baseline_suite).find(Boolean);
    if (named && allSuites[named]) baselineName = named;
  }

  const baselineCost = baselineName
    ? suiteCost(allSuites[baselineName], handshakes, inputs)
    : null;
  const baselineTotal = baselineCost ? baselineCost.cpuUsd + baselineCost.egressUsd : null;

  const results: SuiteResult[] = [];
  for (const name of selected) {
    const suite = allSuites[name];
    if (!suite?.timing?.median_us) continue; // absent, never zero

    const { cpuUsd, egressUsd } = suiteCost(suite, handshakes, inputs);
    const totalUsd = cpuUsd + egressUsd;

    results.push({
      name,
      medianUs: suite.timing.median_us,
      bytesTotal: suite.size?.bytes_total ?? null,
      bytesOut: suite.size?.bytes_server_to_client ?? null,
      vsBaselinePct: publishableVsBaselinePct(suite, allSuites),
      cpuUsd,
      egressUsd,
      totalUsd,
      multiplier: baselineTotal && baselineTotal > 0 ? totalUsd / baselineTotal : null,
      isBaseline: name === baselineName,
    });
  }

  // Headline: the largest absolute delta against the baseline among the
  // non-baseline selections. Signed — a saving is a legitimate result, and
  // pure ML-KEM-768 genuinely is cheaper than X25519 on CPU time.
  let headline: ScenarioResult["headline"] = null;
  if (baselineCost && baselineTotal != null) {
    const contenders = results.filter((r) => !r.isBaseline);
    if (contenders.length > 0) {
      const top = contenders.reduce((a, b) =>
        Math.abs(b.totalUsd - baselineTotal) > Math.abs(a.totalUsd - baselineTotal) ? b : a,
      );
      const cpuDelta = top.cpuUsd - baselineCost.cpuUsd;
      const egressDelta = top.egressUsd - baselineCost.egressUsd;
      const magnitude = Math.abs(cpuDelta) + Math.abs(egressDelta);

      headline = {
        suiteName: top.name,
        deltaUsd: top.totalUsd - baselineTotal,
        cpuShare: magnitude > 0 ? Math.abs(cpuDelta) / magnitude : 0,
        egressShare: magnitude > 0 ? Math.abs(egressDelta) / magnitude : 0,
      };
    }
  }

  return {
    suites: results,
    baselineName,
    effectiveHandshakesPerSecond: effPerSecond,
    handshakesOverHorizon: handshakes,
    headline,
  };
}

export function formatUsd(v: number): string {
  const abs = Math.abs(v);
  const digits = abs >= 100 ? 0 : abs >= 1 ? 2 : 4;
  return `${v < 0 ? "−" : ""}$${abs.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

export function formatCount(v: number): string {
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return v.toFixed(0);
}
