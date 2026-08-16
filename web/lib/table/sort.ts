// web/lib/table/sort.ts
//
// Table sorting, as pure functions. Kept out of the components so the one
// rule that actually matters here is testable:
//
//   A missing measurement must never sort as if it were zero.
//
// Sorting a column of latencies ascending and having every unmeasured row
// float to the top — reading as "fastest" — would be the table equivalent of
// publishing a fabricated number. Nulls sort last in BOTH directions.

export type SortDir = "asc" | "desc";
export type SortValue = number | string | null;

export interface SortState {
  id: string;
  dir: SortDir;
}

/**
 * Compare two sort values under `dir`, with null/undefined/NaN always last.
 *
 * Strings compare with `localeCompare` so vendor and suite names order the way
 * a reader expects; numbers compare numerically. Mixed types are not expected
 * within a column — if they occur, numbers sort before strings deterministically
 * rather than throwing.
 */
export function compareSortValues(a: SortValue, b: SortValue, dir: SortDir): number {
  const aMissing = a == null || (typeof a === "number" && !Number.isFinite(a));
  const bMissing = b == null || (typeof b === "number" && !Number.isFinite(b));

  // Missing always sinks, regardless of direction. This is the whole point of
  // the module — do not "simplify" it into the comparison below.
  if (aMissing && bMissing) return 0;
  if (aMissing) return 1;
  if (bMissing) return -1;

  let cmp: number;
  if (typeof a === "number" && typeof b === "number") {
    cmp = a - b;
  } else if (typeof a === "string" && typeof b === "string") {
    cmp = a.localeCompare(b);
  } else {
    cmp = typeof a === "number" ? -1 : 1;
  }

  return dir === "asc" ? cmp : -cmp;
}

/**
 * Stable sort of rows by a named sort key. Rows carrying no value for `id`
 * are treated as missing and sink to the tail in input order.
 */
export function sortRows<T extends { key: string; sort?: Record<string, SortValue> }>(
  rows: T[],
  id: string,
  dir: SortDir,
): T[] {
  return rows
    .map((row, index) => ({ row, index }))
    .sort((x, y) => {
      const cmp = compareSortValues(x.row.sort?.[id] ?? null, y.row.sort?.[id] ?? null, dir);
      return cmp !== 0 ? cmp : x.index - y.index;
    })
    .map((entry) => entry.row);
}

/**
 * Header-click cycle: unsorted → the column's natural direction → flipped →
 * back to unsorted (i.e. the page's own default order).
 *
 * Returning to the default matters: the default order on these pages is itself
 * meaningful (threat descending, latency ascending), so a reader must be able
 * to get back to it without a reload.
 */
export function nextSortState(
  current: SortState | null,
  id: string,
  defaultDir: SortDir,
): SortState | null {
  if (!current || current.id !== id) return { id, dir: defaultDir };
  if (current.dir === defaultDir) return { id, dir: defaultDir === "asc" ? "desc" : "asc" };
  return null;
}

export function encodeSort(state: SortState | null): string | null {
  return state ? `${state.id}:${state.dir}` : null;
}

/**
 * Parse `?sort=col:dir`, rejecting anything not in `allowed`. A crafted or
 * stale URL must land on the default order, never throw and never reorder the
 * table by a column that no longer exists.
 */
export function decodeSort(raw: string | null | undefined, allowed: readonly string[]): SortState | null {
  if (!raw) return null;
  const [id, dir] = raw.split(":");
  if (!allowed.includes(id)) return null;
  if (dir !== "asc" && dir !== "desc") return null;
  return { id, dir };
}
