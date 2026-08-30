/**
 * Type definitions for Q-Shield benchmark result files.
 *
 * These mirror the on-disk JSON schema exactly. The discriminated union on
 * `type` ("kem" | "sig") guarantees correct operation names at the call site:
 * KEMs expose keygen/encap/decap, signatures expose keygen/sign/verify.
 *
 * `runtime_metrics` is optional because legacy result files (pre-Day 15) do
 * not contain the block. The UI must render an "older run" pill when missing.
 */

export interface BenchmarkEnvironment {
  iso_timestamp: string;
  cpu_model: string;
  cpu_cores_logical: number;
  cpu_cores_physical: number;
  ram_total_gb: number;
  kernel: string;
  os_release: string;
  python_version: string;
  liboqs_version: string;
  liboqs_python_version: string;
  ec2_instance_type: string;
  git_commit: string;
  git_branch: string;
  script_args: string[];
}

export interface RuntimeMetrics {
  wall_clock_seconds: number;
  cpu_steal_jiffies: number;
  cpu_steal_seconds: number;
  loadavg_start: [number, number, number];
  loadavg_end: [number, number, number];
  instance_type: string;
  burstable: boolean;
}

export interface OperationStats {
  mean_us: number;
  median_us: number;
  p95_us: number;
  p99_us: number;
  stdev_us: number;
  min_us: number;
  max_us: number;
  ops_per_sec: number;
  n_iterations: number;
}

export interface KemAlgorithmRaw {
  status: "ok" | "error";
  type: "kem";
  pubkey_bytes: number;
  privkey_bytes: number;
  ciphertext_bytes: number;
  keygen: OperationStats;
  encap: OperationStats;
  decap: OperationStats;
}

export interface SignatureAlgorithmRaw {
  status: "ok" | "error";
  type: "sig";
  pubkey_bytes: number;
  privkey_bytes: number;
  signature_bytes: number;
  keygen: OperationStats;
  sign: OperationStats;
  verify: OperationStats;
}

export type AlgorithmRaw = KemAlgorithmRaw | SignatureAlgorithmRaw;

/** Shape of a result file on disk. */
export interface BenchmarkResultFile {
  environment: BenchmarkEnvironment;
  runtime_metrics?: RuntimeMetrics;
  algorithms: Record<string, AlgorithmRaw>;
}

// ---------------------------------------------------------------------------
// Normalized / derived types — what the loader returns to components.
// ---------------------------------------------------------------------------

export type AlgorithmFamily = "ML-KEM" | "ML-DSA" | "SLH-DSA";
export type AlgorithmKind = "kem" | "sig";
export type KemOperation = "keygen" | "encap" | "decap";
export type SigOperation = "keygen" | "sign" | "verify";
export type Operation = KemOperation | SigOperation;

export interface NormalizedAlgorithm {
  /** URL-safe slug, e.g. "ml-dsa-65", "slh-dsa-shake-128s" */
  id: string;
  /** Human display name, e.g. "ML-DSA-65", "SLH-DSA-SHAKE-128s" */
  display_name: string;
  /** Original liboqs key, preserved for traceability */
  liboqs_key: string;
  family: AlgorithmFamily;
  parameter_set: string;
  /** NIST security category (1, 2, 3, or 5). See FIPS 203/204/205. */
  nist_level: 1 | 2 | 3 | 5;
  kind: AlgorithmKind;
  pubkey_bytes: number;
  privkey_bytes: number;
  /** Defined for KEMs only */
  ciphertext_bytes?: number;
  /** Defined for signatures only */
  signature_bytes?: number;
  operations: Record<Operation, OperationStats | undefined>;
  status: "ok" | "error";
}

export interface NormalizedRun {
  /** Filename without extension, e.g. "results-2026-05-16-777fee6" */
  file_id: string;
  /** Original filename */
  file_name: string;
  /** Parsed timestamp from environment.iso_timestamp */
  timestamp: Date;
  /** YYYY-MM-DD extracted from filename */
  date_string: string;
  /** Short SHA (7 chars) or null if legacy filename without SHA */
  short_sha: string | null;
  /** Full commit SHA from environment.git_commit */
  full_sha: string;
  environment: BenchmarkEnvironment;
  runtime_metrics: RuntimeMetrics | null;
  /** True when the file used the legacy filename pattern (no SHA suffix) */
  is_legacy_filename: boolean;
  /** True when runtime_metrics was missing */
  is_legacy_schema: boolean;
  /**
   * Hardware era this run belongs to (see lib/data/hosts.ts). Derived from
   * `environment.ec2_instance_type` at load time, never authored. Runs in
   * different eras were measured on different machines and must not be drawn
   * as one continuous series.
   */
  host_era_id: string;
  algorithms: NormalizedAlgorithm[];
  /** Quick lookup by algorithm id */
  algorithms_by_id: Record<string, NormalizedAlgorithm>;
}
