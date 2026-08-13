/**
 * PQC Arena — vendor rating types.
 *
 * These types describe a rating that does not exist yet. No vendor has been
 * rated, and no dataset ships in this repo (see arena.ts and
 * docs/adr/0004-pqc-arena-topology-and-publish-gates.md). They exist now so
 * that publishing later is a dataset plus a flag flip rather than a build.
 *
 * Three properties are deliberately enforced by the type system rather than
 * left to reviewer discipline:
 *
 *  1. `tier` is nullable. A rating with too few assessed dimensions has NO
 *     tier — not a low one. The spec refuses to assign a tier on partial
 *     data, and the type refuses to represent one.
 *  2. `standing` includes "not-assessed" as a first-class value, distinct
 *     from "trails". Not assessed, unavailable, and scored badly are three
 *     different statements and must never collapse.
 *  3. `commercialRelationship` and `limitations` are REQUIRED, not optional.
 *     The rated-parties policy commits to a per-vendor disclosure line on
 *     every rating and to stating limitations even for the top-rated vendor.
 *     Optional fields are how those commitments quietly stop happening.
 */

import type { ArenaTierId } from "./arena-criteria";

/**
 * Relative standing on one dimension. Deliberately not a number: the spec
 * specifies relative comparison against the peer set rather than a
 * points-weighted score, because several dimensions are irreducibly
 * qualitative and a 1–100 figure would invite false precision.
 */
export type AssessmentStanding = "leads" | "adequate" | "trails" | "critical-failure" | "not-assessed";

export interface EvidenceCitation {
  /** The specific claim this citation supports. */
  claim: string;
  sourceUrl: string;
  /** YYYY-MM-DD. */
  retrieved: string;
  verification: "confirmed" | "search-corroborated";
}

export interface DimensionAssessment {
  /** Matches an ArenaCriterion.id from arena-criteria.ts. */
  criterionId: string;
  standing: AssessmentStanding;
  /** The finding in prose. Null only when standing is "not-assessed". */
  finding: string | null;
  /** Evidence for the finding. Empty only when standing is "not-assessed". */
  evidence: EvidenceCitation[];
}

/**
 * The per-vendor commercial-relationship line required by the rated-parties
 * policy. Never optional, and never satisfied by a general policy statement.
 */
export interface CommercialRelationship {
  exists: boolean;
  /** The exact sentence published on the rating. */
  statement: string;
}

export interface VendorDispute {
  raisedOn: string;
  summary: string;
  resolved: boolean;
}

export type VendorCategory =
  | "library-sdk"
  | "hsm"
  | "pki-ca"
  | "tls-network";

export interface VendorRating {
  /** URL slug. */
  id: string;
  displayName: string;
  category: VendorCategory;

  /**
   * Null when not enough dimensions are assessed to justify one. Null is not
   * a bad tier — it is the absence of a verdict, and renders as such.
   */
  tier: ArenaTierId | null;
  /** Required whenever tier is null: why no tier was assigned. */
  tierWithheldReason: string | null;

  reviewedOn: string;
  /** Named byline. Honest attribution, not a fabricated team credit. */
  reviewedBy: string;
  methodologyVersion: string;

  assessments: DimensionAssessment[];
  /** Stated on every rating, including the best one. */
  limitations: string[];
  commercialRelationship: CommercialRelationship;

  dispute?: VendorDispute;
}

export interface ArenaData {
  /** Provenance string, mirroring the convention used by the other generated datasets. */
  _generated_by: string;
  methodologyVersion: string;
  lastUpdated: string;
  vendors: VendorRating[];
}

// ---------------------------------------------------------------------------
// Tier eligibility
// ---------------------------------------------------------------------------

