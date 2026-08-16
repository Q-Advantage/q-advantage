// web/lib/protocols/phases.ts
//
// Handshake phase decomposition.
//
// The composed-protocol harness times each cryptographic phase in its own
// 1000-iteration loop and reports the handshake figure as their composition —
// that is what `identity.mode: "composed"` has always meant. The phases
// therefore account for the handshake exactly, with one wrinkle:
//
//   handshake_mean = kem_keygen + kem_encaps + kem_decaps
//                  + 2 × (classical_keygen + classical_derive)
//
// The classical phases count twice because both parties perform keygen and
// derive; the KEM phases count once each (client keygens and decapsulates,
// server encapsulates). Verified against all 548 committed TLS and SSH suites
// as of 2026-08-16: maximum relative error 0.0016%.
//
// This module exists so no component reimplements that identity inline. If a
// future harness change breaks it, `exact` goes false and the UI is required
// to say so rather than draw a tidy bar over a decomposition that no longer
// adds up.

import type { ComposedSuite, TimingBlock } from "./types";

export const PHASE_ORDER = [
  "kem_keygen",
  "kem_encaps",
  "kem_decaps",
  "classical_keygen",
  "classical_derive",
] as const;

export type PhaseKey = (typeof PHASE_ORDER)[number];

const PHASE_LABEL: Record<PhaseKey, string> = {
  kem_keygen: "KEM keygen",
  kem_encaps: "KEM encapsulate",
  kem_decaps: "KEM decapsulate",
  classical_keygen: "Classical keygen",
  classical_derive: "Classical derive",
};

/**
 * How many times each phase occurs in one handshake. Classical keygen and
 * derive happen on both sides; the KEM phases happen once each.
 */
const PHASE_OCCURRENCES: Record<PhaseKey, 1 | 2> = {
  kem_keygen: 1,
  kem_encaps: 1,
  kem_decaps: 1,
  classical_keygen: 2,
  classical_derive: 2,
};

/** Relative error above which the composition is no longer treated as exact. */
const EXACTNESS_TOLERANCE = 0.001; // 0.1% — measured worst case is 0.0016%

export interface PhaseEntry {
  key: PhaseKey;
  label: string;
  /** The measured block, verbatim — all nine fields, unmodified. */
  timing: TimingBlock;
  /** 1 or 2. Rendered explicitly; never folded silently into the number. */
  occurrences: 1 | 2;
  /** mean_us × occurrences — this phase's contribution to the handshake. */
  contribution_us: number;
  /** Share of the composed total, 0..1. */
  share: number;
}

export interface PhaseDecomposition {
  phases: PhaseEntry[];
  /** Sum of contributions. */
  composed_us: number;
  /** The suite's reported handshake mean. */
  handshake_mean_us: number;
  /** handshake_mean_us − composed_us. Near zero when the identity holds. */
  residual_us: number;
  /**
   * True when the composition matches the reported handshake mean within
   * tolerance. When false, the UI must disclose the discrepancy instead of
   * presenting the phases as a complete breakdown.
   */
  exact: boolean;
}

/**
 * Decompose a suite's handshake into its measured phases.
 *
 * Returns null when the suite carries no `phases` block. Never zero-fills a
 * phase that wasn't measured: a pure-KEM suite has no classical phases and a
 * classical suite has no KEM phases, and a 0 µs segment would read as "this
 * step is free" — a claim the data does not make.
 */
export function decomposePhases(suite: ComposedSuite): PhaseDecomposition | null {
  const raw = suite.phases;
  if (!raw) return null;

  const present = PHASE_ORDER.filter((k) => raw[k] != null);
  if (present.length === 0) return null;

  const entries = present.map((key) => {
    const timing = raw[key];
    const occurrences = PHASE_OCCURRENCES[key];
    return { key, timing, occurrences, contribution_us: timing.mean_us * occurrences };
  });

  const composed_us = entries.reduce((acc, e) => acc + e.contribution_us, 0);
  const handshake_mean_us = suite.timing.mean_us;
  const residual_us = handshake_mean_us - composed_us;

  return {
    phases: entries.map((e) => ({
      key: e.key,
      label: PHASE_LABEL[e.key],
      timing: e.timing,
      occurrences: e.occurrences,
      contribution_us: e.contribution_us,
      share: composed_us > 0 ? e.contribution_us / composed_us : 0,
    })),
    composed_us,
    handshake_mean_us,
    residual_us,
    exact:
      handshake_mean_us > 0 && Math.abs(residual_us) / handshake_mean_us <= EXACTNESS_TOLERANCE,
  };
}
