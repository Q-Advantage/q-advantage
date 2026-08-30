// web/lib/data/hosts.ts
//
// The measurement host as a first-class dimension of the record.
//
// WHY THIS EXISTS. /methodology has promised this in prose since before the
// c7i migration was scheduled:
//
//   "when it does, this document will be updated, historical runs from the
//    burstable period will remain available, and the hardware change will be
//    explicitly dated. Results will not be silently migrated."
//
// No code implemented any part of that. The loader reads one flat directory
// and sorts by timestamp; buildTrends plots every run it finds as one
// continuous line. On the day benchmark.yml is repointed at the c7i runner,
// a ~2x step change would render as a performance trend, under a caveat still
// naming t3.medium's burstable throttling as the cause. The `burstable` pill
// in AuditStrip -- the only visual cue that anything changed -- would silently
// self-clear, because benchmark.py derives it from a `t3.` prefix test.
//
// An era is a maximal run of consecutive runs sharing one instance type.
//
// BOUNDARIES ARE DERIVED, NEVER AUTHORED. Nothing here hardcodes a cutover
// date. An era begins when `environment.ec2_instance_type` changes and ends
// when it changes again, read from the committed files themselves -- so the
// partition cannot drift from the data, and there is no date literal for
// guardrail 1 to catch. The only authored content is the display label and
// one-line note per instance type, below, which describe hardware rather than
// assert any measurement.

import type { NormalizedRun } from "./types";

export interface HostEra {
  /** Stable within a build: instance type plus the era's first date. */
  id: string;
  instanceType: string;
  /** Human label for the instance type; falls back to the raw string. */
  label: string;
  /** What a reader needs to know about this hardware. Empty when unknown. */
  note: string;
  /** Whether the instance class trades sustained performance for burst credits. */
  burstable: boolean;
  /** Inclusive date bounds, taken from the runs themselves. */
  firstDate: string;
  lastDate: string;
  /** Number of committed runs measured on this host. */
  runCount: number;
  cpuModels: string[];
}

/**
 * Authored display metadata, keyed by instance type. Describes hardware, not
 * results. An unknown instance type is not an error -- it renders under its own
 * raw name with no note, which is the honest default.
 */
const HOST_PROFILES: Record<string, { label: string; note: string; burstable: boolean }> = {
  "t3.medium": {
    label: "t3.medium",
    note:
      "Burstable instance class: CPU is guaranteed at a baseline and may burst above it while " +
      "credits last. Under sustained load with credits depleted the host throttles, which shows " +
      "up in the timings rather than in an error.",
    burstable: true,
  },
  "c7i.large": {
    label: "c7i.large",
    note:
      "Fixed-performance instance class on Sapphire Rapids. No burst credits, so sustained load " +
      "does not change the clock the way it can on a burstable host.",
    burstable: false,
  },
};

function profileFor(instanceType: string) {
  return (
    HOST_PROFILES[instanceType] ?? {
      label: instanceType,
      note: "",
      // Matches benchmark.py's own predicate rather than guessing.
      burstable: /^(t2|t3|t3a|t4g)\./.test(instanceType),
    }
  );
}

export const UNKNOWN_HOST = "unknown";

function instanceTypeOf(run: NormalizedRun): string {
  return run.environment?.ec2_instance_type?.trim() || UNKNOWN_HOST;
}

/**
 * Partition the record into hardware eras, oldest first.
 *
 * Accepts runs in any order and sorts defensively -- callers pass
 * `loadAllRuns()`, which is newest-first, and an off-by-one on that ordering
 * would silently invert every era boundary.
 */
export function deriveHostEras(runs: readonly NormalizedRun[]): HostEra[] {
  const ordered = [...runs].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  const eras: HostEra[] = [];
  for (const run of ordered) {
    const instanceType = instanceTypeOf(run);
    const current = eras[eras.length - 1];

    if (current && current.instanceType === instanceType) {
      current.lastDate = run.date_string;
      current.runCount += 1;
      const cpu = run.environment?.cpu_model;
      if (cpu && !current.cpuModels.includes(cpu)) current.cpuModels.push(cpu);
      continue;
    }

    const p = profileFor(instanceType);
    eras.push({
      id: `${instanceType}@${run.date_string}`,
      instanceType,
      label: p.label,
      note: p.note,
      burstable: p.burstable,
      firstDate: run.date_string,
      lastDate: run.date_string,
      runCount: 1,
      cpuModels: run.environment?.cpu_model ? [run.environment.cpu_model] : [],
    });
  }
  return eras;
}

/** Map from run file_id to era id, for tagging runs as they load. */
export function eraIdByRun(runs: readonly NormalizedRun[]): Map<string, string> {
  const ordered = [...runs].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  const out = new Map<string, string>();
  let currentType: string | null = null;
  let currentId = "";
  for (const run of ordered) {
    const t = instanceTypeOf(run);
    if (t !== currentType) {
      currentType = t;
      currentId = `${t}@${run.date_string}`;
    }
    out.set(run.file_id, currentId);
  }
  return out;
}

/** The era a run belongs to, or null when it is not in the supplied set. */
export function eraOf(run: NormalizedRun, eras: readonly HostEra[]): HostEra | null {
  return eras.find((e) => e.id === run.host_era_id) ?? null;
}

/** The era the record is currently measuring in. */
export function currentEra(eras: readonly HostEra[]): HostEra | null {
  return eras.length ? eras[eras.length - 1] : null;
}

/**
 * True when the record spans more than one hardware era -- i.e. any chart
 * drawing a line across it must break that line somewhere.
 */
export function hasHardwareTransition(eras: readonly HostEra[]): boolean {
  return eras.length > 1;
}

/**
 * A one-line, reader-facing statement of the transition between two eras.
 * Deliberately states only what the record shows: which hardware, on what
 * date. It makes no claim about the size or direction of the effect -- that is
 * what the calibration comparison is for, and asserting it here without the
 * measurement would be the exact thing this module exists to prevent.
 */
export function transitionNote(previous: HostEra, next: HostEra): string {
  return (
    `Measurement hardware changed on ${next.firstDate}: ${previous.label} -> ${next.label}. ` +
    `Runs either side of this point were measured on different machines and are not one series.`
  );
}
