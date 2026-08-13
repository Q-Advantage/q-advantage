/**
 * Smoke test for PQC Arena's published criteria.
 *
 *   npx tsx scripts/smoke-arena.ts
 *
 * Same convention as smoke-loader.ts / smoke-protocols.ts: print a digest,
 * assert the things that would embarrass the company if they silently broke,
 * fail loudly.
 *
 * The load-bearing check here is the last one: Arena is published *without*
 * ratings on purpose, and this repo is public. A guard that fails when vendor
 * data appears is cheaper than discovering it in git history later.
 */
import {
  ARENA_CRITERIA,
  ARENA_TIERS,
  rankedTiers,
  criticalFailureCriteria,
  type ArenaTierId,
} from "../lib/data/arena-criteria";

console.log("=== Criteria: all ten dimensions present and complete ===");
if (ARENA_CRITERIA.length !== 10) {
  throw new Error(`Expected 10 rating dimensions, found ${ARENA_CRITERIA.length}.`);
}
const seenNumbers = new Set<number>();
const seenIds = new Set<string>();
for (const c of ARENA_CRITERIA) {
  const problems: string[] = [];
  if (!c.definition.trim()) problems.push("empty definition");
  if (c.checklist.length === 0) problems.push("empty checklist");
  if (!c.dataSource.trim()) problems.push("no stated data source");
  if (seenNumbers.has(c.number)) problems.push(`duplicate number ${c.number}`);
  if (seenIds.has(c.id)) problems.push(`duplicate id ${c.id}`);
  seenNumbers.add(c.number);
  seenIds.add(c.id);
  if (problems.length) {
    throw new Error(`Criterion "${c.id}" is incomplete: ${problems.join(", ")}.`);
  }
  const gate = c.criticalFailure ? " [critical-failure gate]" : "";
  console.log(
    `  ${String(c.number).padStart(2, "0")} ${c.name.padEnd(46)} ${c.checklist.length} checks, ${c.references.length} refs${gate}`,
  );
}
for (let n = 1; n <= 10; n++) {
  if (!seenNumbers.has(n)) throw new Error(`Dimension number ${n} is missing.`);
}
console.log("  All ten present, numbered 1–10, no duplicates.");

console.log("\n=== Citations: every reference states how well it was verified ===");
let confirmed = 0;
let corroborated = 0;
let unverified = 0;
for (const c of ARENA_CRITERIA) {
  for (const r of c.references) {
    if (!r.label.trim()) {
      throw new Error(`Criterion "${c.id}" has a reference with no label.`);
    }
    if (r.verification === "unverified") {
      unverified++;
      // An unverified lead must NOT carry a URL or a retrieval date — those
      // make it look like a citation. It is deliberately inert.
      if (r.url || r.retrieved) {
        throw new Error(
          `Reference "${r.label}" is marked unverified but carries a url/retrieved date. ` +
            `An unverified entry is a lead, not a citation — either verify it and upgrade, or ` +
            `strip the url and date.`,
        );
      }
      if (!r.note?.trim()) {
        throw new Error(`Unverified reference "${r.label}" must carry a note saying it wasn't checked.`);
      }
      continue;
    }
    // Everything else is presented to the reader as a citation, so it must
    // actually resolve to something with a date.
    if (!/^https?:\/\//.test(r.url)) {
      throw new Error(`Reference "${r.label}" (${r.verification}) has no usable URL.`);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.retrieved)) {
      throw new Error(
        `Reference "${r.label}" (${r.verification}) has retrieved="${r.retrieved}" — expected YYYY-MM-DD.`,
      );
    }
    if (r.verification === "confirmed") confirmed++;
    else corroborated++;
  }
}
console.log(`  confirmed: ${confirmed} · search-corroborated: ${corroborated} · unverified leads: ${unverified}`);
console.log("  Every citation has a URL and a retrieval date; every unverified lead is inert.");

console.log("\n=== Critical-failure gate ===");
const gates = criticalFailureCriteria();
if (gates.length === 0) {
  throw new Error(
    "No critical-failure gate is defined. Algorithm correctness must override other scores — " +
      "without a gate, a vendor that computes the wrong answer could average its way to a good tier.",
  );
}
for (const g of gates) {
  console.log(`  ${g.name} → ${g.criticalFailure?.slice(0, 72)}…`);
}
const correctnessGate = gates.find((g) => g.id === "algorithm-correctness");
if (!correctnessGate) {
  throw new Error("Algorithm correctness is no longer a critical-failure gate — that is a regression.");
}
if (!/underperform/i.test(correctnessGate.criticalFailure ?? "")) {
  throw new Error("The correctness gate must state that failure results in Underperform.");
}
console.log("  Correctness gate present and routes to Underperform.");

console.log("\n=== Tiers: exhaustive, ordered, and Unavailable is off-scale ===");
const EXPECTED_TIERS: ArenaTierId[] = [
  "platinum",
  "gold",
  "silver",
  "bronze",
  "underperform",
  "unavailable",
];
for (const id of EXPECTED_TIERS) {
  const tier = ARENA_TIERS.find((t) => t.id === id);
  if (!tier) throw new Error(`Tier "${id}" is missing.`);
  if (!tier.summary.trim()) throw new Error(`Tier "${id}" has no summary.`);
}
if (ARENA_TIERS.length !== EXPECTED_TIERS.length) {
  throw new Error(`Expected ${EXPECTED_TIERS.length} tiers, found ${ARENA_TIERS.length}.`);
}
const ranked = rankedTiers();
console.log(`  ranked: ${ranked.map((t) => t.label).join(" > ")}`);
const ranks = ranked.map((t) => t.rank as number);
if (ranks.some((r, i) => i > 0 && r <= ranks[i - 1])) {
  throw new Error("Ranked tiers are not in strictly ascending rank order.");
}
const unavailable = ARENA_TIERS.find((t) => t.id === "unavailable")!;
if (unavailable.rank !== null) {
  throw new Error(
    "Unavailable has a numeric rank. It is an absence of evidence, not a position on the scale — " +
      "ranking it would sort it as 'worse than Underperform', which misstates what it means.",
  );
}
console.log("  unranked (correct): Unavailable");

console.log("\n=== Public-repo guard: no vendor data may ship here ===");
// PQC Arena publishes criteria, not verdicts. Vendor assessments live in a
// private repo (ADR 0004) because this one is public. If a dataset ever
// appears here, this fails before it reaches a reviewer's eyes.
let vendorDataset: unknown;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  vendorDataset = require("../lib/data/arena-vendors.generated.json");
} catch {
  vendorDataset = null;
}
if (vendorDataset !== null) {
  throw new Error(
    "web/lib/data/arena-vendors.generated.json exists in this PUBLIC repo. Vendor assessments must " +
      "live in the private Q-Advantage/pqc-arena repo until every publish precondition in " +
      "docs/adr/0004-pqc-arena-topology-and-publish-gates.md is met. Remove it — and check whether " +
      "it already entered git history.",
  );
}
console.log("  No vendor dataset present. Correct for this stage.");

console.log("\nOK — arena criteria smoke test passed.");
