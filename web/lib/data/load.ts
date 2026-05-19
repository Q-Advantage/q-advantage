/**
 * Build-time data loader.
 *
 * Reads all results-*.json files from web/data/results/ (which is populated
 * by the `prebuild` script copying from ../benchmark/results/). Parses,
 * normalizes, and returns runs ordered newest-first.
 *
 * Filename patterns supported:
 *   results-YYYY-MM-DD.json              (legacy, pre-Day 15)
 *   results-YYYY-MM-DD-{short_sha}.json  (post-Day 15)
 *
 * This module is NOT safe for the browser — it uses node:fs. All callers
 * must be Server Components or build-time code.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type {
  BenchmarkResultFile,
  NormalizedAlgorithm,
  NormalizedRun,
} from "./types";
import { normalizeAlgorithm } from "./normalize";

const FILENAME_RE = /^results-(\d{4}-\d{2}-\d{2})(?:-([0-9a-f]{7,40}))?\.json$/;

/**
 * Directory the loader reads from. Resolved relative to the Next.js project
 * root (process.cwd() is the web/ dir during `next build`).
 */
function resultsDir(): string {
  return join(process.cwd(), "data", "results");
}

interface ParsedFilename {
  file_name: string;
  file_id: string;
  date_string: string;
  short_sha: string | null;
  is_legacy_filename: boolean;
}

function parseFilename(file_name: string): ParsedFilename | null {
  const match = file_name.match(FILENAME_RE);
  if (!match) return null;
  const [, date_string, short_sha] = match;
  return {
    file_name,
    file_id: file_name.replace(/\.json$/, ""),
    date_string,
    short_sha: short_sha ?? null,
    is_legacy_filename: short_sha === undefined,
  };
}

function loadOne(file_name: string): NormalizedRun | null {
  const parsed = parseFilename(file_name);
  if (!parsed) return null;

  const path = join(resultsDir(), file_name);
  const raw = readFileSync(path, "utf-8");
  const data = JSON.parse(raw) as BenchmarkResultFile;

  const algorithms: NormalizedAlgorithm[] = Object.entries(data.algorithms).map(
    ([key, raw_algo]) => normalizeAlgorithm(key, raw_algo),
  );

  const algorithms_by_id: Record<string, NormalizedAlgorithm> = {};
  for (const a of algorithms) algorithms_by_id[a.id] = a;

  return {
    ...parsed,
    full_sha: data.environment.git_commit,
    timestamp: new Date(data.environment.iso_timestamp),
    environment: data.environment,
    runtime_metrics: data.runtime_metrics ?? null,
    is_legacy_schema: !data.runtime_metrics,
    algorithms,
    algorithms_by_id,
  };
}

/**
 * Load all benchmark runs. Cached for the duration of the build (the loader
 * is called multiple times — once per page that renders dashboard data).
 */
let _cache: NormalizedRun[] | null = null;

export function loadAllRuns(): NormalizedRun[] {
  if (_cache) return _cache;

  let files: string[];
  try {
    files = readdirSync(resultsDir());
  } catch (err) {
    throw new Error(
      `Cannot read benchmark results from ${resultsDir()}. ` +
        `Did the prebuild script run? Original error: ${(err as Error).message}`,
    );
  }

  const runs: NormalizedRun[] = [];
  for (const f of files) {
    if (!f.endsWith(".json")) continue;
    const run = loadOne(f);
    if (run) runs.push(run);
  }

  // Newest first — sort by timestamp, not filename, because same-day reruns
  // (new filename pattern) need to order correctly.
  runs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  if (runs.length === 0) {
    throw new Error(
      `No valid result files found in ${resultsDir()}. Expected at least one ` +
        `file matching results-YYYY-MM-DD.json or results-YYYY-MM-DD-{sha}.json`,
    );
  }

  _cache = runs;
  return runs;
}

export function getLatestRun(): NormalizedRun {
  return loadAllRuns()[0];
}

export function getRunBySha(short_or_full_sha: string): NormalizedRun | null {
  const runs = loadAllRuns();
  return (
    runs.find(
      (r) =>
        r.full_sha === short_or_full_sha ||
        r.full_sha.startsWith(short_or_full_sha) ||
        r.short_sha === short_or_full_sha,
    ) ?? null
  );
}

/**
 * Returns the historical series for a single algorithm + operation,
 * ordered oldest-first (suitable for sparklines).
 */
export interface HistoricalPoint {
  run: NormalizedRun;
  mean_us: number;
  p95_us: number;
  ops_per_sec: number;
}

export function getAlgorithmHistory(
  algorithm_id: string,
  operation: "keygen" | "encap" | "decap" | "sign" | "verify",
): HistoricalPoint[] {
  const runs = loadAllRuns();
  const out: HistoricalPoint[] = [];
  for (const run of runs) {
    const algo = run.algorithms_by_id[algorithm_id];
    if (!algo) continue;
    const op = algo.operations[operation];
    if (!op) continue;
    out.push({
      run,
      mean_us: op.mean_us,
      p95_us: op.p95_us,
      ops_per_sec: op.ops_per_sec,
    });
  }
  // Oldest first for sparkline left-to-right reading
  return out.reverse();
}
