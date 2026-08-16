/**
 * Smoke test for the public data API's payload shapes.
 *
 *   npx tsx scripts/smoke-api.ts
 *
 * The API is the strongest form of the product's claim — it hands a consumer
 * the numbers with nothing but our word on what they are. The assertions here
 * are the ones that would make that word false:
 *
 *   - a measurement without its run_url is an uncited number
 *   - a null that becomes a 0 is a fabricated measurement
 *   - a documented endpoint that does not exist is an uncited claim about
 *     ourselves
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  availabilityPayload,
  historyPayload,
  latestPayload,
  protocolsPayload,
  reliabilityPayload,
  runsIndexPayload,
} from "../lib/api/v1";

console.log("=== every measurement carries its run ===");
const latest = latestPayload();
if (!latest.run.run_url.startsWith("https://github.com/")) {
  throw new Error(`latest.run.run_url = ${latest.run.run_url} — must point at the Actions run.`);
}
console.log(`  latest: ${latest.run.date} ${latest.run.commit.slice(0, 7)} → ${latest.run.run_url}`);

const runs = runsIndexPayload();
const missingUrl = runs.runs.filter((r) => !r.run_url);
if (missingUrl.length > 0) {
  throw new Error(
    `${missingUrl.length} of ${runs.count} runs have no run_url — a measurement a consumer ` +
      `cannot trace back to its run is an uncited number.`,
  );
}
console.log(`  ${runs.count} runs, all with run_url`);

console.log("\n=== nulls stay null: an absent measurement is never zero ===");
// Walk every operation of every algorithm; any zero-valued timing would be a
// fabricated measurement travelling through the API as though real.
let opCount = 0;
for (const a of latest.algorithms) {
  for (const [op, statsRaw] of Object.entries(a.operations)) {
    const s = statsRaw as Record<string, number | null>;
    opCount++;
    for (const field of ["mean_us", "median_us", "p95_us", "p99_us", "max_us"]) {
      const v = s[field];
      if (v === 0) {
        throw new Error(
          `${a.id}.${op}.${field} is 0 — a zero timing is not a measurement. If the value is ` +
            `absent the field must be omitted or null, never zero-filled.`,
        );
      }
    }
  }
}
console.log(`  ${opCount} operation blocks checked, no zero-valued timings`);

console.log("\n=== history is labelled as non-interpolable ===");
const hist = historyPayload(latest.algorithms[0].id);
if (!hist) throw new Error(`historyPayload(${latest.algorithms[0].id}) returned null.`);
if (!/not interpolated/i.test(hist.note)) {
  throw new Error(
    "The history payload must state that the series is measured points only. A consumer who " +
      "resamples it as continuous would be inventing values between our runs.",
  );
}
const firstOp = Object.keys(hist.series)[0];
console.log(`  ${hist.algorithm.name}: ${Object.keys(hist.series).length} operations, ` +
  `${(hist.series[firstOp] as unknown[]).length} points on ${firstOp}`);
if (historyPayload("no-such-algorithm") !== null) {
  throw new Error("An unknown algorithm id must return null so the route can 404, not an empty series.");
}

console.log("\n=== protocols: the phase identity travels, including whether it holds ===");
const protos = protocolsPayload();
let suitesWithPhases = 0;
let inexact = 0;
for (const arch of Object.values(protos.by_architecture) as Record<string, unknown>[]) {
  for (const suite of (arch.tls as Record<string, unknown>[]) ?? []) {
    const phases = suite.phases as { exact: boolean } | null;
    if (!phases) continue;
    suitesWithPhases++;
    if (!phases.exact) inexact++;
  }
}
console.log(`  ${suitesWithPhases} TLS suites carry phases; ${inexact} report exact:false`);
if (suitesWithPhases === 0) {
  throw new Error("No TLS suite exposed a phase decomposition — the phases block is not reaching the API.");
}
if (!/composed, not timed end to end/i.test(protos.note)) {
  throw new Error("The protocols payload must state how the handshake figure is built.");
}

console.log("\n=== reliability is reported as counts, not a bare rate ===");
const rel = reliabilityPayload();
console.log(
  `  ${rel.totals.algorithms_measured}/${rel.totals.algorithms_attempted} measurements across ` +
    `${rel.totals.runs} runs (${rel.totals.earliest} → ${rel.totals.latest})`,
);
if (rel.totals.algorithms_attempted <= 0) {
  throw new Error("reliability reports zero attempted measurements — the denominator is missing.");
}
if (rel.cpu_steal_pct) {
  console.log(
    `  CPU steal: ${rel.cpu_steal_pct.min.toFixed(2)}%–${rel.cpu_steal_pct.max.toFixed(2)}% ` +
      `over ${rel.cpu_steal_pct.runs_reporting} runs reporting`,
  );
}

console.log("\n=== the spec documents exactly what exists ===");
const specPath = join(process.cwd(), "public", "openapi.json");
if (!existsSync(specPath)) {
  throw new Error("public/openapi.json is missing — run `node scripts/build-openapi.mjs` (prebuild does this).");
}
const spec = JSON.parse(readFileSync(specPath, "utf8"));
const documented = Object.keys(spec.paths).sort();
const advertised = [...availabilityPayload().endpoints].sort();
console.log(`  spec documents ${documented.length}; /availability advertises ${advertised.length}`);
for (const path of advertised) {
  if (!documented.includes(path)) {
    throw new Error(
      `/api/v1/availability advertises ${path} but the OpenAPI spec does not document it — ` +
        `the two lists must not drift.`,
    );
  }
}
for (const path of documented) {
  if (!advertised.includes(path)) {
    throw new Error(`The spec documents ${path} but /availability does not advertise it.`);
  }
}
if (spec.openapi !== "3.1.0") throw new Error(`Spec declares openapi ${spec.openapi}, expected 3.1.0.`);
console.log(`  ${documented.join("\n  ")}`);

console.log("\nOK — API smoke test passed.");
