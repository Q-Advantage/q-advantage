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
import { amplificationFactor, formatAmplificationFactor } from "../lib/protocols/derive";
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

console.log("\n=== Real committed data: amplification factor per suite (spot check) ===");
const data = loadProtocolsData();
const arches = Object.keys(data.byArch);
if (arches.length === 0) {
  console.log("  (no protocol data present — public/data/protocols/manifest.json not found; skipping)");
} else {
  for (const arch of arches) {
    const bucket = data.byArch[arch];
    for (const [name, suite] of Object.entries(bucket.tls?.suites ?? {})) {
      const f = amplificationFactor(suite);
      console.log(`  [tls/${arch}] ${name.padEnd(20)} ${formatAmplificationFactor(f)}`);
    }
    for (const [name, suite] of Object.entries(bucket.ssh?.suites ?? {})) {
      const f = amplificationFactor(suite);
      console.log(`  [ssh/${arch}] ${name.padEnd(20)} ${formatAmplificationFactor(f)}`);
    }
  }
}

console.log("\nOK — protocols smoke test passed.");
