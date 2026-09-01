import { describe, expect, it } from "vitest";
import {
  buildPcbomRecord,
  inferPcbomStandard,
  inferPcbomType,
  normalizePcbomName,
  toCdx,
  type BuildPcbomRecordInput,
} from "./emit";
import { REQUIRED_OVERLAY_PROPERTIES, PCBOM_NS, validatePcbomOverlay } from "./enrich";

/**
 * P-CBOM emission correctness and CycloneDX validity — required by
 * docs/standards.md. The clause used to read "if/when that tooling moves into
 * this repo"; it moved, and these are the tests that condition was waiting on.
 *
 * Every value below is an obvious sentinel (9999, -1, a fixture CPU name) per
 * CLAUDE.md guardrail 1. Nothing here could be mistaken for a measurement.
 */
const input: BuildPcbomRecordInput = {
  name: "ML-KEM-768",
  operation: "encaps",
  medianUs: 9999,
  p95Us: 9999,
  opsPerSec: 9999,
  publicKeyBytes: 9999,
  ciphertextBytes: 9999,
  arch: "x86_64",
  cpuModel: "FIXTURE CPU",
  liboqsVersion: "0.0.0-fixture",
  commit: "abcdef1234567890",
  timestamp: "2026-01-01T00:00:00Z",
  refFile: "fixture.json",
};

describe("normalizePcbomName", () => {
  it("turns a Q-Shield internal key into the canonical name", () => {
    expect(normalizePcbomName("SLH_DSA_PURE_SHAKE_128S")).toBe("SLH-DSA-SHAKE-128S");
  });

  it("leaves an already-canonical name alone", () => {
    expect(normalizePcbomName("ML-DSA-65")).toBe("ML-DSA-65");
  });

  it("does not invent an identity for an unknown name", () => {
    expect(normalizePcbomName("Kyber768")).toBe("Kyber768");
  });
});

describe("inferPcbomType", () => {
  it.each([
    ["ML-KEM-768", "key-encapsulation"],
    ["ML-DSA-65", "digital-signature"],
    ["SLH-DSA-SHAKE-128S", "digital-signature"],
    ["FALCON-512", "digital-signature"],
    ["AES-256-GCM", "symmetric-encryption"],
  ])("classifies %s", (name, expected) => {
    expect(inferPcbomType(name)).toBe(expected);
  });

  it("falls back to 'other' rather than guessing", () => {
    expect(inferPcbomType("SOMETHING-NEW-512")).toBe("other");
  });
});

describe("inferPcbomStandard", () => {
  it.each([
    ["ML-KEM-768", "NIST FIPS 203"],
    ["ML-DSA-65", "NIST FIPS 204"],
    ["SLH-DSA-SHAKE-128S", "NIST FIPS 205"],
  ])("cites the standard for %s", (name, expected) => {
    expect(inferPcbomStandard(name)).toBe(expected);
  });

  it("leaves Falcon unset — FIPS 206 is pending, and asserting it would be a false citation", () => {
    expect(inferPcbomStandard("FALCON-512")).toBeUndefined();
    expect(inferPcbomStandard("FN-DSA-512")).toBeUndefined();
  });
});

