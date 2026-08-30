import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NormalizedRun } from "./types";

// buildTrends reads the run record through loadAllRuns(), which touches the
// filesystem. Mock it so these assert the partitioning logic itself rather
// than whatever happens to be committed today.
const runsMock = vi.hoisted(() => ({ current: [] as NormalizedRun[] }));
vi.mock("./load", () => ({ loadAllRuns: () => runsMock.current }));

const { buildTrends } = await import("./trends");
const { eraIdByRun } = await import("./hosts");

/** Obviously-fake run: one algorithm, sentinel-shaped timing. */
function run(date: string, instanceType: string, keygenMean: number): NormalizedRun {
  return {
    file_name: `results-${date}.json`,
    file_id: `results-${date}`,
    date_string: date,
    short_sha: null,
    is_legacy_filename: false,
    full_sha: `0000000000000000000000000000000000000${date.slice(-3).replace("-", "")}`,
    timestamp: new Date(`${date}T06:00:00Z`),
    environment: { ec2_instance_type: instanceType, cpu_model: "FakeCPU" },
    runtime_metrics: null,
    is_legacy_schema: false,
    host_era_id: "",
    algorithms: [],
    algorithms_by_id: {
      "ml-kem-768": {
        id: "ml-kem-768",
        display_name: "ML-KEM-768",
        family: "ML-KEM",
        status: "ok",
        operations: {
          keygen: {
            mean_us: keygenMean,
            median_us: keygenMean,
            p95_us: keygenMean,
            p99_us: keygenMean,
            stdev_us: 0,
            min_us: keygenMean,
            max_us: keygenMean,
            ops_per_sec: 1,
            n_iterations: 1,
          },
        },
      },
    },
  } as unknown as NormalizedRun;
}

function setRecord(rs: NormalizedRun[]) {
  // loadAllRuns() returns newest-first and tags eras; reproduce both.
  const ids = eraIdByRun(rs);
  for (const r of rs) r.host_era_id = ids.get(r.file_id) ?? "";
  runsMock.current = [...rs].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}

beforeEach(() => {
  runsMock.current = [];
});

describe("buildTrends — hardware transitions", () => {
  it("reports no break for a single-host record", () => {
    setRecord([
      run("2026-08-01", "t3.medium", 18),
      run("2026-08-02", "t3.medium", 19),
      run("2026-08-03", "t3.medium", 18.5),
    ]);
    const t = buildTrends(["ml-kem-768"], "mean", "keygen", "all");
    expect(t.breaks).toEqual([]);
    expect(t.series[0].points).toHaveLength(3);
  });

  it("reports a break at the first run on new hardware", () => {
    setRecord([
      run("2026-08-01", "t3.medium", 18),
      run("2026-08-02", "t3.medium", 19),
      run("2026-08-03", "c7i.large", 9),
      run("2026-08-04", "c7i.large", 9.1),
    ]);
    const t = buildTrends(["ml-kem-768"], "mean", "keygen", "all");
    expect(t.breaks).toHaveLength(1);
    expect(t.breaks[0].date).toBe("2026-08-03");
    expect(t.breaks[0].fromLabel).toBe("t3.medium");
    expect(t.breaks[0].toLabel).toBe("c7i.large");
  });

  it("tags every point with the era that measured it, so the chart can split", () => {
    // This is what stops the ~2x step at a host change rendering as a trend:
    // points either side carry different era ids, so they never share a
    // Recharts data key and no segment can be drawn between them.
    setRecord([
      run("2026-08-01", "t3.medium", 18),
      run("2026-08-03", "c7i.large", 9),
    ]);
    const points = buildTrends(["ml-kem-768"], "mean", "keygen", "all").series[0].points;
    expect(points).toHaveLength(2);
    expect(points[0].era_id).not.toBe("");
    expect(points[0].era_id).not.toBe(points[1].era_id);
  });

  it("still refuses to invent a value across the break", () => {
    // The pre-existing guarantee must survive: measured points only.
    setRecord([
      run("2026-08-01", "t3.medium", 18),
      run("2026-08-03", "c7i.large", 9),
    ]);
    const t = buildTrends(["ml-kem-768"], "mean", "keygen", "all");
    expect(t.series[0].points.map((p) => p.date)).toEqual(["2026-08-01", "2026-08-03"]);
    expect(t.series[0].points.every((p) => p.value > 0)).toBe(true);
  });

  it("omits a transition that falls outside the rendered range", () => {
    const rs = [run("2026-06-01", "t3.medium", 18), run("2026-06-02", "c7i.large", 9)];
    for (let d = 1; d <= 20; d++) {
      rs.push(run(`2026-08-${String(d).padStart(2, "0")}`, "c7i.large", 9));
    }
    setRecord(rs);
    const t = buildTrends(["ml-kem-768"], "mean", "keygen", "30");
    expect(t.breaks).toEqual([]);
  });
});

describe("buildTrends — range is calendar days, not run count", () => {
  it("counts 30 days as 30 days even when two hosts commit on the same dates", () => {
    // The bug this pins: `all.slice(-days)` took the last N RUNS. With one host
    // committing daily those were the same number. During the c7i overlap two
    // runs land per date, so "30 days" silently became 15.
    const rs: NormalizedRun[] = [];
    for (let d = 1; d <= 20; d++) {
      const date = `2026-08-${String(d).padStart(2, "0")}`;
      rs.push(run(date, "t3.medium", 18));
    }
    setRecord(rs);
    const all = buildTrends(["ml-kem-768"], "mean", "keygen", "30");
    // 20 calendar days of record, all inside a 30-day window.
    expect(all.runsInRange).toBe(20);

    const narrow = buildTrends(["ml-kem-768"], "mean", "keygen", "all");
    expect(narrow.runsInRange).toBe(20);
  });

  it("measures the window back from the newest run, not from today", () => {
    // A record that stopped updating must not silently render as empty.
    const rs: NormalizedRun[] = [];
    for (let d = 1; d <= 5; d++) {
      rs.push(run(`2020-01-0${d}`, "t3.medium", 18));
    }
    setRecord(rs);
    const t = buildTrends(["ml-kem-768"], "mean", "keygen", "30");
    expect(t.runsInRange).toBe(5);
  });
});
