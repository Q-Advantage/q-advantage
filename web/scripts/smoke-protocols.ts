/**
 * Smoke test for the protocol-track loader + derived metrics.
 *
 *   npx tsx scripts/smoke-protocols.ts
 *
 * Same convention as smoke-loader.ts: print a digest, assert the cases that
 * would embarrass the company if they silently broke (a fabricated number
 * instead of an honest null), fail loudly on a broken assertion.
 */
import { loadProtocolsData } from "../lib/protocols/load";
import {
  amplificationFactor,
  classifySuite,
  formatAmplificationFactor,
  formatMultiplier,
  hasLiveStatefulSigs,
  statefulSigsUnavailableReason,
} from "../lib/protocols/derive";
import { decomposePhases, PHASE_ORDER } from "../lib/protocols/phases";
import { aesBaselinesByArch, formatTailRatio, tailRatio, vsBaselinePct } from "../lib/protocols/metrics";
import {
  detectSuiteAnomaly,
  publishableHybridToPurePqcRatio,
  publishableVsBaselinePct,
} from "../lib/protocols/anomaly";
import type { ComposedSuite, LmsXmssFile, TimingBlock } from "../lib/protocols/types";

/** Sentinel timing block — the values could never pass as a measurement. */
function fixtureTiming(mean: number): TimingBlock {
  return {
    mean_us: mean, median_us: mean, p95_us: mean, p99_us: mean, stdev_us: 0,
    min_us: mean, max_us: mean, ops_per_sec: 1, n_iterations: 1,
  };
}

function fixtureSuite(overrides: Partial<ComposedSuite["size"]>): ComposedSuite {
  return {
    identity: { protocol: "tls", mode: "composed", suite: "fixture" },
    timing: {
      mean_us: 1, median_us: 1, p95_us: 1, p99_us: 1, stdev_us: 0,
      min_us: 1, max_us: 1, ops_per_sec: 1, n_iterations: 1,
    },
    size: overrides === null ? undefined : { bytes_client_to_server: 0, bytes_server_to_client: 0, bytes_total: 0, ...overrides },
  };
}

console.log("=== amplificationFactor: known fixture ===");
// Real X25519MLKEM768 record, tls-composed-2026-08-09-d71eadf.json:
// bytes_client_to_server=1216, bytes_server_to_client=1120.
const known = fixtureSuite({ bytes_client_to_server: 1216, bytes_server_to_client: 1120, bytes_total: 2336 });
const knownFactor = amplificationFactor(known);
const expected = 1120 / 1216;
console.log(`  X25519MLKEM768 (2026-08-09 fixture): ${formatAmplificationFactor(knownFactor)} (raw ${knownFactor})`);
if (knownFactor == null || Math.abs(knownFactor - expected) > 1e-9) {
  throw new Error(
    `amplificationFactor(known fixture) = ${knownFactor}, expected ${expected} — derive.ts changed ` +
      `behavior for a value that must stay exact.`,
  );
}
console.log("  Correct.");

console.log("\n=== amplificationFactor: must return null, never fabricate ===");
const zeroClient = fixtureSuite({ bytes_client_to_server: 0, bytes_server_to_client: 500, bytes_total: 500 });
const noSize = fixtureSuite(null as unknown as Partial<ComposedSuite["size"]>);
noSize.size = undefined;

for (const [label, suite] of [
  ["bytes_client_to_server = 0", zeroClient],
  ["missing size block", noSize],
] as const) {
  const f = amplificationFactor(suite);
  console.log(`  ${label}: ${f === null ? "null (correct)" : `FABRICATED VALUE ${f}`}`);
  if (f !== null) {
    throw new Error(
      `amplificationFactor() returned ${f} for a suite with ${label} — must return null, never a ` +
        `guessed/divide-by-zero number. A suite that can't compute a real ratio must say so.`,
    );
  }
}

console.log("\n=== Real committed data: amplification factor per suite (spot check) ===");
const data = loadProtocolsData();
const arches = Object.keys(data.byArch);
if (arches.length === 0) {
  console.log("  (no protocol data present — public/data/protocols/manifest.json not found; skipping)");
} else {
  for (const arch of arches) {
    const bucket = data.byArch[arch];
    for (const proto of ["tls", "ssh"] as const) {
      const entries = Object.entries(bucket[proto]?.suites ?? {});
      // The pure-PQC suite this protocol's hybrids are compared against, if one
      // was measured. ssh-composed has none, and must print that, not borrow
      // TLS's suite.
      const pure = entries.find(([, s]) => classifySuite(s) === "pure-pqc")?.[1];
      for (const [name, suite] of entries) {
        const f = amplificationFactor(suite);
        const cls = classifySuite(suite);
        let vsPure = "";
        if (cls === "hybrid") {
          if (!pure) {
            vsPure = " (no pure-PQC suite measured for this protocol)";
          } else {
            const r = publishableHybridToPurePqcRatio(suite, pure);
            vsPure =
              r == null
                ? " (vs pure PQC WITHHELD — structurally impossible, see anomaly.ts)"
                : ` (${formatMultiplier(r)} vs pure PQC)`;
          }
        }
        console.log(
          `  [${proto}/${arch}] ${name.padEnd(22)} ${formatAmplificationFactor(f).padEnd(8)} [${cls}]${vsPure}`,
        );
      }
    }
  }
}

