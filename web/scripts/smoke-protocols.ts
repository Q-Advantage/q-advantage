/**
 * Smoke test for the protocol-track loader + derived metrics.
 *
 *   npx tsx scripts/smoke-protocols.ts
 *
 * Same convention as smoke-loader.ts: print a digest, assert the cases that
 * would embarrass the company if they silently broke (a fabricated number
 * instead of an honest null), fail loudly on a broken assertion.
 */
import { loadProtocolsData } from "../lib/protocols/load";
import {
  amplificationFactor,
  formatAmplificationFactor,
  classifySuite,
  hybridToPurePqcRatio,
  formatMultiplier,
} from "../lib/protocols/derive";
import type { ComposedSuite } from "../lib/protocols/types";

function fixtureSuite(overrides: Partial<ComposedSuite["size"]>): ComposedSuite {
  return {
    identity: { protocol: "tls", mode: "composed", suite: "fixture" },
    timing: {
      mean_us: 1, median_us: 1, p95_us: 1, p99_us: 1, stdev_us: 0,
      min_us: 1, max_us: 1, ops_per_sec: 1, n_iterations: 1,
    },
    size: overrides === null ? undefined : { bytes_client_to_server: 0, bytes_server_to_client: 0, bytes_total: 0, ...overrides },
  };
}

function fixtureSuiteWithPhases(medianUs: number, phaseNames: string[]): ComposedSuite {
  return {
    identity: { protocol: "tls", mode: "composed", suite: "fixture" },
    timing: {
      mean_us: medianUs, median_us: medianUs, p95_us: medianUs, p99_us: medianUs,
      stdev_us: 0, min_us: medianUs, max_us: medianUs, ops_per_sec: 1, n_iterations: 1,
    },
    phases: Object.fromEntries(
      phaseNames.map((p) => [p, { mean_us: 1, median_us: 1, p95_us: 1, p99_us: 1, stdev_us: 0, min_us: 1, max_us: 1, ops_per_sec: 1, n_iterations: 1 }]),
    ),
  };
}

console.log("=== amplificationFactor: known fixture ===");
// Real X25519MLKEM768 record, tls-composed-2026-08-09-d71eadf.json:
// bytes_client_to_server=1216, bytes_server_to_client=1120.
const known = fixtureSuite({ bytes_client_to_server: 1216, bytes_server_to_client: 1120, bytes_total: 2336 });
const knownFactor = amplificationFactor(known);
const expected = 1120 / 1216;
console.log(`  X25519MLKEM768 (2026-08-09 fixture): ${formatAmplificationFactor(knownFactor)} (raw ${knownFactor})`);
if (knownFactor == null || Math.abs(knownFactor - expected) > 1e-9) {
  throw new Error(
    `amplificationFactor(known fixture) = ${knownFactor}, expected ${expected} — derive.ts changed ` +
      `behavior for a value that must stay exact.`,
  );
}
console.log("  Correct.");

console.log("\n=== amplificationFactor: must return null, never fabricate ===");
const zeroClient = fixtureSuite({ bytes_client_to_server: 0, bytes_server_to_client: 500, bytes_total: 500 });
const noSize = fixtureSuite(null as unknown as Partial<ComposedSuite["size"]>);
noSize.size = undefined;

for (const [label, suite] of [
  ["bytes_client_to_server = 0", zeroClient],
  ["missing size block", noSize],
] as const) {
  const f = amplificationFactor(suite);
  console.log(`  ${label}: ${f === null ? "null (correct)" : `FABRICATED VALUE ${f}`}`);
  if (f !== null) {
    throw new Error(
      `amplificationFactor() returned ${f} for a suite with ${label} — must return null, never a ` +
        `guessed/divide-by-zero number. A suite that can't compute a real ratio must say so.`,
    );
  }
}

console.log("\n=== classifySuite: fixtures matching the four real phase-key shapes ===");
const classifyCases: [string, ComposedSuite, string][] = [
  ["hybrid (kem_* + classical_*)", fixtureSuiteWithPhases(200, ["kem_keygen", "kem_encaps", "kem_decaps", "classical_keygen", "classical_derive"]), "hybrid"],
  ["pure-pqc (kem_* only)", fixtureSuiteWithPhases(60, ["kem_keygen", "kem_encaps", "kem_decaps"]), "pure-pqc"],
  ["classical (classical_* only)", fixtureSuiteWithPhases(160, ["classical_keygen", "classical_derive"]), "classical"],
  ["unknown (no phases)", fixtureSuiteWithPhases(1, []), "unknown"],
];
for (const [label, suite, expectedClass] of classifyCases) {
  const got = classifySuite(suite);
  console.log(`  ${label.padEnd(32)} → ${got}`);
  if (got !== expectedClass) {
    throw new Error(`classifySuite(${label}) = "${got}", expected "${expectedClass}" — check derive.ts's phase-key logic.`);
  }
}

console.log("\n=== hybridToPurePqcRatio: known fixture + null-safety ===");
const hybridFixture = fixtureSuiteWithPhases(236.312, ["kem_keygen", "kem_encaps", "kem_decaps", "classical_keygen", "classical_derive"]);
const pureFixture = fixtureSuiteWithPhases(60.58, ["kem_keygen", "kem_encaps", "kem_decaps"]);
const ratio = hybridToPurePqcRatio(hybridFixture, pureFixture);
const expectedRatio = 236.312 / 60.58;
console.log(`  X25519MLKEM768 vs MLKEM768 (2026-08-12 fixture): ${formatMultiplier(ratio)} (raw ${ratio})`);
if (ratio == null || Math.abs(ratio - expectedRatio) > 1e-9) {
  throw new Error(`hybridToPurePqcRatio(known fixture) = ${ratio}, expected ${expectedRatio}.`);
}
const noMedian = fixtureSuiteWithPhases(0, ["kem_keygen"]);
noMedian.timing.median_us = 0;
const nullRatio = hybridToPurePqcRatio(hybridFixture, noMedian);
console.log(`  pure suite with median_us=0: ${nullRatio === null ? "null (correct)" : `FABRICATED VALUE ${nullRatio}`}`);
if (nullRatio !== null) {
  throw new Error(`hybridToPurePqcRatio() returned ${nullRatio} for a zero-median pure suite — must return null.`);
}

console.log("\n=== Real committed data: amplification factor per suite (spot check) ===");
const data = loadProtocolsData();
const arches = Object.keys(data.byArch);
if (arches.length === 0) {
  console.log("  (no protocol data present — public/data/protocols/manifest.json not found; skipping)");
} else {
  for (const arch of arches) {
    const bucket = data.byArch[arch];
    const tlsEntries = Object.entries(bucket.tls?.suites ?? {});
    const purePqc = tlsEntries.find(([, s]) => classifySuite(s) === "pure-pqc")?.[1];
    for (const [name, suite] of tlsEntries) {
      const f = amplificationFactor(suite);
      const cls = classifySuite(suite);
      const vsPure = cls === "hybrid" && purePqc ? ` (${formatMultiplier(hybridToPurePqcRatio(suite, purePqc))} vs pure PQC)` : "";
      console.log(`  [tls/${arch}] ${name.padEnd(20)} ${formatAmplificationFactor(f).padEnd(8)} [${cls}]${vsPure}`);
    }
    for (const [name, suite] of Object.entries(bucket.ssh?.suites ?? {})) {
      const f = amplificationFactor(suite);
      console.log(`  [ssh/${arch}] ${name.padEnd(20)} ${formatAmplificationFactor(f).padEnd(8)} [${classifySuite(suite)}]`);
    }
  }
}

console.log("\nOK — protocols smoke test passed.");
