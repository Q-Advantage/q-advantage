/**
 * Preset comparison stories. These derive their numbers from the latest
 * benchmark run, so the cards stay accurate as the dataset grows.
 *
 * Each preset is a small narrative: which algorithms, which operation,
 * what's the headline number, what's the takeaway.
 *
 * Update this list as the algorithm set grows or interesting new
 * relationships emerge in the data.
 */

import { getLatestRun } from "./load";
import type { Operation } from "./types";

export interface ComparisonPreset {
  /** Slug used in URLs and React keys */
  id: string;
  /** Short headline label (mono eyebrow) */
  eyebrow: string;
  /** Main display headline — supports italic via markdown-style *...* */
  headline: string;
  /** One-line subtitle */
  subtitle: string;
  /** The headline ratio or number, computed from real data */
  metric: string;
  /** Metric label */
  metricLabel: string;
  /** Algorithm IDs to compare in the linked /compare page */
  algorithms: [string, string];
  /** Operation being compared */
  operation: Operation;
}

interface ComparisonRecipe {
  id: string;
  eyebrow: string;
  headline: string;
  subtitle: string;
  metricLabel: string;
  algorithms: [string, string];
  operation: Operation;
  /** "ratio_mean_us" gives algorithms[1].mean / algorithms[0].mean */
  metric: "ratio_mean_us" | "ratio_sig_bytes" | "ratio_ops_per_sec";
}

const RECIPES: ComparisonRecipe[] = [
  {
    id: "ml-dsa-65-vs-slh-dsa-128s",
    eyebrow: "The signature speed gap",
    headline: "Lattice vs hash, side by side.",
    subtitle:
      "ML-DSA-65 (lattice) vs SLH-DSA-SHAKE-128s (hash). One is 5000x faster to sign.",
    metricLabel: "Sign throughput ratio",
    algorithms: ["ml-dsa-65", "slh-dsa-shake-128s"],
    operation: "sign",
    metric: "ratio_mean_us",
  },
  {
    id: "ml-kem-768-vs-ml-kem-1024",
    eyebrow: "Security level tradeoff",
    headline: "More bits, more time.",
    subtitle:
      "ML-KEM-768 (NIST level 3) vs ML-KEM-1024 (NIST level 5). The cost of paranoia.",
    metricLabel: "Decap mean ratio",
    algorithms: ["ml-kem-768", "ml-kem-1024"],
    operation: "decap",
    metric: "ratio_mean_us",
  },
  {
    id: "slh-dsa-128f-vs-128s",
    eyebrow: "Fast vs Small",
    headline: "Sign or store, pick one.",
    subtitle:
      "SLH-DSA-SHAKE-128f signs 20x faster than 128s, with 2x larger signatures. Same security.",
    metricLabel: "Sign speed-up",
    algorithms: ["slh-dsa-shake-128f", "slh-dsa-shake-128s"],
    operation: "sign",
    metric: "ratio_mean_us",
  },
  {
    id: "ml-dsa-44-vs-ml-dsa-87",
    eyebrow: "Across the ML-DSA range",
    headline: "Levels 2, 3, and 5.",
    subtitle:
      "ML-DSA-44 (lightest) vs ML-DSA-87 (heaviest). How much you pay for higher security categories.",
    metricLabel: "Sign mean ratio",
    algorithms: ["ml-dsa-44", "ml-dsa-87"],
    operation: "sign",
    metric: "ratio_mean_us",
  },
];

function formatRatio(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k×`;
  if (n >= 100) return `${Math.round(n)}×`;
  if (n >= 10) return `${n.toFixed(1)}×`;
  return `${n.toFixed(2)}×`;
}

export function getComparisonPresets(): ComparisonPreset[] {
  const run = getLatestRun();
  const out: ComparisonPreset[] = [];

  for (const recipe of RECIPES) {
    const [aId, bId] = recipe.algorithms;
    const a = run.algorithms_by_id[aId];
    const b = run.algorithms_by_id[bId];
    if (!a || !b) continue; // skip if algorithm missing from latest run

    const aOp = a.operations[recipe.operation];
    const bOp = b.operations[recipe.operation];
    if (!aOp || !bOp) continue;

    let metric: string;
    switch (recipe.metric) {
      case "ratio_mean_us":
        // bigger / smaller — always > 1
        metric = formatRatio(Math.max(aOp.mean_us, bOp.mean_us) / Math.min(aOp.mean_us, bOp.mean_us));
        break;
      case "ratio_ops_per_sec":
        metric = formatRatio(Math.max(aOp.ops_per_sec, bOp.ops_per_sec) / Math.min(aOp.ops_per_sec, bOp.ops_per_sec));
        break;
      case "ratio_sig_bytes": {
        const aBytes = a.signature_bytes ?? a.ciphertext_bytes ?? 0;
        const bBytes = b.signature_bytes ?? b.ciphertext_bytes ?? 0;
        if (!aBytes || !bBytes) continue;
        metric = formatRatio(Math.max(aBytes, bBytes) / Math.min(aBytes, bBytes));
        break;
      }
    }

    out.push({
      id: recipe.id,
      eyebrow: recipe.eyebrow,
      headline: recipe.headline,
      subtitle: recipe.subtitle,
      metric,
      metricLabel: recipe.metricLabel,
      algorithms: recipe.algorithms,
      operation: recipe.operation,
    });
  }

  return out;
}
