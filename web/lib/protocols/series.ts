// web/lib/protocols/series.ts
//
// The classical-baseline delta as a series, not as one day's figure.
//
// WHY THIS EXISTS. Every page that showed "vs classical" rendered the newest
// run's same-run delta, and that figure moves by tens of percentage points from
// one run to the next with nothing on the page saying so. A reader who cited it
// one day would not find it the next. Work-order 027 sets the policy: the series
// is the headline and a single day never is -- median, range and n, with the
// newest run beside them as a dated point.
//
// Three rules this module holds, each tested:
//
//   * Never pool across hardware. A series is one host era: a maximal run of
//     consecutive runs sharing an instance type, derived from the records the
//     same way lib/data/hosts.ts derives them. A change of machine is not a
//     trend, and a median across two machines describes neither.
//   * The withholding gate still applies. A run whose comparison is
//     structurally impossible (anomaly.ts) contributes nothing to the median or
//     the range. It is counted, never averaged in.
//   * Too few runs is said, not papered over. Below MIN_SERIES_RUNS no range is
//     stated: the newest run is shown as what it is, one dated run, and the
//     previous host's series may sit beside it under its own name. The current
//     host never silently borrows the previous host's figure.
//
// Pure projection over committed measurements. Nothing is interpolated.

import type { ComposedSuite } from "./types";
import { publishableVsBaselinePct } from "./anomaly";
import { vsBaselinePct } from "./metrics";

/**
 * The fewest runs on one host before a median and range are published.
 *
 * One week of daily runs. Fewer than that and a "range" is mostly a statement
 * about which days happened to be sampled; the honest presentation is the
 * dated runs themselves and a plain count.
 */
export const MIN_SERIES_RUNS = 7;

/** Instance type for a run whose host could not be identified. */
export const UNKNOWN_INSTANCE = "unknown";

/** One committed composed-track result file, reduced to what a series needs. */
export interface ComposedRun {
  fileName: string;
  /** RFC 3339, from the file's environment block. */
  timestamp: string;
  commit: string;
  arch: string;
  instanceType: string;
  suites: Record<string, ComposedSuite>;
}

export interface DatedDelta {
  /** Null when this run's comparison was withheld. */
  pct: number | null;
  /** YYYY-MM-DD. */
  date: string;
  commit: string;
  withheld: boolean;
}

export interface DeltaSeries {
  suite: string;
  baselineSuite: string;
  arch: string;
  instanceType: string;
  /** Bounds of the host era, from its first and last run. */
  firstDate: string;
  lastDate: string;
  /** Runs whose comparison entered the median and range. */
  n: number;
  /** Runs on this host whose comparison was withheld as structurally impossible. */
  withheld: number;
  median: number | null;
  min: number | null;
  max: number | null;
  latest: DatedDelta;
  /** True once `n` reaches MIN_SERIES_RUNS. Below that no range is stated. */
  isSeries: boolean;
}

export interface DeltaSeriesPair {
  /** The host the record is measuring on now. Never substituted. */
  current: DeltaSeries | null;
  /** The host before it, kept separate and labelled. */
  previous: DeltaSeries | null;
}

function byTime(a: ComposedRun, b: ComposedRun): number {
  return Date.parse(a.timestamp) - Date.parse(b.timestamp);
}

/** Consecutive runs sharing an instance type, oldest era first. */
export function splitHostEras(runs: readonly ComposedRun[]): ComposedRun[][] {
  const eras: ComposedRun[][] = [];
  for (const run of [...runs].sort(byTime)) {
    const last = eras[eras.length - 1];
    if (last && last[0].instanceType === run.instanceType) last.push(run);
    else eras.push([run]);
  }
  return eras;
}

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function seriesForEra(era: readonly ComposedRun[], suiteName: string): DeltaSeries | null {
  const values: number[] = [];
  let withheld = 0;
  let latest: DatedDelta | null = null;
  let baselineSuite: string | null = null;

  for (const run of era) {
    const suite = run.suites[suiteName];
    const baseName = suite?.baseline?.baseline_suite;
    if (!suite || !baseName) continue;
    // No computable comparison in this file at all (baseline absent): the run
    // says nothing about the delta, so it is neither a value nor a withholding.
    if (vsBaselinePct(suite, run.suites) == null) continue;

    baselineSuite = baseName;
    const pct = publishableVsBaselinePct(suite, run.suites);
    if (pct == null) withheld += 1;
    else values.push(pct);
    latest = { pct, date: run.timestamp.slice(0, 10), commit: run.commit, withheld: pct == null };
  }

  if (!latest || !baselineSuite) return null;
  const first = era[0];
  const last = era[era.length - 1];
  return {
    suite: suiteName,
    baselineSuite,
    arch: first.arch,
    instanceType: first.instanceType,
    firstDate: first.timestamp.slice(0, 10),
    lastDate: last.timestamp.slice(0, 10),
    n: values.length,
    withheld,
    median: median(values),
    min: values.length ? Math.min(...values) : null,
    max: values.length ? Math.max(...values) : null,
    latest,
    isSeries: values.length >= MIN_SERIES_RUNS,
  };
}

/** The delta series for one suite on one architecture: current host and the one before. */
export function deltaSeries(
  runs: readonly ComposedRun[],
  arch: string,
  suiteName: string,
): DeltaSeriesPair {
  const eras = splitHostEras(runs.filter((r) => r.arch === arch));
  return {
    current: eras.length > 0 ? seriesForEra(eras[eras.length - 1], suiteName) : null,
    previous: eras.length > 1 ? seriesForEra(eras[eras.length - 2], suiteName) : null,
  };
}

