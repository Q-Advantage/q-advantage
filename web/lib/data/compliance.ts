/**
 * CNSA 2.0 / country-NIST-equivalent approval status for the algorithm
 * families Q-Shield already benchmarks. Labeling only — no new
 * benchmarking, no new numbers. Every claim below is cited; per the
 * sourcing standard, anything not directly confirmed from primary-source
 * text in this session carries `verification: "search-corroborated"`
 * rather than being asserted with the same confidence as a directly-read
 * source. Do not upgrade a search-corroborated entry to "confirmed"
 * without actually reading the source PDF.
 *
 * Falcon is intentionally absent from this table: it's FN-DSA, still a
 * NIST draft, not a finalized FIPS standard — asserting an approval status
 * either way would be premature. Add it once FN-DSA finalizes.
 */

import type { AlgorithmFamily } from "./types";

export type ApprovalStatus = "approved" | "recommended" | "conditional" | "not-addressed" | "unverified";

export interface RegimeApproval {
  status: ApprovalStatus;
  note: string;
  source: string;
  sourceUrl: string;
  retrieved: string; // YYYY-MM-DD, when this session checked it
  verification: "confirmed" | "search-corroborated";
}

export interface ComplianceEntry {
  family: AlgorithmFamily;
  cnsa2: RegimeApproval;
  bsi: RegimeApproval;
  anssi: RegimeApproval;
}

const NSA_CNSA2_URL =
  "https://media.defense.gov/2022/Sep/07/2003071834/-1/-1/0/CSA_CNSA_2.0_ALGORITHMS_.PDF";
const BSI_TR02102_1_URL =
  "https://www.bsi.bund.de/SharedDocs/Downloads/EN/BSI/Publications/TechGuidelines/TG02102/BSI-TR-02102-1.pdf?__blob=publicationFile&v=10";
const ANSSI_2023_FOLLOWUP_URL =
  "https://messervices.cyber.gouv.fr/documents-guides/follow_up_position_paper_on_post_quantum_cryptography.pdf";

export const COMPLIANCE_TABLE: ComplianceEntry[] = [
  {
    family: "ML-KEM",
    cnsa2: {
      status: "approved",
      note:
        "CNSA 2.0 replaces ECDH/RSA key establishment with ML-KEM. Commercial equipment follows CNSA " +
        "1.0 until the CNSSP 156-mandated transition (~2025–2030 depending on equipment type).",
      source: "NSA CNSA 2.0 Cybersecurity Advisory",
      sourceUrl: NSA_CNSA2_URL,
      retrieved: "2026-08-12",
      verification: "search-corroborated",
    },
    bsi: {
      status: "recommended",
      note: "Listed under §2.4.3 \"ML-KEM Key Agreement\", one of BSI's recommended quantum-safe asymmetric mechanisms.",
      source: "BSI TR-02102-1 \"Cryptographic Mechanisms: Recommendations and Key Lengths\", Version 2026-01 (23 Jan 2026)",
      sourceUrl: BSI_TR02102_1_URL,
      retrieved: "2026-08-12",
      verification: "confirmed",
    },
    anssi: {
      status: "conditional",
      note:
        "Recommended at NIST level 5 (preferred) or level 3, using the IND-CCA (active) variant with " +
        "ephemeral keys where possible — not the parameters modified, and hybridization \"strongly " +
        "emphasized as necessary\" in the short/medium term.",
      source: "ANSSI views on the Post-Quantum Cryptography transition (2023 follow up), §2",
      sourceUrl: ANSSI_2023_FOLLOWUP_URL,
      retrieved: "2026-08-12",
      verification: "confirmed",
    },
  },
  {
    family: "ML-DSA",
    cnsa2: {
      status: "approved",
      note: "CNSA 2.0 replaces ECDSA/RSA digital signatures with ML-DSA.",
      source: "NSA CNSA 2.0 Cybersecurity Advisory",
      sourceUrl: NSA_CNSA2_URL,
      retrieved: "2026-08-12",
      verification: "search-corroborated",
    },
    bsi: {
      status: "recommended",
      note: "Covered under §5.3.4 \"Quantum-Safe Signature Schemes\" (current 2026-01 version).",
      source: "BSI TR-02102-1, Version 2026-01",
      sourceUrl: BSI_TR02102_1_URL,
      retrieved: "2026-08-12",
      verification: "search-corroborated",
    },
    anssi: {
      status: "conditional",
      note: "Same recommendation pattern as ML-KEM: highest available NIST level (5 preferred, else 3), standardized parameters only.",
      source: "ANSSI views on the Post-Quantum Cryptography transition (2023 follow up), §2",
      sourceUrl: ANSSI_2023_FOLLOWUP_URL,
      retrieved: "2026-08-12",
      verification: "confirmed",
    },
  },
  {
    family: "SLH-DSA",
    cnsa2: {
      status: "not-addressed",
      note: "SLH-DSA is not named as a CNSA 2.0 requirement (ML-DSA is the mandated lattice signature; LMS/XMSS/ML-DSA-87 cover the stateful/firmware case — see the LMS/XMSS row).",
      source: "NSA CNSA 2.0 Cybersecurity Advisory",
      sourceUrl: NSA_CNSA2_URL,
      retrieved: "2026-08-12",
      verification: "search-corroborated",
    },
    bsi: {
      status: "recommended",
      note: "\"Relevant and conservative option\" per ANSSI's own cross-reference to BSI's aligned position; also covered under BSI §5.3.4.",
      source: "BSI TR-02102-1, Version 2026-01",
      sourceUrl: BSI_TR02102_1_URL,
      retrieved: "2026-08-12",
      verification: "search-corroborated",
    },
    anssi: {
      status: "recommended",
      note: "\"Relevant and conservative option\" for contexts that can afford SPHINCS+/SLH-DSA's larger signatures; hybridization optional; the XMSS/LMS state-handling recommendations apply here too.",
      source: "ANSSI views on the Post-Quantum Cryptography transition (2023 follow up), §2",
      sourceUrl: ANSSI_2023_FOLLOWUP_URL,
      retrieved: "2026-08-12",
      verification: "confirmed",
    },
  },
];

