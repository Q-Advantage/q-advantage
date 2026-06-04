import type { NormalizedAlgorithm, Operation } from "./types";

/**
 * Comparison browse index — pair enumeration.
 *
 * Generates the hierarchical groups of meaningful algorithm pairs shown on
 * /q-shield/compare. Mirrors the inferencex.semianalysis.com/compare pattern:
 * top-level family → labelled subgroup → individual pair cards.
 *
 * Designed to be data-driven (everything derived from the actual algorithms
 * in the latest run) so new algorithms in Week 6+ (Falcon, LMS, XMSS,
 * AES-GCM) flow in automatically by being added to the appropriate
 * family / subgroup generator below.
 */

export interface ComparisonPair {
  /** Algorithm A's id (matches NormalizedAlgorithm.id) */
  a: string;
  /** Algorithm B's id */
  b: string;
  /** Short tag shown under A's name on the card */
  aLabel: string;
  /** Short tag shown under B's name on the card */
  bLabel: string;
  /** Operation that opens by default when the card is clicked */
  defaultOp: Operation;
}

export interface ComparisonSubgroup {
  id: string;
  label: string;
  description: string;
  pairs: ComparisonPair[];
}

export interface ComparisonGroup {
  id: string;
  title: string;
  description: string;
  subgroups: ComparisonSubgroup[];
}

/**
 * Build the full comparison browse index from the algorithms in the latest run.
 * Algorithm IDs not present in the run are skipped silently — keeps the index
 * resilient to liboqs version changes.
 */
