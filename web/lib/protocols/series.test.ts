import { describe, expect, it } from "vitest";
import {
  MIN_SERIES_RUNS,
  UNKNOWN_INSTANCE,
  deltaSeries,
  deltaSeriesBySuite,
  describeDeltaSeries,
  formatDay,
  hostSeriesNote,
  median,
  primaryPct,
  splitHostEras,
  type ComposedRun,
} from "./series";
import type { ComposedSuite, TimingBlock } from "./types";

// Sentinel discipline: every timing here is obviously fake. The baseline sits
// at 9999 µs and the suites at single-digit µs, so every delta is a -99.9x%
// figure no reader could mistake for a measurement.
const BASE_US = 9999;

function timing(median_us: number): TimingBlock {
  return {
    mean_us: median_us, median_us, p95_us: median_us, p99_us: median_us,
    stdev_us: 0, min_us: median_us, max_us: median_us, ops_per_sec: 1, n_iterations: 1,
  };
}

function suite(name: string, median_us: number, kind: "classical" | "pure" | "hybrid", baselineOf?: string): ComposedSuite {
  const phases: Record<string, TimingBlock> = {};
  if (kind !== "classical") phases.kem_keygen = timing(1);
  if (kind !== "pure") phases.classical_keygen = timing(1);
  return {
    identity: { protocol: "tls", mode: "composed", suite: name },
    timing: timing(median_us),
    phases,
    ...(baselineOf ? { baseline: { baseline_suite: baselineOf, pct_over_classical: 9999 } } : {}),
  } as ComposedSuite;
}

/** One fake run. `pureUs` / `hybridUs` null means that suite is absent from the file. */
function run(
  day: number,
  instanceType: string,
  opts: { pureUs?: number | null; hybridUs?: number | null; arch?: string } = {},
): ComposedRun {
  const suites: Record<string, ComposedSuite> = { BASE: suite("BASE", BASE_US, "classical") };
  if (opts.pureUs !== null) suites.PURE = suite("PURE", opts.pureUs ?? 1, "pure", "BASE");
  if (opts.hybridUs != null) suites.HYB = suite("HYB", opts.hybridUs, "hybrid", "BASE");
  const dd = String(day).padStart(2, "0");
  return {
    fileName: `tls-composed-2026-01-${dd}-fake.json`,
    timestamp: `2026-01-${dd}T06:00:00Z`,
    commit: `fake${dd}`.padEnd(40, "0"),
    arch: opts.arch ?? "x86_64",
    instanceType,
    suites,
  };
}

const pct = (us: number) => ((us - BASE_US) / BASE_US) * 100;

describe("median", () => {
  it("handles odd and even counts and refuses an empty set", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBeNull();
  });
});

describe("splitHostEras", () => {
  it("splits on instance type and orders by time regardless of input order", () => {
    const eras = splitHostEras([run(3, "new"), run(1, "old"), run(2, "old")]);
    expect(eras.map((e) => e.map((r) => r.instanceType))).toEqual([["old", "old"], ["new"]]);
  });
});

describe("deltaSeries", () => {
  it("never pools runs across hosts", () => {
    const runs = [
      ...Array.from({ length: MIN_SERIES_RUNS }, (_, i) => run(i + 1, "old", { pureUs: 1 })),
      run(20, "new", { pureUs: 5 }),
    ];
    const { current, previous } = deltaSeries(runs, "x86_64", "PURE");
    expect(current!.instanceType).toBe("new");
    expect(current!.n).toBe(1);
    expect(current!.min).toBeCloseTo(pct(5));
    expect(current!.max).toBeCloseTo(pct(5));
    expect(previous!.instanceType).toBe("old");
    expect(previous!.n).toBe(MIN_SERIES_RUNS);
    expect(previous!.max).toBeCloseTo(pct(1));
  });

  it("does not fall back to the previous host when the current one lacks the suite", () => {
    const runs = [
      ...Array.from({ length: MIN_SERIES_RUNS }, (_, i) => run(i + 1, "old")),
      run(20, "new", { pureUs: null }),
    ];
    const pair = deltaSeries(runs, "x86_64", "PURE");
    expect(pair.current).toBeNull();
    expect(pair.previous).not.toBeNull();
    expect(describeDeltaSeries(pair)).toBeNull();
    expect(primaryPct(pair)).toBeNull();
  });

  it("keeps withheld runs out of the median and the range, and counts them", () => {
    // HYB below the baseline is structurally impossible for a hybrid: withheld.
    const runs = [
      run(1, "h", { hybridUs: 19998 }),
      run(2, "h", { hybridUs: 1 }),
      run(3, "h", { hybridUs: 29997 }),
    ];
    const s = deltaSeries(runs, "x86_64", "HYB").current!;
    expect(s.n).toBe(2);
    expect(s.withheld).toBe(1);
    expect(s.min).toBeCloseTo(pct(19998));
    expect(s.max).toBeCloseTo(pct(29997));
    expect(s.median).toBeCloseTo((pct(19998) + pct(29997)) / 2);
  });

  it("filters by architecture", () => {
    const runs = [run(1, "h", { arch: "aarch64", pureUs: 2 }), run(2, "h", { pureUs: 3 })];
    expect(deltaSeries(runs, "aarch64", "PURE").current!.latest.pct).toBeCloseTo(pct(2));
  });

  it("returns nothing for the baseline itself", () => {
    const bySuite = deltaSeriesBySuite([run(1, "h")], "x86_64");
    expect(bySuite.BASE).toBeUndefined();
    expect(bySuite.PURE).toBeDefined();
  });
});

