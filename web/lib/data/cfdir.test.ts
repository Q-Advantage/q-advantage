import { describe, expect, it } from "vitest";
import {
  CFDIR_FRAMEWORK_VERSION,
  LINE_ITEMS,
  USE_CASES,
  coverageSentence,
  tally,
  tracksPresent,
  coverageByUseCase,
  hasClassicalSignatureArm,
  lineItemsFor,
} from "./cfdir";
import type { ProtocolsData } from "@/lib/protocols/types";

function data(tracks: {
  tls?: boolean;
  ipsec?: boolean;
  ssh?: boolean;
  sig?: boolean;
  aes?: boolean;
}): ProtocolsData {
  return {
    manifest: null,
    byArch: {
      x86_64: {
        tls: tracks.tls ? ({ suites: { X25519: {} } } as never) : null,
        ipsec: tracks.ipsec ? ({ suites: { curve25519: {} } } as never) : null,
        ssh: tracks.ssh ? ({ suites: { curve25519: {} } } as never) : null,
        sig: tracks.sig ? ({} as never) : null,
        aes: tracks.aes ? ({} as never) : null,
        lmsXmss: null,
      },
    },
  } as ProtocolsData;
}

describe("the taxonomy itself", () => {
  it("carries all fourteen CFDIR use cases", () => {
    expect(USE_CASES).toHaveLength(14);
    expect(USE_CASES.map((u) => u.id)).toContain("3.1");
    expect(USE_CASES.map((u) => u.id)).toContain("3.14");
  });

  it("carries all eleven line items", () => {
    expect(LINE_ITEMS).toHaveLength(11);
  });

  it("names a requirement for exactly the five measurement-dependent line items", () => {
    // The other six are procurement and labour, sourced elsewhere. Claiming a
    // measurement requirement for those would invite someone to wait on us.
    const measurement = LINE_ITEMS.filter((li) => li.requirement != null);
    expect(measurement.map((li) => li.code).sort()).toEqual(["ER", "MIA", "PO", "T", "UE"]);
  });

  it("gives every blocked or partial line item a stated blocker", () => {
    // An empty cell says less than the reason for it.
    for (const li of LINE_ITEMS) {
      if (li.status === "partial" || li.status === "blocked") {
        expect(li.blocker, `${li.code} has no blocker`).toBeTruthy();
      }
    }
  });

  it("pins the framework version", () => {
    expect(CFDIR_FRAMEWORK_VERSION).toBe("v.01");
  });
});

describe("tracksPresent", () => {
  it("reads which tracks actually produced data", () => {
    const present = tracksPresent(data({ tls: true, ssh: true }));
    expect([...present].sort()).toEqual(["ssh-composed", "tls-composed"]);
  });

  it("does not count a track whose suite set is empty", () => {
    const empty = {
      manifest: null,
      byArch: {
        x86_64: { tls: { suites: {} } as never, ipsec: null, ssh: null, sig: null, aes: null, lmsXmss: null },
      },
    } as ProtocolsData;
    expect(tracksPresent(empty).has("tls-composed")).toBe(false);
  });

  it("handles an empty build without throwing", () => {
    expect(tracksPresent({ manifest: null, byArch: {} } as ProtocolsData).size).toBe(0);
  });
});

describe("coverageByUseCase", () => {
  it("marks the two fully-covered use cases when both tracks are present", () => {
    const rows = coverageByUseCase(data({ tls: true, ssh: true, sig: true, aes: true }));
    const covered = rows.filter((r) => r.coverage === "covered").map((r) => r.id);
    expect(covered.sort()).toEqual(["3.13", "3.4"]);
  });

  it("downgrades a use case whose track produced no data", () => {
    // The reason coverage is computed rather than declared: a track that stops
    // running must downgrade its own row instead of a stale table claiming it.
    const rows = coverageByUseCase(data({ ssh: true }));
    const tls = rows.find((r) => r.id === "3.4")!;
    expect(tls.coverage).toBe("none");
    expect(tls.trackMissing).toBe(true);
  });

  it("distinguishes a missing track from a use case nothing measures", () => {
    // These read differently and must not be collapsed: one is an outage, the
    // other is scope.
    const rows = coverageByUseCase(data({}));
    expect(rows.find((r) => r.id === "3.4")!.trackMissing).toBe(true);
    expect(rows.find((r) => r.id === "3.10")!.trackMissing).toBe(false);
  });

  it("leaves the not-applicable row not-applicable regardless of data", () => {
    // 3.1 has no measurable cryptographic term at all. It must never appear as
    // a gap we could close.
    for (const d of [data({}), data({ tls: true, ssh: true, sig: true, aes: true })]) {
      expect(coverageByUseCase(d).find((r) => r.id === "3.1")!.coverage).toBe("not-applicable");
    }
  });
});

describe("tally and the headline sentence", () => {
  it("excludes not-applicable rows from the denominator", () => {
    const t = tally(coverageByUseCase(data({ tls: true, ssh: true, sig: true, aes: true })));
    expect(t.notApplicable).toBe(1);
    expect(t.scorable).toBe(13);
    expect(t.covered + t.partial + t.none).toBe(13);
  });

  it("reports two covered against the real track set", () => {
    const t = tally(coverageByUseCase(data({ tls: true, ssh: true, sig: true, aes: true })));
    expect(t.covered).toBe(2);
  });

  it("writes the sentence from the computed numbers, never a typed one", () => {
    const t = tally(coverageByUseCase(data({ tls: true, ssh: true, sig: true, aes: true })));
    const s = coverageSentence(t);
    expect(s).toContain(`${t.covered} of ${t.scorable}`);
    expect(s).toContain(`${t.partial} partial`);
    expect(s).toContain(`${t.none} not covered`);
  });

  it("keeps the sentence honest when everything goes dark", () => {
    const t = tally(coverageByUseCase(data({})));
    expect(t.covered).toBe(0);
    expect(coverageSentence(t)).toContain("0 of 13");
  });
});

