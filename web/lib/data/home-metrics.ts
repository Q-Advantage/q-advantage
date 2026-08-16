import { getLatestRun } from "./load";
import { getQDayIndex } from "./q-day";
import { loadProtocolsData } from "@/lib/protocols/load";
import { computeStealPercent } from "@/lib/format";
import { vsBaselinePct } from "@/lib/protocols/metrics";
import type { ComposedSuite } from "@/lib/protocols/types";

/**
 * Everything the homepage displays, derived from the measured runs.
 *
 * This module exists so the landing page can never contain a literal. Under
 * guardrail 1, a benchmark figure is measured, not authored — and a marketing
 * page is exactly where a stale hardcoded number would survive longest before
 * anyone noticed. Every field below traces to a file under benchmark/results/
 * (mirrored into public/data for the protocol tracks).
 *
 * Everything is nullable on purpose. A missing track should blank one card,
 * never fail the build or, worse, render a zero as though it were a
 * measurement.
 */

/** The suite most stacks actually deploy — the hybrid we lead the tile with. */
const HERO_SUITE = "X25519MLKEM768";
/** Its classical counterpart, and the baseline every delta is taken against. */
const CLASSICAL_SUITE = "X25519";

export interface SuiteRow {
  name: string;
  /** One-line description of what the suite is, for the table's second line. */
  note: string;
  meanUs: number;
  bytesTotal: number | null;
  /** Negative means faster than classical. Null on the baseline row itself. */
  pctOverClassical: number | null;
  isBaseline: boolean;
}

export interface HomeMetrics {
  run: {
    date: string;
    shortSha: string;
    fullSha: string;
    instanceType: string;
    liboqsVersion: string;
    /** CPU steal on this run, as a percentage. Disclosed on the page. */
    stealPct: number | null;
  };
  wire: {
    hybridBytes: number;
    classicalBytes: number;
    deltaBytes: number;
    /** hybrid ÷ classical, e.g. 36.5 */
    ratio: number;
  } | null;
  handshake: {
    hybridMeanUs: number;
    /** Handshakes per second per core — the connections-per-core proxy. */
    hybridOpsPerSec: number;
  } | null;
  signatures: {
    fastestName: string;
    slowestName: string;
    /** How many times slower the slowest scheme signs. */
    ratio: number;
    /** Signature size of the lattice scheme, in bytes. */
    latticeSigBytes: number | null;
  } | null;
  /**
   * A named, representative lattice signature for the hero tile.
   *
   * Deliberately NOT the computed fastest signer: that resolves to ML-DSA-44,
   * which is real but not the parameter set most teams deploy. ML-DSA-65 is
   * the NIST level-3 default and the one the comparison views lead with, so
   * the tile and the dashboard agree.
   */
  representativeSignature: { name: string; sigBytes: number } | null;
  kem: { encapUs: number } | null;
  qDay: { score: number; bandLow: number; bandHigh: number; systemsScored: number } | null;
  /** TLS suites ranked fastest-first, with the classical baseline pinned last. */
  ranked: SuiteRow[];
}

/** Human-readable note per suite. Keyed by the suite name the harness emits. */
const SUITE_NOTES: Record<string, string> = {
  MLKEM768: "Pure post-quantum key exchange",
  X25519MLKEM768: "Hybrid — the one most stacks deploy",
  SecP256r1MLKEM768: "Hybrid, NIST curve",
  X25519: "Classical baseline",
};

function suiteRows(suites: Record<string, ComposedSuite>): SuiteRow[] {
  const rows: SuiteRow[] = Object.entries(suites).map(([name, s]) => ({
    name,
    note: SUITE_NOTES[name] ?? "Composed key exchange",
    meanUs: s.timing.mean_us,
    bytesTotal: s.size?.bytes_total ?? null,
    pctOverClassical: vsBaselinePct(s, suites) ?? null,
    isBaseline: s.baseline?.baseline_suite == null,
  }));

  // Fastest first, but the classical baseline always sits last regardless of
  // where its timing lands — it is the reference, not a competitor.
  return rows.sort((a, b) => {
    if (a.isBaseline !== b.isBaseline) return a.isBaseline ? 1 : -1;
    return a.meanUs - b.meanUs;
  });
}

