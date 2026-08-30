import { describe, expect, it } from "vitest";
import {
  CFDIR_FRAMEWORK_VERSION,
  LINE_ITEMS,
  USE_CASES,
  coverageSentence,
  tally,
  tracksPresent,
  useCaseCoverage,
} from "./cfdir";
import type { ProtocolsData } from "@/lib/protocols/types";

function data(tracks: {
  tls?: boolean;
  ssh?: boolean;
  sig?: boolean;
  aes?: boolean;
}): ProtocolsData {
  return {
    manifest: null,
    byArch: {
      x86_64: {
        tls: tracks.tls ? ({ suites: { X25519: {} } } as never) : null,
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
      byArch: { x86_64: { tls: { suites: {} } as never, ssh: null, sig: null, aes: null, lmsXmss: null } },
    } as ProtocolsData;
    expect(tracksPresent(empty).has("tls-composed")).toBe(false);
  });

  it("handles an empty build without throwing", () => {
    expect(tracksPresent({ manifest: null, byArch: {} } as ProtocolsData).size).toBe(0);
  });
});

describe("useCaseCoverage", () => {
  it("marks the two fully-covered use cases when both tracks are present", () => {
    const rows = useCaseCoverage(data({ tls: true, ssh: true, sig: true, aes: true }));
    const covered = rows.filter((r) => r.coverage === "covered").map((r) => r.id);
    expect(covered.sort()).toEqual(["3.13", "3.4"]);
  });

  it("downgrades a use case whose track produced no data", () => {
    // The reason coverage is computed rather than declared: a track that stops
    // running must downgrade its own row instead of a stale table claiming it.
    const rows = useCaseCoverage(data({ ssh: true }));
    const tls = rows.find((r) => r.id === "3.4")!;
    expect(tls.coverage).toBe("none");
    expect(tls.trackMissing).toBe(true);
  });

  it("distinguishes a missing track from a use case nothing measures", () => {
    // These read differently and must not be collapsed: one is an outage, the
    // other is scope.
    const rows = useCaseCoverage(data({}));
    expect(rows.find((r) => r.id === "3.4")!.trackMissing).toBe(true);
    expect(rows.find((r) => r.id === "3.10")!.trackMissing).toBe(false);
  });

  it("leaves the not-applicable row not-applicable regardless of data", () => {
    // 3.1 has no measurable cryptographic term at all. It must never appear as
    // a gap we could close.
    for (const d of [data({}), data({ tls: true, ssh: true, sig: true, aes: true })]) {
      expect(useCaseCoverage(d).find((r) => r.id === "3.1")!.coverage).toBe("not-applicable");
    }
  });
});

describe("tally and the headline sentence", () => {
  it("excludes not-applicable rows from the denominator", () => {
    const t = tally(useCaseCoverage(data({ tls: true, ssh: true, sig: true, aes: true })));
    expect(t.notApplicable).toBe(1);
    expect(t.scorable).toBe(13);
    expect(t.covered + t.partial + t.none).toBe(13);
  });

  it("reports two covered against the real track set", () => {
    const t = tally(useCaseCoverage(data({ tls: true, ssh: true, sig: true, aes: true })));
    expect(t.covered).toBe(2);
  });

  it("writes the sentence from the computed numbers, never a typed one", () => {
    const t = tally(useCaseCoverage(data({ tls: true, ssh: true, sig: true, aes: true })));
    const s = coverageSentence(t);
    expect(s).toContain(`${t.covered} of ${t.scorable}`);
    expect(s).toContain(`${t.partial} partial`);
    expect(s).toContain(`${t.none} not covered`);
  });

  it("keeps the sentence honest when everything goes dark", () => {
    const t = tally(useCaseCoverage(data({})));
    expect(t.covered).toBe(0);
    expect(coverageSentence(t)).toContain("0 of 13");
  });
});
