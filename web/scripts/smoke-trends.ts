/**
 * Smoke test for the historical trends series.
 *
 *   npx tsx scripts/smoke-trends.ts
 *
 * One rule carries this whole surface: measured points only. A run that did
 * not happen produces no point. The failure this guards is a series that fills
 * a gap — by carrying the previous value forward, by inserting a zero, or by
 * interpolating between neighbours. Any of those publishes a number nobody
 * measured, on a chart whose entire claim is the opposite.
 */
import { getLatestRun, loadAllRuns } from "../lib/data/load";
import {
  MAX_SERIES,
  buildTrends,
  defaultSelection,
  rangeDays,
  seriesChangePct,
  spreadPct,
} from "../lib/data/trends";

const run = getLatestRun();
const allRuns = loadAllRuns();

console.log("=== series carry only measured points ===");
const selection = defaultSelection(run.algorithms);
const trends = buildTrends(selection, "mean", "keygen", "all");
for (const s of trends.series) {
  const pointDates = new Set(s.points.map((p) => p.date));
  console.log(
    `  ${s.label.padEnd(24)} ${String(s.points.length).padStart(3)} points, ${s.gaps} gaps, ` +
      `${pointDates.size} distinct dates`,
  );
  if (pointDates.size !== s.points.length) {
    throw new Error(`${s.label} has duplicate dates — a run contributed more than one point.`);
  }
  if (s.points.some((p) => p.value <= 0 || !Number.isFinite(p.value))) {
    throw new Error(
      `${s.label} contains a non-positive or non-finite value. A gap must produce no point at ` +
        `all, never a zero — a zero on a latency chart reads as instant.`,
    );
  }
  if (s.points.some((p) => !p.run_url)) {
    throw new Error(`${s.label} has a point with no run_url — every point must trace to its run.`);
  }
}

console.log("\n=== points + gaps never exceed the runs in range ===");
// If this ever exceeded the run count, something would be synthesising rows.
for (const s of trends.series) {
  const accounted = s.points.length + s.gaps;
  console.log(`  ${s.label.padEnd(24)} ${accounted} accounted vs ${trends.runsInRange} runs`);
  if (accounted > trends.runsInRange) {
    throw new Error(
      `${s.label}: ${accounted} points+gaps against ${trends.runsInRange} runs in range — the ` +
        `series is inventing entries.`,
    );
  }
}

console.log("\n=== an unmeasured algorithm yields no series, and is named ===");
const missing = buildTrends(["no-such-algorithm"], "mean", "keygen", "all");
console.log(`  series: ${missing.series.length}, empty: ${JSON.stringify(missing.empty)}`);
if (missing.series.length !== 0) {
  throw new Error("An unknown algorithm produced a series — it must produce none.");
}

console.log("\n=== a KEM has no sign operation, and that is a gap, not a zero ===");
const kem = run.algorithms.find((a) => a.kind === "kem");
if (kem) {
  const wrongOp = buildTrends([kem.id], "mean", "sign", "all");
  const points = wrongOp.series[0]?.points.length ?? 0;
  console.log(`  ${kem.display_name} signing: ${points} points (expect 0)`);
  if (points > 0) {
    throw new Error(`${kem.display_name} produced signing measurements. KEMs do not sign.`);
  }
}

console.log("\n=== series cap is enforced so hues are never cycled ===");
const many = run.algorithms.filter((a) => a.status === "ok").map((a) => a.id);
const capped = buildTrends(many, "mean", "keygen", "all");
console.log(`  requested ${many.length}, returned ${capped.series.length}, cap ${MAX_SERIES}`);
if (capped.series.length > MAX_SERIES) {
  throw new Error(
    `buildTrends returned ${capped.series.length} series against a cap of ${MAX_SERIES}. The ` +
      `chart has ${MAX_SERIES} validated hues; a fifth would have to reuse one.`,
  );
}

console.log("\n=== change is null for a single point, not 0% ===");
const single = {
  id: "x", label: "X", family: "ML-KEM" as const, gaps: 0,
  points: [{ date: "2026-01-01", commit: "a", run_url: "u", value: 9999 }],
  min: 9999, max: 9999,
};
if (seriesChangePct(single) !== null) {
  throw new Error("A one-point series reported a change. One measurement is not a trend.");
}
console.log("  Correct.");

console.log("\n=== ranges trim, and 'all' does not ===");
for (const id of ["30", "90", "all"]) {
  const r = buildTrends(selection, "mean", "keygen", id);
  const days = rangeDays(id);
  console.log(`  ${id.padEnd(4)} → ${r.runsInRange} runs (limit ${days ?? "none"})`);
  if (days != null && r.runsInRange > days) {
    throw new Error(`Range ${id} returned ${r.runsInRange} runs, more than ${days}.`);
  }
}
if (buildTrends(selection, "mean", "keygen", "all").runsInRange !== allRuns.length) {
  throw new Error("Range 'all' did not cover every committed run.");
}

console.log("\n=== Real committed data: movement across the record ===");
for (const s of trends.series) {
  const change = seriesChangePct(s);
  const first = s.points[0];
  const last = s.points[s.points.length - 1];
  console.log(
    `  ${s.label.padEnd(24)} ${first.value.toFixed(1)} → ${last.value.toFixed(1)} µs  ` +
      `(${change == null ? "—" : `${change > 0 ? "+" : ""}${change.toFixed(1)}%`})  ` +
      `${first.date} → ${last.date}`,
  );
}

console.log("\n=== spread is reported next to change, so noise cannot read as a trend ===");
// ML-KEM-768 keygen alternates between roughly 19 and 32 microseconds on this
// instance. First-to-last on such a series says only which mode each endpoint
// landed in, so the UI must never show a change figure without the observed
// range beside it.
for (const s of trends.series) {
  const change = seriesChangePct(s);
  const spread = spreadPct(s);
  if (change == null || spread == null) continue;
  const noisy = Math.abs(change) < spread / 2;
  console.log(
    `  ${s.label.padEnd(24)} change ${change > 0 ? "+" : ""}${change.toFixed(1)}%  ` +
      `spread ${spread.toFixed(1)}%  range ${s.min.toFixed(1)}-${s.max.toFixed(1)}` +
      `${noisy ? "  <- change sits inside the noise" : ""}`,
  );
  if (spread < Math.abs(change) - 1e-9) {
    throw new Error(
      `${s.label}: reported change ${change.toFixed(1)}% exceeds observed spread ` +
        `${spread.toFixed(1)}% — impossible, both derive from the same points.`,
    );
  }
}


console.log("\nOK — trends smoke test passed.");
