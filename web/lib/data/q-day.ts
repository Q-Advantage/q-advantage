// Q-Day Index data loader. Mirrors the lib/data/load.ts pattern: the generated
// JSON is committed (like benchmark/results), imported statically, and typed.
// Regenerate the JSON with: python3 benchmark/build-q-day-index.py
import generated from "@/lib/data/q-day-index.generated.json";
import type { QDayIndexData } from "@/lib/data/q-day-types";

export function getQDayIndex(): QDayIndexData {
  return generated as unknown as QDayIndexData;
}
