/**
 * P-CBOM v0.1 record emission — TypeScript port of `Q-Advantage/p-cbom`'s
 * reference implementation (`tools/emit_pcbom.py`, commit-pinned per
 * `work-orders/012-pcbom-snippet-generator.md`).
 *
 * This is a faithful port, not a reinterpretation: `normalizePcbomName`,
 * `inferPcbomType`, `inferPcbomStandard`, `buildPcbomRecord`, and `toCdx`
 * mirror the Python functions of the same name (`normalize_name`, `infer_type`,
 * `infer_standard`, `build_record`, `to_cdx`) field-for-field against the real
 * schema (`schema/p-cbom-0.1.json`, `schema/p-cbom-0.1.cdx.json` — mirrored
 * from the `Q-Advantage/p-cbom` repo in this same PR). If the two ever need to
 * diverge, that is a decision to make deliberately, not a drift to let happen.
 *
 * Unlike the Python tool (which reads raw Q-Shield result files from disk),
 * this module builds records from this repo's own already-loaded, already-typed
 * protocol data (`lib/protocols/load.ts` / `lib/protocols/types.ts`) — reusing
 * that loader rather than re-parsing JSON a second time.
 */

import { GITHUB_REPO } from "../format";

export const DATASET_SOURCE = "q-advantage/q-shield";
export const RAW_BASE = `https://raw.githubusercontent.com/${GITHUB_REPO}/main/benchmark/results/protocols`;

export type PcbomAlgorithmType =
  | "digital-signature"
  | "key-encapsulation"
  | "symmetric-encryption"
  | "hash"
  | "mac"
  | "key-derivation"
  | "other";

const TYPE_BY_PREFIX: Record<string, PcbomAlgorithmType> = {
  "ML-KEM": "key-encapsulation",
  "ML-DSA": "digital-signature",
  "SLH-DSA": "digital-signature",
  FALCON: "digital-signature",
  "FN-DSA": "digital-signature",
  AES: "symmetric-encryption",
};

// Falcon / FN-DSA: FIPS 206 pending — leave unset rather than assert, same as
// the Python reference.
const STANDARD_BY_PREFIX: Record<string, string> = {
  "ML-KEM": "NIST FIPS 203",
  "ML-DSA": "NIST FIPS 204",
  "SLH-DSA": "NIST FIPS 205",
};

/**
 * Q-Shield internal key -> canonical algorithm name.
 * SLH_DSA_PURE_SHAKE_128S -> SLH-DSA-SHAKE-128S ; ML-DSA-65 -> ML-DSA-65.
 */
export function normalizePcbomName(raw: string): string {
  return raw.replace(/_/g, "-").replace(/-PURE-/gi, "-");
}

export function inferPcbomType(name: string): PcbomAlgorithmType {
  const up = name.toUpperCase();
  for (const [prefix, type] of Object.entries(TYPE_BY_PREFIX)) {
    if (up.startsWith(prefix)) return type;
  }
  return "other";
}

export function inferPcbomStandard(name: string): string | undefined {
  const up = name.toUpperCase();
  for (const [prefix, standard] of Object.entries(STANDARD_BY_PREFIX)) {
    if (up.startsWith(prefix)) return standard;
  }
  return undefined;
}

function shortCommit(commit: string): string {
  return commit ? commit.slice(0, 7) : "UNKNOWN";
}

export interface PcbomBaseline {
  classical_algorithm: string;
  pct_over_classical: number;
  comparison?: string;
}

export interface PcbomSnapshot {
  operation: string;
  platform: string;
  median_us?: number;
  p95_us?: number;
  throughput_ops_sec?: number;
  signature_bytes?: number;
  public_key_bytes?: number;
  ciphertext_bytes?: number;
  baseline?: PcbomBaseline;
}

export interface PcbomRecord {
  cbom_version: string;
  p_cbom_extension: "0.1";
  algorithm: {
    name: string;
    type: PcbomAlgorithmType;
    standard?: string;
  };
  implementation: {
    library: string;
    version: string;
    build_flags?: string;
  };
  performance: {
    source: string;
    measurement_id: string;
    ref_url: string;
    last_measured: string;
    commit: string;
    snapshot: PcbomSnapshot;
  };
}

export interface BuildPcbomRecordInput {
  name: string;
  operation: string;
  medianUs?: number;
  p95Us?: number;
  opsPerSec?: number;
  signatureBytes?: number;
  publicKeyBytes?: number;
  ciphertextBytes?: number;
  arch: string;
  cpuModel: string;
  buildFlags?: string;
  liboqsVersion: string;
  /** Full commit SHA — shortened to 7 chars to match the Python reference. */
  commit: string;
  /** RFC 3339 UTC timestamp. */
  timestamp: string;
  /** Filename under benchmark/results/protocols/, used to build ref_url. */
  refFile: string;
  baseline?: {
    classicalAlgorithm: string;
    pctOverClassical: number;
    comparison?: string;
  };
}

