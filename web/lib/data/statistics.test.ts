import { describe, expect, it } from "vitest";
import {
  Z_95,
  confidenceInterval,
  formatInterval,
  formatRelativeMargin,
  separatedBeyondNoise,
} from "./statistics";

const stat = (mean: number, stdev: number, n: number) => ({
  mean_us: mean,
  stdev_us: stdev,
  n_iterations: n,
});

describe("confidenceInterval", () => {
  it("computes the interval from the standard error, not the standard deviation", () => {
    // The distinction this whole module exists for. stdev 30 at n=900 gives a
    // standard error of 1, so the interval is ±1.96 — not ±30.
    const ci = confidenceInterval(stat(100, 30, 900))!;
    expect(ci.stdError).toBeCloseTo(1, 10);
    expect(ci.low).toBeCloseTo(100 - Z_95, 6);
    expect(ci.high).toBeCloseTo(100 + Z_95, 6);
  });

  it("narrows as sqrt(n) grows", () => {
    const few = confidenceInterval(stat(100, 30, 100))!;
    const many = confidenceInterval(stat(100, 30, 10000))!;
    expect(many.stdError).toBeCloseTo(few.stdError / 10, 6);
  });

  it("reports the relative margin a reader actually quotes", () => {
    const ci = confidenceInterval(stat(200, 40, 1600))!;
    // stderr = 1, margin = 1.96, on a mean of 200 => 0.98%
    expect(ci.relativeMarginPct).toBeCloseTo(0.98, 2);
  });

  it("returns null for a single sample rather than a zero-width interval", () => {
    // `x ± 0` reads as certainty. Absence of evidence must not render as
    // precision.
    expect(confidenceInterval(stat(100, 0, 1))).toBeNull();
  });

  it("returns null when any input field is missing", () => {
    expect(confidenceInterval({ mean_us: 100, stdev_us: 5 })).toBeNull();
    expect(confidenceInterval({ mean_us: 100, n_iterations: 1000 })).toBeNull();
    expect(confidenceInterval(null)).toBeNull();
    expect(confidenceInterval(undefined)).toBeNull();
  });

  it("returns null for non-finite or non-positive input", () => {
    expect(confidenceInterval(stat(Number.NaN, 5, 1000))).toBeNull();
    expect(confidenceInterval(stat(100, Number.POSITIVE_INFINITY, 1000))).toBeNull();
    expect(confidenceInterval(stat(0, 5, 1000))).toBeNull();
    expect(confidenceInterval(stat(100, -1, 1000))).toBeNull();
  });

  it("handles a perfectly stable measurement without dividing by zero", () => {
    const ci = confidenceInterval(stat(100, 0, 1000))!;
    expect(ci.low).toBe(100);
    expect(ci.high).toBe(100);
    expect(ci.relativeMarginPct).toBe(0);
  });
});

describe("separatedBeyondNoise", () => {
  it("is true when the intervals do not overlap", () => {
    expect(separatedBeyondNoise(stat(100, 10, 1000), stat(200, 10, 1000))).toBe(true);
  });

  it("is false when two means sit inside each other's intervals", () => {
    // The case worth catching: a published "A is faster than B" that this host
    // cannot actually distinguish.
    expect(separatedBeyondNoise(stat(100, 100, 100), stat(102, 100, 100))).toBe(false);
  });

  it("is symmetric", () => {
    const a = stat(100, 10, 1000);
    const b = stat(200, 10, 1000);
    expect(separatedBeyondNoise(a, b)).toBe(separatedBeyondNoise(b, a));
  });

  it("is null, not false, when either side cannot be judged", () => {
    // A caller would reasonably read `false` as "they overlap", which is a
    // different claim from "we cannot tell".
    expect(separatedBeyondNoise(stat(100, 10, 1000), null)).toBeNull();
    expect(separatedBeyondNoise(null, stat(100, 10, 1000))).toBeNull();
    expect(separatedBeyondNoise(stat(100, 10, 1), stat(200, 10, 1000))).toBeNull();
  });

  it("errs toward calling a real difference indistinguishable", () => {
    // Non-overlap is a stricter bar than a t-test. Under-claiming is the
    // failure mode this product can afford; over-claiming is not.
    const a = stat(100, 20, 100); // stderr 2, interval ~96.1-103.9
    const b = stat(105, 20, 100); // stderr 2, interval ~101.1-108.9
    expect(separatedBeyondNoise(a, b)).toBe(false);
  });
});

describe("formatting", () => {
  it("renders an em-dash for an absent interval rather than a zero", () => {
    expect(formatInterval(null)).toBe("—");
    expect(formatRelativeMargin(null)).toBe("—");
  });

  it("renders the interval and the relative margin", () => {
    const ci = confidenceInterval(stat(100, 30, 900))!;
    expect(formatInterval(ci)).toMatch(/98\.04–101\.96 µs/);
    expect(formatRelativeMargin(ci)).toBe("±1.96%");
  });
});
