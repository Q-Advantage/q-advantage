// web/lib/protocols/derive.ts
//
// Derived metrics computed purely from ComposedSuite fields that are
// already measured and already committed — no new benchmarking, no
// fabrication. Keep this logic in ONE place (mirrors the discipline in
// web/lib/data/normalize.ts) — components must never recompute these inline.

import type { ComposedSuite, LmsXmssFile } from "./types";

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

/**
 * True only when at least one stateful-signature scheme carries a real
 * measurement (`status: "ok"`).
 *
 * The presence of an `lms-xmss-*.json` file is NOT evidence of data. The
 * harness commits a file every daily run and records `status: "unavailable"`
 * per scheme when the runner's liboqs build lacks
 * `-DOQS_HAZARDOUS_EXPERIMENTAL_ENABLE_SIG_STFL_KEY_SIG_GEN` — which is the
 * live state as of the first runs (2026-08-14 onward). Any UI that gates a
 * "no data yet" notice on file presence silently drops the notice the moment
 * the first empty file lands, which is exactly backwards. Gate on this.
 */
export function hasLiveStatefulSigs(file: LmsXmssFile | null | undefined): boolean {
  if (!file) return false;
  return Object.values(file.schemes ?? {}).some((s) => s.status === "ok");
}

/**
 * The reason to show a reader when there is no live stateful-sig data:
 * the harness's own recorded reason if a run has landed and reported one,
 * otherwise null (meaning "no run at all yet" — the caller supplies that
 * wording). Never invents an explanation.
 */
export function statefulSigsUnavailableReason(file: LmsXmssFile | null | undefined): string | null {
  if (!file) return null;
  for (const s of Object.values(file.schemes ?? {})) {
    if (s.status !== "ok" && (s.reason || s.error)) return s.reason ?? s.error ?? null;
  }
  return null;
}
