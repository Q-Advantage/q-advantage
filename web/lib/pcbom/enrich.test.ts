import { describe, expect, it } from "vitest";
import {
  PCBOM_NS,
  checkCdxStructure,
  cdxAlgorithmIdentifier,
  coverageSentence,
  enrichCdxDocument,
  parseCdxText,
  representativeOperation,
  validatePcbomOverlay,
  walkComponents,
  type CdxComponent,
  type CdxDocument,
} from "./enrich";
import { buildPcbomRecord, toCdx } from "./emit";
import type { PcbomCatalog, PcbomCatalogEntry } from "./catalog";

/**
 * Sentinel discipline, per CLAUDE.md guardrail 1: every number below is
 * obviously fabricated (9999, -1) and could never be mistaken for a
 * measurement if it escaped into a result file or a page.
 */
function entry(name: string, operation: string, type: "kem" | "sig"): PcbomCatalogEntry {
  const native = buildPcbomRecord({
    name,
    operation,
    medianUs: 9999,
    p95Us: 9999,
    opsPerSec: 9999,
    arch: "x86_64",
    cpuModel: "FIXTURE CPU",
    liboqsVersion: "0.0.0-fixture",
    commit: "abcdef1234567890",
    timestamp: "2026-01-01T00:00:00Z",
    refFile: "fixture.json",
    ...(operation === "encaps"
      ? { baseline: { classicalAlgorithm: "FIXTURE-CLASSICAL", pctOverClassical: -1 } }
      : {}),
  });
  return {
    id: `${name.toLowerCase()}-${operation}`,
    algorithmId: name.toLowerCase(),
    algorithmName: name,
    family: type === "kem" ? "ML-KEM" : "ML-DSA",
    operation,
    native,
    cdx: toCdx(native),
  };
}

const catalog: PcbomCatalog = {
  arch: "x86_64",
  entries: [
    entry("ML-KEM-768", "keygen", "kem"),
    entry("ML-KEM-768", "encaps", "kem"),
    entry("ML-KEM-768", "decaps", "kem"),
    entry("ML-DSA-65", "keygen", "sig"),
    entry("ML-DSA-65", "sign", "sig"),
    entry("ML-DSA-65", "verify", "sig"),
  ],
};

function cryptoAsset(over: Partial<CdxComponent> = {}): CdxComponent {
  return {
    type: "cryptographic-asset",
    name: "ML-KEM-768",
    cryptoProperties: {
      assetType: "algorithm",
      algorithmProperties: { parameterSetIdentifier: "ML-KEM-768" },
    },
    ...over,
  };
}

function doc(components: CdxComponent[]): CdxDocument {
  return { bomFormat: "CycloneDX", specVersion: "1.6", components };
}

describe("checkCdxStructure", () => {
  it("accepts a well-formed 1.6 document", () => {
    expect(checkCdxStructure(doc([]))).toEqual([]);
  });

  it("accepts a later spec version", () => {
    expect(checkCdxStructure({ ...doc([]), specVersion: "1.7" })).toEqual([]);
  });

  it("rejects a version below 1.6, where crypto assets do not exist", () => {
    const problems = checkCdxStructure({ ...doc([]), specVersion: "1.4" });
    expect(problems).toHaveLength(1);
    expect(problems[0].field).toBe("specVersion");
    expect(problems[0].message).toContain("1.6");
  });

  it("rejects a document that is not CycloneDX at all", () => {
    const problems = checkCdxStructure({ bomFormat: "SPDX", specVersion: "1.6" });
    expect(problems.some((p) => p.field === "bomFormat")).toBe(true);
  });

  it("rejects a non-object, rather than throwing on it later", () => {
    expect(checkCdxStructure(null)[0].field).toBe("(document)");
    expect(checkCdxStructure([])[0].field).toBe("(document)");
    expect(checkCdxStructure("{}")[0].field).toBe("(document)");
  });

  it("flags components present but not an array", () => {
    const problems = checkCdxStructure({ ...doc([]), components: {} });
    expect(problems.some((p) => p.field === "components")).toBe(true);
  });

  it("allows a document with no components key at all", () => {
    expect(checkCdxStructure({ bomFormat: "CycloneDX", specVersion: "1.6" })).toEqual([]);
  });
});

describe("walkComponents", () => {
  it("finds assets nested under an application, not just top-level ones", () => {
    const nested = doc([
      { type: "application", name: "svc", components: [cryptoAsset({ name: "deep" })] },
    ]);
    const found = walkComponents(nested.components);
    expect(found.map((c) => c.name)).toEqual(["svc", "deep"]);
  });

  it("survives a self-referential structure rather than hanging", () => {
    const a: CdxComponent = { type: "application", name: "a" };
    a.components = [a];
    expect(() => walkComponents([a])).not.toThrow();
  });

  it("ignores nulls in the array", () => {
    expect(walkComponents([null as unknown as CdxComponent, cryptoAsset()])).toHaveLength(1);
  });
});

