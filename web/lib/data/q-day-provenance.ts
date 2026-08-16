// web/lib/data/q-day-provenance.ts
//
// Turns a scored system's provenance record into display rows.
//
// This is the module the sourcing standard in CLAUDE.md actually cashes out
// to. The Q-Day Index claims its numbers come from vendor specifications and
// peer-reviewed papers "rather than press releases"; the evidence for that
// claim is the per-field provenance block, which until now was emitted into
// the generated JSON and rendered nowhere.
//
// The distinction this module exists to preserve:
//
//   field absent      → we do not track it. No row.
//   field present,
//   value null        → we looked and there is no qualifying value. A row,
//                       rendering "—". That is information, not a gap.
//
// Collapsing those two into one would turn "we checked and found nothing
// citable" into silence, which is the quieter of the two failure modes and
// the more misleading one.

import type { ProvenanceField, ScoredSystem } from "./q-day-types";
import type { SortValue } from "../table/sort";

/** Display order. Fields outside this list still render, after these. */
export const PROVENANCE_ORDER = [
  "physical_qubits",
  "logical_qubits",
  "two_qubit_gate_fidelity",
  "single_qubit_gate_fidelity",
  "t1_coherence_us",
  "t2_coherence_us",
  "error_correction_below_threshold",
  "cloud_available",
] as const;

const LABELS: Record<string, string> = {
  physical_qubits: "Physical qubits",
  logical_qubits: "Logical qubits",
  two_qubit_gate_fidelity: "Two-qubit gate fidelity",
  single_qubit_gate_fidelity: "Single-qubit gate fidelity",
  t1_coherence_us: "T1 coherence",
  t2_coherence_us: "T2 coherence",
  error_correction_below_threshold: "Below the EC threshold",
  cloud_available: "Cloud available",
};

/** How to render the value — derived from the field, never guessed from magnitude. */
export type RenderKind = "count" | "fidelity" | "microseconds" | "boolean" | "number";

const RENDER: Record<string, RenderKind> = {
  physical_qubits: "count",
  logical_qubits: "count",
  two_qubit_gate_fidelity: "fidelity",
  single_qubit_gate_fidelity: "fidelity",
  t1_coherence_us: "microseconds",
  t2_coherence_us: "microseconds",
  error_correction_below_threshold: "boolean",
  cloud_available: "boolean",
};

export function humanizeField(field: string): string {
  return (
    LABELS[field] ??
    field.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase())
  );
}

export interface ProvenanceRow {
  field: string;
  label: string;
  value: number | boolean | null;
  render: RenderKind;
  /** Formatted for display. "—" when the value is null. Never a substitute. */
  display: string;
  source: string | null;
  confidence: ProvenanceField["confidence"];
  method: string | null;
  asOf: string | null;
  notes: string | null;
}

export function formatProvenanceValue(value: number | boolean | null, render: RenderKind): string {
  if (value == null) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  switch (render) {
    case "count":
      return value.toLocaleString();
    case "fidelity":
      // Fidelities are reported to four decimals; rounding further would erase
      // the difference between 99.63% and 99.6%, which is the whole signal.
      return value.toFixed(4);
    case "microseconds":
      return `${value.toLocaleString()} µs`;
    default:
      return String(value);
  }
}

/**
 * Rows for every field present on the system, ordered.
 *
 * A field whose `value` is null still yields a row — see the module comment.
 * A source that is absent stays absent: this function never substitutes a
 * plausible-looking URL, a vendor homepage, or our own repository.
 */
export function normalizeProvenance(system: ScoredSystem): ProvenanceRow[] {
  const record = system.provenance ?? {};
  const known = PROVENANCE_ORDER.filter((f) => f in record);
  const extra = Object.keys(record)
    .filter((f) => !(PROVENANCE_ORDER as readonly string[]).includes(f))
    .sort();

  return [...known, ...extra].map((field) => {
    const p = record[field];
    const render = RENDER[field] ?? "number";
    return {
      field,
      label: humanizeField(field),
      value: p.value,
      render,
      display: formatProvenanceValue(p.value, render),
      source: p.source ?? null,
      confidence: p.confidence ?? null,
      method: p.method ?? null,
      asOf: p.as_of ?? null,
      notes: p.notes ?? null,
    };
  });
}

/** How many of a system's tracked fields carry a citable source. */
export function citedFieldCount(system: ScoredSystem): { cited: number; total: number } {
  const rows = normalizeProvenance(system);
  return { cited: rows.filter((r) => r.source).length, total: rows.length };
}

/**
 * Serializable sort keys for the systems table.
 *
 * Unscored systems return null, never 0 — an analog simulator with no
 * gate-model score must not sort as though it scored zero. That is the same
 * category error the page's own copy warns about ("marked N/A rather than
 * scored zero"), and sorting is the easiest place to reintroduce it.
 */
export function systemSortValues(s: ScoredSystem): Record<string, SortValue> {
  return {
    system: `${s.vendor} ${s.system_name ?? ""}`.trim(),
    modality: s.modality,
    threat: s.threat_score ?? null,
    readiness: s.readiness?.readiness ?? null,
    fidelity: s.threat_components?.fidelity_gate ?? null,
    ec: s.threat_components?.ec_signal ?? null,
    confidence: s.input_confidence?.level ?? null,
    year: s.release_year ?? null,
    cited: citedFieldCount(s).cited,
  };
}
