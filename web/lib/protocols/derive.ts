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

/**
 * The honest label for `size.bytes_total` on a composed suite. The composed-protocol harness
 * measures the cryptographic key-exchange payload (public key / ciphertext
 * / classical key share), not a full captured TLS record — no ClientHello
 * extensions, no certificate chain, no record-layer framing. Every UI
 * surface showing this number must use this label, not "handshake bytes"
 * or "bytes on the wire" unqualified, which would imply more than what's
 * measured.
 */
export const BYTES_ON_WIRE_LABEL = "key-exchange payload bytes";