describe("cdxAlgorithmIdentifier", () => {
  it("prefers parameterSetIdentifier over the component name", () => {
    const c = cryptoAsset({
      name: "some vendor label",
      cryptoProperties: {
        assetType: "algorithm",
        algorithmProperties: { parameterSetIdentifier: "ML-DSA-65" },
      },
    });
    expect(cdxAlgorithmIdentifier(c)).toBe("ML-DSA-65");
  });

  it("falls back to name, because real scanners often fill only that", () => {
    const c = cryptoAsset({ name: "ML-DSA-65", cryptoProperties: { assetType: "algorithm" } });
    expect(cdxAlgorithmIdentifier(c)).toBe("ML-DSA-65");
  });

  it("is null when nothing usable was declared, not an empty string", () => {
    expect(cdxAlgorithmIdentifier({ type: "cryptographic-asset", name: "   " })).toBeNull();
    expect(cdxAlgorithmIdentifier({ type: "cryptographic-asset" })).toBeNull();
  });
});

describe("representativeOperation", () => {
  it("picks encaps for a KEM — the per-handshake server cost", () => {
    const kem = catalog.entries.filter((e) => e.algorithmName === "ML-KEM-768");
    expect(representativeOperation(kem)?.operation).toBe("encaps");
  });

  it("picks sign for a signature — the cost that constrains a deployment", () => {
    const sig = catalog.entries.filter((e) => e.algorithmName === "ML-DSA-65");
    expect(representativeOperation(sig)?.operation).toBe("sign");
  });

  it("is null for an empty set rather than throwing", () => {
    expect(representativeOperation([])).toBeNull();
  });
});

describe("enrichCdxDocument", () => {
  it("attaches the full P-CBOM property set to a measured algorithm", () => {
    const result = enrichCdxDocument(doc([cryptoAsset()]), catalog);
    expect(result.summary.enriched).toHaveLength(1);
    expect(result.summary.enriched[0].matchedAlgorithm).toBe("ML-KEM-768");
    expect(result.summary.enriched[0].operation).toBe("encaps");

    const props = result.document.components![0].properties!;
    expect(props.find((p) => p.name === `${PCBOM_NS}:extension`)?.value).toBe("0.1");
    expect(props.find((p) => p.name === `${PCBOM_NS}:ref_url`)?.value).toContain("fixture.json");
  });

  it("produces output that satisfies the published overlay contract", () => {
    const result = enrichCdxDocument(doc([cryptoAsset()]), catalog);
    expect(result.overlayProblems).toEqual([]);
  });

  it("NEVER mutates the caller's document", () => {
    const input = doc([cryptoAsset()]);
    const before = JSON.stringify(input);
    enrichCdxDocument(input, catalog);
    expect(JSON.stringify(input)).toBe(before);
  });

  it("reports an unmeasured algorithm by name instead of skipping it silently", () => {
    const result = enrichCdxDocument(doc([cryptoAsset({ name: "RSA-2048", cryptoProperties: { assetType: "algorithm", algorithmProperties: { parameterSetIdentifier: "RSA-2048" } } })]), catalog);
    expect(result.summary.enriched).toHaveLength(0);
    expect(result.summary.skipped).toEqual([
      { componentName: "RSA-2048", identifier: "RSA-2048", reason: "not-measured" },
    ]);
  });

  it("does NOT alias a legacy spelling to a measured algorithm", () => {
    // Kyber768 and ML-KEM-768 denote the same algorithm, but asserting that on
    // someone else's inventory is an identity claim this tool has no primary
    // source for. It must be reported, not quietly enriched.
    const result = enrichCdxDocument(
      doc([cryptoAsset({ name: "Kyber768", cryptoProperties: { assetType: "algorithm", algorithmProperties: { parameterSetIdentifier: "Kyber768" } } })]),
      catalog,
    );
    expect(result.summary.enriched).toHaveLength(0);
    expect(result.summary.skipped[0]).toMatchObject({ identifier: "Kyber768", reason: "not-measured" });
  });

  it("matches case-insensitively and through underscores, as the emitter does", () => {
    const result = enrichCdxDocument(
      doc([cryptoAsset({ cryptoProperties: { assetType: "algorithm", algorithmProperties: { parameterSetIdentifier: "ml-kem-768" } } })]),
      catalog,
    );
    expect(result.summary.enriched).toHaveLength(1);
  });

  it("leaves protocol assets alone and says why — v0.1 binds to algorithms", () => {
    const result = enrichCdxDocument(
      doc([cryptoAsset({ name: "TLSv1.3", cryptoProperties: { assetType: "protocol" } })]),
      catalog,
    );
    expect(result.summary.enriched).toHaveLength(0);
    expect(result.summary.skipped[0]).toMatchObject({
      reason: "asset-type-out-of-scope",
      assetType: "protocol",
    });
  });

  it("reports a crypto asset that declares no identifier", () => {
    const result = enrichCdxDocument(
      doc([{ type: "cryptographic-asset", cryptoProperties: { assetType: "algorithm" } }]),
      catalog,
    );
    expect(result.summary.skipped[0].reason).toBe("no-algorithm-identifier");
  });

  it("counts every crypto asset, enriched or not", () => {
    const result = enrichCdxDocument(
      doc([cryptoAsset(), cryptoAsset({ name: "RSA-2048", cryptoProperties: { assetType: "algorithm", algorithmProperties: { parameterSetIdentifier: "RSA-2048" } } }), { type: "library", name: "openssl" }]),
      catalog,
    );
    expect(result.summary.componentsTotal).toBe(3);
    expect(result.summary.cryptoAssetsTotal).toBe(2);
    expect(result.summary.enriched).toHaveLength(1);
    expect(result.summary.skipped).toHaveLength(1);
  });

  it("enriches assets nested inside another component", () => {
    const result = enrichCdxDocument(
      doc([{ type: "application", name: "svc", components: [cryptoAsset()] }]),
      catalog,
    );
    expect(result.summary.enriched).toHaveLength(1);
    expect(result.document.components![0].components![0].properties).toBeDefined();
  });

  it("is idempotent — re-enriching does not duplicate properties or references", () => {
    const once = enrichCdxDocument(doc([cryptoAsset()]), catalog);
    const twice = enrichCdxDocument(once.document, catalog);
    const a = once.document.components![0];
    const b = twice.document.components![0];
    expect(b.properties).toHaveLength(a.properties!.length);
    expect(b.externalReferences).toHaveLength(1);
    expect(twice.overlayProblems).toEqual([]);
  });

  it("preserves the caller's own properties and external references", () => {
    const result = enrichCdxDocument(
      doc([
        cryptoAsset({
          properties: [{ name: "internal:owner", value: "payments-team" }],
          externalReferences: [{ type: "website", url: "https://example.invalid/policy" }],
        }),
      ]),
      catalog,
    );
    const c = result.document.components![0];
    expect(c.properties!.find((p) => p.name === "internal:owner")?.value).toBe("payments-team");
    expect(c.externalReferences!.some((r) => r.url === "https://example.invalid/policy")).toBe(true);
  });

  it("lists what it could have matched, so an empty result is explicable", () => {
    const result = enrichCdxDocument(doc([]), catalog);
    expect(result.summary.measuredAlgorithms).toEqual(["ML-DSA-65", "ML-KEM-768"]);
  });
});

