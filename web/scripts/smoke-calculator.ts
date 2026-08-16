/**
 * Smoke test for the cost model.
 *
 *   npx tsx scripts/smoke-calculator.ts
 *
 * This is the repo's first modelling surface — it computes numbers nobody
 * measured. The assertions here are the ones that keep that legitimate:
 *
 *   - the arithmetic is arithmetic (checked against a hand-computed case)
 *   - session reuse actually reduces cost, monotonically
 *   - a suite with no measurement is omitted, never costed at zero
 *   - egress is charged on outbound bytes only, not the full wire total
 *   - every shipped default carries a citation
 *
 * Fixtures use obviously-fake sentinels (-1, 9999) per CLAUDE.md guardrail 1.
 */
import { loadProtocolsData } from "../lib/protocols/load";
import {
  DAYS_PER_MONTH,
  effectiveHandshakes,
  formatUsd,
  runScenario,
  type ScenarioInputs,
} from "../lib/calculator/model";
import {
  ARCHETYPES,
  EGRESS_GB,
  HORIZONS,
  SESSION_REUSE,
  STATIC_REFERENCES,
  VCPU_HOUR,
} from "../lib/calculator/defaults";
import type { ComposedSuite } from "../lib/protocols/types";

function fixture(medianUs: number, bytesOut: number, baselineOf?: string): ComposedSuite {
  return {
    identity: { protocol: "tls", mode: "composed", suite: "fixture" },
    timing: {
      mean_us: medianUs, median_us: medianUs, p95_us: medianUs, p99_us: medianUs,
      stdev_us: 0, min_us: medianUs, max_us: medianUs, ops_per_sec: 1, n_iterations: 1,
    },
    size: { bytes_client_to_server: 9999, bytes_server_to_client: bytesOut, bytes_total: 9999 + bytesOut },
    ...(baselineOf ? { baseline: { baseline_suite: baselineOf, pct_over_classical: -1 } } : {}),
  } as unknown as ComposedSuite;
}

const BASE_INPUTS: ScenarioInputs = {
  handshakesPerSecond: 1000,
  sessionReusePct: 0,
  vcpuHourUsd: 1, // $1/vCPU-hr makes the arithmetic checkable by hand
  egressGbUsd: 1,
  months: 1,
};

console.log("=== the arithmetic is arithmetic ===");
// 1000 hs/sec, no reuse, 1 month => 1000 * 86400 * 30.4375 handshakes.
// At 3,600,000 µs each that is exactly 1 vCPU-hour per 1,000,000 handshakes...
// so compute it directly rather than trusting a remembered constant.
const handshakes = 1000 * 86400 * DAYS_PER_MONTH;
const suites = { classical: fixture(1000, 0), hybrid: fixture(2000, 0, "classical") };
const r = runScenario(["classical", "hybrid"], suites, BASE_INPUTS);

const expectedClassicalCpu = (1000 * handshakes) / 3_600_000_000;
const got = r.suites.find((s) => s.name === "classical")!.cpuUsd;
console.log(`  ${formatCountLocal(handshakes)} handshakes; classical CPU $${got.toFixed(4)}`);
if (Math.abs(got - expectedClassicalCpu) > 1e-9) {
  throw new Error(`CPU cost = ${got}, expected ${expectedClassicalCpu}.`);
}
// Hybrid takes exactly twice as long, so it must cost exactly twice.
const hybrid = r.suites.find((s) => s.name === "hybrid")!;
if (Math.abs(hybrid.multiplier! - 2) > 1e-9) {
  throw new Error(`Hybrid multiplier = ${hybrid.multiplier}, expected exactly 2.`);
}
console.log(`  hybrid multiplier ${hybrid.multiplier!.toFixed(2)}× — correct`);

console.log("\n=== egress is charged on outbound bytes only ===");
// bytes_client_to_server is 9999 in the fixture. If it were being billed, the
// egress term would be non-zero here.
const outOnly = runScenario(["classical"], { classical: fixture(1, 0) }, BASE_INPUTS);
if (outOnly.suites[0].egressUsd !== 0) {
  throw new Error(
    `Egress charged ${outOnly.suites[0].egressUsd} on a suite sending 0 outbound bytes — inbound ` +
      `traffic is being billed. Cloud egress bills outbound only.`,
  );
}
const withOut = runScenario(["classical"], { classical: fixture(1, 1000) }, BASE_INPUTS);
console.log(`  0 B out → $${outOnly.suites[0].egressUsd}; 1000 B out → $${withOut.suites[0].egressUsd.toFixed(2)}`);
if (withOut.suites[0].egressUsd <= 0) throw new Error("Outbound bytes produced no egress cost.");

