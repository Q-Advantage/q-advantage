import { describe, expect, it } from "vitest";
import {
  fileOperatingCostDeltas,
  formatSignedDelta,
  mixedSignDeltas,
  operatingCostDelta,
} from "./ocd";
import type { ComposedSuite, TimingBlock } from "./types";

function timing(median: number): TimingBlock {
  return {
    mean_us: median,
    median_us: median,
    p95_us: median,
    p99_us: median,
    stdev_us: 0,
    min_us: median,
    max_us: median,
    ops_per_sec: 1,
    n_iterations: 1,
  } as TimingBlock;
}

function suite(
  name: string,
  median: number,
  bytes: number,
  opts: { baselineOf?: string; phases?: string[] } = {},
): ComposedSuite {
  const phases: Record<string, TimingBlock> = {};
  for (const p of opts.phases ?? []) phases[p] = timing(median);
  return {
    identity: { protocol: "tls", mode: "fixture", suite: name },
    timing: timing(median),
    size: { bytes_client_to_server: 0, bytes_server_to_client: bytes, bytes_total: bytes },
    ...(opts.baselineOf
      ? { baseline: { baseline_suite: opts.baselineOf, pct_over_classical: 9999 } }
      : {}),
    ...(opts.phases ? { phases } : {}),
  } as ComposedSuite;
}

const HYBRID = ["kem_encap", "classical_keygen"];
const PQC_ONLY = ["kem_encap"];

describe("operatingCostDelta", () => {
  it("never emits a blended total, and says why", () => {
    // The whole reason this module exists. A single number would need a price
    // for microseconds against bytes, which belongs to whoever is costing.
    const suites = {
      X25519: suite("X25519", 280, 64),
      MLKEM768: suite("MLKEM768", 103, 2272, { baselineOf: "X25519", phases: PQC_ONLY }),
    };
    const d = operatingCostDelta(suites.MLKEM768, suites)!;
    expect(d.blendedTotal).toBeNull();
    expect(d.blendedTotalReason).toContain("opposite signs");
    expect(Object.keys(d)).not.toContain("total");
  });

  it("keeps the signs intact when the components disagree", () => {
    // The real shape of the finding: pure ML-KEM is cheaper on CPU and dearer
    // on the wire. A blended figure erases exactly this.
    const suites = {
      X25519: suite("X25519", 280, 64),
      MLKEM768: suite("MLKEM768", 103, 2272, { baselineOf: "X25519", phases: PQC_ONLY }),
    };
    const d = operatingCostDelta(suites.MLKEM768, suites)!;
    const cpu = d.components.find((c) => c.component === "cpu")!;
    const bytes = d.components.find((c) => c.component === "bytes")!;

    expect(cpu.delta).toBeLessThan(0);
    expect(cpu.direction).toBe("saving");
    expect(bytes.delta).toBeGreaterThan(0);
    expect(bytes.direction).toBe("cost");
    expect(d.mixedSigns).toBe(true);
  });

  it("does not flag mixed signs when both components cost more", () => {
    const suites = {
      X25519: suite("X25519", 162, 64),
      X25519MLKEM768: suite("X25519MLKEM768", 221, 2336, {
        baselineOf: "X25519",
        phases: HYBRID,
      }),
    };
    const d = operatingCostDelta(suites.X25519MLKEM768, suites)!;
    expect(d.mixedSigns).toBe(false);
    expect(d.components.every((c) => c.direction === "cost")).toBe(true);
  });

  it("refuses a structurally impossible comparison", () => {
    // A cost model fed an impossible delta produces a confident wrong answer
    // rather than an obvious one, so the anomaly gate applies here too.
    const suites = {
      X25519: suite("X25519", 280.8, 64),
      SecP256r1MLKEM768: suite("SecP256r1MLKEM768", 226.4, 2402, {
        baselineOf: "X25519",
        phases: HYBRID,
      }),
    };
    expect(operatingCostDelta(suites.SecP256r1MLKEM768, suites)).toBeNull();
  });

  it("returns null for the baseline itself rather than a row of zeroes", () => {
    const suites = { X25519: suite("X25519", 280, 64) };
    expect(operatingCostDelta(suites.X25519, suites)).toBeNull();
  });

  it("returns null when the named baseline is absent from the file", () => {
    const suites = {
      Only: suite("Only", 100, 100, { baselineOf: "NotHere", phases: PQC_ONLY }),
    };
    expect(operatingCostDelta(suites.Only, suites)).toBeNull();
  });

  it("emits the CPU component even when byte sizes are missing", () => {
    const base = { ...suite("X25519", 280, 64) };
    const s = suite("MLKEM768", 103, 0, { baselineOf: "X25519", phases: PQC_ONLY });
    delete (s as { size?: unknown }).size;
    const d = operatingCostDelta(s, { X25519: base, MLKEM768: s })!;
    expect(d.components.map((c) => c.component)).toEqual(["cpu"]);
  });
});

describe("fileOperatingCostDeltas", () => {
  it("skips the baseline and returns one delta per comparable suite", () => {
    const suites = {
      X25519: suite("X25519", 280, 64),
      MLKEM768: suite("MLKEM768", 103, 2272, { baselineOf: "X25519", phases: PQC_ONLY }),
      X25519MLKEM768: suite("X25519MLKEM768", 382, 2336, {
        baselineOf: "X25519",
        phases: HYBRID,
      }),
    };
    const all = fileOperatingCostDeltas(suites);
    expect(all.map((d) => d.suite).sort()).toEqual(["MLKEM768", "X25519MLKEM768"]);
  });

  it("surfaces the mixed-sign case on its own", () => {
    const suites = {
      X25519: suite("X25519", 280, 64),
      MLKEM768: suite("MLKEM768", 103, 2272, { baselineOf: "X25519", phases: PQC_ONLY }),
      X25519MLKEM768: suite("X25519MLKEM768", 382, 2336, {
        baselineOf: "X25519",
        phases: HYBRID,
      }),
    };
    const mixed = mixedSignDeltas(fileOperatingCostDeltas(suites));
    expect(mixed.map((d) => d.suite)).toEqual(["MLKEM768"]);
  });

  it("returns an empty list, not null, for an absent suite set", () => {
    expect(fileOperatingCostDeltas(undefined)).toEqual([]);
  });
});

describe("formatSignedDelta", () => {
  it("renders a saving with a minus and a cost with a plus", () => {
    const suites = {
      X25519: suite("X25519", 280, 64),
      MLKEM768: suite("MLKEM768", 103, 2272, { baselineOf: "X25519", phases: PQC_ONLY }),
    };
    const d = operatingCostDelta(suites.MLKEM768, suites)!;
    expect(formatSignedDelta(d.components.find((c) => c.component === "cpu")!)).toMatch(/^−/);
    expect(formatSignedDelta(d.components.find((c) => c.component === "bytes")!)).toMatch(/^\+/);
  });
});
