// web/lib/protocols/types.ts
// Arch-aware: manifest.files keyed "{track}::{arch}", ProtocolsData holds per-arch buckets.

export interface ManifestFileEntry {
  track: string;
  arch: string;
  filename: string;
  date: string;
  commit: string;
}

export interface Manifest {
  generated_utc: string;
  tracks: string[];
  arches: string[];
  files: Record<string, ManifestFileEntry>;
}

export interface TimingBlock {
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

export interface CrossValidation {
  ebacs_reference_cycles?: number;
  liboqs_speed_number?: number;
  measured_vs_reference_pct?: number;
  reference_notes?: string;
}

/**
 * Per-operation resource accounting (`qshield-update-spec.md` §15, Tier 1).
 *
 * Read the CPU figure with its own caveat attached: on a single-core-pinned
 * harness it reads close to wall time by construction. And `max_rss_delta_bytes`
 * is the growth in a process high-water mark across the whole loop, not a
 * per-operation footprint — it is deliberately not divided by the iteration
 * count, because doing so would produce a confident, meaningless number.
 */
export interface ResourceAccounting {
  measured: boolean;
  reason?: string;
  cpu_us_per_op?: number | null;
  cpu_seconds_total?: number | null;
  max_rss_delta_bytes?: number | null;
  max_rss_bytes?: number | null;
  cpu_note?: string;
  rss_note?: string;
  rss_unit_note?: string;
}

export interface ComposedSuite {
  identity: { protocol: string; mode: string; suite: string };
  timing: TimingBlock;
  size?: {
    bytes_client_to_server: number;
    bytes_server_to_client: number;
    bytes_total: number;
    /**
     * Secret key length. §16.3 makes this blocking for the TCM's Expansion &
     * Retention line item — storage for larger private keys cannot be priced
     * from public key sizes alone. Emitted from 2026-08-30 onward.
     */
    secret_key_bytes?: number;
  };
  resources?: ResourceAccounting;
  baseline?: { baseline_suite: string; pct_over_classical: number };
  cross_validation?: CrossValidation;
  auth?: null;
  toolchain?: {
    liboqs?: string;
    liboqs_python?: string;
    openssl_runtime?: string;
    openssl_cli?: string;
    oqs_provider?: string | null;
    openssh?: string;
  };
  host?: {
    cpu_model?: string;
    arch?: string;
    /**
     * Which machine measured this. Two hosts can share an architecture, and
     * without this they collapse into one bucket — see lib/data/hosts.ts.
     */
    ec2_instance_type?: string;
    build_path?: string;
    cpu_flags?: string[];
    cpu_hz_nominal?: number;
    steal_time_pct?: number;
  };
  audit?: { git_commit?: string; timestamp_utc?: string };
  phases?: Record<string, TimingBlock>;
}

export interface ComposedEnvironment {
  iso_timestamp: string;
  liboqs_version: string;
  liboqs_python_version: string;
  openssl_cli?: string;
  git_commit: string;
}

export interface TLSComposedFile {
  environment: ComposedEnvironment;
  suites: Record<string, ComposedSuite>;
}

export type SSHComposedFile = TLSComposedFile;

export interface SigScheme {
  scheme: string;
  keygen: TimingBlock;
  sign: TimingBlock;
  verify: TimingBlock;
  signature_bytes: number;
  public_key_bytes: number;
  cross_validation?: CrossValidation;
}

export interface SigTrackEnvironment {
  iso_timestamp: string;
  liboqs_version: string;
  liboqs_python_version: string;
  git_commit: string;
  cpu_model?: string;
  arch?: string;
  build_path?: string;
  steal_time_pct?: number;
}

/**
 * Whether a signature record is a candidate or a reference line.
 *
 * Emitted from 2026-08-30. Absent on every earlier committed run, which is why
 * consumers must treat `undefined` as "not stated" rather than as post-quantum.
 */
export type SigKind = "post-quantum" | "classical";

export interface SigTrackFile {
  environment: SigTrackEnvironment;
  schemes: Record<string, SigScheme>;
}

export interface AesBaselineRecord {
  algorithm: string;
  payload_bytes: number;
  payload_bytes_source: string;
  key_bytes: number;
  nonce_bytes: number;
  tag_bytes: number;
  encrypt: TimingBlock;
  decrypt: TimingBlock;
}

export interface AesBaselineFile {
  environment: SigTrackEnvironment;
  baseline: AesBaselineRecord;
}

/** One LMS/XMSS scheme record. `status !== "ok"` means no real numbers —
 * see `reason` (unavailable) or `error` (failed). Never render a stat block
 * for a non-"ok" record. */
export interface StatefulSigScheme {
  scheme: string;
  status: "ok" | "unavailable" | "failed";
  reason?: string;
  error?: string;
  error_type?: string;
  use_case_note?: string;
  sigs_total?: number;
  n_iterations_actual?: number;
  n_iterations_requested?: number;
  keygen?: TimingBlock | null;
  sign?: TimingBlock;
  verify?: TimingBlock;
  signature_bytes?: number;
  public_key_bytes?: number;
}

export interface LmsXmssFile {
  environment: SigTrackEnvironment;
  schemes: Record<string, StatefulSigScheme>;
}

export interface ArchBucket {
  tls: TLSComposedFile | null;
  sig: SigTrackFile | null;
  ssh: SSHComposedFile | null;
  aes: AesBaselineFile | null;
  lmsXmss: LmsXmssFile | null;
}

export interface ProtocolsData {
  manifest: Manifest | null;
  byArch: Record<string, ArchBucket>;
}
