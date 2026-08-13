/**
 * PQC Arena — the published rating criteria.
 *
 * This file is the single source of truth for what PQC Arena rates vendors on.
 * It drives the public criteria pages now, and the per-vendor assessment pages
 * when those are eventually unblocked. Criteria are published *before* any
 * vendor is rated, deliberately: that is what makes a rating a procurement
 * reference rather than an attack, and it is what gives a vendor advance
 * notice of the bar.
 *
 * WHAT THIS FILE IS NOT: it contains no vendor, no assessment, and no tier
 * assignment. No company is named here or anywhere else in this public repo.
 * See docs/adr/0004-pqc-arena-topology-and-publish-gates.md for why, and for
 * where vendor data goes instead.
 *
 * CITATION DISCIPLINE, same convention as compliance.ts: every reference
 * carries how well it was actually verified.
 *   "confirmed"           — primary source text was read directly
 *   "search-corroborated" — consistent across sources, primary text not read
 *   "unverified"          — named for completeness, NOT checked; treat as a
 *                           lead, never as a citation
 * Do not upgrade a reference without actually reading the source.
 */

export type ReferenceVerification = "confirmed" | "search-corroborated" | "unverified";

export interface CriterionReference {
  label: string;
  url: string;
  /** YYYY-MM-DD — when this session actually checked it. */
  retrieved: string;
  verification: ReferenceVerification;
  note?: string;
}

export interface ArenaCriterion {
  id: string;
  number: number;
  name: string;
  /** One line: what this dimension asks. */
  definition: string;
  /** Itemized, concrete: what is actually checked. */
  checklist: string[];
  /** Where the evidence for this dimension comes from. */
  dataSource: string;
  /**
   * Set when failing this dimension overrides every other score. Text states
   * the failure condition and its consequence.
   */
  criticalFailure?: string;
  references: CriterionReference[];
}

// --- Referenced standards -------------------------------------------------
// Hoisted so the same source is cited identically everywhere it appears.

const FIPS_203: CriterionReference = {
  label: "NIST FIPS 203 — Module-Lattice-Based Key-Encapsulation Mechanism Standard (ML-KEM)",
  url: "https://csrc.nist.gov/pubs/fips/203/final",
  retrieved: "2026-08-13",
  verification: "confirmed",
  note: "Published 2024-08-13. Parameter sets ML-KEM-512 / 768 / 1024.",
};

const FIPS_204: CriterionReference = {
  label: "NIST FIPS 204 — Module-Lattice-Based Digital Signature Standard (ML-DSA)",
  url: "https://csrc.nist.gov/pubs/fips/204/final",
  retrieved: "2026-08-13",
  verification: "confirmed",
  note: "Published 2024-08-13.",
};

const FIPS_205: CriterionReference = {
  label: "NIST FIPS 205 — Stateless Hash-Based Digital Signature Standard (SLH-DSA)",
  url: "https://csrc.nist.gov/pubs/fips/205/final",
  retrieved: "2026-08-13",
  verification: "confirmed",
  note: "Published 2024-08-13. Based on SPHINCS+.",
};

const CMVP: CriterionReference = {
  label: "NIST/CCCS Cryptographic Module Validation Program (CMVP)",
  url: "https://csrc.nist.gov/projects/cryptographic-module-validation-program",
  retrieved: "2026-08-13",
  verification: "confirmed",
  note:
    "Joint NIST + Canadian Centre for Cyber Security programme. Publishes a public Validated Modules " +
    "search and a separate Modules In Process list; currently prioritises FIPS 140-3 submissions.",
};

const BSI_TR_02102_1: CriterionReference = {
  label: "BSI TR-02102-1 — Cryptographic Mechanisms: Recommendations and Key Lengths",
  url: "https://www.bsi.bund.de/SharedDocs/Downloads/EN/BSI/Publications/TechGuidelines/TG02102/BSI-TR-02102-1.pdf?__blob=publicationFile&v=10",
  retrieved: "2026-08-12",
  verification: "confirmed",
  note: "Version 2026-01, dated 23 Jan 2026. Germany's recommendation set.",
};

const ANSSI_PQC: CriterionReference = {
  label: "ANSSI views on the Post-Quantum Cryptography transition (2023 follow-up)",
  url: "https://messervices.cyber.gouv.fr/documents-guides/follow_up_position_paper_on_post_quantum_cryptography.pdf",
  retrieved: "2026-08-12",
  verification: "confirmed",
  note: "France's position. Notably requires hybridisation where PQ protection is relevant.",
};

const CNSA_2_0: CriterionReference = {
  label: "NSA Commercial National Security Algorithm Suite 2.0 (CNSA 2.0)",
  url: "https://media.defense.gov/2022/Sep/07/2003071834/-1/-1/0/CSA_CNSA_2.0_ALGORITHMS_.PDF",
  retrieved: "2026-08-12",
  verification: "search-corroborated",
  note: "Direct PDF read was blocked (HTTP 403) when last attempted; contents corroborated across secondary sources only.",
};

