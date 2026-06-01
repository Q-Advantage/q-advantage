// Types for web/lib/data/q-day-index.generated.json (emitted by benchmark/build-q-day-index.py).
// Keep in sync with the emitter output shape.

export interface ProvenanceField {
  value: number | boolean | null;
  source: string | null;
  confidence: "peer_reviewed" | "vendor_published" | null;
  method: string | null;
  as_of: string | null;
  notes: string | null;
}

export interface Readiness {
  readiness: number;
  fidelity_progress: number;
  ec_progress: number;
  scale_progress: number;
  _meaning: string;
}

export interface ThreatComponents {
  logical_capacity: number;
  fidelity_gate: number;
  ec_signal: number;
  effective_logical: number;
}

export interface InputConfidence {
  level: "high" | "medium" | "low" | "none";
  by_field: Record<string, string | null>;
}

export interface PresentationFlag {
  region_gated?: boolean;
  region_note?: string;
}

export interface ScoredSystem {
  vendor: string;
  system_name: string;
  modality: string;
  threat_score: number | null;
  na_reason: string | null;
  threat_components: ThreatComponents | null;
  readiness: Readiness | null;
  input_confidence: InputConfidence;
  flags: string[];
  disclaimer_keys: string[];
  provenance: Record<string, ProvenanceField>;
  release_year: number | null;
  topology: string | null;
  notes: string;
  presentation: PresentationFlag;
}

export interface QDayIndexData {
  _generated_by: string;
  anchor: {
    target: string; label: string; logical_qubits: number; physical_qubits: number;
    runtime: string; source: string; citation: string; confidence: string; as_of: string;
  };
  anchor_prior: {
    label: string; physical_qubits: number; runtime: string; source: string; as_of: string;
  };
  hero: {
    frontier_threat_score: number;
    confidence_band: [number, number];
    composite_industry_score: number;
    n_scored: number;
    n_na: number;
  };
  systems: ScoredSystem[];
  announced_not_scored: Array<{
    vendor: string; system_name?: string; modality: string; reason: string;
    disclaimer_keys: string[]; notes: string;
  }>;
  historical_anchors: Array<{
    vendor: string; system_name: string; release_year: number;
    physical_qubits: number; modality: string;
  }>;
  disclaimer_keys_present: string[];
}
