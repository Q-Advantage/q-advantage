// web/lib/protocols/derive.ts
//
// Derived metrics computed purely from ComposedSuite fields that are
// already measured and already committed — no new benchmarking, no
// fabrication. Keep this logic in ONE place (mirrors the discipline in
// web/lib/data/normalize.ts) — components must never recompute these inline.

import type { ComposedSuite, JoseComposedFile, LmsXmssFile } from "./types";

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
 * keys present — not by parsing the suite name. Names are wire-format
 * identifiers and a house convention, not a guarantee; a renamed or added
 * suite must not silently land in the wrong bucket.
 *
 *   kem_* and classical_*  → "hybrid"     (KEM exchange AND classical exchange)
 *   kem_* only             → "pure-pqc"   (PQC alone, no classical leg)
 *   classical_* only       → "classical"  (the baseline everyone already runs)
 *   neither                → "unknown"    — never guessed
 *
 * All four shapes are present in the committed record. As of
 * tls-composed-2026-08-31: X25519MLKEM768 and SecP256r1MLKEM768 are hybrid,
 * MLKEM768 is pure-pqc, X25519 is classical; ssh-composed has no pure-PQC
 * suite at all, which is why callers must handle its absence rather than
 * assume every protocol has one.
 *
 * This is the single source of truth for that question. `isHybridSuite` in
 * anomaly.ts delegates here — two independent readings of the same phase
 * block is exactly how they drift apart.
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
 * How much slower a hybrid suite is than its same-protocol pure-PQC
 * counterpart: hybrid.median_us / pure.median_us.
 *
 * Arithmetic only — the raw projection, mirroring `vsBaselinePct` in
 * metrics.ts. It does NOT gate on whether the answer is structurally
 * possible; a hybrid that measures faster than pure PQC alone is an
 * impossible result, not a fast one, and screening for that lives in
 * anomaly.ts as `publishableHybridToPurePqcRatio`. Rendering surfaces must
 * call that one, never this. This stays raw so analysis and the smoke test
 * can still see a bad value in order to report it.
 *
 * Returns `null` (never a guess) when either side lacks a real median.
 * Picking a same-protocol pure-PQC suite to compare against is the caller's
 * job — that matching is context-dependent and does not belong hidden in here.
 */
export function hybridToPurePqcRatio(hybrid: ComposedSuite, pure: ComposedSuite): number | null {
  const h = hybrid.timing?.median_us;
  const p = pure.timing?.median_us;
  if (!h || !p) return null;
  if (!Number.isFinite(h) || !Number.isFinite(p)) return null;
  return h / p;
}

export function formatMultiplier(ratio: number | null): string {
  if (ratio == null) return "—";
  if (ratio >= 100) return `${Math.round(ratio)}×`;
  if (ratio >= 10) return `${ratio.toFixed(1)}×`;
  return `${ratio.toFixed(2)}×`;
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

  // Prefer a scheme that recorded a real `reason`. From 2026-08-17 to
  // 2026-08-30 the harness misclassified "this liboqs build does not have the
  // mechanism compiled in" as status "failed" with the raw exception string as
  // its only explanation, so /q-shield/compare showed readers
  // "MechanismNotEnabledError: LMS_SHA256_H10_W8" as the reason there is no
  // hash-based signature data. The harness is fixed, but every file already
  // committed still carries the raw string, so the read side translates it
  // rather than waiting for the record to age out.
  for (const s of Object.values(file.schemes ?? {})) {
    if (s.status !== "ok" && s.reason) return s.reason;
  }
  for (const s of Object.values(file.schemes ?? {})) {
    if (s.status !== "ok" && s.error) return humanizeStatefulSigError(s.error);
  }
  return null;
}

/**
 * Turn a recorded harness exception into something a reader can act on.
 *
 * Only translates the one case whose meaning is unambiguous — the mechanism is
 * not compiled into this liboqs build. Anything else is passed through
 * verbatim: inventing an explanation for an error we have not diagnosed would
 * be worse than showing the raw string.
 */
export function humanizeStatefulSigError(error: string): string {
  if (error.includes("MechanismNotEnabledError")) {
    return (
      "The benchmark host's liboqs build does not have stateful hash-based signatures compiled " +
      "in, so there is nothing to measure yet. Enabling them is a rebuild on the measurement " +
      "host (OQS_ENABLE_SIG_STFL_LMS and OQS_ENABLE_SIG_STFL_XMSS), not a change to what is " +
      "published here."
    );
  }
  return error;
}

/** One documented size limit a measured token either fits inside or does not. */
export interface TokenLimitVerdict {
  name: string;
  bytes: number;
  source: string;
  exceeded: boolean;
}

/**
 * Which of the track's own documented size limits a token of `bytes` exceeds.
 *
 * The limits are read from the result file rather than retyped here, so the
 * page cannot drift from what the harness published, and each carries its own
 * source string.
 *
 * These are configurable defaults, not protocol constants. The track says so
 * itself: they exist so a measured token size means something, NOT so a
 * pass/fail can be declared -- that judgement needs a reader who knows their
 * own stack. So this reports which lines a size crosses and never labels the
 * result "broken".
 */
export function tokenLimitVerdicts(
  file: JoseComposedFile | null | undefined,
  bytes: number | null | undefined,
): TokenLimitVerdict[] {
  const limits = file?.size_limits ?? [];
  if (bytes == null || !Number.isFinite(bytes)) return [];
  return limits.map((l) => ({
    name: l.name,
    bytes: l.bytes,
    source: l.source,
    exceeded: bytes > l.bytes,
  }));
}

/**
 * The largest post-quantum token the JOSE track measured, or null.
 *
 * Post-quantum only, deliberately: the headline is what migrating costs, and a
 * classical arm topping the table would mean something has gone wrong with the
 * run rather than being a finding. Returns null when the track could not
 * produce a comparison at all -- the file records `measurable: false` with a
 * reason in that case, and a page must show the reason, not a blank.
 */
export function largestPostQuantumToken(
  file: JoseComposedFile | null | undefined,
): { scheme: string; bytes: number; multiple: number } | null {
  const cmp = file?.comparison;
  if (!cmp?.measurable || !cmp.rows?.length) return null;
  const pq = cmp.rows.filter((r) => r.kind === "post-quantum" && Number.isFinite(r.token_bytes));
  if (pq.length === 0) return null;
  const worst = pq.reduce((a, b) => (b.token_bytes > a.token_bytes ? b : a));
  return {
    scheme: worst.scheme,
    bytes: worst.token_bytes,
    multiple: worst.token_multiple_of_baseline,
  };
}
