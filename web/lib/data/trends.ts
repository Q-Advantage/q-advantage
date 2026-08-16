// web/lib/data/trends.ts
//
// Server-side construction of the historical series. Reads the committed runs
// from disk, so this module must never be imported by a client component —
// import from ./trends-shared instead.

import { loadAllRuns } from "./load";
import { getMetric, type MetricId } from "./board-metrics";
import type { NormalizedAlgorithm, Operation } from "./types";
import { githubChecksUrl } from "../format";
import { MAX_SERIES, rangeDays, type TrendPoint, type TrendSeries, type TrendsResult } from "./trends-shared";

export * from "./trends-shared";

/**
 * Build one series per requested algorithm.
 *
 * A run where the algorithm has no measurement contributes no point and
 * increments `gaps`. It never contributes a zero, and never inherits the
 * previous run's value.
 */
export function buildTrends(
  algorithmIds: string[],
  metricId: MetricId | string,
  op: Operation,
  range: string,
): TrendsResult {
  const metric = getMetric(metricId);
  const days = rangeDays(range);

  // loadAllRuns() is newest-first; charts read left-to-right in time.
  const all = [...loadAllRuns()].reverse();
  const runs = days == null ? all : all.slice(Math.max(0, all.length - days));

  const series: TrendSeries[] = [];
  const empty: string[] = [];

  for (const id of algorithmIds.slice(0, MAX_SERIES)) {
    const points: TrendPoint[] = [];
    let gaps = 0;
    let label = id;
    let family: NormalizedAlgorithm["family"] = "ML-KEM";

    for (const run of runs) {
      const algo = run.algorithms_by_id[id];
      if (!algo || algo.status !== "ok") {
        gaps++;
        continue;
      }
      label = algo.display_name;
      family = algo.family;

      const value = metric.value(algo, op);
      if (value == null || !Number.isFinite(value) || value <= 0) {
        gaps++;
        continue;
      }

      points.push({
        date: run.date_string,
        commit: run.full_sha,
        run_url: githubChecksUrl(run.full_sha),
        value,
      });
    }

    if (points.length === 0) {
      empty.push(label);
      continue;
    }
    const values = points.map((p) => p.value);
    series.push({
      id,
      label,
      family,
      points,
      gaps,
      min: Math.min(...values),
      max: Math.max(...values),
    });
  }

  return {
    series,
    metricLabel: metric.label,
    unit: metric.unit,
    dates: runs.map((r) => r.date_string),
    runsInRange: runs.length,
    empty,
  };
}


/** Default selection: enough spread that the chart opens saying something. */
export function defaultSelection(algorithms: NormalizedAlgorithm[]): string[] {
  const sigs = algorithms.filter((a) => a.kind === "sig" && a.status === "ok");
  const kems = algorithms.filter((a) => a.kind === "kem" && a.status === "ok");
  return [...kems.slice(0, 2), ...sigs.slice(0, 2)].map((a) => a.id).slice(0, MAX_SERIES);
}
