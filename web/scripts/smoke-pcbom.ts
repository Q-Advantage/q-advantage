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
import {
  checkCdxStructure,
  coverageSentence,
  enrichCdxDocument,
  type CdxDocument,
} from "../lib/pcbom/enrich";

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

console.log("\n=== capability 2: enrichment against the real catalog ===");

// Shaped like something a real scanner emits: assets nested under an
// application, a measured algorithm, an unmeasured one, a legacy spelling, a
// protocol asset, and a component that is not a crypto asset at all.
const sampleBom: CdxDocument = {
  bomFormat: "CycloneDX",
  specVersion: "1.6",
  components: [
    {
      type: "application",
      name: "payments-api",
      components: [
        {
          type: "cryptographic-asset",
          name: "ML-KEM-768",
          cryptoProperties: {
            assetType: "algorithm",
            algorithmProperties: { parameterSetIdentifier: "ML-KEM-768" },
          },
          properties: [{ name: "internal:owner", value: "payments" }],
        },
      ],
    },
    {
      type: "cryptographic-asset",
      name: "RSA-2048",
      cryptoProperties: { assetType: "algorithm", algorithmProperties: { parameterSetIdentifier: "RSA-2048" } },
    },
    {
      type: "cryptographic-asset",
      name: "Kyber768",
      cryptoProperties: { assetType: "algorithm", algorithmProperties: { parameterSetIdentifier: "Kyber768" } },
    },
    { type: "cryptographic-asset", name: "TLSv1.3", cryptoProperties: { assetType: "protocol" } },
    { type: "library", name: "openssl" },
  ],
};

if (checkCdxStructure(sampleBom).length !== 0) {
  throw new Error("the sample CycloneDX 1.6 document failed the structural gate");
}

const frozen = JSON.stringify(sampleBom);
const enrichment = enrichCdxDocument(sampleBom, { entries, arch });

if (JSON.stringify(sampleBom) !== frozen) {
  throw new Error("enrichCdxDocument mutated the caller's document -- it must deep-clone first.");
}
if (enrichment.overlayProblems.length > 0) {
  throw new Error(
    "enriched output failed the published overlay contract: " + enrichment.overlayProblems.join("; "),
  );
}
if (enrichment.summary.cryptoAssetsTotal !== 4) {
  throw new Error("expected 4 crypto assets counted, got " + enrichment.summary.cryptoAssetsTotal);
}

const enrichedNames = enrichment.summary.enriched.map((e) => e.matchedAlgorithm);
if (!enrichedNames.includes("ML-KEM-768")) {
  throw new Error("ML-KEM-768 is in the catalog but was not enriched -- the nested walk is broken.");
}

const kyber = enrichment.summary.skipped.find((sk) => sk.identifier === "Kyber768");
if (!kyber || kyber.reason !== "not-measured") {
  throw new Error(
    "Kyber768 must be reported as unmatched. Silently treating it as ML-KEM-768 would be this tool " +
      "asserting an algorithm identity on someone else's inventory without a source for the claim.",
  );
}

const proto = enrichment.summary.skipped.find((sk) => sk.componentName === "TLSv1.3");
if (!proto || proto.reason !== "asset-type-out-of-scope") {
  throw new Error("a protocol asset must be left alone -- P-CBOM v0.1 binds to algorithm assets only.");
}

// The reader's own data must survive being enriched.
const nested = enrichment.document.components?.[0]?.components?.[0];
if (!nested?.properties?.some((prop) => prop.name === "internal:owner")) {
  throw new Error("enrichment dropped a property the caller's document already carried.");
}

// Re-running must not duplicate anything.
const again = enrichCdxDocument(enrichment.document, { entries, arch });
const firstCount = nested.properties.length;
const secondCount = again.document.components?.[0]?.components?.[0]?.properties?.length ?? -1;
if (firstCount !== secondCount) {
  throw new Error("enrichment is not idempotent: " + firstCount + " properties became " + secondCount);
}

console.log("  " + coverageSentence(enrichment.summary));
for (const e of enrichment.summary.enriched) {
  console.log("    enriched  " + e.componentName.padEnd(12) + " -> " + e.matchedAlgorithm + " / " + e.operation);
}
for (const sk of enrichment.summary.skipped) {
  console.log("    skipped   " + sk.componentName.padEnd(12) + " " + sk.reason);
}
console.log("  input unmutated, overlay contract satisfied, re-run idempotent");

console.log("\nOK — P-CBOM smoke test passed.");
