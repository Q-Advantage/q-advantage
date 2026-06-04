import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type {
  ComparisonGroup,
  ComparisonPair,
} from "@/lib/data/comparison-pairs";
import type { NormalizedAlgorithm } from "@/lib/data/types";

interface ComparisonIndexProps {
  groups: ComparisonGroup[];
  algorithmsById: Record<string, NormalizedAlgorithm>;
}

/**
 * Hierarchical browse index of every measured PQC algorithm pair.
 *
 * Three-tier structure modelled on inferencex.semianalysis.com/compare:
 *   Group (KEMs / Signatures)
 *     subgroup (across levels, fast vs small, lattice vs hash, ...)
 *       Pair cards (clickable, opens the detail view)
 *
 * Each pair card carries a metadata tag line under the name (e.g.
 * "NIST L1 / NIST L3", "Lattice / Hash-based") so the comparison's
 * category is legible at a glance without opening it.
 *
 * Clicks deep-link to the existing CompareView via query string and add
 * #detail so the browser scrolls to the detail panel below.
 */
export function ComparisonIndex({
  groups,
  algorithmsById,
}: ComparisonIndexProps) {
  if (groups.length === 0) return null;

  return (
    <section className="space-y-12">
      {groups.map((group) => (
        <div key={group.id} className="space-y-6">
          <div>
            <h2 className="font-serif text-[clamp(28px,3.5vw,40px)] font-normal leading-[1.1] tracking-[-0.02em] text-fg mb-2">
              {group.title}
            </h2>
            <p className="text-[15px] text-fg-muted leading-relaxed font-light max-w-2xl">
              {group.description}
            </p>
          </div>

          {group.subgroups.map((subgroup) => (
            <div key={subgroup.id} className="space-y-4">
              <div>
                <h3 className="text-base font-medium text-fg mb-1">
                  {subgroup.label}
                </h3>
                <p className="text-sm text-fg-muted leading-relaxed max-w-2xl">
                  {subgroup.description}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {subgroup.pairs.map((pair) => (
                  <PairCard
                    key={`${pair.a}-vs-${pair.b}`}
                    pair={pair}
                    algorithmsById={algorithmsById}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ))}
    </section>
  );
}

function PairCard({
  pair,
  algorithmsById,
}: {
  pair: ComparisonPair;
  algorithmsById: Record<string, NormalizedAlgorithm>;
}) {
  const algA = algorithmsById[pair.a];
  const algB = algorithmsById[pair.b];

  // Defensive: if either algorithm is missing from the run, skip the card.
  if (!algA || !algB) return null;

  const href = `/q-shield/compare?a=${pair.a}&b=${pair.b}&op=${pair.defaultOp}#detail`;

  return (
    <Link
      href={href}
      className="group block bg-bg-card border border-border rounded-lg p-4 hover:border-border-strong hover:-translate-y-0.5 transition-all"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-[15px] text-fg font-medium tracking-tight leading-snug mb-1.5 truncate">
            {algA.display_name}{" "}
            <span className="text-fg-subtle font-normal">vs</span>{" "}
            {algB.display_name}
          </div>
          <div className="font-mono text-[11px] text-fg-subtle uppercase tracking-eyebrow truncate">
            {pair.aLabel} · {pair.bLabel}
          </div>
        </div>
        <ArrowUpRight className="w-3.5 h-3.5 text-fg-subtle group-hover:text-accent transition-colors flex-shrink-0 mt-1" />
      </div>
    </Link>
  );
}
