/**
 * Smoke test for the data loader.
 *
 *   npx tsx scripts/smoke-loader.ts
 *
 * Prints a digest of what the loader returns. The dashboard should never
 * ship if any of these lines look wrong.
 */
import {
  loadAllRuns,
  getLatestRun,
  getAlgorithmHistory,
} from "../lib/data/load";
import {
  formatDuration,
  formatOpsPerSec,
  formatBytes,
  shortCpuModel,
  shortSha,
  formatRunDate,
  formatWallClock,
  computeStealPercent,
  classifyStealPercent,
  formatStealPercent,
} from "../lib/format";

const runs = loadAllRuns();
console.log(`\n=== ${runs.length} runs loaded ===`);
for (const r of runs) {
  const ts = formatRunDate(r.environment.iso_timestamp);
  const sha = shortSha(r.full_sha);
  const legacy = r.is_legacy_schema ? " [legacy schema]" : "";
  const legacyFn = r.is_legacy_filename ? " [legacy filename]" : "";
  console.log(`  ${ts}  ${sha}  ${r.algorithms.length} algos${legacy}${legacyFn}`);
}

const latest = getLatestRun();
console.log(`\n=== Latest run audit strip ===`);
console.log(`  Date:      ${formatRunDate(latest.environment.iso_timestamp)}`);
console.log(`  SHA:       ${shortSha(latest.full_sha)}`);
console.log(`  CPU:       ${shortCpuModel(latest.environment.cpu_model)}`);
console.log(`  Instance:  ${latest.environment.ec2_instance_type}`);
console.log(`  liboqs:    ${latest.environment.liboqs_version} (python binding ${latest.environment.liboqs_python_version})`);
const skew = latest.environment.liboqs_version !== latest.environment.liboqs_python_version;
console.log(`  Skew:      ${skew ? "YES — show pill" : "no"}`);
if (latest.runtime_metrics) {
  const rm = latest.runtime_metrics;
  const pct = computeStealPercent(rm.cpu_steal_seconds, rm.wall_clock_seconds);
  console.log(`  Wall:      ${formatWallClock(rm.wall_clock_seconds)}`);
  console.log(`  Steal:     ${rm.cpu_steal_seconds}s (${formatStealPercent(pct)} — ${classifyStealPercent(pct)})`);
  console.log(`  Load:      ${rm.loadavg_start[0].toFixed(2)} → ${rm.loadavg_end[0].toFixed(2)}`);
} else {
  console.log(`  Runtime:   (legacy — no runtime_metrics block)`);
}

console.log(`\n=== Normalized algorithms (latest run) ===`);
for (const a of latest.algorithms) {
  const sizes = a.kind === "kem"
    ? `pk=${formatBytes(a.pubkey_bytes)} ct=${formatBytes(a.ciphertext_bytes!)}`
    : `pk=${formatBytes(a.pubkey_bytes)} sig=${formatBytes(a.signature_bytes!)}`;
  console.log(`  ${a.id.padEnd(22)}  ${a.display_name.padEnd(26)}  ${a.family.padEnd(8)}  ${a.kind}  ${sizes}`);
}

console.log(`\n=== Format spot checks (the wide-range cases) ===`);
const mlkem512 = latest.algorithms_by_id["ml-kem-512"];
const slhdsa128s = latest.algorithms_by_id["slh-dsa-shake-128s"];
const slhdsa128f = latest.algorithms_by_id["slh-dsa-shake-128f"];

console.log(`  ML-KEM-512 keygen mean:   ${formatDuration(mlkem512.operations.keygen!.mean_us)}  (${formatOpsPerSec(mlkem512.operations.keygen!.ops_per_sec)} ops/s)`);
console.log(`  SLH-DSA-128f sign mean:   ${formatDuration(slhdsa128f.operations.sign!.mean_us)}  (${formatOpsPerSec(slhdsa128f.operations.sign!.ops_per_sec)} ops/s)`);
console.log(`  SLH-DSA-128s sign mean:   ${formatDuration(slhdsa128s.operations.sign!.mean_us)}  (${formatOpsPerSec(slhdsa128s.operations.sign!.ops_per_sec)} ops/s)`);

console.log(`\n=== ML-DSA-65 sign history (sparkline data) ===`);
const hist = getAlgorithmHistory("ml-dsa-65", "sign");
for (const p of hist) {
  console.log(`  ${formatRunDate(p.run.environment.iso_timestamp).padEnd(20)}  mean=${formatDuration(p.mean_us).padEnd(12)}  p95=${formatDuration(p.p95_us)}`);
}

console.log(`\nOK — loader smoke test passed.`);
