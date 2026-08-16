/**
 * Smoke test for the Q-Day Index provenance layer.
 *
 *   npx tsx scripts/smoke-qday.ts
 *
 * The Q-Day Index claims its numbers come from vendor specifications and
 * peer-reviewed papers "rather than press releases". The per-field provenance
 * block is the evidence for that claim, so the assertions here are the ones
 * that would make the claim hollow:
 *
 *   - a source we do not have must never be substituted with one we do
 *   - "we looked and found nothing citable" must not collapse into silence
 *   - an unscored system must never sort as though it scored zero
 *
 * Fixtures use obviously-fake sentinels (-1, 9999) per CLAUDE.md guardrail 1.
 */
import { getQDayIndex } from "../lib/data/q-day";
import {
  citedFieldCount,
  formatProvenanceValue,
  normalizeProvenance,
  systemSortValues,
} from "../lib/data/q-day-provenance";
import type { ScoredSystem } from "../lib/data/q-day-types";

function fixture(provenance: ScoredSystem["provenance"], over: Partial<ScoredSystem> = {}): ScoredSystem {
  return {
    vendor: "FIXTURE",
    system_name: "SENTINEL",
    modality: "fixture",
    threat_score: -1,
    na_reason: null,
    threat_components: null,
    readiness: null,
    input_confidence: { level: "none", by_field: {} },
    flags: [],
    disclaimer_keys: [],
    provenance,
    release_year: 9999,
    topology: null,
    notes: "",
    presentation: {},
    ...over,
  } as ScoredSystem;
}

console.log("=== present-but-null and absent are different states ===");
// The failure this guards: collapsing "we checked and there is no qualifying
// source" into "we don't track this" — the quieter and more misleading of the
// two, because the reader cannot tell it happened.
const rows = normalizeProvenance(
  fixture({
    physical_qubits: { value: 9999, source: "https://example.invalid/spec", confidence: "vendor_published", method: "device_specification", as_of: "2026-01", notes: null },
    logical_qubits: { value: null, source: null, confidence: null, method: null, as_of: null, notes: null },
    // two_qubit_gate_fidelity deliberately absent
  }),
);
console.log(`  rows: ${rows.map((r) => `${r.field}=${r.display}`).join(", ")}`);
if (rows.length !== 2) {
  throw new Error(`Expected 2 rows (one present-with-value, one present-but-null), got ${rows.length}.`);
}
if (!rows.some((r) => r.field === "logical_qubits" && r.display === "—")) {
  throw new Error(
    "A field present with a null value must still produce a row rendering '—'. 'We looked and " +
      "there is no qualifying source' is information and must not be silently dropped.",
  );
}
if (rows.some((r) => r.field === "two_qubit_gate_fidelity")) {
  throw new Error("A field absent from the record must produce no row — we do not track it.");
}

console.log("\n=== a missing source is never substituted ===");
const nullSource = rows.find((r) => r.field === "logical_qubits")!;
if (nullSource.source !== null) {
  throw new Error(
    `A field with no source came back with source=${nullSource.source}. The UI must render "no ` +
      `qualifying source"; it must never fill in a vendor homepage or our own repository.`,
  );
}
console.log("  Correct.");

console.log("\n=== unscored systems sort as null, never as zero ===");
// The page's own copy says analog systems are "marked N/A rather than scored
// zero". Sorting is the easiest place to reintroduce exactly that error.
const analog = fixture({}, { threat_score: null, na_reason: "no gate-model path", readiness: null });
const sv = systemSortValues(analog);
console.log(`  threat=${sv.threat}  readiness=${sv.readiness}  fidelity=${sv.fidelity}`);
for (const key of ["threat", "readiness", "fidelity", "ec"]) {
  if (sv[key] === 0) {
    throw new Error(
      `systemSortValues().${key} is 0 for an unscored system — it must be null so the sort sinks ` +
        `it. A system outside the model must never outrank one measured at zero.`,
    );
  }
}

console.log("\n=== value formatting preserves the signal ===");
// Fidelity to four decimals: rounding further erases the difference between
// 99.63% and 99.6%, which is the entire comparison.
if (formatProvenanceValue(0.9963, "fidelity") !== "0.9963") {
  throw new Error(`Fidelity formatting lost precision: ${formatProvenanceValue(0.9963, "fidelity")}`);
}
if (formatProvenanceValue(null, "count") !== "—") throw new Error("null must render as an em-dash.");
if (formatProvenanceValue(true, "boolean") !== "Yes") throw new Error("boolean rendering broke.");
console.log("  Correct.");

console.log("\n=== Real committed data: every system's provenance ===");
const q = getQDayIndex();
let totalCited = 0;
let totalFields = 0;
let notesCarried = 0;
for (const s of q.systems) {
  const { cited, total } = citedFieldCount(s);
  totalCited += cited;
  totalFields += total;
  const withNotes = normalizeProvenance(s).filter((r) => r.notes).length;
  notesCarried += withNotes;
  console.log(
    `  ${`${s.vendor} ${s.system_name ?? ""}`.trim().padEnd(28)} ` +
      `${String(cited).padStart(2)}/${String(total).padEnd(2)} sourced · ` +
      `${withNotes} with notes · confidence ${s.input_confidence?.level ?? "—"}` +
      (s.na_reason ? " · N/A" : ""),
  );
}
console.log(`  ${totalCited}/${totalFields} fields carry a source across ${q.systems.length} systems`);
console.log(`  ${notesCarried} fields carry an explanatory note`);

if (totalFields === 0) {
  throw new Error("No provenance fields reached the page — the whole evidence layer is missing.");
}
if (notesCarried === 0) {
  throw new Error(
    "No provenance notes survived. The dataset carries substantial caveats (e.g. that a dated " +
      "fidelity snapshot is not comparable across measurement methods); losing them would leave " +
      "the numbers looking more comparable than they are.",
  );
}

console.log("\n=== the anchor's own provenance is present ===");
if (!q.anchor.source || !q.anchor_prior.source) {
  throw new Error("The anchor and its prior must both carry a source — the page cites both.");
}
console.log(
  `  current: ${q.anchor.label} — ${q.anchor.physical_qubits.toLocaleString()} physical qubits`,
);
console.log(
  `  prior:   ${q.anchor_prior.label} — ${q.anchor_prior.physical_qubits.toLocaleString()} (${q.anchor_prior.as_of})`,
);
console.log(
  `  the requirement fell ~${Math.round(q.anchor_prior.physical_qubits / q.anchor.physical_qubits)}× on algorithmic improvement alone`,
);

console.log("\nOK — Q-Day smoke test passed.");
