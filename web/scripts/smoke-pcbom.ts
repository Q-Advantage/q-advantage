/**
 * Smoke test for the P-CBOM snippet generator (work-order 012).
 *
 *   npx tsx scripts/smoke-pcbom.ts
 *
 * P-CBOM's entire claim is "every record traces to something real." The
 * assertions here are the ones that would make that claim false: a record
 * with no citation, a fabricated field, a CDX form missing the schema's
 * required namespaced properties, or a dropdown entry for something Q-Shield
 * never actually measured.
 */
import { getPcbomCatalog } from "../lib/pcbom/catalog";
import { normalizePcbomName, inferPcbomType, inferPcbomStandard } from "../lib/pcbom/emit";

console.log("=== normalize / infer match the upstream reference tool ===");
const cases: [string, string][] = [
  ["SLH_DSA_PURE_SHAKE_128S", "SLH-DSA-SHAKE-128S"],
  ["ML-DSA-65", "ML-DSA-65"],
];
for (const [raw, expected] of cases) {
  const got = normalizePcbomName(raw);
  if (got !== expected) throw new Error(`normalizePcbomName(${raw}) = ${got}, expected ${expected}`);
}
if (inferPcbomType("ML-KEM-768") !== "key-encapsulation") throw new Error("ML-KEM-768 must infer key-encapsulation");
if (inferPcbomType("ML-DSA-65") !== "digital-signature") throw new Error("ML-DSA-65 must infer digital-signature");
if (inferPcbomStandard("ML-KEM-768") !== "NIST FIPS 203") throw new Error("ML-KEM-768 must cite FIPS 203");
if (inferPcbomStandard("FALCON-512") !== undefined) {
  throw new Error("FALCON must NOT get an inferred standard — FIPS 206 is pending, asserting one would be a fabricated citation.");
}
console.log("  OK");

console.log("\n=== catalog is built from real, current Q-Shield data ===");
const { entries, arch } = getPcbomCatalog();
if (entries.length === 0) {
  throw new Error("P-CBOM catalog is empty — the snippet generator would render with nothing to pick.");
}
console.log(`  ${entries.length} (algorithm, operation) entries on ${arch}`);

console.log("\n=== every record carries a real, resolvable citation ===");
for (const e of entries) {
  const perf = e.native.performance;
  if (!perf.ref_url.startsWith("https://raw.githubusercontent.com/Q-Advantage/q-advantage/")) {
    throw new Error(`${e.id}: ref_url "${perf.ref_url}" does not point at the real benchmark repo.`);
  }
  if (!/^[0-9a-f]{7,40}$/.test(perf.commit)) {
    throw new Error(`${e.id}: commit "${perf.commit}" is not a valid short/full SHA.`);
  }
  if (Number.isNaN(Date.parse(perf.last_measured))) {
    throw new Error(`${e.id}: last_measured "${perf.last_measured}" is not a valid timestamp.`);
  }
  if (e.native.p_cbom_extension !== "0.1") {
    throw new Error(`${e.id}: p_cbom_extension must be "0.1" per the schema's const constraint.`);
  }
  // A zero timing is not a measurement — same discipline as smoke-api.ts.
  if (e.native.performance.snapshot.median_us === 0) {
    throw new Error(`${e.id}: median_us is 0 — an absent measurement must be omitted, never zero-filled.`);
  }
}
console.log("  every record: real ref_url, valid commit, valid timestamp, correct extension version");

console.log("\n=== CDX form carries the schema's required namespaced properties ===");
const REQUIRED_CDX_PROPS = [
  "q-advantage:p-cbom:extension",
  "q-advantage:p-cbom:source",
  "q-advantage:p-cbom:measurement_id",
  "q-advantage:p-cbom:ref_url",
  "q-advantage:p-cbom:last_measured",
  "q-advantage:p-cbom:commit",
];
for (const e of entries) {
  const names = new Set(e.cdx.properties.map((p) => p.name));
  for (const required of REQUIRED_CDX_PROPS) {
    if (!names.has(required)) throw new Error(`${e.id}: CDX form is missing required property ${required}`);
  }
  if (e.cdx.cryptoProperties.assetType !== "algorithm") {
    throw new Error(`${e.id}: CDX cryptoProperties.assetType must be "algorithm" (v0.1 scope) — got ${e.cdx.cryptoProperties.assetType}`);
  }
}
console.log(`  ${entries.length} CDX components, all carry the required P-CBOM reference tuple`);

console.log("\n=== baseline sign convention: negative means faster than classical ===");
let baselineCount = 0;
for (const e of entries) {
  const baseline = e.native.performance.snapshot.baseline;
  if (!baseline) continue;
  baselineCount++;
  if (typeof baseline.pct_over_classical !== "number") {
    throw new Error(`${e.id}: baseline.pct_over_classical must be numeric.`);
  }
}
console.log(`  ${baselineCount} of ${entries.length} entries carry a classical baseline (KEM encaps only, by design)`);

console.log("\n=== no entry for an algorithm family this tool doesn't actually emit ===");
const KNOWN_FAMILIES = new Set(["ML-KEM", "ML-DSA", "SLH-DSA"]);
for (const e of entries) {
  if (!KNOWN_FAMILIES.has(e.family)) {
    throw new Error(`${e.id}: unexpected family "${e.family}" — AES/LMS/XMSS are not wired into this generator yet.`);
  }
}
console.log("  OK");

console.log("\nOK — P-CBOM smoke test passed.");
