import { describe, expect, it } from "vitest";
import {
  detectFileAnomalies,
  detectSuiteAnomaly,
  isHybridSuite,
  publishableVsBaselinePct,
} from "./anomaly";
import { vsBaselinePct } from "./metrics";
import type { ComposedSuite, TimingBlock } from "./types";

// Sentinel discipline, per CLAUDE.md guardrail 1 and the header of every
// smoke-*.ts fixture: fabricated inputs must be impossible to mistake for a
// measurement. Degenerate distribution, n=1, zero stdev.
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
  opts: { baselineOf?: string; phases?: string[] } = {},
): ComposedSuite {
  const phases: Record<string, TimingBlock> = {};
  for (const p of opts.phases ?? []) phases[p] = timing(median);
  return {
    identity: { protocol: "tls", mode: "fixture", suite: name },
    timing: timing(median),
    ...(opts.baselineOf
      ? { baseline: { baseline_suite: opts.baselineOf, pct_over_classical: 9999 } }
      : {}),
    ...(opts.phases ? { phases } : {}),
  } as ComposedSuite;
}

const HYBRID_PHASES = ["kem_encap", "classical_keygen"];
const PQC_ONLY_PHASES = ["kem_encap"];

describe("isHybridSuite", () => {
  it("is true only when both a KEM phase and a classical phase were measured", () => {
    expect(isHybridSuite(suite("H", 100, { phases: HYBRID_PHASES }))).toBe(true);
    expect(isHybridSuite(suite("P", 100, { phases: PQC_ONLY_PHASES }))).toBe(false);
    expect(isHybridSuite(suite("C", 100, { phases: ["classical_keygen"] }))).toBe(false);
  });

  it("is false when no phase block was measured at all", () => {
    expect(isHybridSuite(suite("X", 100))).toBe(false);
  });
});

describe("detectSuiteAnomaly", () => {
  it("flags a hybrid suite that reads faster than its own classical baseline", () => {
    // The real 2026-08-29 shape: SecP256r1MLKEM768 at 226.4 µs against an
    // X25519 baseline inflated to 280.8 µs.
    const suites = {
      X25519: suite("X25519", 280.8),
      SecP256r1MLKEM768: suite("SecP256r1MLKEM768", 226.4, {
        baselineOf: "X25519",
        phases: HYBRID_PHASES,
      }),
    };

    const a = detectSuiteAnomaly(suites.SecP256r1MLKEM768, suites);
    expect(a).not.toBeNull();
    expect(a!.kind).toBe("hybrid-faster-than-classical");
    expect(a!.suite).toBe("SecP256r1MLKEM768");
    expect(a!.baselineSuite).toBe("X25519");
    expect(a!.pct).toBeLessThan(0);
    // The reason must name both figures, so a reader can see the baseline is
    // the broken half rather than concluding the hybrid is cheap.
    expect(a!.reason).toContain("280.8");
    expect(a!.reason).toContain("226.4");
  });

  it("does NOT flag a pure-PQC suite that is legitimately faster", () => {
    // ML-KEM-768 beating X25519 is a real, published finding. Firing here
    // would suppress the product's own headline result.
    const suites = {
      X25519: suite("X25519", 280.8),
      MLKEM768: suite("MLKEM768", 103.7, { baselineOf: "X25519", phases: PQC_ONLY_PHASES }),
    };
    expect(detectSuiteAnomaly(suites.MLKEM768, suites)).toBeNull();
    expect(publishableVsBaselinePct(suites.MLKEM768, suites)).toBeCloseTo(-63.07, 1);
  });

  it("does not flag a healthy hybrid", () => {
    const suites = {
      X25519: suite("X25519", 162.0),
      X25519MLKEM768: suite("X25519MLKEM768", 221.8, {
        baselineOf: "X25519",
        phases: HYBRID_PHASES,
      }),
    };
    expect(detectSuiteAnomaly(suites.X25519MLKEM768, suites)).toBeNull();
  });

  it("treats an exactly-equal hybrid as anomalous — it still cannot be free", () => {
    const suites = {
      X25519: suite("X25519", 200),
      H: suite("H", 200, { baselineOf: "X25519", phases: HYBRID_PHASES }),
    };
    expect(detectSuiteAnomaly(suites.H, suites)).not.toBeNull();
  });

  it("returns null rather than throwing when the baseline is missing from the file", () => {
    const suites = {
      H: suite("H", 100, { baselineOf: "NotPresent", phases: HYBRID_PHASES }),
    };
    expect(detectSuiteAnomaly(suites.H, suites)).toBeNull();
  });

  it("returns null when the suite names no baseline", () => {
    const suites = { H: suite("H", 100, { phases: HYBRID_PHASES }) };
    expect(detectSuiteAnomaly(suites.H, suites)).toBeNull();
  });

  it("never divides by a zero or negative baseline", () => {
    const suites = {
      Zero: suite("Zero", 0),
      H: suite("H", 0, { baselineOf: "Zero", phases: HYBRID_PHASES }),
    };
    expect(detectSuiteAnomaly(suites.H, suites)).toBeNull();
  });
});

describe("publishableVsBaselinePct", () => {
  it("withholds the impossible figure that vsBaselinePct still computes", () => {
    const suites = {
      X25519: suite("X25519", 280.8),
      SecP256r1MLKEM768: suite("SecP256r1MLKEM768", 226.4, {
        baselineOf: "X25519",
        phases: HYBRID_PHASES,
      }),
    };
    // The raw projection is unchanged — analysis and the smoke report need to
    // see the bad number in order to name it.
    expect(vsBaselinePct(suites.SecP256r1MLKEM768, suites)).toBeLessThan(0);
    // What a UI is allowed to render is nothing.
    expect(publishableVsBaselinePct(suites.SecP256r1MLKEM768, suites)).toBeNull();
  });

  it("passes healthy comparisons through untouched", () => {
    const suites = {
      X25519: suite("X25519", 162.0),
      X25519MLKEM768: suite("X25519MLKEM768", 221.8, {
        baselineOf: "X25519",
        phases: HYBRID_PHASES,
      }),
    };
    expect(publishableVsBaselinePct(suites.X25519MLKEM768, suites)).toBe(
      vsBaselinePct(suites.X25519MLKEM768, suites),
    );
  });
});

describe("detectFileAnomalies", () => {
  it("reports every impossible comparison in a file and leaves the rest alone", () => {
    const suites = {
      X25519: suite("X25519", 280.8),
      MLKEM768: suite("MLKEM768", 103.7, { baselineOf: "X25519", phases: PQC_ONLY_PHASES }),
      SecP256r1MLKEM768: suite("SecP256r1MLKEM768", 226.4, {
        baselineOf: "X25519",
        phases: HYBRID_PHASES,
      }),
      X25519MLKEM768: suite("X25519MLKEM768", 382.5, {
        baselineOf: "X25519",
        phases: HYBRID_PHASES,
      }),
    };
    const found = detectFileAnomalies(suites);
    expect(found.map((a) => a.suite)).toEqual(["SecP256r1MLKEM768"]);
  });

  it("returns an empty list, not null, for an absent suite set", () => {
    expect(detectFileAnomalies(undefined)).toEqual([]);
  });
});
