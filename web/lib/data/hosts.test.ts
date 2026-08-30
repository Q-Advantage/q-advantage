import { describe, expect, it } from "vitest";
import {
  currentEra,
  deriveHostEras,
  eraIdByRun,
  hasHardwareTransition,
  transitionNote,
  UNKNOWN_HOST,
} from "./hosts";
import type { NormalizedRun } from "./types";

// Sentinel discipline: these are obviously-fake runs, never mistakable for a
// measurement. No algorithm block at all, and -1 where a number is needed.
function run(date: string, instanceType: string | undefined, cpu = "FakeCPU"): NormalizedRun {
  return {
    file_name: `results-${date}.json`,
    file_id: `results-${date}`,
    date_string: date,
    short_sha: null,
    is_legacy_filename: false,
    full_sha: `sha-${date}`,
    timestamp: new Date(`${date}T06:00:00Z`),
    environment: { ec2_instance_type: instanceType, cpu_model: cpu } as never,
    runtime_metrics: null,
    is_legacy_schema: false,
    host_era_id: "",
    algorithms: [],
    algorithms_by_id: {},
  } as unknown as NormalizedRun;
}

describe("deriveHostEras", () => {
  it("returns one era for a single-host record", () => {
    const eras = deriveHostEras([
      run("2026-08-01", "t3.medium"),
      run("2026-08-02", "t3.medium"),
      run("2026-08-03", "t3.medium"),
    ]);
    expect(eras).toHaveLength(1);
    expect(eras[0].instanceType).toBe("t3.medium");
    expect(eras[0].firstDate).toBe("2026-08-01");
    expect(eras[0].lastDate).toBe("2026-08-03");
    expect(eras[0].runCount).toBe(3);
    expect(eras[0].burstable).toBe(true);
  });

  it("opens a new era when the instance type changes, with derived boundaries", () => {
    const eras = deriveHostEras([
      run("2026-08-01", "t3.medium"),
      run("2026-08-02", "t3.medium"),
      run("2026-08-03", "c7i.large"),
      run("2026-08-04", "c7i.large"),
    ]);
    expect(eras).toHaveLength(2);
    expect(eras[0].instanceType).toBe("t3.medium");
    expect(eras[0].lastDate).toBe("2026-08-02");
    expect(eras[1].instanceType).toBe("c7i.large");
    // The boundary is the first date measured on the new host -- read from the
    // data, not from a constant anyone had to remember to update.
    expect(eras[1].firstDate).toBe("2026-08-03");
    expect(eras[1].burstable).toBe(false);
  });

  it("orders eras oldest-first even when handed newest-first runs", () => {
    // loadAllRuns() is newest-first. Getting this backwards would invert every
    // boundary and label the historical record with the new hardware.
    const eras = deriveHostEras([
      run("2026-08-04", "c7i.large"),
      run("2026-08-03", "c7i.large"),
      run("2026-08-02", "t3.medium"),
      run("2026-08-01", "t3.medium"),
    ]);
    expect(eras.map((e) => e.instanceType)).toEqual(["t3.medium", "c7i.large"]);
    expect(currentEra(eras)!.instanceType).toBe("c7i.large");
  });

  it("treats a return to earlier hardware as a third era, not a merge", () => {
    // A rollback is still a hardware change. Merging it back into the first era
    // would draw a line across the c7i period as though it never happened.
    const eras = deriveHostEras([
      run("2026-08-01", "t3.medium"),
      run("2026-08-02", "c7i.large"),
      run("2026-08-03", "t3.medium"),
    ]);
    expect(eras).toHaveLength(3);
    expect(eras.map((e) => e.instanceType)).toEqual(["t3.medium", "c7i.large", "t3.medium"]);
  });

  it("records an absent instance type as unknown rather than guessing", () => {
    const eras = deriveHostEras([run("2026-05-11", undefined)]);
    expect(eras[0].instanceType).toBe(UNKNOWN_HOST);
    expect(eras[0].note).toBe("");
  });

  it("infers burstability from the instance family for unprofiled types", () => {
    expect(deriveHostEras([run("2026-08-01", "t4g.small")])[0].burstable).toBe(true);
    expect(deriveHostEras([run("2026-08-01", "m7i.large")])[0].burstable).toBe(false);
  });

  it("collects every distinct CPU model seen within an era, without duplicates", () => {
    const eras = deriveHostEras([
      run("2026-08-01", "t3.medium", "Xeon A"),
      run("2026-08-02", "t3.medium", "Xeon A"),
      run("2026-08-03", "t3.medium", "Xeon B"),
    ]);
    expect(eras[0].cpuModels).toEqual(["Xeon A", "Xeon B"]);
  });

  it("returns an empty list for an empty record", () => {
    expect(deriveHostEras([])).toEqual([]);
    expect(currentEra([])).toBeNull();
  });
});

describe("hasHardwareTransition", () => {
  it("is false for one era and true for more", () => {
    expect(hasHardwareTransition(deriveHostEras([run("2026-08-01", "t3.medium")]))).toBe(false);
    expect(
      hasHardwareTransition(
        deriveHostEras([run("2026-08-01", "t3.medium"), run("2026-08-02", "c7i.large")]),
      ),
    ).toBe(true);
  });
});

describe("eraIdByRun", () => {
  it("tags every run, and tags the two sides of a change differently", () => {
    const runs = [
      run("2026-08-01", "t3.medium"),
      run("2026-08-02", "t3.medium"),
      run("2026-08-03", "c7i.large"),
    ];
    const ids = eraIdByRun(runs);
    expect(ids.size).toBe(3);
    expect(ids.get("results-2026-08-01")).toBe(ids.get("results-2026-08-02"));
    expect(ids.get("results-2026-08-03")).not.toBe(ids.get("results-2026-08-01"));
  });
});

describe("transitionNote", () => {
  it("states the hardware and the date, and claims nothing about the effect", () => {
    const eras = deriveHostEras([
      run("2026-08-02", "t3.medium"),
      run("2026-08-03", "c7i.large"),
    ]);
    const note = transitionNote(eras[0], eras[1]);
    expect(note).toContain("2026-08-03");
    expect(note).toContain("t3.medium");
    expect(note).toContain("c7i.large");
    // Asserting a magnitude here without the calibration measurement would be
    // authoring a number, which is the whole thing this module prevents.
    expect(note).not.toMatch(/\d+(\.\d+)?\s*[%x×]/);
  });
});
