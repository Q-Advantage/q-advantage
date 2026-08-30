// web/lib/layer-b/load.ts
//
// Loads Layer B results from web/public/data/layer-b/, populated by
// layer-b/publish-results.py from runs that were actually taken.
//
// Absence is normal and must not be an error: Layer B runs on demand rather
// than daily, so a build with no results is a build where nobody has run it
// yet. That renders as "not run", never as a zero.

import fs from "fs";
import path from "path";
import type { LayerBData, LayerBResult } from "./types";

function dataDir(): string {
  return path.join(process.cwd(), "public", "data", "layer-b");
}

export function loadLayerBData(): LayerBData {
  const dir = dataDir();
  if (!fs.existsSync(dir)) return { byScenario: {}, scenarios: [] };

  const byScenario: Record<string, LayerBResult> = {};
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith(".json")) continue;
    try {
      const parsed = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8")) as LayerBResult;
      const label = parsed?.identity?.label;
      if (!label) continue;
      // Newest wins when a scenario has been run more than once.
      const existing = byScenario[label];
      const a = parsed.audit?.timestamp_utc ?? "";
      const b = existing?.audit?.timestamp_utc ?? "";
      if (!existing || a > b) byScenario[label] = parsed;
    } catch {
      // A malformed result file is skipped rather than failing the build. It
      // is one scenario missing from a page, not a reason the site cannot ship.
      continue;
    }
  }

  return { byScenario, scenarios: Object.keys(byScenario) };
}
