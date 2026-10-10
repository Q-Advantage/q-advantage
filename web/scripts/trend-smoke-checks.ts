import type { TrendPoint } from "../lib/data/trends-shared";

/** Same-day reruns and different hardware eras are independent measurements. */
export function assertUniqueRuns(points: Pick<TrendPoint, "date" | "commit" | "era_id">[]) {
  const keys = points.map((point) => JSON.stringify([point.date, point.commit, point.era_id]));
  if (new Set(keys).size !== points.length) {
    throw new Error("A measured run contributed more than one point.");
  }
}

/** A day window limits dates, not the number of committed runs. */
export function assertCalendarWindow(dates: string[], days: number | null) {
  if (days == null || dates.length === 0) return;
  const sorted = [...dates].sort();
  const first = Date.parse(`${sorted[0]}T00:00:00Z`);
  const last = Date.parse(`${sorted[sorted.length - 1]}T00:00:00Z`);
  if (!Number.isFinite(first) || !Number.isFinite(last) || (last - first) / 86400000 >= days) {
    throw new Error(`Dates exceed the ${days}-day calendar window.`);
  }
}