describe("describeDeltaSeries", () => {
  it("below the threshold shows one dated run and a plain count, and no range", () => {
    const runs = [run(1, "c7i.fake", { pureUs: 4 }), run(2, "c7i.fake", { pureUs: 2 })];
    const d = describeDeltaSeries(deltaSeries(runs, "x86_64", "PURE"))!;
    expect(d.value).toBe(`−${Math.abs(pct(2)).toFixed(1)}%`);
    expect(d.lines[0]).toBe("one run · 2 Jan 2026 · fake020");
    expect(d.lines[1]).toBe("2 runs on c7i.fake — too few for a range");
    expect(d.lines.join(" ")).not.toContain("median");
  });

  it("at the threshold leads with the median and dates the newest run beside it", () => {
    const runs = Array.from({ length: MIN_SERIES_RUNS }, (_, i) => run(i + 1, "h", { pureUs: i + 1 }));
    const pair = deltaSeries(runs, "x86_64", "PURE");
    const d = describeDeltaSeries(pair)!;
    const s = pair.current!;
    expect(s.isSeries).toBe(true);
    expect(d.value).toBe(`−${Math.abs(s.median!).toFixed(1)}%`);
    expect(d.lines[0]).toContain(`median of ${MIN_SERIES_RUNS} runs`);
    expect(d.lines[1]).toContain(`07 Jan 2026`.replace(/^0/, ""));
    expect(d.lines[1]).toContain("fake070");
    expect(primaryPct(pair)).toBe(s.median);
  });

  it("shows no figure when the only run on the host was withheld", () => {
    const d = describeDeltaSeries(deltaSeries([run(1, "h", { hybridUs: 1 })], "x86_64", "HYB"))!;
    expect(d.value).toBeNull();
    expect(d.lines[0]).toContain("withheld");
  });
});

describe("hostSeriesNote", () => {
  it("is silent once the current host has a series", () => {
    const runs = Array.from({ length: MIN_SERIES_RUNS }, (_, i) => run(i + 1, "h"));
    expect(hostSeriesNote(deltaSeries(runs, "x86_64", "PURE"), "P", "B")).toBeNull();
  });

  it("names the previous host and keeps it separate when the current host is thin", () => {
    const runs = [
      ...Array.from({ length: MIN_SERIES_RUNS }, (_, i) => run(i + 1, "old.fake", { pureUs: i + 1 })),
      run(20, "new.fake"),
    ];
    const note = hostSeriesNote(deltaSeries(runs, "x86_64", "PURE"), "P", "B")!;
    expect(note).toContain("The current host, new.fake, has 1 run since 20 Jan 2026");
    expect(note).toContain(`On the previous host, old.fake (${MIN_SERIES_RUNS} runs`);
    expect(note).toContain("faster");
    expect(note).toContain("rather than combined");
  });

  it("omits the previous host when it has too few runs of its own", () => {
    const runs = [run(1, "old.fake"), run(2, "new.fake")];
    const note = hostSeriesNote(deltaSeries(runs, "x86_64", "PURE"), "P", "B")!;
    expect(note).not.toContain("previous host");
  });

  it("puts the baseline beside the previous host's median, not after the range", () => {
    const runs = [
      ...Array.from({ length: MIN_SERIES_RUNS }, (_, i) => run(i + 1, "old.fake", { pureUs: i + 1 })),
      run(20, "new.fake"),
    ];
    const note = hostSeriesNote(deltaSeries(runs, "x86_64", "PURE"), "P", "B")!;
    expect(note).toMatch(/P measured a median [\d.]+% faster than B, and between/);
  });

  it("says in words when the host is unidentified", () => {
    const pair = deltaSeries([run(1, UNKNOWN_INSTANCE)], "x86_64", "PURE");
    expect(hostSeriesNote(pair, "P", "B")).toContain("which the record does not identify");
    expect(describeDeltaSeries(pair)!.lines[1]).toContain("on an unidentified host");
  });
});

describe("formatDay", () => {
  it("is deterministic across runtimes, including September", () => {
    // Intl en-GB gives "Sept" in Node; a client render could differ and break hydration.
    expect(formatDay("2026-09-14")).toBe("14 Sep 2026");
    expect(formatDay("2026-01-02T06:00:00Z")).toBe("2 Jan 2026");
    expect(formatDay("not a date")).toBe("date unknown");
  });
});