console.log("\n=== session reuse reduces cost monotonically ===");
let prev = Infinity;
for (const reuse of [0, 25, 53, 90, 100]) {
  const res = runScenario(["classical"], { classical: fixture(1000, 500) }, {
    ...BASE_INPUTS,
    sessionReusePct: reuse,
  });
  const total = res.suites[0].totalUsd;
  console.log(`  ${String(reuse).padStart(3)}% reuse → ${formatUsd(total)}`);
  if (total > prev) throw new Error(`Cost rose as session reuse increased (${reuse}%).`);
  prev = total;
}
if (prev !== 0) throw new Error("100% session reuse must cost exactly zero — no handshakes run.");

console.log("\n=== reuse is clamped, never negative-handshakes ===");
for (const bad of [-50, 150]) {
  const eff = effectiveHandshakes(1000, bad);
  console.log(`  reuse ${bad}% → ${eff} effective handshakes/sec`);
  if (eff < 0 || eff > 1000) throw new Error(`effectiveHandshakes clamping failed at ${bad}%.`);
}

console.log("\n=== an unmeasured suite is omitted, never costed at zero ===");
const missing = runScenario(["classical", "ghost"], { classical: fixture(1000, 0) }, BASE_INPUTS);
console.log(`  requested 2, costed ${missing.suites.length}`);
if (missing.suites.some((s) => s.name === "ghost")) {
  throw new Error("A suite with no measurement was given a cost. It must be omitted.");
}

console.log("\n=== every shipped default carries a citation ===");
const fields = [
  ["session reuse", SESSION_REUSE.citation],
  ["$/vCPU-hr", VCPU_HOUR.citation],
  ["$/GB egress", EGRESS_GB.citation],
  ...ARCHETYPES.map((a) => [`archetype: ${a.label}`, a.citation] as const),
] as const;
for (const [label, c] of fields) {
  if (!c.text || !c.url || !c.retrieved) {
    throw new Error(
      `Default "${label}" is missing part of its citation. An input the customer did not give us ` +
        `ships with a cited default or it does not ship — that is the only rule this surface has.`,
    );
  }
  console.log(`  ${label.padEnd(34)} ${c.caveat ? "cited + caveated" : "cited"}`);
}
if (STATIC_REFERENCES.length < 6) throw new Error("The static reference list lost entries.");
if (!ARCHETYPES.some((a) => a.perSecond === null && a.range)) {
  throw new Error(
    "No archetype ships an honest range. The public-API-gateway figure has no authoritative " +
      "'typical' value and must not be given a point default.",
  );
}

console.log("\n=== Real committed data: the default scenario ===");
const data = loadProtocolsData();
const arch = data.byArch["x86_64"] ?? data.byArch[Object.keys(data.byArch)[0]];
const real = arch?.tls?.suites;
if (!real) {
  console.log("  (no protocol data present — skipping)");
} else {
  const inputs: ScenarioInputs = {
    handshakesPerSecond: ARCHETYPES[0].perSecond ?? 1500,
    sessionReusePct: SESSION_REUSE.value,
    vcpuHourUsd: VCPU_HOUR.value,
    egressGbUsd: EGRESS_GB.value,
    months: HORIZONS[0].months,
  };
  const scenario = runScenario(Object.keys(real), real, inputs);
  console.log(
    `  ${inputs.handshakesPerSecond} hs/sec at ${inputs.sessionReusePct}% reuse → ` +
      `${formatCountLocal(scenario.handshakesOverHorizon)} full handshakes/month`,
  );
  for (const s of scenario.suites) {
    console.log(
      `  ${s.name.padEnd(20)} ${formatUsd(s.totalUsd).padStart(12)}/mo  ` +
        `(cpu ${formatUsd(s.cpuUsd)}, egress ${formatUsd(s.egressUsd)})  ` +
        `${s.multiplier ? `${s.multiplier.toFixed(2)}×` : "baseline"}`,
    );
  }
  if (scenario.headline) {
    const h = scenario.headline;
    console.log(
      `  headline: ${h.suiteName} ${formatUsd(h.deltaUsd)}/mo vs ${scenario.baselineName} — ` +
        `${(h.cpuShare * 100).toFixed(0)}% CPU, ${(h.egressShare * 100).toFixed(0)}% egress`,
    );
    if (Math.abs(h.cpuShare + h.egressShare - 1) > 1e-9) {
      throw new Error("Attribution shares must sum to 1 — the chart asserts they account for the delta.");
    }
  }
}

function formatCountLocal(v: number): string {
  return v >= 1e9 ? `${(v / 1e9).toFixed(2)}B` : v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v.toFixed(0);
}

console.log("\nOK — calculator smoke test passed.");
