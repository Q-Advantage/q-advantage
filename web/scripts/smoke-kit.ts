/**
 * Smoke test for the kit's pure table logic.
 *
 *   npx tsx scripts/smoke-kit.ts
 *
 * Same convention as the other smoke scripts: print a digest, assert the
 * cases that would embarrass the company if they silently broke, throw loudly
 * with an explanation.
 *
 * Fixtures use obviously-fake sentinels (-1, 9999) per CLAUDE.md guardrail 1 —
 * nothing here could be mistaken for a measurement.
 */
import {
  compareSortValues,
  decodeSort,
  encodeSort,
  nextSortState,
  sortRows,
} from "../lib/table/sort";

type Row = { key: string; sort?: Record<string, number | string | null> };

const rows: Row[] = [
  { key: "measured-slow", sort: { latency: 9999, name: "c" } },
  { key: "unmeasured", sort: { latency: null, name: "a" } },
  { key: "measured-zero", sort: { latency: 0, name: "b" } },
  { key: "missing-key", sort: { name: "d" } },
];

console.log("=== nulls sort last in BOTH directions ===");
// The regression this guards: sorting a latency column ascending and having
// every unmeasured row float to the top, reading as "fastest". A missing
// measurement ranking as zero is the table equivalent of publishing a
// fabricated number.
for (const dir of ["asc", "desc"] as const) {
  const order = sortRows(rows, "latency", dir).map((r) => r.key);
  console.log(`  ${dir}: ${order.join(" → ")}`);

  const measured = ["measured-zero", "measured-slow"];
  const firstTwo = order.slice(0, 2);
  if (!measured.every((k) => firstTwo.includes(k))) {
    throw new Error(
      `sortRows(latency, ${dir}) = ${order.join(",")} — every measured row must precede every ` +
        `unmeasured one. A null latency must never outrank a real measurement of zero.`,
    );
  }
}

console.log("\n=== a row missing the key entirely is treated as missing, not as 0 ===");
const ascOrder = sortRows(rows, "latency", "asc").map((r) => r.key);
if (ascOrder.indexOf("missing-key") < ascOrder.indexOf("measured-zero")) {
  throw new Error(
    "A row with no entry for the sort column outranked a measured 0 — absent and zero are " +
      "different states and must not collapse.",
  );
}
console.log("  Correct.");

console.log("\n=== stability: equal keys keep input order ===");
const ties: Row[] = [
  { key: "first", sort: { v: 1 } },
  { key: "second", sort: { v: 1 } },
  { key: "third", sort: { v: 1 } },
];
const tieOrder = sortRows(ties, "v", "desc").map((r) => r.key).join(",");
console.log(`  ${tieOrder}`);
if (tieOrder !== "first,second,third") {
  throw new Error(`Unstable sort: got ${tieOrder} — ties must preserve the server's order.`);
}

console.log("\n=== NaN and Infinity count as missing ===");
for (const bad of [NaN, Infinity, -Infinity]) {
  if (compareSortValues(bad, 5, "asc") !== 1) {
    throw new Error(`compareSortValues(${bad}, 5) must sink the non-finite value.`);
  }
}
console.log("  Correct.");

console.log("\n=== header-click cycle returns to the page's default order ===");
// The default order on these pages is itself meaningful (threat descending,
// latency ascending), so a reader must be able to get back to it.
let state = nextSortState(null, "latency", "asc");
console.log(`  click 1: ${encodeSort(state)}`);
state = nextSortState(state, "latency", "asc");
console.log(`  click 2: ${encodeSort(state)}`);
state = nextSortState(state, "latency", "asc");
console.log(`  click 3: ${encodeSort(state) ?? "default"}`);
if (state !== null) {
  throw new Error(`Third click gave ${encodeSort(state)}, expected a return to the default order.`);
}

console.log("\n=== decodeSort rejects anything not explicitly allowed ===");
const allowed = ["latency", "name"];
const cases: [string | null, boolean][] = [
  ["latency:asc", true],
  ["name:desc", true],
  ["latency:sideways", false],
  ["__proto__:asc", false],
  ["secret_column:desc", false],
  ["latency", false],
  ["", false],
  [null, false],
];
for (const [raw, shouldParse] of cases) {
  const got = decodeSort(raw, allowed);
  console.log(`  ${JSON.stringify(raw)} → ${got ? encodeSort(got) : "null"}`);
  if (Boolean(got) !== shouldParse) {
    throw new Error(
      `decodeSort(${JSON.stringify(raw)}) = ${JSON.stringify(got)} — a crafted or stale ?sort= ` +
        `must fall back to the default order, never throw and never sort by an unknown column.`,
    );
  }
}

console.log("\nOK — kit smoke test passed.");
