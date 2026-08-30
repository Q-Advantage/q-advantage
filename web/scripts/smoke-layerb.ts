// web/scripts/smoke-layerb.ts
//
// Integration checks over the REAL committed Layer B results, as opposed to
// lib/layer-b/derive.test.ts which tests the logic against fixtures. Both run
// in CI; they answer different questions.
//
// The invariant that matters: no committed result may carry a duration it is
// not entitled to publish. publish-results.py strips those before they reach
// the bundle and derive.ts refuses them at render time, but the thing worth
// asserting is the outcome of both — that nothing in web/public/data/layer-b
// contains a publishable-looking timing from a machine we cannot vouch for.

import { loadLayerBData } from "../lib/layer-b/load";
import {
  crossedTheCliff,
  negotiatedFromWire,
  orderScenarios,
  outcomeTone,
  publishableDuration,
} from "../lib/layer-b/derive";

const data = loadLayerBData();
console.log("\n=== Layer B results committed to this build ===");
console.log(`  ${data.scenarios.length} scenario(s): ${orderScenarios(data.scenarios).join(", ")}`);

if (data.scenarios.length === 0) {
  // Not a failure. Layer B runs on demand, so a build with no results is a
  // build where nobody has run it — the page says so rather than showing zeros.
  console.log("  No results committed. Nothing to check.");
} else {
  for (const label of orderScenarios(data.scenarios)) {
    const r = data.byScenario[label];
    const s = r.structure;
    console.log(
      `  ${label.padEnd(20)} ${r.outcome.outcome.padEnd(28)} ` +
        (s ? `${s.packets_total} packets, ${s.wire_bytes_total} B` : "aggregate"),
    );

    // 1. A duration must never survive from a run we cannot vouch for.
    const d = publishableDuration(r);
    if (d != null && r.timing?.publishable !== true) {
      throw new Error(
        `${label}: a duration is renderable from a run that did not assert the measurement ` +
          `host. publish-results.py strips these and derive.ts refuses them; one of the two ` +
          `has stopped working.`,
      );
    }
    if (r.timing && r.timing.publishable === false && r.timing.duration_seconds != null) {
      throw new Error(
        `${label}: timing.duration_seconds is still present on a non-publishable run. It should ` +
          `have been stripped before reaching web/public/data.`,
      );
    }

    // 2. A negotiated group must be able to say it came from the wire. That is
    //    the one claim this whole layer exists to make.
    if (r.wire?.negotiated_group && !negotiatedFromWire(r)) {
      throw new Error(
        `${label}: a negotiated group is published without wire-bytes provenance. Layer B's ` +
          `entire premise is that it does not trust a stack's own report.`,
      );
    }

    // 3. A cliff verdict must be a real verdict or absent — never a default.
    const cliff = crossedTheCliff(r);
    if (cliff != null && !r.congestion?.measurable) {
      throw new Error(`${label}: a congestion verdict was derived from an unmeasurable flight.`);
    }
    if (r.congestion?.measurable && r.congestion.assumed_initcwnd_bytes == null) {
      throw new Error(
        `${label}: a congestion verdict without its assumed window. initcwnd is a tunable ` +
          `default, so a verdict that does not state its assumption is not reproducible.`,
      );
    }
  }

  console.log("\n=== the mismatch scenario is a finding, not an error ===");
  const mismatch = data.byScenario["mismatch"];
  if (mismatch) {
    console.log(`  ${mismatch.outcome.outcome} — ${mismatch.outcome.detail.slice(0, 90)}`);
    if (outcomeTone(mismatch) !== "finding") {
      throw new Error(
        "the deliberately-misconfigured run does not read as a finding. A clean rejection and a " +
          "silent downgrade are the dataset this scenario exists to produce; rendering either " +
          "as an error would bury it.",
      );
    }
    if (mismatch.outcome.outcome === "negotiated") {
      throw new Error("a mismatched pair negotiated — the scenario misconfigured nothing.");
    }
  } else {
    console.log("  (no mismatch result committed)");
  }
}

console.log("\nOK — Layer B smoke test passed.");
