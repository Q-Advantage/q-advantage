// Types for web/lib/data/pqc-readiness-index.generated.json.
//
// Shape mirrors the private Q-Advantage/pqc-readiness-index repo's
// scanner/scoring.py InstitutionScore + data/targets.json institution
// records — this is the public-rendering half (Phase 2 component H) of a
// pipeline that runs entirely in that private repo. See
// docs/adr/0003-pqc-readiness-index-repo-topology.md for why the two are
// split, and work-orders/002-pqc-readiness-index-phase1.md for the pipeline.
//
// NOT WIRED TO REAL DATA YET. The generated JSON this loads is synthetic
// placeholder content (obviously-fake institution names) — real,
// named-institution data does not enter this public repo until the Phase 2
// publication gate clears (entity + legal review; see the ADR above).
// Swapping in real data later means replacing the generated JSON with an
// export from the private repo's scoring output — this loader and every
// component that consumes it are otherwise ready.

export type PQCCategory =
  | "bank_gsib"
  | "bank_national_retail"
  | "exchange_ccp"
  | "card_network_processor"
  | "ca";

export interface PQCHygieneFlags {
  tls_1_2_accepted: boolean;
  weak_signature_algorithm: boolean;
  short_key: boolean;
  expired_or_near_expiry: boolean;
}

export interface PQCEndpointResult {
  hostname: string;
  purpose: string;
  connected: boolean;
  highest_negotiated_version: string | null;
  kex_groups_supported: string[]; // hybrid PQ groups this endpoint supports
  cert_signature_algorithm: string | null;
  cert_issuer: string | null;
}

export interface PQCInstitutionEntry {
  id: string;
  name: string;
  category: PQCCategory;
  jurisdiction: string | null;
  /** Share of measurable endpoints supporting a hybrid PQ key-exchange group. null = zero measurable endpoints, not zero support. */
  kex_score: number | null;
  /** Share of measurable endpoints presenting a PQ/hybrid certificate signature. Expected to be 0 for every row today — see methodology. */
  auth_score: number | null;
  measurable_endpoints: number;
  total_endpoints: number;
  hygiene: PQCHygieneFlags;
  endpoints: PQCEndpointResult[];
  unverified?: boolean;
  excluded?: { date: string } | null;
}

export interface PQCReadinessIndexData {
  _generated_by: string;
  sweep_date: string;
  methodology_version: string;
  client_config_hash: string;
  hero: {
    n_institutions: number;
    kex_field_average: number | null;
    auth_field_average: number | null;
  };
  categories: Record<PQCCategory, { label: string }>;
  institutions: PQCInstitutionEntry[];
}
