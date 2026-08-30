import { describe, expect, it } from "vitest";
import {
  crossedTheCliff,
  groupLabel,
  negotiatedFromWire,
  orderScenarios,
  outcomeTone,
  publishableDuration,
  withheldTimingReason,
} from "./derive";
import type { LayerBResult } from "./types";

function result(over: Partial<LayerBResult> = {}): LayerBResult {
  return {
    schema: "layer-b/0.2.0",
    identity: { layer: "B", protocol: "tls", mode: "live_handshake", label: "fixture" },
    outcome: { outcome: "negotiated", detail: "Negotiated." },
    ...over,
  } as LayerBResult;
}

describe("publishableDuration", () => {
  it("withholds a duration from a run that was not on the measurement host", () => {
    // The whole reason the flag exists: a timing from a shared CI runner sat
    // beside Q-Shield's measured figures would be indistinguishable from one.
    const r = result({ timing: { duration_seconds: 0.42, publishable: false } });
    expect(publishableDuration(r)).toBeNull();
  });

  it("returns the duration once a run asserts the measurement host", () => {
    const r = result({ timing: { duration_seconds: 0.42, publishable: true } });
    expect(publishableDuration(r)).toBe(0.42);
  });

  it("returns null when there is no timing block at all", () => {
    expect(publishableDuration(result())).toBeNull();
  });

  it("returns null for a non-finite duration even when marked publishable", () => {
    const r = result({ timing: { duration_seconds: Number.NaN, publishable: true } });
    expect(publishableDuration(r)).toBeNull();
  });

  it("gives the reader the harness's own reason for withholding", () => {
    const r = result({
      timing: { duration_seconds: 1, publishable: false, note: "ran on a shared runner" },
    });
    expect(withheldTimingReason(r)).toBe("ran on a shared runner");
  });

  it("has no withholding reason when the duration is publishable", () => {
    const r = result({ timing: { duration_seconds: 1, publishable: true } });
    expect(withheldTimingReason(r)).toBeNull();
  });
});

describe("groupLabel", () => {
  it("marks a code point whose identity is not confirmed against a primary source", () => {
    // CLAUDE.md's sourcing standard treats an uncited identity block as the
    // same failure mode as a fabricated benchmark.
    const g = groupLabel({ code: 0x11ec, name: "X25519MLKEM768", identity_verified: false });
    expect(g).toEqual({ name: "X25519MLKEM768", unverified: true });
  });

  it("does not mark a confirmed one", () => {
    expect(groupLabel({ code: 0x001d, name: "x25519", identity_verified: true })).toEqual({
      name: "x25519",
      unverified: false,
    });
  });

  it("returns null for an absent group rather than a placeholder name", () => {
    expect(groupLabel(null)).toBeNull();
    expect(groupLabel(undefined)).toBeNull();
  });
});

describe("negotiatedFromWire", () => {
  it("is true only when the claim states it came from wire bytes", () => {
    const r = result({
      wire: {
        negotiated_group: {
          code: 29,
          name: "x25519",
          identity_verified: true,
          source: "wire bytes (ServerHello key_share extension)",
        },
      } as LayerBResult["wire"],
    });
    expect(negotiatedFromWire(r)).toBe(true);
  });

  it("is false when a group arrived without stated provenance", () => {
    const r = result({
      wire: {
        negotiated_group: { code: 29, name: "x25519", identity_verified: true },
      } as LayerBResult["wire"],
    });
    expect(negotiatedFromWire(r)).toBe(false);
  });
});

describe("outcomeTone", () => {
  it("reads a downgrade as a finding, not an error and not a success", () => {
    // It is the single most valuable thing the instrument produces; rendering
    // it like a failure would bury it.
    const r = result({ outcome: { outcome: "downgraded_to_classical", detail: "" } });
    expect(outcomeTone(r)).toBe("finding");
  });

  it("reads a clean rejection as a finding too", () => {
    expect(outcomeTone(result({ outcome: { outcome: "no_server_hello", detail: "" } }))).toBe(
      "finding",
    );
  });

  it("reads a successful negotiation as ok, including after a retry", () => {
    expect(outcomeTone(result())).toBe("ok");
    expect(
      outcomeTone(result({ outcome: { outcome: "negotiated_after_retry", detail: "" } })),
    ).toBe("ok");
  });

  it("reads no traffic as absent rather than as a finding", () => {
    expect(outcomeTone(result({ outcome: { outcome: "no_traffic_captured", detail: "" } }))).toBe(
      "absent",
    );
  });
});

describe("crossedTheCliff", () => {
  it("is null, not false, when the flight could not be measured", () => {
    // "We could not see a flight" and "the flight fit" are different claims.
    // Collapsing them turns absence of evidence into evidence of absence.
    const r = result({ congestion: { measurable: false, assumed_initcwnd_bytes: 14600 } });
    expect(crossedTheCliff(r)).toBeNull();
  });

  it("is null when there is no congestion block at all", () => {
    expect(crossedTheCliff(result())).toBeNull();
  });

  it("reports a crossing and a fit", () => {
    expect(
      crossedTheCliff(
        result({
          congestion: {
            measurable: true,
            assumed_initcwnd_bytes: 14600,
            exceeded_initcwnd: true,
          },
        }),
      ),
    ).toBe(true);
    expect(
      crossedTheCliff(
        result({
          congestion: {
            measurable: true,
            assumed_initcwnd_bytes: 14600,
            exceeded_initcwnd: false,
          },
        }),
      ),
    ).toBe(false);
  });
});

describe("orderScenarios", () => {
  it("puts the baseline first and keeps a stable order", () => {
    expect(orderScenarios(["middlebox", "mismatch", "pairwise", "rtt", "concurrency"])).toEqual([
      "pairwise",
      "mismatch",
      "rtt",
      "concurrency",
      "middlebox",
    ]);
  });

  it("appends unknown scenarios rather than dropping them", () => {
    const out = orderScenarios(["custom-thing", "pairwise"]);
    expect(out[0]).toBe("pairwise");
    expect(out).toContain("custom-thing");
  });
});
