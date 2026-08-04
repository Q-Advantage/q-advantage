/**
 * Algorithm naming normalization + NIST security category mapping.
 *
 * liboqs uses inconsistent naming:
 *   ML-KEM-512                  (hyphens, simple)
 *   ML-DSA-65                   (hyphens, simple)
 *   SLH_DSA_PURE_SHAKE_128S     (underscores, with redundant PURE_ prefix)
 *
 * We normalize all of these to:
 *   - id: URL slug (lowercase, hyphens)
 *   - display_name: canonical NIST-style name
 *   - family: ML-KEM | ML-DSA | SLH-DSA
 *   - parameter_set: the variable suffix (e.g. "512", "65", "SHAKE-128s")
 *   - nist_level: NIST security category 1/2/3/5
 *
 * NIST levels (per FIPS 203/204/205):
 *   Level 1: ≥ AES-128 brute force
 *   Level 2: ≥ SHA-256 collision
 *   Level 3: ≥ AES-192 brute force
 *   Level 5: ≥ AES-256 brute force
 * (Level 4 was defined but no standardized parameter set targets it.)
 *
 * Keep this logic in ONE place. Components must never parse liboqs keys directly.
 */

import type { AlgorithmFamily, AlgorithmRaw, NormalizedAlgorithm, Operation } from "./types";

interface NameParts {
  id: string;
  display_name: string;
  family: AlgorithmFamily;
  parameter_set: string;
  nist_level: 1 | 2 | 3 | 5;
}

export function parseAlgorithmKey(liboqs_key: string): NameParts {
  // ML-KEM-512 (L1), ML-KEM-768 (L3), ML-KEM-1024 (L5) per FIPS 203
  const mlKem = liboqs_key.match(/^ML-KEM-(\d+)$/);
  if (mlKem) {
    const param = mlKem[1];
    const level = param === "512" ? 1 : param === "768" ? 3 : 5;
    return {
      id: `ml-kem-${param}`,
      display_name: `ML-KEM-${param}`,
      family: "ML-KEM",
      parameter_set: param,
      nist_level: level as 1 | 3 | 5,
    };
  }

  // ML-DSA-44 (L2), ML-DSA-65 (L3), ML-DSA-87 (L5) per FIPS 204
  const mlDsa = liboqs_key.match(/^ML-DSA-(\d+)$/);
  if (mlDsa) {
    const param = mlDsa[1];
    const level = param === "44" ? 2 : param === "65" ? 3 : 5;
    return {
      id: `ml-dsa-${param}`,
      display_name: `ML-DSA-${param}`,
      family: "ML-DSA",
      parameter_set: param,
      nist_level: level as 2 | 3 | 5,
    };
  }

  // SLH_DSA_PURE_SHAKE_128S → L1, _192S → L3, _256S → L5 per FIPS 205
  // Same for SHA2 variants and F (fast) variants.
  const slhDsa = liboqs_key.match(/^SLH_DSA_(?:PURE_)?(SHAKE|SHA2)_(\d+)([SF])$/);
  if (slhDsa) {
    const hash = slhDsa[1];
    const bits = slhDsa[2];
    const speed = slhDsa[3].toLowerCase();
    const level = bits === "128" ? 1 : bits === "192" ? 3 : 5;
    return {
      id: `slh-dsa-${hash.toLowerCase()}-${bits}${speed}`,
      display_name: `SLH-DSA-${hash}-${bits}${speed}`,
      family: "SLH-DSA",
      parameter_set: `${hash}-${bits}${speed}`,
      nist_level: level as 1 | 3 | 5,
    };
  }

  // No match — fail loudly rather than fabricate a classification. Silently
  // defaulting to family: "ML-KEM", nist_level: 1 would render an unrecognized
  // algorithm (e.g. from a liboqs bump) as a specific, false security claim on
  // the public dashboard. Matches the fail-loud convention in load.ts.
  throw new Error(
    `Unrecognized liboqs algorithm key "${liboqs_key}". Add a case for it in ` +
      `parseAlgorithmKey() (web/lib/data/normalize.ts) — do not let it fall ` +
      `through to a guessed family/NIST level.`,
  );
}

export function normalizeAlgorithm(
  liboqs_key: string,
  raw: AlgorithmRaw,
): NormalizedAlgorithm {
  const parts = parseAlgorithmKey(liboqs_key);

  const operations: Record<Operation, import("./types").OperationStats | undefined> = {
    keygen: raw.keygen,
    encap: raw.type === "kem" ? raw.encap : undefined,
    decap: raw.type === "kem" ? raw.decap : undefined,
    sign: raw.type === "sig" ? raw.sign : undefined,
    verify: raw.type === "sig" ? raw.verify : undefined,
  };

  return {
    id: parts.id,
    display_name: parts.display_name,
    liboqs_key,
    family: parts.family,
    parameter_set: parts.parameter_set,
    nist_level: parts.nist_level,
    kind: raw.type,
    pubkey_bytes: raw.pubkey_bytes,
    privkey_bytes: raw.privkey_bytes,
    ciphertext_bytes: raw.type === "kem" ? raw.ciphertext_bytes : undefined,
    signature_bytes: raw.type === "sig" ? raw.signature_bytes : undefined,
    operations,
    status: raw.status,
  };
}