const OTHER_JURISDICTIONS: CriterionReference = {
  label: "Other national PQC programmes (e.g. South Korea KpqC, Japan CRYPTREC)",
  url: "",
  retrieved: "",
  verification: "unverified",
  note:
    "Named as leads only — neither programme's published standard has been checked by this project. " +
    "A conformance claim against either must be verified against that body's own document before it " +
    "is scored, never mapped onto NIST's.",
};

// --- The ten dimensions ---------------------------------------------------

export const ARENA_CRITERIA: ArenaCriterion[] = [
  {
    id: "algorithm-correctness",
    number: 1,
    name: "Algorithm correctness & standards conformance",
    definition:
      "Does the implementation actually compute the standardised algorithm correctly, against whichever standard it claims conformance to?",
    checklist: [
      "Passes known-answer tests / test vectors for the final standardised parameter sets.",
      "Ships the final FIPS 203 / 204 / 205 parameter sets — not draft or round-3 Kyber/Dilithium naming and parameters.",
      "Where a vendor claims conformance to a non-NIST national standard, that claim is checked against that body's own published document, never silently mapped onto NIST's.",
      "Algorithm identifiers and OIDs match the standard the vendor claims.",
      "Any deviation from standardised parameters is disclosed by the vendor rather than discovered.",
    ],
    dataSource:
      "Independent testing (Q-Shield) plus the relevant national standard body's own published test vectors.",
    criticalFailure:
      "Failing known-answer tests against the standard it claims, or still shipping pre-final parameter sets past a stated deadline, results in Underperform regardless of how the vendor scores on every other dimension.",
    references: [FIPS_203, FIPS_204, FIPS_205, BSI_TR_02102_1, ANSSI_PQC, OTHER_JURISDICTIONS],
  },
  {
    id: "measured-performance",
    number: 2,
    name: "Independently measured performance",
    definition:
      "What does the implementation actually cost to run, measured by someone with no stake in the answer?",
    checklist: [
      "Keygen / sign / verify and keygen / encap / decap timings, measured rather than quoted.",
      "Measured on more than one architecture (x86 and ARM) so the numbers travel.",
      "Measured on named hardware, at a stated iteration count, traceable to a reproducible public run.",
      "Key, ciphertext, and signature sizes checked against the standard rather than the datasheet.",
      "Where an implementation is not independently testable, that is recorded as not assessed — never inferred from the vendor's own published figures.",
    ],
    dataSource:
      "Q-Shield, this project's own daily benchmark harness. This is the one dimension no competitor currently produces.",
    references: [],
  },
  {
    id: "protocol-integration",
    number: 3,
    name: "Protocol integration depth",
    definition:
      "Is this a raw primitive library, or something that actually terminates a real protocol?",
    checklist: [
      "Raw algorithm library only, versus integration into TLS, QUIC, SSH, or IPsec.",
      "Hybrid key exchange supported, and whether it is available in production rather than in a branch.",
      "Post-quantum authentication (signatures in the handshake), not only key exchange.",
      "Integration is documented for practitioners, not only announced in a press release.",
    ],
    dataSource:
      "Public documentation, plus independent testing wherever a testable endpoint or SDK exists.",
    references: [ANSSI_PQC],
  },
  {
    id: "crypto-agility",
    number: 4,
    name: "Crypto-agility",
    definition:
      "Can a customer change algorithms later without re-architecting — the question every regulator is converging on?",
    checklist: [
      "Algorithms are selectable through configuration rather than compiled in.",
      "More than one algorithm family is supported for the same function.",
      "A documented path exists for replacing an algorithm after deployment.",
      "Hybrid and classical-only modes can both be expressed, since jurisdictions differ on which is required.",
      "Cryptographic inventory or bill-of-materials output is available, in any form.",
    ],
    dataSource: "Public documentation.",
    references: [ANSSI_PQC, BSI_TR_02102_1],
  },
  {
    id: "transparency",
    number: 5,
    name: "Transparency & disclosure",
    definition:
      "Does the vendor show its work — publish methodology, cite third parties, and state its own limitations?",
    checklist: [
      "Performance claims are accompanied by actual numbers rather than adjectives.",
      "Third-party or independent validation is cited, and the citation is not circular (a source that itself cites the vendor does not count).",
      "Test conditions behind any published figure are stated: hardware, versions, iteration counts.",
      "Known limitations are disclosed by the vendor rather than found by a reviewer.",
      "Claims are attributed to named people rather than to the company in the abstract.",
    ],
    dataSource:
      "Public claims audit — reading the vendor's own published documentation, case studies, and whitepapers.",
    references: [],
  },
  {
    id: "compliance-certification",
    number: 6,
    name: "Compliance & certification",
    definition:
      "What has actually been validated by an external body, as opposed to asserted?",
    checklist: [
      "FIPS 140-3 validation status, checked against the public CMVP Validated Modules list.",
      "Whether a module is validated, in process, or neither — these are three different states and are reported as such.",
      "Common Criteria evaluation status where applicable.",
      "Sector-specific certifications relevant to the vendor's stated market.",
      "Certificate scope is read, not just its existence: what was validated is frequently narrower than what is marketed.",
    ],
    dataSource: "Public certification registries.",
    references: [CMVP, CNSA_2_0],
  },
  {
    id: "deployment-support",
    number: 7,
    name: "Deployment & support model",
    definition:
      "What is it actually like to buy, deploy, and be supported on this — including whether the price is discoverable at all?",
    checklist: [
      "Pricing is published, indicative, or contact-only.",
      "Contract flexibility, trial availability, and evaluation licensing.",
      "Migration support offered, and whether it is included or a separate professional-services line.",
      "Documentation is sufficient to deploy without a sales engagement.",
      "Support model and stated response commitments.",
    ],
    dataSource: "Public documentation.",
    references: [],
  },
  {
    id: "interoperability",
    number: 8,
    name: "Interoperability & ecosystem",
    definition:
      "Does it work with the rest of the world's post-quantum stack, or only with itself?",
    checklist: [
      "Compatibility with the Open Quantum Safe ecosystem where relevant.",
      "Participation in interoperability testing with other implementations.",
      "Standards-track engagement: IETF drafts, working group participation.",
      "Alignment with national algorithm suites where the vendor claims it.",
      "Wire-format compatibility with other vendors' implementations of the same standard.",
    ],
    dataSource: "Public documentation and the Open Quantum Safe project's own published provider list.",
    references: [CNSA_2_0, BSI_TR_02102_1, ANSSI_PQC],
  },
  {
    id: "track-record",
    number: 9,
    name: "Track-record credibility",
    definition:
      "Do the published case studies contain evidence, or only claims?",
    checklist: [
      "Named production deployments rather than unnamed 'a major bank' references.",
      "Case studies contain measured outcomes rather than only qualitative statements.",
      "A named delivery partner or named customer contact exists and is checkable.",
      "Ecosystem partnership announcements are counted as what they are — partnerships, not deployments.",
      "Deployment scale and duration are stated.",
    ],
    dataSource: "Public claims audit.",
    references: [],
  },
  {
    id: "roadmap-currency",
    number: 10,
    name: "Roadmap & standards currency",
    definition:
      "Is the vendor tracking where the standards are going, or where they were?",
    checklist: [
      "Stated timeline for algorithms still being finalised.",
      "Responsiveness to standards changes: how quickly draft-to-final parameter changes were adopted.",
      "Deprecation policy for superseded algorithms and parameter sets.",
      "Public position on hybrid deployment, which several jurisdictions require and others merely permit.",
      "Whether roadmap statements carry dates, or only intent.",
    ],
    dataSource: "Public documentation.",
    references: [FIPS_203, FIPS_204, FIPS_205],
  },
];

