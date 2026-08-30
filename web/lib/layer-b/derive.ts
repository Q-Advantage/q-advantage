// web/lib/layer-b/derive.ts
//
// The gate between what a Layer B result contains and what a page may render.
//
// Layer B's structural facts are portable: packets, wire bytes, the negotiated
// group, fragmentation, the congestion verdict are properties of the protocol
// exchange and are identical wherever the capture was taken. Its timings are
// properties of the machine and are not.
//
// Every result carries `timing.publishable`, set false unless the run asserted
// it happened on the measurement host. The whole point of that flag is lost if
// a component reads `duration_seconds` directly, so the only supported way to
// get a duration out of a result is `publishableDuration()`, which returns null
// when the flag says no.

import type { LayerBGroup, LayerBResult } from "./types";

/**
 * The handshake duration, or null when this run is not entitled to publish one.
 *
 * Returns null for anything measured on a laptop or a shared CI runner. That is
 * not caution for its own sake: a timing from a noisy shared machine presented
 * next to Q-Shield's measured figures would be indistinguishable from one, and
 * this product's entire claim is that every published number traces to a real
 * measurement on a known host.
 */
export function publishableDuration(result: LayerBResult): number | null {
  const t = result.timing;
  if (!t || !t.publishable) return null;
  if (t.duration_seconds == null || !Number.isFinite(t.duration_seconds)) return null;
  return t.duration_seconds;
}

/** Why a duration is being withheld, for the reader rather than the developer. */
export function withheldTimingReason(result: LayerBResult): string | null {
  if (publishableDuration(result) != null) return null;
  return (
    result.timing?.note ??
    "This run was not taken on the measurement host, so its timing is not published."
  );
}

/**
 * Structural facts are portable and may always be shown.
 *
 * Stated as a function rather than left implicit so the asymmetry with timings
 * is visible at every call site.
 */
export function hasPortableStructure(result: LayerBResult): boolean {
  return !!result.structure && result.structure.packets_total > 0;
}

/**
 * How to label a group in the UI.
 *
 * A name whose identity is not confirmed against a primary source must never
 * render as though it were — the hybrid PQC code points are currently in that
 * state, and CLAUDE.md's sourcing standard treats an uncited identity block as
 * the same failure mode as a fabricated benchmark.
 */
export function groupLabel(group: LayerBGroup | null | undefined): {
  name: string;
  unverified: boolean;
} | null {
  if (!group) return null;
  return { name: group.name, unverified: !group.identity_verified };
}

/**
 * True when the negotiated group was read from wire bytes.
 *
 * `layer-b-spec.md` §4 makes this binding: a stack's own report of what it
 * negotiated is ambiguous, and an instrument that trusts it reproduces the
 * reporting gap it exists to expose. Anything rendering a negotiated group
 * should be able to state where the claim came from.
 */
export function negotiatedFromWire(result: LayerBResult): boolean {
  const src = result.wire?.negotiated_group?.source;
  return typeof src === "string" && src.startsWith("wire bytes");
}

export type OutcomeTone = "ok" | "finding" | "absent";

/**
 * How an outcome should read.
 *
 * A downgrade is a **finding**, not an error and not a success. It is the
 * single most valuable thing this instrument produces, and rendering it in the
 * same style as a failure would bury it.
 */
export function outcomeTone(result: LayerBResult): OutcomeTone {
  switch (result.outcome.outcome) {
    case "negotiated":
    case "negotiated_after_retry":
      return "ok";
    case "downgraded_to_classical":
    case "no_server_hello":
    case "server_hello_without_key_share":
      return "finding";
    default:
      return "absent";
  }
}

/**
 * Whether the server's first flight crossed the assumed congestion window.
 *
 * Returns null when it was not measurable, never false — "we could not see a
 * flight" and "the flight fit" are different statements, and collapsing them
 * would turn absence of evidence into evidence of absence.
 */
export function crossedTheCliff(result: LayerBResult): boolean | null {
  const c = result.congestion;
  if (!c || !c.measurable || c.exceeded_initcwnd == null) return null;
  return c.exceeded_initcwnd;
}

/** Scenario ordering for display: baseline first, then the interesting ones. */
const SCENARIO_ORDER = ["pairwise", "mismatch", "rtt", "concurrency", "middlebox"];

/** The scenario family a label belongs to: `middlebox-nginx` -> `middlebox`. */
export function scenarioFamily(label: string): string {
  const dash = label.indexOf("-");
  return dash === -1 ? label : label.slice(0, dash);
}

export function orderScenarios(labels: string[]): string[] {
  return [...labels].sort((a, b) => {
    const ia = SCENARIO_ORDER.indexOf(scenarioFamily(a));
    const ib = SCENARIO_ORDER.indexOf(scenarioFamily(b));
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia === ib ? a.localeCompare(b) : ia - ib;
  });
}

/**
 * Blurb for a label, falling back to its family.
 *
 * Two proxies are two separate rows on purpose: middlebox compatibility is a
 * property of each product, so collapsing them would state something broader
 * than what was measured.
 */
export function scenarioBlurb(label: string): string {
  return SCENARIO_BLURB[label] ?? SCENARIO_BLURB[scenarioFamily(label)] ?? "";
}

export const SCENARIO_BLURB: Record<string, string> = {
  pairwise: "One hybrid handshake between two stacks we control. The baseline every other row is read against.",
  mismatch: "Client and server deliberately share no group. What happens then is the finding — a clean rejection and a silent fall back to classical look identical from the outside.",
  rtt: "The same handshake with latency injected on both egress paths. Synthetic delay, not real distance — it reproduces the round-trip cost, not the route.",
  concurrency: "Many live connections at once — real sockets, real accept queue, not concurrent crypto calls.",
  middlebox:
    "A TCP passthrough proxy in the path, asking whether a box that is not even inspecting the handshake still damages it.",
  "middlebox-haproxy": "HAProxy in TCP passthrough. A pass means this product at this version with this config, not proxies in general.",
  "middlebox-nginx": "nginx in TCP passthrough. Tested separately because middlebox compatibility is a property of each product, not of the category.",
};
