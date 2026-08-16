// web/lib/data/board-metrics.ts
//
// The metric axis for the algorithm board: what a reader can put on the
// x-axis, how each value is pulled off a measured record, and how it formats.
//
// Kept out of the component so the selection logic is testable and so no chart
// recomputes a metric inline. Every metric here is a direct read of a measured
// field or a ratio of two of them — nothing is modelled, estimated, or
// interpolated. A metric that cannot be computed for an algorithm returns null
// and that algorithm drops out of the chart with a stated reason, rather than
// being plotted at zero.

import type { NormalizedAlgorithm, Operation, OperationStats } from "./types";
import { formatBytes, formatDuration, formatOpsPerSec } from "../format";

export type MetricId =
  | "mean"
  | "median"
  | "p95"
  | "p99"
  | "max"
  | "tail"
  | "ops"
  | "pubkey"
  | "payload";

export interface MetricDef {
  id: MetricId;
  label: string;
  /** Axis unit, shown once on the axis rather than on every bar. */
  unit: string;
  /** True when a larger value is better — flips the "leader" wording only. */
  higherIsBetter: boolean;
  /** Whether the metric depends on the selected operation. */
  perOperation: boolean;
  format: (v: number) => string;
  /** Null when this algorithm has no measurement for the metric. */
  value: (algo: NormalizedAlgorithm, op: Operation) => number | null;
}

function stats(algo: NormalizedAlgorithm, op: Operation): OperationStats | undefined {
  return algo.operations[op];
}

/** max ÷ median — how far the worst observed run strays from the typical one. */
function tail(s: OperationStats | undefined): number | null {
  if (!s || s.median_us == null || s.max_us == null) return null;
  if (!Number.isFinite(s.median_us) || !Number.isFinite(s.max_us) || s.median_us <= 0) return null;
  return s.max_us / s.median_us;
}

export const METRICS: MetricDef[] = [
  {
    id: "mean",
    label: "Mean latency",
    unit: "µs",
    higherIsBetter: false,
    perOperation: true,
    format: formatDuration,
    value: (a, op) => stats(a, op)?.mean_us ?? null,
  },
  {
    id: "median",
    label: "Median latency",
    unit: "µs",
    higherIsBetter: false,
    perOperation: true,
    format: formatDuration,
    value: (a, op) => stats(a, op)?.median_us ?? null,
  },
  {
    id: "p95",
    label: "p95 latency",
    unit: "µs",
    higherIsBetter: false,
    perOperation: true,
    format: formatDuration,
    value: (a, op) => stats(a, op)?.p95_us ?? null,
  },
  {
    id: "p99",
    label: "p99 latency",
    unit: "µs",
    higherIsBetter: false,
    perOperation: true,
    format: formatDuration,
    value: (a, op) => stats(a, op)?.p99_us ?? null,
  },
  {
    id: "max",
    label: "Max latency",
    unit: "µs",
    higherIsBetter: false,
    perOperation: true,
    format: formatDuration,
    value: (a, op) => stats(a, op)?.max_us ?? null,
  },
  {
    id: "tail",
    label: "Tail (max ÷ median)",
    unit: "×",
    higherIsBetter: false,
    perOperation: true,
    format: (v) => `${v.toFixed(2)}×`,
    value: (a, op) => tail(stats(a, op)),
  },
  {
    id: "ops",
    label: "Throughput",
    unit: "ops/sec",
    higherIsBetter: true,
    perOperation: true,
    format: formatOpsPerSec,
    value: (a, op) => stats(a, op)?.ops_per_sec ?? null,
  },
  {
    id: "pubkey",
    label: "Public key size",
    unit: "bytes",
    higherIsBetter: false,
    perOperation: false,
    format: formatBytes,
    value: (a) => a.pubkey_bytes ?? null,
  },
  {
    id: "payload",
    label: "Signature / ciphertext size",
    unit: "bytes",
    higherIsBetter: false,
    perOperation: false,
    format: formatBytes,
    value: (a) => a.signature_bytes ?? a.ciphertext_bytes ?? null,
  },
];

export function getMetric(id: string | null | undefined): MetricDef {
  return METRICS.find((m) => m.id === id) ?? METRICS[0];
}

/** Operations actually measured across the given algorithms, in a stable order. */
export const OPERATION_ORDER: Operation[] = ["keygen", "sign", "verify", "encap", "decap"];

export function availableOperations(algos: NormalizedAlgorithm[]): Operation[] {
  return OPERATION_ORDER.filter((op) => algos.some((a) => a.operations[op]));
}

export interface BoardPoint {
  id: string;
  label: string;
  family: NormalizedAlgorithm["family"];
  /** "lattice" | "hash" — the categorical identity the colour encodes. */
  group: "lattice" | "hash";
  nistLevel: number;
  value: number;
  display: string;
  stats?: OperationStats;
}

/**
 * Build the plottable series.
 *
 * Algorithms with no value for the selected metric are returned separately in
 * `omitted` so the UI can name them. They are never plotted at zero — a
 * missing measurement drawn as a zero-length bar reads as "instant".
 */
export function buildBoard(
  algos: NormalizedAlgorithm[],
  metricId: string,
  op: Operation,
  groups: ReadonlySet<string>,
): { metric: MetricDef; points: BoardPoint[]; omitted: string[] } {
  const metric = getMetric(metricId);
  const points: BoardPoint[] = [];
  const omitted: string[] = [];

  for (const a of algos) {
    if (a.status !== "ok") continue;
    const group = a.family === "SLH-DSA" ? ("hash" as const) : ("lattice" as const);
    if (!groups.has(group)) continue;

    const v = metric.value(a, op);
    if (v == null || !Number.isFinite(v) || v <= 0) {
      omitted.push(a.display_name);
      continue;
    }

    points.push({
      id: a.id,
      label: a.display_name,
      family: a.family,
      group,
      nistLevel: a.nist_level,
      value: v,
      display: metric.format(v),
      stats: metric.perOperation ? stats(a, op) : undefined,
    });
  }

  points.sort((x, y) => (metric.higherIsBetter ? y.value - x.value : x.value - y.value));
  return { metric, points, omitted };
}

/**
 * Whether a log axis is warranted: the spread is wide enough that a linear
 * axis would render the small bars invisible.
 *
 * This is the default only. The reader can override it — the previous chart
 * applied the same heuristic silently, which meant the axis could change
 * under you with no way to tell or to stop it.
 */
export const LOG_SPREAD_THRESHOLD = 100;

export function suggestsLogScale(points: BoardPoint[]): boolean {
  if (points.length < 2) return false;
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  return min > 0 && max / min > LOG_SPREAD_THRESHOLD;
}
