// web/lib/data/cert-chain.ts
//
// Certificate-chain sizes, and the congestion-window consequence.
//
// WHY THIS DATA EXISTS SEPARATELY FROM THE DAILY RUN. Minting an ML-DSA
// certificate needs OpenSSL with `oqs-provider`, and the measurement host runs
// OpenSSL 3.0.13 without it. So chains are minted in the Layer B container and
// their sizes committed — which is sound, because a certificate's size is a
// property of the certificate, not of the machine that generated it. Unlike a
// timing, it is portable.
//
// THE FINDING THIS CARRIES. Layer B measured a real TLS first flight at 1,762
// bytes, comfortably inside a ~14.6 KB congestion window, and this site said
// so. That measurement is correct and the conclusion drawn from it was too
// broad: Layer B's testbed serves a classical certificate by design, so its
// flight contains no post-quantum certificate at all. With one in it, the
// larger ML-DSA parameter sets cross the window.
//
// The congestion figures are therefore a COMPOSITION over measured components,
// not a captured flight, and `congestionIsComposed()` exists so no surface can
// render them without that being available to say.

import fs from "fs";
import path from "path";

export interface ChainMeasurement {
  algorithm: string;
  measured: boolean;
  reason?: string;
  certificates_der_bytes?: { leaf: number; intermediate: number; root: number };
  full_chain_der_bytes?: number;
  sent_in_handshake?: {
    certificates: string[];
    der_bytes: number;
    tls_message_bytes: number;
    note?: string;
  };
}

export interface ChainComparison {
  measurable: boolean;
  reason?: string;
  baseline?: string;
  baseline_sent_der_bytes?: number;
  rows?: {
    algorithm: string;
    sent_der_bytes: number;
    delta_bytes: number;
    multiple_of_baseline: number | null;
  }[];
  note?: string;
}

export interface CongestionRow {
  certificate_algorithm: string;
  server_hello_bytes: number;
  certificate_message_bytes: number;
  certificate_verify_signature_bytes: number;
  composed_first_flight_bytes: number;
  exceeds_initcwnd: boolean;
  headroom_bytes: number;
}

export interface CertChainFile {
  schema: string;
  environment: { iso_timestamp: string; openssl?: string | null; git_commit?: string | null };
  scope: Record<string, string>;
  chains: ChainMeasurement[];
  comparison: ChainComparison;
  components?: { rows: unknown[]; claim_boundary: string };
  congestion?: {
    assumed_initcwnd_bytes: number;
    assumed_initcwnd_note?: string;
    key_exchange?: string;
    rows: CongestionRow[];
    claim_type: string;
    why_layer_b_did_not_see_this: string;
  };
}

/** Chains that actually got minted, largest first — the story is the growth. */
export function measuredChains(file: CertChainFile | null): ChainMeasurement[] {
  if (!file) return [];
  return file.chains
    .filter((c) => c.measured && c.sent_in_handshake)
    .sort(
      (a, b) => (b.sent_in_handshake!.der_bytes ?? 0) - (a.sent_in_handshake!.der_bytes ?? 0),
    );
}

/**
 * The rows whose composed flight crosses the assumed congestion window.
 *
 * Returns an empty list when the congestion block is absent — never a guess.
 * "We did not compute this" and "nothing crosses" are different claims, and a
 * page that collapsed them would turn a missing measurement into reassurance.
 */
export function overTheWindow(file: CertChainFile | null): CongestionRow[] {
  return (file?.congestion?.rows ?? []).filter((r) => r.exceeds_initcwnd);
}

/**
 * Whether the congestion figures are composed rather than captured.
 *
 * Always true today, and deliberately a function rather than a constant: the
 * day Layer B's testbed serves a post-quantum certificate, this becomes a real
 * measurement and the caveat must stop being printed. Reading it from the data
 * means that happens on its own.
 */
export function congestionIsComposed(file: CertChainFile | null): boolean {
  return typeof file?.congestion?.claim_type === "string";
}

/** The largest multiple of the classical baseline, for the headline. */
export function worstMultiple(file: CertChainFile | null): { algorithm: string; multiple: number } | null {
  const rows = file?.comparison?.rows ?? [];
  let worst: { algorithm: string; multiple: number } | null = null;
  for (const r of rows) {
    if (r.multiple_of_baseline == null) continue;
    if (!worst || r.multiple_of_baseline > worst.multiple) {
      worst = { algorithm: r.algorithm, multiple: r.multiple_of_baseline };
    }
  }
  return worst;
}

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

/**
 * The newest committed chain measurement, or null if none has been taken.
 *
 * Absence is a normal state, not an error: chain sizing runs on demand in the
 * Layer B workflow rather than daily. A build with no file is a build where
 * nobody has run it — which renders as "not measured", never as a zero.
 */
export function loadCertChain(): CertChainFile | null {
  const dir = path.join(process.cwd(), "public", "data", "cert-chain");
  if (!fs.existsSync(dir)) return null;

  const files = fs
    .readdirSync(dir)
    .filter((f: string) => f.endsWith(".json"))
    .sort();
  if (files.length === 0) return null;

  try {
    const raw = fs.readFileSync(path.join(dir, files[files.length - 1]), "utf8");
    return JSON.parse(raw) as CertChainFile;
  } catch {
    // A malformed file reads as no measurement rather than crashing the build.
    // The alternative — a page that renders half a table — is worse.
    return null;
  }
}

/**
 * Whether a usable chain measurement exists, for CFDIR 3.5's coverage.
 *
 * Requires an actual comparison, not merely a file: a run where every chain
 * failed to mint still writes a result, and that must not read as coverage.
 */
export function hasChainSizing(file: CertChainFile | null): boolean {
  return Boolean(file?.comparison?.measurable && (file.comparison.rows?.length ?? 0) > 0);
}
