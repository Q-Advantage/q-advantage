import { describe, expect, it } from "vitest";
import {
  amplificationFactor,
  classifySuite,
  formatMultiplier,
  hasLiveStatefulSigs,
  humanizeStatefulSigError,
  hybridToPurePqcRatio,
  largestPostQuantumToken,
  statefulSigsUnavailableReason,
  tokenLimitVerdicts,
} from "./derive";
import type { ComposedSuite, JoseComposedFile, LmsXmssFile } from "./types";

const env = { iso_timestamp: "", liboqs_version: "", git_commit: "", cpu_model: "", arch: "" };
const file = (schemes: Record<string, unknown>) =>
  ({ environment: env, schemes }) as unknown as LmsXmssFile;

describe("hasLiveStatefulSigs", () => {
  it("is false for no file — a missing file is not evidence of data", () => {
    expect(hasLiveStatefulSigs(null)).toBe(false);
    expect(hasLiveStatefulSigs(undefined)).toBe(false);
  });

  it("is false when every scheme is unavailable", () => {
    expect(
      hasLiveStatefulSigs(
        file({
          LMS_SHA256_H10_W8: { scheme: "LMS_SHA256_H10_W8", status: "unavailable", reason: "r" },
        }),
      ),
    ).toBe(false);
  });

  it("is false when every scheme FAILED — the shape live since 2026-08-17", () => {
    // No fixture covered this before. The harness committed a file every day
    // with four failed schemes; anything gating on file presence, or on
    // "unavailable" specifically, would read it as data.
    expect(
      hasLiveStatefulSigs(
        file({
          LMS_SHA256_H10_W8: {
            scheme: "LMS_SHA256_H10_W8",
            status: "failed",
            error: "MechanismNotEnabledError: LMS_SHA256_H10_W8",
            error_type: "verify_only_exception",
          },
        }),
      ),
    ).toBe(false);
  });

  it("is true only when a scheme actually measured something", () => {
    expect(
      hasLiveStatefulSigs(
        file({
          a: { scheme: "a", status: "unavailable" },
          b: { scheme: "b", status: "ok", signature_bytes: 2500 },
        }),
      ),
    ).toBe(true);
  });
});

describe("statefulSigsUnavailableReason", () => {
  it("is null when there is no file — no file means no reason to quote", () => {
    expect(statefulSigsUnavailableReason(null)).toBeNull();
  });

  it("prefers a recorded reason over a raw error string", () => {
    const r = statefulSigsUnavailableReason(
      file({
        a: { scheme: "a", status: "failed", error: "MechanismNotEnabledError: a" },
        b: { scheme: "b", status: "unavailable", reason: "the harness's own words" },
      }),
    );
    expect(r).toBe("the harness's own words");
  });

  it("translates the raw exception already committed in historical files", () => {
    // Every lms-xmss file from 2026-08-17 onward carries only this. Rendering
    // it verbatim put "MechanismNotEnabledError: LMS_SHA256_H10_W8" on the
    // public page as the explanation for missing data.
    const r = statefulSigsUnavailableReason(
      file({
        a: {
          scheme: "a",
          status: "failed",
          error: "MechanismNotEnabledError: LMS_SHA256_H10_W8",
          error_type: "verify_only_exception",
        },
      }),
    );
    expect(r).not.toBeNull();
    expect(r).not.toContain("MechanismNotEnabledError");
    expect(r).toContain("liboqs");
  });

  it("passes an undiagnosed error through verbatim rather than inventing one", () => {
    expect(humanizeStatefulSigError("KatVerificationError: vector did not verify")).toBe(
      "KatVerificationError: vector did not verify",
    );
  });
});

describe("amplificationFactor", () => {
  const suite = (c: number, s: number) =>
    ({ size: { bytes_client_to_server: c, bytes_server_to_client: s, bytes_total: c + s } }) as ComposedSuite;

  it("is server bytes per client byte", () => {
    expect(amplificationFactor(suite(1216, 1120))).toBeCloseTo(1120 / 1216, 10);
  });

  it("is null, never Infinity, when the client sent nothing", () => {
    expect(amplificationFactor(suite(0, 1120))).toBeNull();
  });

  it("is null when the suite has no size block", () => {
    expect(amplificationFactor({} as ComposedSuite)).toBeNull();
  });
});

