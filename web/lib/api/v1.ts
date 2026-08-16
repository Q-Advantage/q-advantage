// web/lib/api/v1.ts
//
// The public data API's response shapes, as pure projections of committed
// measurements.
//
// Two rules govern everything here:
//
//   1. Projection only. Every field is a direct read of a committed
//      measurement or a ratio of two of them via an existing derive function.
//      Nothing is interpolated, smoothed, estimated, or filled. Where a value
//      does not exist the field is null and stays null — an API that guesses
//      is worse than one that omits, because the consumer cannot tell.
//   2. Every row carries its provenance. `run_url` on every measurement points
//      at the GitHub Actions run that produced it. That is the entire product
//      claim, and it must survive the trip through the API.
//
// Shapes are versioned under /api/v1 and are a contract: add fields freely,
// never repurpose or silently drop one.

import { loadAllRuns, getLatestRun, type HistoricalPoint } from "../data/load";
import { loadProtocolsData } from "../protocols/load";
import { decomposePhases } from "../protocols/phases";
import { tailRatio } from "../protocols/metrics";
import { amplificationFactor } from "../protocols/derive";
import { githubChecksUrl, githubCommitUrl } from "../format";
import { OPERATION_ORDER } from "../data/board-metrics";
import type { NormalizedAlgorithm, NormalizedRun, Operation } from "../data/types";

export const API_VERSION = "1";

/** Provenance block attached to every measurement-bearing response. */
export interface RunRef {
  date: string;
  commit: string;
  /** The Actions run that produced these numbers. */
  run_url: string;
  commit_url: string;
  instance_type: string | null;
  cpu_model: string | null;
  liboqs_version: string | null;
  /** Percentage of wall clock the hypervisor took from us. Disclosed, not hidden. */
  cpu_steal_pct: number | null;
}

function stealPct(run: NormalizedRun): number | null {
  const m = run.runtime_metrics;
  if (!m || !m.wall_clock_seconds || m.cpu_steal_seconds == null) return null;
  if (m.wall_clock_seconds <= 0) return null;
  return (m.cpu_steal_seconds / m.wall_clock_seconds) * 100;
}

export function runRef(run: NormalizedRun): RunRef {
  return {
    date: run.date_string,
    commit: run.full_sha,
    run_url: githubChecksUrl(run.full_sha),
    commit_url: githubCommitUrl(run.full_sha),
    instance_type: run.environment.ec2_instance_type ?? null,
    cpu_model: run.environment.cpu_model ?? null,
    liboqs_version: run.environment.liboqs_version ?? null,
    cpu_steal_pct: stealPct(run),
  };
}

/** One algorithm's measurements within a run. */
function algorithmRow(a: NormalizedAlgorithm) {
  const ops: Record<string, unknown> = {};
  for (const op of OPERATION_ORDER) {
    const s = a.operations[op as Operation];
    if (!s) continue; // absent, not zero
    ops[op] = {
      mean_us: s.mean_us,
      median_us: s.median_us,
      p95_us: s.p95_us,
      p99_us: s.p99_us,
      stdev_us: s.stdev_us,
      min_us: s.min_us,
      max_us: s.max_us,
      ops_per_sec: s.ops_per_sec,
      n_iterations: s.n_iterations,
      tail_ratio: tailRatio(s),
    };
  }
  return {
    id: a.id,
    name: a.display_name,
    liboqs_key: a.liboqs_key,
    family: a.family,
    kind: a.kind,
    nist_level: a.nist_level,
    parameter_set: a.parameter_set,
    public_key_bytes: a.pubkey_bytes ?? null,
    private_key_bytes: a.privkey_bytes ?? null,
    ciphertext_bytes: a.ciphertext_bytes ?? null,
    signature_bytes: a.signature_bytes ?? null,
    status: a.status,
    operations: ops,
  };
}

export function runPayload(run: NormalizedRun) {
  return {
    api_version: API_VERSION,
    run: runRef(run),
    environment: {
      kernel: run.environment.kernel ?? null,
      os_release: run.environment.os_release ?? null,
      python_version: run.environment.python_version ?? null,
      liboqs_python_version: run.environment.liboqs_python_version ?? null,
      cpu_cores_logical: run.environment.cpu_cores_logical ?? null,
      cpu_cores_physical: run.environment.cpu_cores_physical ?? null,
      ram_total_gb: run.environment.ram_total_gb ?? null,
    },
    algorithms: run.algorithms.map(algorithmRow),
  };
}

/** Discovery: what can be asked for. Mirrors the shape of an availability call. */
export function availabilityPayload() {
  const runs = loadAllRuns();
  const latest = runs[0];
  const protocols = loadProtocolsData();

  const algorithms = latest.algorithms.map((a) => ({
    id: a.id,
    name: a.display_name,
    kind: a.kind,
    family: a.family,
    operations: OPERATION_ORDER.filter((op) => a.operations[op as Operation]),
  }));

  const tracks: string[] = [];
  for (const bucket of Object.values(protocols.byArch)) {
    if (bucket.tls) tracks.push("tls");
    if (bucket.ssh) tracks.push("ssh");
    if (bucket.sig) tracks.push("sig");
    if (bucket.aes) tracks.push("aes-baseline");
    if (bucket.lmsXmss) tracks.push("lms-xmss");
  }

  return {
    api_version: API_VERSION,
    runs: {
      count: runs.length,
      earliest: runs[runs.length - 1]?.date_string ?? null,
      latest: latest.date_string,
    },
    algorithms,
    operations: OPERATION_ORDER,
    protocol_tracks: [...new Set(tracks)].sort(),
    architectures: Object.keys(protocols.byArch).sort(),
    endpoints: [
      "/api/v1/availability",
      "/api/v1/latest",
      "/api/v1/runs",
      "/api/v1/runs/{date}",
      "/api/v1/algorithms/{id}/history",
      "/api/v1/protocols",
      "/api/v1/reliability",
    ],
  };
}