console.log("\n=== hasLiveStatefulSigs: a committed file is not evidence of data ===");
// The regression this guards: /q-shield/compare gated its "no measurements
// yet" notice on file presence, so the notice vanished when the first
// all-unavailable lms-xmss file landed (2026-08-14) — the site went quiet
// about missing data instead of louder.
const env = { iso_timestamp: "", liboqs_version: "", git_commit: "", cpu_model: "", arch: "" };
const unavailableFile = {
  environment: env,
  schemes: {
    LMS_SHA256_M32_H10: {
      scheme: "LMS_SHA256_M32_H10",
      status: "unavailable",
      reason: "not in get_enabled_stateful_sig_mechanisms() — build lacks the STFL flag.",
    },
    "XMSS-SHA2_10_256": { scheme: "XMSS-SHA2_10_256", status: "unavailable" },
  },
} as unknown as LmsXmssFile;
const liveFile = {
  environment: env,
  schemes: {
    LMS_SHA256_M32_H10: { scheme: "LMS_SHA256_M32_H10", status: "unavailable" },
    "XMSS-SHA2_10_256": { scheme: "XMSS-SHA2_10_256", status: "ok", signature_bytes: 2500 },
  },
} as unknown as LmsXmssFile;

for (const [label, file, expected] of [
  ["no file at all", null, false],
  ["file present, every scheme unavailable", unavailableFile, false],
  ["file present, one scheme ok", liveFile, true],
] as const) {
  const got = hasLiveStatefulSigs(file);
  console.log(`  ${label}: ${got}`);
  if (got !== expected) {
    throw new Error(
      `hasLiveStatefulSigs(${label}) = ${got}, expected ${expected} — a file full of ` +
        `"unavailable" must never read as live data, or /q-shield/compare drops its ` +
        `"no measurements yet" notice while there are still no measurements.`,
    );
  }
}

const reason = statefulSigsUnavailableReason(unavailableFile);
console.log(`  reason surfaced: ${reason}`);
if (!reason || !reason.includes("STFL")) {
  throw new Error(
    `statefulSigsUnavailableReason() = ${reason} — must surface the harness's own recorded ` +
      `reason, not a substitute the UI invented.`,
  );
}
if (statefulSigsUnavailableReason(null) !== null) {
  throw new Error("statefulSigsUnavailableReason(null) must be null — no file means no reason to quote.");
}
console.log("  Correct.");

console.log("\n=== Real committed data: stateful-sig status ===");
for (const arch of arches) {
  const file = data.byArch[arch].lmsXmss;
  console.log(
    `  [${arch}] file ${file ? "present" : "absent"}, live measurements: ${hasLiveStatefulSigs(file)}` +
      (file && !hasLiveStatefulSigs(file) ? ` — ${statefulSigsUnavailableReason(file) ?? "no reason recorded"}` : ""),
  );
}

console.log("\n=== decomposePhases: classical phases count twice, KEM phases once ===");
// The identity this encodes, verified across all 548 committed suites:
//   handshake = kem_keygen + kem_encaps + kem_decaps
//             + 2 × (classical_keygen + classical_derive)
const hybridFixture = {
  ...fixtureSuite({ bytes_client_to_server: 1, bytes_server_to_client: 1, bytes_total: 2 }),
  timing: fixtureTiming(9999),
  phases: {
    kem_keygen: fixtureTiming(1000),
    kem_encaps: fixtureTiming(1000),
    kem_decaps: fixtureTiming(1000),
    classical_keygen: fixtureTiming(1000),
    classical_derive: fixtureTiming(1000),
  },
} as unknown as ComposedSuite;

const hybrid = decomposePhases(hybridFixture);
if (!hybrid) throw new Error("decomposePhases returned null for a suite that has a phases block.");
console.log(`  composed=${hybrid.composed_us} (3×1000 KEM + 2×2×1000 classical, expect 7000)`);
if (hybrid.composed_us !== 7000) {
  throw new Error(
    `composed_us = ${hybrid.composed_us}, expected 7000 — the classical phases must count ` +
      `twice (both parties keygen and derive) and the KEM phases once. Getting this wrong ` +
      `mis-attributes a third of the handshake.`,
  );
}
if (hybrid.phases.find((p) => p.key === "classical_keygen")!.occurrences !== 2) {
  throw new Error("classical_keygen must report occurrences: 2, shown explicitly in the UI.");
}
if (Math.abs(hybrid.phases.reduce((a, p) => a + p.share, 0) - 1) > 1e-9) {
  throw new Error("Phase shares must sum to exactly 1 — the stacked bar asserts completeness.");
}