/**
 * How many of the ten dimensions must carry a real assessment before a tier
 * may be assigned at all.
 *
 * HOUSE CHOICE, NOT FROM THE SPEC. The spec establishes only that 2 of 10 is
 * far too few to assign a tier; it sets no threshold. 7 is this build's
 * proposal and is deliberately visible here rather than buried in review
 * logic — it needs founder confirmation before the first real rating, and
 * changing it is a one-line change plus a methodology-page update.
 */
export const MIN_ASSESSED_DIMENSIONS = 7;

export type TierEligibility =
  | { eligible: true }
  | { eligible: false; reason: string };

/**
 * Whether a set of assessments can carry a tier at all.
 *
 * Two independent rules:
 *  - A critical failure forces Underperform, and is always assignable — a
 *    vendor whose cryptography is provably wrong does not get to be
 *    unrated because the other dimensions are outstanding.
 *  - Otherwise, enough dimensions must actually be assessed. Below the
 *    threshold the honest output is no tier, not a cautious one.
 */
export function tierEligibility(assessments: DimensionAssessment[]): TierEligibility {
  const hasCriticalFailure = assessments.some((a) => a.standing === "critical-failure");
  if (hasCriticalFailure) return { eligible: true };

  const assessed = assessments.filter((a) => a.standing !== "not-assessed").length;
  if (assessed < MIN_ASSESSED_DIMENSIONS) {
    return {
      eligible: false,
      reason: `Only ${assessed} of 10 dimensions assessed; a tier requires at least ${MIN_ASSESSED_DIMENSIONS}.`,
    };
  }
  return { eligible: true };
}

/**
 * The tier a critical failure forces, regardless of every other dimension.
 * Returns null when no critical failure is present — this function decides
 * nothing else, deliberately: the remaining tier placement is a relative,
 * editorial judgement and is not computed.
 */
export function forcedTier(assessments: DimensionAssessment[]): ArenaTierId | null {
  return assessments.some((a) => a.standing === "critical-failure") ? "underperform" : null;
}

/**
 * Structural validity of a rating, independent of whether its findings are
 * correct. Returns the problems found; an empty array means well-formed.
 *
 * This enforces the published policy commitments as data invariants, so a
 * rating that quietly drops its disclosure line or its limitations cannot
 * render.
 */
export function validateRating(rating: VendorRating): string[] {
  const problems: string[] = [];

  if (!rating.commercialRelationship.statement.trim()) {
    problems.push(
      "commercialRelationship.statement is empty — the rated-parties policy requires a positive per-vendor line on every rating.",
    );
  }
  if (rating.limitations.length === 0) {
    problems.push("limitations is empty — every rating states limitations, including the top-rated one.");
  }
  if (rating.tier === null && !rating.tierWithheldReason?.trim()) {
    problems.push("tier is null but no tierWithheldReason was given.");
  }
  if (rating.tier !== null && rating.tierWithheldReason) {
    problems.push("tierWithheldReason is set on a rating that has a tier.");
  }

  const eligibility = tierEligibility(rating.assessments);
  if (rating.tier !== null && !eligibility.eligible) {
    problems.push(`tier "${rating.tier}" assigned but not eligible: ${eligibility.reason}`);
  }

  const forced = forcedTier(rating.assessments);
  if (forced && rating.tier !== forced) {
    problems.push(
      `a critical failure is recorded, which forces tier "${forced}", but tier is "${rating.tier}".`,
    );
  }

  for (const a of rating.assessments) {
    if (a.standing === "not-assessed") {
      if (a.finding !== null || a.evidence.length > 0) {
        problems.push(
          `assessment "${a.criterionId}" is not-assessed but carries a finding or evidence — that is a contradiction.`,
        );
      }
      continue;
    }
    if (!a.finding?.trim()) {
      problems.push(`assessment "${a.criterionId}" has standing "${a.standing}" but no finding.`);
    }
    if (a.evidence.length === 0) {
      problems.push(`assessment "${a.criterionId}" has standing "${a.standing}" but no evidence cited.`);
    }
  }

  return problems;
}
