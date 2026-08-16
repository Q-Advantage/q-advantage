/**
 * Smoke test for the algorithm board's metric logic.
 *
 *   npx tsx scripts/smoke-board.ts
 *
 * The board lets a reader put any measured metric on the axis. The failure
 * mode that matters is an algorithm with no measurement being drawn as a
 * zero-length bar, which reads as "instant" — a fabricated claim. It must drop
 * out and be named instead.
 *
 * Fixtures use obviously-fake sentinels (-1, 9999) per CLAUDE.md guardrail 1.
 */
import { getLatestRun } from "../lib/data/load";
import {
  METRICS,
  availableOperations,
  buildBoard,
  getMetric,
  suggestsLogScale,
} from "../lib/data/board-metrics";
import type { NormalizedAlgorithm } from "../lib/data/types";

const ALL = new Set(["lattice", "hash"]);

function fixtureAlgo(over: Partial<NormalizedAlgorithm>): NormalizedAlgorithm {
  return {
    id: "fixture",
    display_name: "FIXTURE",
    liboqs_key: "FIXTURE",
    family: "ML-DSA",
    parameter_set: "x",
    nist_level: 3,
    kind: "sig",
    pubkey_bytes: 9999,
    privkey_bytes: 9999,
    signature_bytes: 9999,
    operations: {} as NormalizedAlgorithm["operations"],
    status: "ok",
    ...over,
  } as NormalizedAlgorithm;
}

console.log("=== a missing measurement is omitted, never plotted at zero ===");
const measured = fixtureAlgo({
  id: "measured",
  display_name: "MEASURED",
  operations: {
    sign: {
      mean_us: 9999, median_us: 9999, p95_us: 9999, p99_us: 9999,
      stdev_us: 0, min_us: 9999, max_us: 9999, ops_per_sec: 1, n_iterations: 1,
    },
  } as NormalizedAlgorithm["operations"],
});
const unmeasured = fixtureAlgo({ id: "unmeasured", display_name: "UNMEASURED", operations: {} as NormalizedAlgorithm["operations"] });

const board = buildBoard([measured, unmeasured], "mean", "sign", ALL);
console.log(`  plotted: ${board.points.map((p) => p.label).join(", ") || "(none)"}`);
console.log(`  omitted: ${board.omitted.join(", ") || "(none)"}`);
if (board.points.some((p) => p.label === "UNMEASURED")) {
  throw new Error(
    "An algorithm with no measurement for the selected metric was plotted. A zero-length bar " +
      "reads as 'instant' — it must be omitted and named, never drawn.",
  );
}
if (!board.omitted.includes("UNMEASURED")) {
  throw new Error("An omitted algorithm must be named to the reader, not silently dropped.");
}

console.log("\n=== a zero or non-finite value is treated as missing ===");
for (const bad of [0, Number.NaN, Number.POSITIVE_INFINITY]) {
  const a = fixtureAlgo({
    id: "bad",
    display_name: "BAD",
    operations: {
      sign: {
        mean_us: bad, median_us: 1, p95_us: 1, p99_us: 1,
        stdev_us: 0, min_us: 1, max_us: 1, ops_per_sec: 1, n_iterations: 1,
      },
    } as NormalizedAlgorithm["operations"],
  });
  const r = buildBoard([a], "mean", "sign", ALL);
  if (r.points.length !== 0) {
    throw new Error(`A mean of ${bad} was plotted — non-positive and non-finite values are not measurements.`);
  }
}
console.log("  Correct.");

console.log("\n=== family filter never empties silently, and never repaints survivors ===");
// Colour follows the entity (its family), not its rank — filtering one family
// out must not change the colour of the other.
const hash = fixtureAlgo({ id: "h", display_name: "HASHY", family: "SLH-DSA", operations: measured.operations });
const both = buildBoard([measured, hash], "mean", "sign", ALL);
const latticeOnly = buildBoard([measured, hash], "mean", "sign", new Set(["lattice"]));
console.log(`  both: ${both.points.map((p) => `${p.label}:${p.group}`).join(", ")}`);
console.log(`  lattice only: ${latticeOnly.points.map((p) => `${p.label}:${p.group}`).join(", ")}`);
const before = both.points.find((p) => p.id === "measured")!.group;
const after = latticeOnly.points.find((p) => p.id === "measured")!.group;
if (before !== after) {
  throw new Error(
    `Filtering changed an entity's colour group from ${before} to ${after} — colour must follow ` +
      `the algorithm's family, never its position in the filtered set.`,
  );
}

console.log("\n=== tail metric: never Infinity ===");
const zeroMedian = fixtureAlgo({
  id: "zm",
  display_name: "ZM",
  operations: {
    sign: {
      mean_us: 1, median_us: 0, p95_us: 1, p99_us: 1,
      stdev_us: 0, min_us: 1, max_us: 9999, ops_per_sec: 1, n_iterations: 1,
    },
  } as NormalizedAlgorithm["operations"],
});
if (getMetric("tail").value(zeroMedian, "sign") !== null) {
  throw new Error("tail with a zero median must be null, not Infinity.");
}
console.log("  Correct.");

console.log("\n=== every metric has a label, a unit and a formatter ===");
for (const m of METRICS) {
  if (!m.label || !m.unit || typeof m.format !== "function") {
    throw new Error(`Metric ${m.id} is incompletely defined — the axis label is read off these.`);
  }
}
console.log(`  ${METRICS.length} metrics: ${METRICS.map((m) => m.id).join(", ")}`);

console.log("\n=== Real committed data ===");
const run = getLatestRun();
const ops = availableOperations(run.algorithms);
console.log(`  operations measured: ${ops.join(", ")}`);
for (const m of METRICS) {
  const r = buildBoard(run.algorithms, m.id, "sign", ALL);
  const logged = suggestsLogScale(r.points);
  console.log(
    `  ${m.label.padEnd(28)} ${String(r.points.length).padStart(2)} plotted, ` +
      `${String(r.omitted.length).padStart(2)} omitted, default axis ${logged ? "log" : "linear"}` +
      (r.points.length ? ` — leader ${r.points[0].label} ${r.points[0].display}` : ""),
  );
}

console.log("\nOK — board smoke test passed.");
