/**
 * PQC Arena vendor-rating loader.
 *
 * There is deliberately no dataset. PQC Arena publishes its criteria and not
 * its verdicts, because the publish preconditions in
 * docs/adr/0004-pqc-arena-topology-and-publish-gates.md are open and the
 * assessment work is incomplete.
 *
 * When ratings do exist, they will NOT simply be dropped into this repo:
 * `q-advantage` is public, and vendor assessments live in the private
 * Q-Advantage/pqc-arena repo (ADR 0004, following ADR 0003's precedent for
 * the Readiness Index). Wiring a real dataset in is a deliberate publication
 * step with its own review — not a file copy.
 *
 * `scripts/smoke-arena.ts` fails if a vendor dataset appears in this repo.
 */

import type { ArenaData, VendorRating } from "./arena-types";
import { validateRating } from "./arena-types";

const EMPTY: ArenaData = {
  _generated_by:
    "No dataset. PQC Arena publishes criteria only until every publish precondition is met — see docs/adr/0004-pqc-arena-topology-and-publish-gates.md.",
  methodologyVersion: "1.0",
  lastUpdated: "2026-08-13",
  vendors: [],
};

export function getArenaData(): ArenaData {
  return EMPTY;
}

export function getVendorRatings(): VendorRating[] {
  return getArenaData().vendors;
}

export function getVendorRating(id: string): VendorRating | null {
  return getVendorRatings().find((v) => v.id === id) ?? null;
}

/** True while no vendor has been rated — drives the honest empty state. */
export function hasPublishedRatings(): boolean {
  return getVendorRatings().length > 0;
}

/**
 * Fail loudly rather than render a malformed rating. Called at build time by
 * the vendor page; a rating that violates a published policy commitment
 * (missing disclosure line, missing limitations, a tier it isn't eligible
 * for) must break the build, not reach a reader.
 */
export function assertRatingsWellFormed(): void {
  for (const rating of getVendorRatings()) {
    const problems = validateRating(rating);
    if (problems.length > 0) {
      throw new Error(
        `PQC Arena rating "${rating.id}" is malformed and must not publish:\n  - ${problems.join("\n  - ")}`,
      );
    }
  }
}