export function runsIndexPayload() {
  const runs = loadAllRuns();
  return {
    api_version: API_VERSION,
    count: runs.length,
    runs: runs.map((r) => ({
      ...runRef(r),
      algorithm_count: r.algorithms.length,
      href: `/api/v1/runs/${r.date_string}`,
    })),
  };
}

export function historyPayload(algorithmId: string) {
  const runs = loadAllRuns();
  const algo = runs.find((r) => r.algorithms_by_id[algorithmId])?.algorithms_by_id[algorithmId];
  if (!algo) return null;

  // Walk runs directly rather than via getAlgorithmHistory so the full timing
  // block travels, not just the three fields the sparkline needed.
  const series: Record<string, unknown[]> = {};
  for (const op of OPERATION_ORDER) {
    const points: unknown[] = [];
    for (const run of [...runs].reverse()) {
      const a = run.algorithms_by_id[algorithmId];
      const s = a?.operations[op as Operation];
      if (!s) continue;
      points.push({
        date: run.date_string,
        commit: run.full_sha,
        run_url: githubChecksUrl(run.full_sha),
        mean_us: s.mean_us,
        median_us: s.median_us,
        p95_us: s.p95_us,
        p99_us: s.p99_us,
        max_us: s.max_us,
        ops_per_sec: s.ops_per_sec,
        n_iterations: s.n_iterations,
      });
    }
    if (points.length > 0) series[op] = points;
  }

  return {
    api_version: API_VERSION,
    algorithm: {
      id: algo.id,
      name: algo.display_name,
      family: algo.family,
      kind: algo.kind,
      nist_level: algo.nist_level,
    },
    note:
      "Measured points only. There is no value between two runs — this series is not " +
      "interpolated and must not be resampled as though it were continuous.",
    series,
  };
}

export function protocolsPayload() {
  const data = loadProtocolsData();
  const byArch: Record<string, unknown> = {};

  for (const [arch, bucket] of Object.entries(data.byArch)) {
    const suites = (record: Record<string, import("../protocols/types").ComposedSuite> | undefined) =>
      Object.entries(record ?? {}).map(([name, s]) => {
        const phases = decomposePhases(s);
        return {
          suite: name,
          timing: s.timing,
          tail_ratio: tailRatio(s.timing),
          size: s.size ?? null,
          amplification_factor: amplificationFactor(s),
          baseline: s.baseline ?? null,
          phases: phases
            ? {
                composed_us: phases.composed_us,
                handshake_mean_us: phases.handshake_mean_us,
                residual_us: phases.residual_us,
                exact: phases.exact,
                entries: phases.phases.map((p) => ({
                  phase: p.key,
                  occurrences_per_handshake: p.occurrences,
                  contribution_us: p.contribution_us,
                  timing: p.timing,
                })),
              }
            : null,
          host: s.host ?? null,
          toolchain: s.toolchain ?? null,
          commit: s.audit?.git_commit ?? null,
          run_url: s.audit?.git_commit ? githubChecksUrl(s.audit.git_commit) : null,
        };
      });

    byArch[arch] = {
      tls: suites(bucket.tls?.suites),
      ssh: suites(bucket.ssh?.suites),
      signatures: bucket.sig?.schemes ?? null,
      aes_baseline: bucket.aes?.baseline ?? null,
      stateful_signatures: bucket.lmsXmss?.schemes ?? null,
    };
  }

  return {
    api_version: API_VERSION,
    manifest: data.manifest,
    note:
      "The handshake mean is composed, not timed end to end: it is the sum of the phase " +
      "measurements, with classical keygen and derive counted twice (both parties perform them). " +
      "`phases.exact` reports whether that identity currently holds.",
    by_architecture: byArch,
  };
}

/**
 * Measurement reliability: how many algorithm measurements succeeded per run,
 * and how much CPU the hypervisor took while they ran.
 *
 * Reported as counts (n/N), not just a percentage — a 100% success rate over
 * two runs and over ninety-four are different claims.
 */
export function reliabilityPayload() {
  const runs = loadAllRuns();
  const perRun = runs.map((r) => {
    const total = r.algorithms.length;
    const ok = r.algorithms.filter((a) => a.status === "ok").length;
    return {
      date: r.date_string,
      commit: r.full_sha,
      run_url: githubChecksUrl(r.full_sha),
      algorithms_measured: ok,
      algorithms_attempted: total,
      cpu_steal_pct: stealPct(r),
    };
  });

  const attempted = perRun.reduce((a, r) => a + r.algorithms_attempted, 0);
  const measured = perRun.reduce((a, r) => a + r.algorithms_measured, 0);
  const steals = perRun.map((r) => r.cpu_steal_pct).filter((v): v is number => v != null);

  return {
    api_version: API_VERSION,
    totals: {
      runs: runs.length,
      algorithms_measured: measured,
      algorithms_attempted: attempted,
      earliest: runs[runs.length - 1]?.date_string ?? null,
      latest: runs[0]?.date_string ?? null,
    },
    cpu_steal_pct: steals.length
      ? { max: Math.max(...steals), min: Math.min(...steals), runs_reporting: steals.length }
      : null,
    runs: perRun,
  };
}

export function latestPayload() {
  return runPayload(getLatestRun());
}

export type { HistoricalPoint };