// --- Tiers ----------------------------------------------------------------

export type ArenaTierId =
  | "platinum"
  | "gold"
  | "silver"
  | "bronze"
  | "underperform"
  | "unavailable";

export interface ArenaTier {
  id: ArenaTierId;
  label: string;
  /**
   * Ordering rank, best first. `null` for tiers that are deliberately not a
   * position on the scale — Unavailable is an absence of signal, not a bad
   * score, and must never be sorted as though it were the bottom.
   */
  rank: number | null;
  summary: string;
}

export const ARENA_TIERS: ArenaTier[] = [
  {
    id: "platinum",
    label: "Platinum",
    rank: 1,
    summary:
      "Leads on cryptographic substance across nearly every dimension, with independently verified correctness and performance, and discloses its own limitations without being asked.",
  },
  {
    id: "gold",
    label: "Gold",
    rank: 2,
    summary:
      "Strong across most dimensions with independent verification available, and no critical failures. Gaps exist and are visible rather than hidden.",
  },
  {
    id: "silver",
    label: "Silver",
    rank: 3,
    summary:
      "Solid on the fundamentals, with meaningful gaps — commonly in independent verification, transparency, or protocol integration depth.",
  },
  {
    id: "bronze",
    label: "Bronze",
    rank: 4,
    summary:
      "Real post-quantum capability exists, but substantiation is thin: claims outrun published evidence on several dimensions.",
  },
  {
    id: "underperform",
    label: "Underperform",
    rank: 5,
    summary:
      "Falls short on a dimension that cannot be traded off — most directly, failing correctness against the standard the vendor itself claims. A critical failure lands a vendor here regardless of its other scores.",
  },
  {
    id: "unavailable",
    label: "Unavailable",
    rank: null,
    summary:
      "Not enough public signal to rate, and no cooperation offered. This is explicitly not a judgement about quality: a vendor here has not been found wanting, it has not been assessable. In a market this young, this tier is expected to be populated rather than empty.",
  },
];

/** Tiers that represent a position on the scale, best first. */
export function rankedTiers(): ArenaTier[] {
  return ARENA_TIERS.filter((t) => t.rank !== null).sort(
    (a, b) => (a.rank as number) - (b.rank as number),
  );
}

/** The dimensions whose failure overrides every other score. */
export function criticalFailureCriteria(): ArenaCriterion[] {
  return ARENA_CRITERIA.filter((c) => c.criticalFailure != null);
}