// Sentinel discipline, per CLAUDE.md guardrail 1: fabricated inputs must be
// impossible to mistake for a measurement. Degenerate distribution, n=1,
// zero stdev — the same shape anomaly.test.ts uses.
function timing(median: number) {
  return {
    mean_us: median,
    median_us: median,
    p95_us: median,
    p99_us: median,
    stdev_us: 0,
    min_us: median,
    max_us: median,
    ops_per_sec: 1,
    n_iterations: 1,
  };
}

function phased(median: number, phaseNames: string[]): ComposedSuite {
  const phases: Record<string, ReturnType<typeof timing>> = {};
  for (const p of phaseNames) phases[p] = timing(1);
  return {
    identity: { protocol: "tls", mode: "fixture", suite: "fixture" },
    timing: timing(median),
    phases,
  } as unknown as ComposedSuite;
}

describe("classifySuite", () => {
  // The four phase-key shapes as they actually appear in the committed
  // record, per tls-composed-2026-08-31 / ssh-composed-2026-08-31.
  const HYBRID = ["kem_keygen", "kem_encaps", "kem_decaps", "classical_keygen", "classical_derive"];
  const PURE = ["kem_keygen", "kem_encaps", "kem_decaps"];
  const CLASSICAL = ["classical_keygen", "classical_derive"];

  it("is hybrid when both a KEM phase and a classical phase were measured", () => {
    expect(classifySuite(phased(265.514, HYBRID))).toBe("hybrid");
  });

  it("is pure-pqc for a KEM-only suite — the case that must not read as hybrid", () => {
    // MLKEM768 is legitimately faster than the classical baseline. Calling it
    // hybrid would make anomaly.ts withhold a true published finding; calling
    // a hybrid pure-pqc would let an impossible comparison through.
    expect(classifySuite(phased(102.166, PURE))).toBe("pure-pqc");
  });

  it("is classical for a classical-only suite", () => {
    expect(classifySuite(phased(231.698, CLASSICAL))).toBe("classical");
  });

  it("is unknown — never guessed — when there is no phase data", () => {
    expect(classifySuite(phased(1, []))).toBe("unknown");
    expect(classifySuite({} as ComposedSuite)).toBe("unknown");
  });

  it("reads the phase block, not the suite name", () => {
    // A suite named like a hybrid but carrying only KEM phases is pure-pqc.
    // Name patterns are a house convention; the measurement is the truth.
    const misleading = phased(102.166, PURE);
    (misleading as { identity: { suite: string } }).identity.suite = "X25519MLKEM768";
    expect(classifySuite(misleading)).toBe("pure-pqc");
  });
});

describe("hybridToPurePqcRatio", () => {
  const hybrid = phased(265.514, ["kem_keygen", "classical_keygen"]);
  const pure = phased(102.166, ["kem_keygen"]);

  it("is hybrid median over pure median", () => {
    expect(hybridToPurePqcRatio(hybrid, pure)).toBeCloseTo(265.514 / 102.166, 10);
  });

  it("is null, never Infinity, when the pure suite has a zero median", () => {
    expect(hybridToPurePqcRatio(hybrid, phased(0, ["kem_keygen"]))).toBeNull();
  });

  it("is null when either side has no timing block", () => {
    expect(hybridToPurePqcRatio(hybrid, {} as ComposedSuite)).toBeNull();
    expect(hybridToPurePqcRatio({} as ComposedSuite, pure)).toBeNull();
  });
});

describe("formatMultiplier", () => {
  it("renders an em dash for null rather than a zero", () => {
    expect(formatMultiplier(null)).toBe("—");
  });

  it("scales precision with magnitude", () => {
    expect(formatMultiplier(2.5988)).toBe("2.60×");
    expect(formatMultiplier(12.34)).toBe("12.3×");
    expect(formatMultiplier(148.6)).toBe("149×");
  });
});