describe("hasClassicalSignatureArm", () => {
  function withSchemes(schemes: Record<string, unknown>): ProtocolsData {
    return {
      manifest: null,
      byArch: {
        x86_64: {
          tls: null,
          ipsec: null,
          ssh: null,
          sig: { schemes } as never,
          aes: null,
          lmsXmss: null,
        },
      },
    } as ProtocolsData;
  }

  it("is false when the track carries only post-quantum schemes", () => {
    expect(
      hasClassicalSignatureArm(
        withSchemes({ "ML-DSA-44": { kind: "post-quantum", status: "ok" } }),
      ),
    ).toBe(false);
  });

  it("is true once a classical scheme has actually landed", () => {
    expect(
      hasClassicalSignatureArm(
        withSchemes({
          "ML-DSA-44": { kind: "post-quantum", status: "ok" },
          "ECDSA-P256": { kind: "classical", status: "ok" },
        }),
      ),
    ).toBe(true);
  });

  it("does not count a classical scheme that failed to measure", () => {
    // An unavailable baseline is a gap, not an arm.
    expect(
      hasClassicalSignatureArm(
        withSchemes({ "RSA-2048-PSS": { kind: "classical", status: "unavailable" } }),
      ),
    ).toBe(false);
  });

  it("treats an unmarked scheme as not-stated rather than as classical", () => {
    // Every run committed before 2026-08-30 has no `kind` at all. Guessing
    // here would be the over-claim this file exists to avoid.
    expect(hasClassicalSignatureArm(withSchemes({ "ML-DSA-44": { status: "ok" } }))).toBe(false);
  });

  it("is false for a build with no signature track", () => {
    expect(hasClassicalSignatureArm({ manifest: null, byArch: {} } as ProtocolsData)).toBe(false);
  });
});

describe("lineItemsFor", () => {
  const noArm = { manifest: null, byArch: {} } as ProtocolsData;
  const withArm = {
    manifest: null,
    byArch: {
      x86_64: {
        tls: null,
        ipsec: null,
        ssh: null,
        sig: { schemes: { "ECDSA-P256": { kind: "classical", status: "ok" } } } as never,
        aes: null,
        lmsXmss: null,
      },
    },
  } as ProtocolsData;

  it("keeps T's pessimistic blocker while no classical arm has landed", () => {
    const t = lineItemsFor(noArm).find((li) => li.code === "T")!;
    expect(t.blocker).toContain("not yet appeared");
  });

  it("rewrites T's blocker once both arms are measured", () => {
    const t = lineItemsFor(withArm).find((li) => li.code === "T")!;
    expect(t.blocker).toContain("Both arms are now measured");
    expect(t.blocker).toContain("same-run");
  });

  it("changes nothing else", () => {
    const before = lineItemsFor(noArm).filter((li) => li.code !== "T");
    const after = lineItemsFor(withArm).filter((li) => li.code !== "T");
    expect(after).toEqual(before);
  });

  it("still returns all eleven line items", () => {
    expect(lineItemsFor(withArm)).toHaveLength(11);
  });
});

describe("the network-layer use case (3.12)", () => {
  it("is not covered while no IPsec track has produced data", () => {
    const row = coverageByUseCase(data({ tls: true, ssh: true })).find((r) => r.id === "3.12")!;
    expect(row.coverage).toBe("none");
    expect(row.trackMissing).toBe(true);
  });

  it("becomes PARTIAL, never covered, once the track lands", () => {
    // The use case bundles IPsec/IKE with MACsec and only the first is
    // measured. Marking it covered would claim the whole cell.
    const row = coverageByUseCase(data({ ipsec: true })).find((r) => r.id === "3.12")!;
    expect(row.coverage).toBe("partial");
    expect(row.trackMissing).toBe(false);
  });

  it("names both of what it leaves out", () => {
    const row = coverageByUseCase(data({ ipsec: true })).find((r) => r.id === "3.12")!;
    expect(row.gap).toContain("MACsec");
    expect(row.gap).toContain("MODP");
  });

  it("moves the tally from six uncovered to five", () => {
    // The first time the use-case count has moved, rather than a line item.
    const before = tally(coverageByUseCase(data({ tls: true, ssh: true, sig: true, aes: true })));
    const after = tally(
      coverageByUseCase(data({ tls: true, ssh: true, sig: true, aes: true, ipsec: true })),
    );
    expect(after.none).toBe(before.none - 1);
    expect(after.partial).toBe(before.partial + 1);
    // Still two fully covered: partial is not covered.
    expect(after.covered).toBe(before.covered);
  });

  it("counts the ipsec track as present only when it has suites", () => {
    expect(tracksPresent(data({ ipsec: true })).has("ipsec-composed")).toBe(true);
    expect(tracksPresent(data({ tls: true })).has("ipsec-composed")).toBe(false);
  });
});
