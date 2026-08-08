// PQC Readiness Index data loader. Mirrors the lib/data/q-day.ts pattern:
// the generated JSON is committed and imported statically, typed.
//
// Currently loads SYNTHETIC PLACEHOLDER data — see the generated JSON's own
// _generated_by field and pqc-readiness-types.ts's file header for why.
// Regenerating with real data is a later, explicitly-gated step (Phase 2
// publication clearance), not something this loader does automatically.
import generated from "@/lib/data/pqc-readiness-index.generated.json";
import type { PQCReadinessIndexData } from "@/lib/data/pqc-readiness-types";

export function getPQCReadinessIndex(): PQCReadinessIndexData {
  return generated as unknown as PQCReadinessIndexData;
}