describe("validatePcbomOverlay", () => {
  it("passes a component this tool actually produced", () => {
    const result = enrichCdxDocument(doc([cryptoAsset()]), catalog);
    expect(validatePcbomOverlay(result.document.components![0])).toEqual([]);
  });

  it("catches a missing required property from the reference tuple", () => {
    const result = enrichCdxDocument(doc([cryptoAsset()]), catalog);
    const c = result.document.components![0];
    c.properties = c.properties!.filter((p) => p.name !== `${PCBOM_NS}:commit`);
    expect(validatePcbomOverlay(c).some((p) => p.includes("commit"))).toBe(true);
  });

  it("catches a wrong extension version", () => {
    const result = enrichCdxDocument(doc([cryptoAsset()]), catalog);
    const c = result.document.components![0];
    c.properties!.find((p) => p.name === `${PCBOM_NS}:extension`)!.value = "0.2";
    expect(validatePcbomOverlay(c).some((p) => p.includes("0.1"))).toBe(true);
  });

  it("catches an assetType v0.1 does not bind to", () => {
    const result = enrichCdxDocument(doc([cryptoAsset()]), catalog);
    const c = result.document.components![0];
    c.cryptoProperties!.assetType = "protocol";
    expect(validatePcbomOverlay(c).some((p) => p.includes("assetType"))).toBe(true);
  });

  it("reports a missing properties array rather than throwing", () => {
    expect(validatePcbomOverlay({ type: "cryptographic-asset", cryptoProperties: { assetType: "algorithm" } })).toContain(
      "(unnamed component): properties[] is missing.",
    );
  });
});

describe("parseCdxText", () => {
  it("rejects empty input with something actionable", () => {
    const r = parseCdxText("   ");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("Nothing to read");
  });

  it("rejects a JSON array at the root", () => {
    const r = parseCdxText("[]");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("object at its root");
  });

  it("surfaces the parser's own message on malformed JSON", () => {
    const r = parseCdxText("{ nope }");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("Not valid JSON");
  });

  it("accepts a valid object", () => {
    const r = parseCdxText('{"bomFormat":"CycloneDX"}');
    expect(r.ok).toBe(true);
  });
});

describe("coverageSentence", () => {
  it("says plainly when there was nothing to enrich", () => {
    const result = enrichCdxDocument(doc([]), catalog);
    expect(coverageSentence(result.summary)).toContain("No cryptographic-asset components");
  });

  it("counts enriched against total crypto assets", () => {
    const result = enrichCdxDocument(
      doc([cryptoAsset(), cryptoAsset({ name: "RSA-2048", cryptoProperties: { assetType: "algorithm", algorithmProperties: { parameterSetIdentifier: "RSA-2048" } } })]),
      catalog,
    );
    expect(coverageSentence(result.summary)).toBe(
      "1 of 2 cryptographic-asset components enriched with live Q-Shield data.",
    );
  });
});
