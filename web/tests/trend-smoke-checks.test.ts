import { describe, expect, it } from "vitest";
import { assertCalendarWindow, assertUniqueRuns } from "../scripts/trend-smoke-checks";

describe("trend smoke invariants", () => {
  const point = { date: "2000-01-01", commit: "TEST-COMMIT-A", era_id: "TEST-ERA-A" };
  it("retains independent runs on the same date", () => {
    expect(() => assertUniqueRuns([point, { ...point, commit: "TEST-COMMIT-B" },
      { ...point, era_id: "TEST-ERA-B" }])).not.toThrow();
  });
  it("rejects duplicate points from the same run", () => {
    expect(() => assertUniqueRuns([point, { ...point }])).toThrow("more than one point");
  });
  it("accepts more runs than calendar days", () => {
    const dates = Array.from({ length: 60 }, (_, index) =>
      `2000-01-${String(Math.floor(index / 2) + 1).padStart(2, "0")}`);
    expect(() => assertCalendarWindow(dates, 30)).not.toThrow();
  });
  it("rejects a run outside the inclusive calendar window", () => {
    expect(() => assertCalendarWindow(["2000-01-01", "2000-01-31"], 30)).toThrow();
  });
  it("allows gaps, unsorted dates and the all-time range", () => {
    expect(() => assertCalendarWindow(["2000-01-30", "2000-01-01"], 30)).not.toThrow();
    expect(() => assertCalendarWindow(["2000-01-01", "2001-01-01"], null)).not.toThrow();
  });
});