export function getHomeMetrics(): HomeMetrics {
  const run = getLatestRun();
  const env = run.environment;

  const stealPct = run.runtime_metrics
    ? computeStealPercent(
        run.runtime_metrics.cpu_steal_seconds,
        run.runtime_metrics.wall_clock_seconds
      )
    : null;

  // ---- protocol-composed TLS, x86_64 ----
  const protocols = loadProtocolsData();
  const tls = protocols.byArch["x86_64"]?.tls ?? null;
  const suites = tls?.suites ?? {};

  const hybrid = suites[HERO_SUITE];
  const classical = suites[CLASSICAL_SUITE];

  const wire =
    hybrid?.size && classical?.size
      ? {
          hybridBytes: hybrid.size.bytes_total,
          classicalBytes: classical.size.bytes_total,
          deltaBytes: hybrid.size.bytes_total - classical.size.bytes_total,
          ratio: hybrid.size.bytes_total / classical.size.bytes_total,
        }
      : null;

  const handshake = hybrid
    ? { hybridMeanUs: hybrid.timing.mean_us, hybridOpsPerSec: hybrid.timing.ops_per_sec }
    : null;

  // ---- signature spread, from the algorithm run ----
  //
  // The gap is computed between a NAMED pair, not between the fastest and
  // slowest signer in the set. That distinction matters: the homepage card
  // that shows this ratio also names both algorithms and links to their
  // comparison view, so a min/max ratio would print a number belonging to a
  // different pair than the one labelled (ML-DSA-44 is the fastest signer,
  // but ML-DSA-65 is the level-3 default everyone actually compares).
  //
  // The IDs are looked up rather than hardcoded as figures, so a rename in
  // liboqs blanks the card instead of silently mislabelling it.
  const latticeSigner = run.algorithms_by_id["ml-dsa-65"];
  const hashSigner = run.algorithms_by_id["slh-dsa-shake-128s"];

  let signatures: HomeMetrics["signatures"] = null;
  const latticeUs = latticeSigner?.operations.sign?.mean_us;
  const hashUs = hashSigner?.operations.sign?.mean_us;

  if (latticeSigner && hashSigner && latticeUs != null && hashUs != null && latticeUs > 0) {
    signatures = {
      fastestName: latticeSigner.display_name,
      slowestName: hashSigner.display_name,
      ratio: hashUs / latticeUs,
      latticeSigBytes: latticeSigner.signature_bytes ?? null,
    };
  }

  const mlKem768 = run.algorithms_by_id["ml-kem-768"];
  const encap = mlKem768?.operations.encap?.mean_us;

  const mlDsa65 = run.algorithms_by_id["ml-dsa-65"];
  const representativeSignature =
    mlDsa65?.signature_bytes != null
      ? { name: mlDsa65.display_name, sigBytes: mlDsa65.signature_bytes }
      : null;

  // ---- Q-Day Index ----
  let qDay: HomeMetrics["qDay"] = null;
  try {
    const q = getQDayIndex();
    const [low, high] = q.hero.confidence_band;
    qDay = {
      score: q.hero.frontier_threat_score,
      bandLow: low,
      bandHigh: high,
      systemsScored: q.hero.n_scored,
    };
  } catch {
    // The index ships as generated JSON; if it hasn't been built yet the card
    // is simply omitted rather than shown empty.
    qDay = null;
  }

  return {
    run: {
      date: run.date_string,
      shortSha: run.short_sha ?? env.git_commit.slice(0, 7),
      fullSha: env.git_commit,
      instanceType: env.ec2_instance_type,
      liboqsVersion: env.liboqs_version,
      stealPct,
    },
    wire,
    handshake,
    signatures,
    representativeSignature,
    kem: encap != null ? { encapUs: encap } : null,
    qDay,
    ranked: suiteRows(suites),
  };
}
