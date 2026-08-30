// web/lib/data/trends.ts
//
// Server-side construction of the historical series. Reads the committed runs
// from disk, so this module must never be imported by a client component —
// import from ./trends-shared instead.

import { loadAllRuns } from "./load";
import { deriveHostEras, transitionNote } from "./hosts";
import { getMetric, type MetricId } from "./board-metrics";
import type { NormalizedAlgorithm, Operation } from "./types";
import { githubChecksUrl } from "../format";
import {
  MAX_SERIES,
  rangeDays,
  type TrendBreak,
  type TrendPoint,
  type TrendSeries,
  type TrendsResult,
} from "./trends-shared";

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

  // Slice by CALENDAR DAYS, not by run count. These were the same number while
  // one host committed one run a day, and stop being the same the moment two
  // hosts commit in parallel -- "30 days" would silently become 15. The window
  // is measured back from the newest run in the record, not from today, so a
  // gap in the record does not shrink the window.
  let runs = all;
  if (days != null && all.length > 0) {
    const newest = all[all.length - 1].date_string;
    const cutoff = new Date(`${newest}T00:00:00Z`);
    cutoff.setUTCDate(cutoff.getUTCDate() - (days - 1));
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    runs = all.filter((r) => r.date_string >= cutoffStr);
  }

  // Hardware changes inside the rendered window. Derived from the runs in
  // range, so a transition outside the window is correctly absent.
  const erasInRange = deriveHostEras(runs);
  const breaks: TrendBreak[] = erasInRange.slice(1).map((era, i) => {
    const previous = erasInRange[i];
    return {
      date: era.firstDate,
      fromLabel: previous.label,
      toLabel: era.label,
      note: transitionNote(previous, era),
    };
  });

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
        era_id: run.host_era_id,
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
    breaks,
  };
}


/** Default selection: enough spread that the chart opens saying something. */
export function defaultSelection(algorithms: NormalizedAlgorithm[]): string[] {
  const sigs = algorithms.filter((a) => a.kind === "sig" && a.status === "ok");
  const kems = algorithms.filter((a) => a.kind === "kem" && a.status === "ok");
  return [...kems.slice(0, 2), ...sigs.slice(0, 2)].map((a) => a.id).slice(0, MAX_SERIES);
}