/** Every suite with a comparison on this architecture, keyed by suite name. */
export function deltaSeriesBySuite(
  runs: readonly ComposedRun[],
  arch: string,
): Record<string, DeltaSeriesPair> {
  const names = new Set<string>();
  for (const r of runs) if (r.arch === arch) for (const n of Object.keys(r.suites)) names.add(n);
  const out: Record<string, DeltaSeriesPair> = {};
  for (const name of names) {
    const pair = deltaSeries(runs, arch, name);
    if (pair.current || pair.previous) out[name] = pair;
  }
  return out;
}

/** The one number a sortable column orders by: the median once there is a series, else the newest run. */
export function primaryPct(pair: DeltaSeriesPair | null | undefined): number | null {
  const s = pair?.current;
  if (!s) return null;
  return s.isSeries ? s.median : s.latest.pct;
}

export function formatSignedPct(pct: number): string {
  return `${pct < 0 ? "−" : "+"}${Math.abs(pct).toFixed(1)}%`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * "2026-09-14" → "14 Sep 2026".
 *
 * Deliberately not Intl. These strings render on the server and again inside
 * client components, and locale data differs between runtimes -- Node formats
 * en-GB September as "Sept" -- so an Intl date would not match on hydration.
 */
export function formatDay(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd);
  const month = m ? MONTHS[Number(m[2]) - 1] : undefined;
  if (!m || !month) return "date unknown";
  return `${Number(m[3])} ${month} ${m[1]}`;
}

function hostLabel(instanceType: string): string {
  return instanceType === UNKNOWN_INSTANCE ? "an unidentified host" : instanceType;
}

export interface SeriesDisplay {
  /** The headline figure, or null when the only run on this host was withheld. */
  value: string | null;
  tone: "pos" | "neutral" | "mute";
  /** Small print under the figure: what it is, and the dated newest run. */
  lines: string[];
}

function runStamp(d: DatedDelta): string {
  return `${formatDay(d.date)} · ${d.commit.slice(0, 7)}`;
}

/**
 * How a "vs classical" cell reads. Null when the current host has no
 * comparison for this suite -- the caller renders its own baseline/em-dash.
 */
export function describeDeltaSeries(pair: DeltaSeriesPair | null | undefined): SeriesDisplay | null {
  const s = pair?.current;
  if (!s) return null;
  const l = s.latest;

  if (s.isSeries && s.median != null && s.min != null && s.max != null) {
    return {
      value: formatSignedPct(s.median),
      tone: s.median < 0 ? "pos" : "neutral",
      lines: [
        `median of ${s.n} runs · ${formatSignedPct(s.min)} to ${formatSignedPct(s.max)}`,
        l.pct == null ? `latest run withheld · ${runStamp(l)}` : `latest ${formatSignedPct(l.pct)} · ${runStamp(l)}`,
      ],
    };
  }

  const total = s.n + s.withheld;
  const count = `${total} run${total === 1 ? "" : "s"} on ${hostLabel(s.instanceType)} — too few for a range`;
  if (l.pct == null) {
    return { value: null, tone: "mute", lines: [`withheld · ${runStamp(l)}`, count] };
  }
  return {
    value: formatSignedPct(l.pct),
    tone: l.pct < 0 ? "pos" : "neutral",
    lines: [`one run · ${runStamp(l)}`, count],
  };
}

function rangeInWords(med: number, min: number, max: number, baseline: string): string {
  const pct = (x: number) => `${Math.abs(x).toFixed(1)}%`;
  if (max < 0) {
    return `a median ${pct(med)} faster than ${baseline}, and between ${pct(max)} and ${pct(min)} faster across those runs`;
  }
  if (min > 0) {
    return `a median ${pct(med)} slower than ${baseline}, and between ${pct(min)} and ${pct(max)} slower across those runs`;
  }
  return `a median of ${formatSignedPct(med)} against ${baseline}, and between ${formatSignedPct(min)} and ${formatSignedPct(max)} across those runs`;
}

/**
 * The sentence that explains a table of single dated runs, or null when the
 * current host already has a series and there is nothing to explain.
 *
 * States the current host's count plainly, and -- when the previous host has a
 * series of its own -- that series under the previous host's name, said to be a
 * different machine. It never presents the previous figure as describing the
 * current hardware.
 */
export function hostSeriesNote(
  pair: DeltaSeriesPair | null | undefined,
  suiteLabel: string,
  baselineLabel: string,
): string | null {
  const cur = pair?.current;
  if (!cur || cur.isSeries) return null;

  const total = cur.n + cur.withheld;
  const current =
    cur.instanceType === UNKNOWN_INSTANCE
      ? "The current host, which the record does not identify,"
      : `The current host, ${cur.instanceType},`;
  let text =
    `Timing comparisons are published as a median and range across runs on one machine. ` +
    `${current} has ${total} run${total === 1 ? "" : "s"} since ${formatDay(cur.firstDate)}, ` +
    `fewer than the ${MIN_SERIES_RUNS} a range needs, so each comparison shown here is a single dated run.`;

  const prev = pair?.previous;
  if (prev?.isSeries && prev.median != null && prev.min != null && prev.max != null) {
    text +=
      ` On the previous host, ${hostLabel(prev.instanceType)} (${prev.n} runs, ${formatDay(prev.firstDate)} ` +
      `to ${formatDay(prev.lastDate)}), ${suiteLabel} measured ` +
      `${rangeInWords(prev.median, prev.min, prev.max, baselineLabel)}. That was a different machine, ` +
      `so it is shown beside the new runs rather than combined with them.`;
  }
  return text;
}
