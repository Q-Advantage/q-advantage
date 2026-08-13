// web/lib/protocols/derive.ts
//
// Derived metrics computed purely from ComposedSuite fields that are
// already measured and already committed — no new benchmarking, no
// fabrication. Keep this logic in ONE place (mirrors the discipline in
// web/lib/data/normalize.ts) — components must never recompute these inline.

import type { ComposedSuite } from "./types";

/**
 * Server bytes returned per byte the client sends, for one handshake suite.
 * = bytes_server_to_client / bytes_client_to_server.
 *
 * Not published elsewhere for these suites as far as this repo has found —
 * the number a DoS-conscious architect actually wants: how much traffic a
 * spoofed/replayed client-side packet can cause the server to emit.
 *
 * Returns `null` (never 0, never a guess) when the suite has no `size`
 * block or the client side sent zero bytes — a suite that can't compute a
 * real ratio must say so, not render a fabricated number.
 */
export function amplificationFactor(suite: ComposedSuite): number | null {
  const size = suite.size;
  if (!size || !size.bytes_client_to_server) return null;
  return size.bytes_server_to_client / size.bytes_client_to_server;
}

export function formatAmplificationFactor(factor: number | null): string {
  if (factor == null) return "—";
  return `${factor.toFixed(2)}×`;
}

export type SuiteClassification = "hybrid" | "pure-pqc" | "classical" | "unknown";

/**
 * Classifies a composed suite by what it actually measured, from the phase
 * keys present — not from parsing the suite name (name patterns are a
 * house convention, not a guarantee; a future suite could break it, and
 * this shouldn't silently misclassify when that happens).
 *
 *   has kem_* phases only        → "pure-pqc"   (PQC alone, no classical leg)
 *   has classical_* phases only  → "classical"  (classical alone)
 *   has both                     → "hybrid"     (PQC + classical combined)
 *   has neither (no phases data) → "unknown"    — never guessed
 */
export function classifySuite(suite: ComposedSuite): SuiteClassification {
  const phaseNames = Object.keys(suite.phases ?? {});
  const hasKem = phaseNames.some((p) => p.startsWith("kem_"));
  const hasClassical = phaseNames.some((p) => p.startsWith("classical_"));
  if (hasKem && hasClassical) return "hybrid";
  if (hasKem) return "pure-pqc";
  if (hasClassical) return "classical";
  return "unknown";
}

/**
 * How much slower (or faster) a hybrid suite is than its same-protocol
 * pure-PQC counterpart, using the same KEM. = hybrid.median_us /
 * pure.median_us. Returns `null` (never a guess) if either side is
 * missing a real median. Caller is responsible for picking a same-KEM,
 * same-protocol pure-PQC suite to compare against — this function does
 * the arithmetic only, no suite-matching logic (that's genuinely context-
 * dependent and belongs at the call site, not hidden in here).
 */
export function hybridToPurePqcRatio(hybrid: ComposedSuite, pure: ComposedSuite): number | null {
  const h = hybrid.timing?.median_us;
  const p = pure.timing?.median_us;
  if (!h || !p) return null;
  return h / p;
}

export function formatMultiplier(ratio: number | null): string {
  if (ratio == null) return "—";
  if (ratio >= 100) return `${Math.round(ratio)}×`;
  if (ratio >= 10) return `${ratio.toFixed(1)}×`;
  return `${ratio.toFixed(2)}×`;
}

/**
 * The honest label for `size.bytes_total` on a composed suite. Layer A
 * measures the cryptographic key-exchange payload (public key / ciphertext
 * / classical key share), not a full captured TLS record — no ClientHello
 * extensions, no certificate chain, no record-layer framing. Every UI
 * surface showing this number must use this label, not "handshake bytes"
 * or "bytes on the wire" unqualified, which would imply more than what's
 * measured.
 */
export const BYTES_ON_WIRE_LABEL = "key-exchange payload bytes";
