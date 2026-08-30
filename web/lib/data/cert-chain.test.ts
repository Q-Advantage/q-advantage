// Certificate-chain sizing, on the web side.
//
// The measurement itself is tested in `layer-b/tests/test_measure_chains.py`.
// What is tested here is how the page is allowed to READ it — specifically the
// three places where a missing measurement could quietly become a reassuring
// one.

import { describe, expect, it } from "vitest";
import {
  congestionIsComposed,
  hasChainSizing,
  measuredChains,
  overTheWindow,
  worstMultiple,
  type CertChainFile,
} from "./cert-chain";

function file(over: Partial<CertChainFile> = {}): CertChainFile {
  return {
    schema: "cert-chain/1",
    environment: { iso_timestamp: "2026-08-30T00:00:00Z" },
    scope: {},
    chains: [
      {
        algorithm: "ecdsa-p256",
        measured: true,
        certificates_der_bytes: { leaf: 466, intermediate: 431, root: 386 },
        full_chain_der_bytes: 1283,
        sent_in_handshake: { certificates: ["leaf", "intermediate"], der_bytes: 897, tls_message_bytes: 907 },
      },
      {
        algorithm: "mldsa87",
        measured: true,
        certificates_der_bytes: { leaf: 7546, intermediate: 7507, root: 7463 },
        full_chain_der_bytes: 22516,
        sent_in_handshake: { certificates: ["leaf", "intermediate"], der_bytes: 15053, tls_message_bytes: 15063 },
      },
      { algorithm: "falcon512", measured: false, reason: "oqs-provider could not mint it" },
    ],
    comparison: {
      measurable: true,
      baseline: "ecdsa-p256",
      baseline_sent_der_bytes: 897,
      rows: [{ algorithm: "mldsa87", sent_der_bytes: 15053, delta_bytes: 14156, multiple_of_baseline: 16.78 }],
    },
    congestion: {
      assumed_initcwnd_bytes: 14600,
      assumed_initcwnd_note: "RFC 6928",
      rows: [
        {
          certificate_algorithm: "ecdsa-p256",
          server_hello_bytes: 1210,
          certificate_message_bytes: 907,
          certificate_verify_signature_bytes: 72,
          composed_first_flight_bytes: 2249,
          exceeds_initcwnd: false,
          headroom_bytes: 12351,
        },
        {
          certificate_algorithm: "mldsa87",
          server_hello_bytes: 1210,
          certificate_message_bytes: 15063,
          certificate_verify_signature_bytes: 4627,
          composed_first_flight_bytes: 20960,
          exceeds_initcwnd: true,
          headroom_bytes: -6360,
        },
      ],
      claim_type: "A COMPOSITION over measured components, not a captured flight.",
      why_layer_b_did_not_see_this: "Its testbed serves a throwaway ECDSA certificate.",
    },
    ...over,
  };
}

describe("measuredChains", () => {
  it("drops the chains that failed to mint rather than showing them as zero", () => {
    const rows = measuredChains(file());
    expect(rows.map((c) => c.algorithm)).toEqual(["mldsa87", "ecdsa-p256"]);
  });

  it("returns nothing at all when no measurement exists", () => {
    expect(measuredChains(null)).toEqual([]);
  });
});

describe("overTheWindow", () => {
  it("names only the chains that actually cross", () => {
    expect(overTheWindow(file()).map((r) => r.certificate_algorithm)).toEqual(["mldsa87"]);
  });

  it("returns empty when the congestion block is absent", () => {
    // The dangerous case: a page that treats this as "nothing crosses" would
    // turn a measurement we never took into reassurance. The page guards it by
    // rendering the section only when `congestion` exists, and this pins the
    // helper's half of that contract.
    expect(overTheWindow(file({ congestion: undefined }))).toEqual([]);
    expect(overTheWindow(null)).toEqual([]);
  });
});

describe("congestionIsComposed", () => {
  it("is true while the figures are composed, so the caveat renders", () => {
    expect(congestionIsComposed(file())).toBe(true);
  });

  it("goes false on its own if a capture ever replaces the composition", () => {
    // Read from the data rather than hardcoded, so the day Layer B serves a
    // post-quantum certificate the caveat stops printing without an edit.
    const captured = file();
    delete (captured.congestion as { claim_type?: string }).claim_type;
    expect(congestionIsComposed(captured)).toBe(false);
  });
});

describe("hasChainSizing", () => {
  it("is true only when a comparison actually produced rows", () => {
    expect(hasChainSizing(file())).toBe(true);
  });

  it("is false when every chain failed, even though a result file exists", () => {
    // A run where nothing minted still writes a file. CFDIR 3.5 must not read
    // that as coverage.
    expect(hasChainSizing(file({ comparison: { measurable: false, reason: "no baseline" } }))).toBe(false);
    expect(hasChainSizing(file({ comparison: { measurable: true, rows: [] } }))).toBe(false);
    expect(hasChainSizing(null)).toBe(false);
  });
});

describe("worstMultiple", () => {
  it("picks the largest multiple for the headline", () => {
    expect(worstMultiple(file())).toEqual({ algorithm: "mldsa87", multiple: 16.78 });
  });

  it("skips rows whose multiple could not be computed", () => {
    const f = file();
    f.comparison.rows = [{ algorithm: "x", sent_der_bytes: 1, delta_bytes: 0, multiple_of_baseline: null }];
    expect(worstMultiple(f)).toBeNull();
  });
});
