// web/components/data/TierBadge.tsx
//
// PQC Arena tier chip. Server component — no interactivity.
//
// Colour carries meaning here, so it is deliberately not a rainbow: the four
// rated tiers descend through a single warm ramp, Underperform is the only
// red, and Unavailable is visually *outside* the scale (dashed, dim) because
// it is an absence of evidence rather than a low position on it. Sorting or
// colouring Unavailable as "below Bronze" would misstate what it means.
//
// Same Record<id, classes> + Record<id, label> shape as ComplianceBadges.

import type { ArenaTierId } from "@/lib/data/arena-criteria";

const TIER_CLASS: Record<ArenaTierId, string> = {
  platinum: "text-cyan-300 border-cyan-300/40 bg-cyan-300/[0.06]",
  gold: "text-amber-300 border-amber-300/40 bg-amber-300/[0.06]",
  silver: "text-fg border-border-strong bg-fg/[0.04]",
  bronze: "text-orange-300/90 border-orange-300/30 bg-orange-300/[0.05]",
  underperform: "text-status-err border-status-err/40 bg-status-err/[0.06]",
  unavailable: "text-fg-subtle border-border border-dashed",
};

const TIER_LABEL: Record<ArenaTierId, string> = {
  platinum: "Platinum",
  gold: "Gold",
  silver: "Silver",
  bronze: "Bronze",
  underperform: "Underperform",
  unavailable: "Unavailable",
};

export function TierBadge({ tier, className = "" }: { tier: ArenaTierId; className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-2xs uppercase tracking-eyebrow ${TIER_CLASS[tier]} ${className}`}
    >
      {TIER_LABEL[tier]}
    </span>
  );
}

/**
 * The "we have not rated this" state. Distinct from Unavailable, which is a
 * published finding that a vendor could not be assessed. This one means the
 * assessment simply has not been done yet — three different states (not
 * assessed / unavailable / scored) that must never collapse into each other.
 */
export function NotAssessedBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border border-dashed border-border px-2.5 py-0.5 font-mono text-2xs uppercase tracking-eyebrow text-fg-subtle ${className}`}
    >
      Not assessed
    </span>
  );
}
