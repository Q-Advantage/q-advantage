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
import {
  tierEligibility,
  forcedTier,
  validateRating,
  MIN_ASSESSED_DIMENSIONS,
  type DimensionAssessment,
  type VendorRating,
} from "../lib/data/arena-types";
import { getVendorRatings, hasPublishedRatings } from "../lib/data/arena";

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

console.log("\n=== Tier eligibility: partial data must yield NO tier, not a cautious one ===");
function assessments(standings: DimensionAssessment["standing"][]): DimensionAssessment[] {
  return standings.map((standing, i) => ({
    criterionId: ARENA_CRITERIA[i]?.id ?? `fixture-${i}`,
    standing,
    finding: standing === "not-assessed" ? null : "fixture finding",
    evidence:
      standing === "not-assessed"
        ? []
        : [
            {
              claim: "fixture claim",
              sourceUrl: "https://example.invalid/doc",
              retrieved: "2026-08-13",
              verification: "confirmed" as const,
            },
          ],
  }));
}
const twoOfTen = assessments([
  "leads",
  "trails",
  ...Array<DimensionAssessment["standing"]>(8).fill("not-assessed"),
]);
const twoOfTenEligibility = tierEligibility(twoOfTen);
console.log(`  2 of 10 assessed → eligible: ${twoOfTenEligibility.eligible}`);
if (twoOfTenEligibility.eligible) {
  throw new Error(
    "2-of-10 assessed dimensions was judged tier-eligible. That is precisely the case the spec " +
      "refuses to assign a tier on — partial data must yield no tier, not a cautious one.",
  );
}

const sevenOfTen = assessments([
  ...Array<DimensionAssessment["standing"]>(MIN_ASSESSED_DIMENSIONS).fill("adequate"),
  ...Array<DimensionAssessment["standing"]>(10 - MIN_ASSESSED_DIMENSIONS).fill("not-assessed"),
]);
console.log(
  `  ${MIN_ASSESSED_DIMENSIONS} of 10 assessed → eligible: ${tierEligibility(sevenOfTen).eligible}`,
);
if (!tierEligibility(sevenOfTen).eligible) {
  throw new Error(`${MIN_ASSESSED_DIMENSIONS} assessed dimensions should meet the threshold.`);
}

console.log("\n=== Critical failure forces Underperform and cannot be averaged away ===");
const mostlyExcellent = assessments([
  "critical-failure",
  ...Array<DimensionAssessment["standing"]>(9).fill("leads"),
]);
const forced = forcedTier(mostlyExcellent);
console.log(`  critical failure + 9 "leads" → forced tier: ${forced}`);
if (forced !== "underperform") {
  throw new Error(
    `A critical failure alongside nine leading dimensions produced "${forced}" instead of ` +
      `"underperform". A vendor whose cryptography is provably wrong must not average its way up.`,
  );
}
if (!tierEligibility(mostlyExcellent).eligible) {
  throw new Error(
    "A critical failure must always be assignable — a provably-wrong implementation cannot escape " +
      "a rating by having too few other dimensions assessed.",
  );
}

console.log("\n=== Rating validation enforces the published policy commitments ===");
function baseRating(overrides: Partial<VendorRating> = {}): VendorRating {
  return {
    id: "fixture",
    displayName: "Fixture",
    category: "library-sdk",
    tier: null,
    tierWithheldReason: "Fixture: not enough dimensions assessed.",
    reviewedOn: "2026-08-13",
    reviewedBy: "fixture",
    methodologyVersion: "1.0",
    assessments: twoOfTen,
    limitations: ["Fixture limitation."],
    commercialRelationship: { exists: false, statement: "Commercial relationship: none." },
    ...overrides,
  };
}
const wellFormed = validateRating(baseRating());
console.log(`  well-formed fixture → ${wellFormed.length} problems`);
if (wellFormed.length > 0) {
  throw new Error(`A well-formed fixture reported problems: ${wellFormed.join("; ")}`);
}

const policyViolations: [string, VendorRating][] = [
  ["missing disclosure line", baseRating({ commercialRelationship: { exists: false, statement: "  " } })],
  ["no limitations", baseRating({ limitations: [] })],
  ["tier without eligibility", baseRating({ tier: "gold", tierWithheldReason: null })],
  ["null tier without a reason", baseRating({ tierWithheldReason: null })],
  [
    "critical failure not routed to Underperform",
    baseRating({
      assessments: mostlyExcellent,
      tier: "platinum",
      tierWithheldReason: null,
    }),
  ],
];
for (const [label, rating] of policyViolations) {
  const problems = validateRating(rating);
  console.log(`  ${label.padEnd(44)} → ${problems.length} problem(s) — ${problems.length ? "caught" : "MISSED"}`);
  if (problems.length === 0) {
    throw new Error(
      `validateRating() accepted a rating with "${label}". These are published policy commitments; ` +
        `a rating that breaks one must not be renderable.`,
    );
  }
}

console.log("\n=== Loader ships no ratings ===");
console.log(`  hasPublishedRatings(): ${hasPublishedRatings()} · vendors: ${getVendorRatings().length}`);
if (hasPublishedRatings()) {
  throw new Error(
    "The Arena loader returned vendor ratings. No rating may ship until every publish precondition " +
      "in docs/adr/0004-pqc-arena-topology-and-publish-gates.md is met.",
  );
}

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