console.log("\n=== decomposePhases: a broken identity must surface, not be hidden ===");
// If a future harness change breaks the composition, `exact` goes false and
// the UI is required to disclose it rather than draw a tidy bar.
const skewed = decomposePhases({
  ...hybridFixture,
  timing: fixtureTiming(-1),
} as unknown as ComposedSuite)!;
console.log(`  handshake=-1 composed=7000 → residual=${skewed.residual_us}, exact=${skewed.exact}`);
if (skewed.exact) {
  throw new Error(
    "A suite whose phases do not compose to its handshake mean reported exact:true — the " +
      "discrepancy must reach the UI, never be clamped or swallowed.",
  );
}

console.log("\n=== decomposePhases: never zero-fills an unmeasured phase ===");
const kemOnly = decomposePhases({
  ...hybridFixture,
  timing: fixtureTiming(3000),
  phases: {
    kem_keygen: fixtureTiming(1000),
    kem_encaps: fixtureTiming(1000),
    kem_decaps: fixtureTiming(1000),
  },
} as unknown as ComposedSuite)!;
console.log(`  KEM-only suite → ${kemOnly.phases.length} phases, exact=${kemOnly.exact}`);
if (kemOnly.phases.length !== 3 || kemOnly.phases.some((p) => p.key.startsWith("classical_"))) {
  throw new Error(
    `KEM-only suite produced ${kemOnly.phases.length} phases including classical ones — an ` +
      `unmeasured phase must be absent, never a 0 µs segment. A zero-width bar reads as ` +
      `"this step is free", which the data does not claim.`,
  );
}
if (decomposePhases(fixtureSuite({ bytes_client_to_server: 1 })) !== null) {
  throw new Error("A suite with no phases block must decompose to null, not an empty breakdown.");
}
console.log("  Correct.");

console.log("\n=== tailRatio: never Infinity, never a guess ===");
for (const [label, block] of [
  ["median 0", fixtureTiming(0)],
  ["missing block", null],
] as const) {
  if (tailRatio(block) !== null) {
    throw new Error(`tailRatio(${label}) must be null, got ${tailRatio(block)}.`);
  }
}
console.log(`  median 0 → ${formatTailRatio(tailRatio(fixtureTiming(0)))}, missing → ${formatTailRatio(null)}`);

console.log("\n=== Real committed data: phase identity holds on every suite ===");
// A running honesty check. If the harness ever stops composing the handshake
// from these phases, this digest shows it before the site does.
let worstResidualPct = 0;
let checked = 0;
for (const arch of arches) {
  const bucket = data.byArch[arch];
  for (const [track, suites] of [
    ["tls", bucket.tls?.suites],
    ["ssh", bucket.ssh?.suites],
  ] as const) {
    for (const [name, suite] of Object.entries(suites ?? {})) {
      const d = decomposePhases(suite);
      if (!d) continue;
      checked++;
      const pct = Math.abs(d.residual_us) / d.handshake_mean_us * 100;
      worstResidualPct = Math.max(worstResidualPct, pct);
      console.log(
        `  [${track}/${arch}] ${name.padEnd(21)} handshake=${d.handshake_mean_us.toFixed(1).padStart(8)}µs  ` +
          `composed=${d.composed_us.toFixed(1).padStart(8)}µs  residual=${pct.toFixed(4)}%  ` +
          `tail=${formatTailRatio(tailRatio(suite.timing))}  ${d.exact ? "exact" : "NOT EXACT"}`,
      );
      if (!d.exact) {
        throw new Error(
          `${track}/${arch} ${name}: phases compose to ${d.composed_us.toFixed(3)} µs against a ` +
            `reported handshake mean of ${d.handshake_mean_us.toFixed(3)} µs (${pct.toFixed(3)}% off). ` +
            `The phase decomposition on /q-shield/protocols presents these as a complete ` +
            `breakdown — either the harness changed or PHASE_OCCURRENCES is wrong. Do not ship ` +
            `a stacked bar over a decomposition that does not add up.`,
        );
      }
    }
  }
}
console.log(`  ${checked} suites checked, worst residual ${worstResidualPct.toFixed(4)}%`);
console.log(`  phase order: ${PHASE_ORDER.join(" → ")}`);