export function getComparisonGroups(
  algorithms: NormalizedAlgorithm[],
): ComparisonGroup[] {
  const byId: Record<string, NormalizedAlgorithm> = Object.fromEntries(
    algorithms.map((a) => [a.id, a]),
  );
  const exists = (id: string) => byId[id] !== undefined;

  const groups: ComparisonGroup[] = [];

  // -------------------------------------------------------------------------
  // KEMs
  // -------------------------------------------------------------------------
  const mlKems = algorithms
    .filter((a) => a.family === "ML-KEM")
    .sort((a, b) => a.nist_level - b.nist_level);

  if (mlKems.length >= 2) {
    const kemPairs: ComparisonPair[] = [];
    for (let i = 0; i < mlKems.length; i++) {
      for (let j = i + 1; j < mlKems.length; j++) {
        kemPairs.push({
          a: mlKems[i].id,
          b: mlKems[j].id,
          aLabel: `NIST L${mlKems[i].nist_level}`,
          bLabel: `NIST L${mlKems[j].nist_level}`,
          defaultOp: "encap",
        });
      }
    }
    groups.push({
      id: "kems",
      title: "Key encapsulation mechanisms",
      description: `${kemPairs.length} ML-KEM pairs measured daily across NIST security levels.`,
      subgroups: [
        {
          id: "ml-kem-levels",
          label: "ML-KEM across security levels",
          description:
            "Same lattice scheme, different NIST categories. The cost of higher security.",
          pairs: kemPairs,
        },
      ],
    });
  }

  // -------------------------------------------------------------------------
  // Signatures
  // -------------------------------------------------------------------------
  const sigSubgroups: ComparisonSubgroup[] = [];

  // ML-DSA across security levels
  const mlDsa = algorithms
    .filter((a) => a.family === "ML-DSA")
    .sort((a, b) => a.nist_level - b.nist_level);

  if (mlDsa.length >= 2) {
    const pairs: ComparisonPair[] = [];
    for (let i = 0; i < mlDsa.length; i++) {
      for (let j = i + 1; j < mlDsa.length; j++) {
        pairs.push({
          a: mlDsa[i].id,
          b: mlDsa[j].id,
          aLabel: `NIST L${mlDsa[i].nist_level}`,
          bLabel: `NIST L${mlDsa[j].nist_level}`,
          defaultOp: "sign",
        });
      }
    }
    sigSubgroups.push({
      id: "ml-dsa-levels",
      label: "ML-DSA across security levels",
      description:
        "Same lattice scheme, different NIST categories. Higher security means bigger keys and slower signing.",
      pairs,
    });
  }

  // SLH-DSA: fast vs small at matched hash + level
  const slhFastVsSmall: ComparisonPair[] = [];
  const hashFamilies = ["sha2", "shake"];
  const slhLevels = ["128", "192", "256"];
  for (const hash of hashFamilies) {
    for (const lvl of slhLevels) {
      const fId = `slh-dsa-${hash}-${lvl}f`;
      const sId = `slh-dsa-${hash}-${lvl}s`;
      if (exists(fId) && exists(sId)) {
        slhFastVsSmall.push({
          a: fId,
          b: sId,
          aLabel: `${hash.toUpperCase()} · fast`,
          bLabel: `${hash.toUpperCase()} · small`,
          defaultOp: "sign",
        });
      }
    }
  }
  if (slhFastVsSmall.length > 0) {
    sigSubgroups.push({
      id: "slh-dsa-fast-vs-small",
      label: "SLH-DSA: fast vs small",
      description:
        "The defining SLH-DSA tradeoff — fast signatures with larger signature sizes, or small signatures with much slower signing.",
      pairs: slhFastVsSmall,
    });
  }

  // SLH-DSA: SHA2 vs SHAKE at matched level + variant
  const slhSha2VsShake: ComparisonPair[] = [];
  for (const lvl of slhLevels) {
    for (const v of ["f", "s"]) {
      const sha2Id = `slh-dsa-sha2-${lvl}${v}`;
      const shakeId = `slh-dsa-shake-${lvl}${v}`;
      if (exists(sha2Id) && exists(shakeId)) {
        slhSha2VsShake.push({
          a: sha2Id,
          b: shakeId,
          aLabel: "SHA2",
          bLabel: "SHAKE",
          defaultOp: "sign",
        });
      }
    }
  }
  if (slhSha2VsShake.length > 0) {
    sigSubgroups.push({
      id: "slh-dsa-sha2-vs-shake",
      label: "SLH-DSA: SHA2 vs SHAKE hash",
      description:
        "Same scheme, different hash family. The performance cost of the hash choice.",
      pairs: slhSha2VsShake,
    });
  }

  // Lattice vs hash-based at matched NIST level (cross-family, SHA2 variants)
  // ML-DSA-44 (L2) <-> SLH-DSA-128 (L1) — closest available match
  // ML-DSA-65 (L3) <-> SLH-DSA-192 (L3) — exact level match
  // ML-DSA-87 (L5) <-> SLH-DSA-256 (L5) — exact level match
  if (mlDsa.length > 0) {
    const crossFamily: ComparisonPair[] = [];
    const levelMap: Record<number, string> = { 2: "128", 3: "192", 5: "256" };
    for (const dsa of mlDsa) {
      const slhLevel = levelMap[dsa.nist_level];
      if (!slhLevel) continue;
      for (const v of ["f", "s"]) {
        const slhId = `slh-dsa-sha2-${slhLevel}${v}`;
        if (exists(slhId)) {
          crossFamily.push({
            a: dsa.id,
            b: slhId,
            aLabel: "Lattice",
            bLabel: `Hash-based · ${v === "f" ? "fast" : "small"}`,
            defaultOp: "sign",
          });
        }
      }
    }
    if (crossFamily.length > 0) {
      sigSubgroups.push({
        id: "lattice-vs-hash",
        label: "Lattice vs hash-based",
        description:
          "The two major PQC signature families head-to-head at matched NIST levels. Where the 1000×+ performance gaps live.",
        pairs: crossFamily,
      });
    }
  }

  if (sigSubgroups.length > 0) {
    const totalSigPairs = sigSubgroups.reduce((sum, sg) => sum + sg.pairs.length, 0);
    groups.push({
      id: "signatures",
      title: "Digital signatures",
      description: `${totalSigPairs} signature pairs across ML-DSA and SLH-DSA — lattice-based and hash-based schemes side by side.`,
      subgroups: sigSubgroups,
    });
  }

  return groups;
}

/** Total number of comparison pairs across all groups. */
export function countTotalPairs(groups: ComparisonGroup[]): number {
  return groups.reduce(
    (total, g) =>
      total + g.subgroups.reduce((s, sg) => s + sg.pairs.length, 0),
    0,
  );
}
