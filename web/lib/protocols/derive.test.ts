import { describe, expect, it } from "vitest";
import {
  amplificationFactor,
  hasLiveStatefulSigs,
  humanizeStatefulSigError,
  statefulSigsUnavailableReason,
} from "./derive";
import type { ComposedSuite, LmsXmssFile } from "./types";

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
