// web/lib/protocols/history.ts
//
// Every committed composed-track run, not only the newest one.
//
// The manifest behind load.ts names one file per track and architecture, which
// is right for a page describing a run and wrong for a comparison that must be
// published as a series (work-order 027). scripts/copy-data.mjs mirrors
// benchmark/results/protocols into web/data/protocols-history at build time, so
// the series is computed from the committed record itself -- nothing is
// summarised ahead of time and nothing is authored.
//
// Build-time only (node:fs). What reaches a client component is the computed
// DeltaSeriesPair, which is plain data.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { loadAllRuns } from "@/lib/data/load";
import type { TLSComposedFile } from "./types";
import {
  deltaSeriesBySuite,
  UNKNOWN_INSTANCE,
  type ComposedRun,
  type DeltaSeriesPair,
} from "./series";

export type ComposedTrack = "tls" | "ssh" | "ipsec";

const FILENAME_RE = /^(tls|ssh|ipsec)-composed-\d{4}-\d{2}-\d{2}-[0-9a-f]+\.json$/;

function historyDir(): string {
  return join(process.cwd(), "data", "protocols-history");
}

/**
 * Which machine a composed file was measured on.
 *
 * Composed records carry `host.ec2_instance_type` from 2026-08-30. Earlier ones
 * do not, but the primitives run from the same workflow run -- same commit --
 * does, and the site already derives its hardware eras from that field. The
 * join is accepted only when both records name the same CPU model, so a file
 * measured on a different machine at the same commit cannot inherit a host it
 * never ran on. Anything unmatched is "unknown", which is its own era.
 */
function resolveInstanceType(
  file: TLSComposedFile,
  byCommit: Map<string, { instanceType: string; cpuModel: string }>,
): string {
  const suites = Object.values(file.suites ?? {});
  const recorded = suites.map((s) => s.host?.ec2_instance_type).find((t): t is string => Boolean(t));
  if (recorded) return recorded;

  const joined = byCommit.get(file.environment?.git_commit ?? "");
  const cpu = suites[0]?.host?.cpu_model;
  if (joined && cpu && joined.cpuModel === cpu) return joined.instanceType;
  return UNKNOWN_INSTANCE;
}

const cache = new Map<ComposedTrack, ComposedRun[]>();

export function loadComposedHistory(track: ComposedTrack): ComposedRun[] {
  const hit = cache.get(track);
  if (hit) return hit;

  const dir = historyDir();
  if (!existsSync(dir)) {
    throw new Error(
      `Cannot read composed-track history from ${dir}. Did the prebuild script (scripts/copy-data.mjs) run?`,
    );
  }

  const byCommit = new Map<string, { instanceType: string; cpuModel: string }>();
  for (const r of loadAllRuns()) {
    const instanceType = r.environment?.ec2_instance_type;
    if (instanceType) byCommit.set(r.full_sha, { instanceType, cpuModel: r.environment.cpu_model });
  }

  const runs: ComposedRun[] = [];
  for (const name of readdirSync(dir)) {
    const m = name.match(FILENAME_RE);
    if (!m || m[1] !== track) continue;
    const file = JSON.parse(readFileSync(join(dir, name), "utf8")) as TLSComposedFile;
    const first = Object.values(file.suites ?? {})[0];
    if (!first || !file.environment?.iso_timestamp) continue;
    runs.push({
      fileName: name,
      timestamp: file.environment.iso_timestamp,
      commit: file.environment.git_commit ?? "",
      arch: first.host?.arch ?? "unknown",
      instanceType: resolveInstanceType(file, byCommit),
      suites: file.suites,
    });
  }

  cache.set(track, runs);
  return runs;
}

/** The delta series for every suite of a track, by architecture then suite name. */
export function deltaSeriesByArch(track: ComposedTrack): Record<string, Record<string, DeltaSeriesPair>> {
  const runs = loadComposedHistory(track);
  const out: Record<string, Record<string, DeltaSeriesPair>> = {};
  for (const arch of new Set(runs.map((r) => r.arch))) out[arch] = deltaSeriesBySuite(runs, arch);
  return out;
}