// Shapes taken from jose-composed-2026-08-31: a 413-byte ECDSA-P256 baseline,
// ML-DSA-87 at 6,494 bytes, and the three documented limits the track publishes.
const joseFile = (over: Partial<JoseComposedFile> = {}) =>
  ({
    size_limits: [
      { name: "HTTP cookie value", bytes: 4096, source: "RFC 6265 section 6.1" },
      { name: "nginx large_client_header_buffers (one header)", bytes: 8192, source: "nginx default" },
      { name: "Node.js --max-http-header-size (whole header block)", bytes: 16384, source: "Node default" },
    ],
    comparison: {
      measurable: true,
      baseline: "ECDSA-P256",
      baseline_token_bytes: 413,
      rows: [
        { scheme: "ML-DSA-87", kind: "post-quantum", token_bytes: 6494, token_delta_bytes: 6081, token_multiple_of_baseline: 15.72, sign_delta_pct: 447.8 },
        { scheme: "ML-DSA-44", kind: "post-quantum", token_bytes: 3551, token_delta_bytes: 3138, token_multiple_of_baseline: 8.6, sign_delta_pct: 153.2 },
        { scheme: "RSA-2048", kind: "classical", token_bytes: 500, token_delta_bytes: 87, token_multiple_of_baseline: 1.21, sign_delta_pct: 10 },
      ],
    },
    ...over,
  }) as unknown as JoseComposedFile;

describe("tokenLimitVerdicts", () => {
  it("marks only the limits a token actually crosses", () => {
    const v = tokenLimitVerdicts(joseFile(), 6494);
    expect(v.map((x) => x.exceeded)).toEqual([true, false, false]);
  });

  it("treats a token exactly on a limit as fitting, not exceeding", () => {
    // RFC 6265 asks servers to SUPPORT 4096 bytes, so 4096 is inside it.
    expect(tokenLimitVerdicts(joseFile(), 4096)[0].exceeded).toBe(false);
    expect(tokenLimitVerdicts(joseFile(), 4097)[0].exceeded).toBe(true);
  });

  it("carries each limit's own source through rather than restating it", () => {
    expect(tokenLimitVerdicts(joseFile(), 500)[0].source).toBe("RFC 6265 section 6.1");
  });

  it("returns nothing when there is no size to judge", () => {
    expect(tokenLimitVerdicts(joseFile(), null)).toEqual([]);
    expect(tokenLimitVerdicts(joseFile(), Number.NaN)).toEqual([]);
    expect(tokenLimitVerdicts(null, 6494)).toEqual([]);
  });
});

describe("largestPostQuantumToken", () => {
  it("is the biggest post-quantum row, never a classical one", () => {
    const worst = largestPostQuantumToken(joseFile());
    expect(worst).toEqual({ scheme: "ML-DSA-87", bytes: 6494, multiple: 15.72 });
  });

  it("is null when the track recorded that it could not compare", () => {
    // The file carries a reason in this case; a page must show that, not a blank.
    expect(
      largestPostQuantumToken(
        joseFile({ comparison: { measurable: false, reason: "no classical arm" } } as Partial<JoseComposedFile>),
      ),
    ).toBeNull();
  });

  it("is null when every arm is classical, rather than promoting one", () => {
    expect(
      largestPostQuantumToken(
        joseFile({
          comparison: {
            measurable: true,
            baseline: "ECDSA-P256",
            rows: [{ scheme: "RSA-2048", kind: "classical", token_bytes: 500, token_delta_bytes: 87, token_multiple_of_baseline: 1.21, sign_delta_pct: 10 }],
          },
        } as Partial<JoseComposedFile>),
      ),
    ).toBeNull();
  });

  it("is null for a missing file", () => {
    expect(largestPostQuantumToken(null)).toBeNull();
  });
});