console.log("\n=== Real committed data: AES-GCM baseline ===");
const aes = aesBaselinesByArch(data);
if (Object.keys(aes).length === 0) {
  console.log("  (no aes-baseline file present — skipping)");
} else {
  for (const [arch, b] of Object.entries(aes)) {
    console.log(
      `  [${arch}] ${b.algorithm} · ${b.payload_bytes} B payload · ` +
        `encrypt ${b.encrypt.median_us.toFixed(2)}µs · decrypt ${b.decrypt.median_us.toFixed(2)}µs`,
    );
    if (!b.payload_bytes_source) {
      throw new Error(
        `AES baseline for ${arch} has no payload_bytes_source — the payload size is a cited ` +
          `choice (RFC 8446 §5.2), and the page renders that citation. It must be present.`,
      );
    }
  }
}


console.log("\n=== baseline delta is recomputed same-run, never read from the file ===");
const anomalousSuites: string[] = [];
// The regression this guards, found 2026-08-16: tls_composed.py measured the
// baseline in one pass and every suite in a second pass, then compared across
// them. On this host the two passes land in different modes, so the stored
// pct_over_classical swung from +46.2% to -17.2% across six runs and flipped
// sign on the two most recent — the site published "-16.9%" in the good/green
// style, telling readers hybrid PQC is FASTER than classical. It is ~40% slower.
for (const arch of arches) {
  const suites = data.byArch[arch].tls?.suites;
  if (!suites) continue;
  for (const [name, suite] of Object.entries(suites)) {
    const recomputed = vsBaselinePct(suite, suites);
    if (recomputed == null) continue;
    const stored = suite.baseline?.pct_over_classical;
    const baselineName = suite.baseline!.baseline_suite;
    const baselineMedian = suites[baselineName].timing.median_us;
    const expected = ((suite.timing.median_us - baselineMedian) / baselineMedian) * 100;

    console.log(
      `  [${arch}] ${name.padEnd(20)} recomputed ${recomputed.toFixed(1).padStart(6)}%  ` +
        `stored ${String(stored ?? "—").padStart(6)}%` +
        (stored != null && Math.sign(stored) !== Math.sign(recomputed) ? "  <- stored sign is wrong" : ""),
    );

    if (Math.abs(recomputed - expected) > 1e-9) {
      throw new Error(`vsBaselinePct(${name}) disagrees with a direct same-run computation.`);
    }
    // A *hybrid* suite does a KEM exchange AND a classical one, so it cannot be
    // faster than the classical baseline alone. Pure-PQC suites legitimately
    // can be — ML-KEM-768 beats X25519 by roughly 60%, one of the product's own
    // published findings — so the check keys off the measured phase block, not
    // the suite name. See lib/protocols/anomaly.ts.
    //
    // This used to throw and fail the build. It no longer does, and the reason
    // matters: from 2026-08-17 the x86 host's X25519 floor went bimodal, so
    // roughly one committed run in ten carries an inflated baseline that makes
    // a hybrid read as negative. That is a measurement-host problem the harness
    // cannot promise away, and halting the site build on it does not protect
    // any reader. What protects the reader is that the impossible figure can
    // never RENDER. So the invariant asserted here is that one, and it is a
    // hard failure — a violating suite that still yields a publishable number
    // is a real regression.
    const anomaly = detectSuiteAnomaly(suite, suites);
    if (anomaly) {
      anomalousSuites.push(`${arch}/${name}`);
      console.log(
        `  [${arch}] ${name.padEnd(20)} WITHHELD — hybrid at ${anomaly.suiteMedianUs.toFixed(1)}µs ` +
          `vs ${anomaly.baselineSuite} at ${anomaly.baselineMedianUs.toFixed(1)}µs (inflated baseline)`,
      );
      if (publishableVsBaselinePct(suite, suites) !== null) {
        throw new Error(
          `${arch}/${name} is a structurally impossible comparison (hybrid at ` +
            `${anomaly.suiteMedianUs} µs against ${anomaly.baselineSuite} at ` +
            `${anomaly.baselineMedianUs} µs) yet publishableVsBaselinePct still returned a ` +
            `number. The anomaly gate is the only thing stopping the site publishing "hybrid ` +
            `post-quantum TLS is faster than classical". It must return null here.`,
        );
      }
    } else if (publishableVsBaselinePct(suite, suites) !== recomputed) {
      throw new Error(
        `${arch}/${name} is a sound comparison but the anomaly gate suppressed it. The gate must ` +
          `withhold only impossible figures — suppressing real ones hides the product's findings.`,
      );
    }
  }
}

if (anomalousSuites.length > 0) {
  console.log(
    `
  ${anomalousSuites.length} suite(s) withheld this run: ${anomalousSuites.join(", ")}.` +
      `
  Not a build failure — the gate held and /q-shield/protocols states the reason.` +
      `
  Root cause is the x86 host's bimodal X25519 floor since 2026-08-17; the c7i` +
      `
  overlap data does not show it. Tracked in work-order 013.`,
  );
}


console.log("\nOK — protocols smoke test passed.");