export function buildPcbomRecord(input: BuildPcbomRecordInput): PcbomRecord {
  const commit = shortCommit(input.commit);
  const dateOnly = (input.timestamp || "1970-01-01T00:00:00Z").slice(0, 10);
  const measurementId = `${input.name.toLowerCase()}/${input.operation}/${input.arch}/${dateOnly}`;

  const snapshot: PcbomSnapshot = {
    operation: input.operation,
    platform: `${input.cpuModel} (${input.arch})`,
  };
  if (input.medianUs != null) snapshot.median_us = input.medianUs;
  if (input.p95Us != null) snapshot.p95_us = input.p95Us;
  if (input.opsPerSec != null) snapshot.throughput_ops_sec = input.opsPerSec;
  if (input.signatureBytes != null) snapshot.signature_bytes = input.signatureBytes;
  if (input.publicKeyBytes != null) snapshot.public_key_bytes = input.publicKeyBytes;
  if (input.ciphertextBytes != null) snapshot.ciphertext_bytes = input.ciphertextBytes;
  if (input.baseline) {
    snapshot.baseline = {
      classical_algorithm: input.baseline.classicalAlgorithm,
      pct_over_classical: input.baseline.pctOverClassical,
      ...(input.baseline.comparison ? { comparison: input.baseline.comparison } : {}),
    };
  }

  const record: PcbomRecord = {
    cbom_version: "1.6",
    p_cbom_extension: "0.1",
    algorithm: { name: input.name, type: inferPcbomType(input.name) },
    implementation: { library: "liboqs", version: input.liboqsVersion || "unknown" },
    performance: {
      source: DATASET_SOURCE,
      measurement_id: measurementId,
      ref_url: `${RAW_BASE}/${input.refFile}`,
      last_measured: input.timestamp || "1970-01-01T00:00:00Z",
      commit,
      snapshot,
    },
  };

  const standard = inferPcbomStandard(input.name);
  if (standard) record.algorithm.standard = standard;
  if (input.buildFlags) record.implementation.build_flags = input.buildFlags;

  return record;
}

export interface PcbomCdxProperty {
  name: string;
  value: string;
}

export interface PcbomCdxComponent {
  type: "cryptographic-asset";
  name: string;
  "bom-ref": string;
  cryptoProperties: {
    assetType: "algorithm";
    algorithmProperties: { parameterSetIdentifier: string };
  };
  externalReferences: { type: string; url: string; comment: string }[];
  properties: PcbomCdxProperty[];
}

/**
 * Wrap a native record as a valid CycloneDX cryptographic-asset component.
 * Matches emit_pcbom.py's to_cdx(): cryptoProperties.algorithmProperties
 * carries identity; the reference lives in an externalReference; the full
 * record rides in the sanctioned properties[] as namespaced entries.
 */
export function toCdx(native: PcbomRecord): PcbomCdxComponent {
  const NS = "q-advantage:p-cbom";
  const { algorithm, performance: perf, implementation: impl } = native;

  const props: PcbomCdxProperty[] = [
    { name: `${NS}:extension`, value: native.p_cbom_extension },
    { name: `${NS}:source`, value: perf.source },
    { name: `${NS}:measurement_id`, value: perf.measurement_id },
    { name: `${NS}:ref_url`, value: perf.ref_url },
    { name: `${NS}:last_measured`, value: perf.last_measured },
    { name: `${NS}:commit`, value: perf.commit },
    {
      name: `${NS}:implementation`,
      value: `${impl.library} ${impl.version}${impl.build_flags ? ` (${impl.build_flags})` : ""}`,
    },
  ];

  for (const [key, value] of Object.entries(perf.snapshot)) {
    if (value == null) continue;
    if (key === "baseline" && typeof value === "object") {
      for (const [bKey, bValue] of Object.entries(value as Record<string, unknown>)) {
        if (bValue == null) continue;
        props.push({ name: `${NS}:snapshot:baseline:${bKey}`, value: String(bValue) });
      }
    } else {
      props.push({ name: `${NS}:snapshot:${key}`, value: String(value) });
    }
  }

  return {
    type: "cryptographic-asset",
    name: algorithm.name,
    "bom-ref": `crypto/algorithm/${algorithm.name.toLowerCase()}`,
    cryptoProperties: {
      assetType: "algorithm",
      algorithmProperties: { parameterSetIdentifier: algorithm.name },
    },
    externalReferences: [
      {
        type: "other",
        url: perf.ref_url,
        comment: `P-CBOM performance reference (${perf.source}). commit ${perf.commit}, measured ${perf.last_measured}.`,
      },
    ],
    properties: props,
  };
}