/**
 * LMS/XMSS approval status, kept separate from COMPLIANCE_TABLE because
 * these aren't a NormalizedAlgorithm `family` (they're not in the main
 * benchmark run at all yet — see lms_xmss.py) but the approval-status
 * research already happened, so it's recorded here to avoid re-doing it
 * once PR A's harness produces real data.
 */
export const LMS_XMSS_COMPLIANCE = {
  cnsa2: {
    status: "approved" as ApprovalStatus,
    note: "CNSA 2.0 explicitly allows LMS, XMSS, or ML-DSA-87 for software/firmware signing.",
    source: "NSA CNSA 2.0 Cybersecurity Advisory",
    sourceUrl: NSA_CNSA2_URL,
    retrieved: "2026-08-12",
    verification: "search-corroborated" as const,
  },
  bsi: {
    status: "recommended" as ApprovalStatus,
    note: "\"Considered as conservative options\" for use cases with a bounded, carefully-stored signature count (e.g. software updates) — the exact use case this repo's harness targets.",
    source: "BSI TR-02102-1, Version 2026-01",
    sourceUrl: BSI_TR02102_1_URL,
    retrieved: "2026-08-12",
    verification: "search-corroborated" as const,
  },
  anssi: {
    status: "recommended" as ApprovalStatus,
    note:
      "\"ANSSI agrees that XMSS or LMS can be a relevant option\" where the signature count is bounded and " +
      "state can be carefully stored — with explicit recommendations: don't modify standardized " +
      "parameters/hash function, use the highest available security level, hybridization is optional, " +
      "and \"the state is a very critical data and should be protected in integrity\" and against replay " +
      "attacks. This is exactly the discipline benchmark/protocols/lms_xmss.py's ephemeral-keypair design " +
      "follows (see that file's docstring).",
    source: "ANSSI views on the Post-Quantum Cryptography transition (2023 follow up), §2",
    sourceUrl: ANSSI_2023_FOLLOWUP_URL,
    retrieved: "2026-08-12",
    verification: "confirmed" as const,
  },
};
