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

export interface ComposedSuite {
  identity: { protocol: string; mode: string; suite: string };
  timing: TimingBlock;
  size?: { bytes_client_to_server: number; bytes_server_to_client: number; bytes_total: number };
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

export interface SigTrackFile {
  environment: SigTrackEnvironment;
  schemes: Record<string, SigScheme>;
}

export interface ArchBucket {
  tls: TLSComposedFile | null;
  sig: SigTrackFile | null;
  ssh: SSHComposedFile | null;
}

export interface ProtocolsData {
  manifest: Manifest | null;
  byArch: Record<string, ArchBucket>;
}
