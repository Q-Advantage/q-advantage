// web/lib/protocols/types.ts
//
// Types derived from the confirmed JSON schemas:
//   tls-composed-2026-06-10-857e560.json  (suites shape)
//   sig-track-2026-06-10-857e560.json     (schemes shape)
//   ssh-composed mirrors tls-composed (suites shape)
//
// All optional fields are marked ? — the dashboard gracefully omits them
// rather than throwing if a future run changes shape.

// ── manifest ─────────────────────────────────────────────────────────────────

export interface ManifestFileEntry {
  filename: string;
  date: string;      // YYYY-MM-DD
  commit: string;    // short hash
}

export interface Manifest {
  generated_utc: string;
  tracks: string[];
  files: Record<string, ManifestFileEntry>;
}

// ── shared timing block ───────────────────────────────────────────────────────

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

// ── cross-validation ──────────────────────────────────────────────────────────

export interface CrossValidation {
  ebacs_reference_cycles?: number;
  liboqs_speed_number?: number;       // µs from speed_kem / speed_sig
  measured_vs_reference_pct?: number; // negative = our harness faster
  reference_notes?: string;           // long string — render as collapsible
}

// ── tls-composed / ssh-composed ───────────────────────────────────────────────

export interface ComposedSuite {
  identity: {
    protocol: string;
    mode: string;
    suite: string;
  };
  timing: TimingBlock;
  size?: {
    bytes_client_to_server: number;
    bytes_server_to_client: number;
    bytes_total: number;
  };
  baseline?: {
    baseline_suite: string;
    pct_over_classical: number;  // positive = PQC slower; negative = PQC faster
  };
  cross_validation?: CrossValidation;
  auth?: null;  // null for KEM-only suites; populated when auth track added
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
    arch?: string;             // "x86_64" | "aarch64" — key for multi-arch
    build_path?: string;       // raw string from JSON; §8 rewrite fixes the text
    cpu_flags?: string[];
    cpu_hz_nominal?: number;
    steal_time_pct?: number;
  };
  audit?: {
    git_commit?: string;
    timestamp_utc?: string;
  };
  phases?: Record<string, TimingBlock>;  // kem_keygen, kem_encaps, kem_decaps, etc.
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

export type SSHComposedFile = TLSComposedFile;  // same shape, different suites

// ── sig-track ────────────────────────────────────────────────────────────────

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

export interface SigTrackFile {
  environment: SigTrackEnvironment;
  schemes: Record<string, SigScheme>;
}

// ── page-level aggregate ──────────────────────────────────────────────────────

export interface ProtocolsData {
  manifest: Manifest | null;
  tls: TLSComposedFile | null;
  sig: SigTrackFile | null;
  ssh: SSHComposedFile | null;
}