describe("buildPcbomRecord", () => {
  it("shortens the commit to 7 characters, matching the reference emitter", () => {
    expect(buildPcbomRecord(input).performance.commit).toBe("abcdef1");
  });

  it("builds measurement_id as algorithm/operation/arch/date", () => {
    expect(buildPcbomRecord(input).performance.measurement_id).toBe(
      "ml-kem-768/encaps/x86_64/2026-01-01",
    );
  });

  it("points ref_url at the raw result file the number came from", () => {
    const url = buildPcbomRecord(input).performance.ref_url;
    expect(url).toMatch(/^https:\/\/raw\.githubusercontent\.com\//);
    expect(url.endsWith("/fixture.json")).toBe(true);
  });

  it("omits absent measurements rather than emitting them as zero", () => {
    const sparse = buildPcbomRecord({ ...input, p95Us: undefined, opsPerSec: undefined, ciphertextBytes: undefined });
    expect(sparse.performance.snapshot).not.toHaveProperty("p95_us");
    expect(sparse.performance.snapshot).not.toHaveProperty("throughput_ops_sec");
    expect(sparse.performance.snapshot).not.toHaveProperty("ciphertext_bytes");
    expect(sparse.performance.snapshot.median_us).toBe(9999);
  });

  it("carries the signed baseline convention through unchanged", () => {
    // Negative means the PQC/hybrid asset is FASTER than the classical one it
    // replaces. Flipping this sign would invert every headline built on it.
    const withBaseline = buildPcbomRecord({
      ...input,
      baseline: { classicalAlgorithm: "FIXTURE-CLASSICAL", pctOverClassical: -1 },
    });
    expect(withBaseline.performance.snapshot.baseline).toEqual({
      classical_algorithm: "FIXTURE-CLASSICAL",
      pct_over_classical: -1,
    });
  });

  it("pins the extension version and the CBOM version it binds to", () => {
    const r = buildPcbomRecord(input);
    expect(r.p_cbom_extension).toBe("0.1");
    expect(r.cbom_version).toBe("1.6");
  });

  it("does not fabricate a timestamp or commit when given none", () => {
    const bare = buildPcbomRecord({ ...input, commit: "", timestamp: "" });
    expect(bare.performance.commit).toBe("UNKNOWN");
    expect(bare.performance.last_measured).toBe("1970-01-01T00:00:00Z");
  });
});

describe("toCdx", () => {
  const component = toCdx(buildPcbomRecord(input));

  it("emits a cryptographic-asset bound to assetType algorithm", () => {
    expect(component.type).toBe("cryptographic-asset");
    expect(component.cryptoProperties.assetType).toBe("algorithm");
  });

  it("carries identity in algorithmProperties, not duplicated in the extension", () => {
    expect(component.cryptoProperties.algorithmProperties.parameterSetIdentifier).toBe("ML-KEM-768");
    const names = component.properties.map((p) => p.name);
    expect(names).not.toContain(`${PCBOM_NS}:algorithm`);
  });

  it("includes every property the published overlay schema requires", () => {
    const names = component.properties.map((p) => p.name);
    for (const suffix of REQUIRED_OVERLAY_PROPERTIES) {
      expect(names).toContain(`${PCBOM_NS}:${suffix}`);
    }
  });

  it("satisfies the overlay contract end to end", () => {
    expect(validatePcbomOverlay(component)).toEqual([]);
  });

  it("flattens the snapshot into namespaced scalar properties", () => {
    const median = component.properties.find((p) => p.name === `${PCBOM_NS}:snapshot:median_us`);
    expect(median?.value).toBe("9999");
  });

  it("namespaces baseline fields one level deeper so they cannot collide", () => {
    const withBaseline = toCdx(
      buildPcbomRecord({ ...input, baseline: { classicalAlgorithm: "FIXTURE-CLASSICAL", pctOverClassical: -1 } }),
    );
    const pct = withBaseline.properties.find(
      (p) => p.name === `${PCBOM_NS}:snapshot:baseline:pct_over_classical`,
    );
    expect(pct?.value).toBe("-1");
  });

  it("attaches the reference as an externalReference a reader can follow", () => {
    expect(component.externalReferences).toHaveLength(1);
    expect(component.externalReferences[0].url).toBe(component.properties.find((p) => p.name === `${PCBOM_NS}:ref_url`)?.value);
    expect(component.externalReferences[0].comment).toContain("abcdef1");
  });

  it("gives every property a string value, as CycloneDX requires", () => {
    for (const p of component.properties) {
      expect(typeof p.name).toBe("string");
      expect(typeof p.value).toBe("string");
    }
  });
});
