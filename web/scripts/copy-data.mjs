// Copy benchmark/results/*.json into web/data/results before Next builds.
// Vercel's project root is web/, so the benchmark/ directory is not in the
// build context by default. This script bridges that gap.
//
// Run automatically via npm `prebuild` and `predev`. Idempotent.

import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = resolve(__dirname, "..");
const SRC = resolve(WEB_ROOT, "..", "benchmark", "results");
const DEST = resolve(WEB_ROOT, "data", "results");

function copyBenchmarkResults() {
  if (!existsSync(SRC)) {
    console.error(`[copy-data] Source directory not found: ${SRC}`);
    console.error(`[copy-data] Expected layout: <repo>/benchmark/results/`);
    process.exit(1);
  }

  // Clean dest so deleted result files don't linger.
  if (existsSync(DEST)) rmSync(DEST, { recursive: true });
  mkdirSync(DEST, { recursive: true });

  const files = readdirSync(SRC).filter((f) => f.endsWith(".json"));
  if (files.length === 0) {
    console.error(`[copy-data] No JSON result files found in ${SRC}`);
    process.exit(1);
  }

  for (const f of files) {
    copyFileSync(join(SRC, f), join(DEST, f));
  }
  console.log(`[copy-data] Copied ${files.length} result file(s) from ${SRC} → ${DEST}`);
}

// Composed-track history. The manifest in public/data/protocols names only the
// newest file per track, which is right for describing one run and wrong for a
// comparison that must be published as a series across runs (work-order 027).
// Only the published record is mirrored: benchmark/results-c7i is an overlap
// evaluation path and is deliberately not read.
const PROTOCOLS_SRC = resolve(SRC, "protocols");
const PROTOCOLS_DEST = resolve(WEB_ROOT, "data", "protocols-history");
const COMPOSED_RE = /^(tls|ssh|ipsec)-composed-\d{4}-\d{2}-\d{2}-[0-9a-f]+\.json$/;

function copyComposedHistory() {
  if (!existsSync(PROTOCOLS_SRC)) {
    console.error(`[copy-data] Source directory not found: ${PROTOCOLS_SRC}`);
    process.exit(1);
  }

  if (existsSync(PROTOCOLS_DEST)) rmSync(PROTOCOLS_DEST, { recursive: true });
  mkdirSync(PROTOCOLS_DEST, { recursive: true });

  const files = readdirSync(PROTOCOLS_SRC).filter((f) => COMPOSED_RE.test(f));
  for (const f of files) {
    copyFileSync(join(PROTOCOLS_SRC, f), join(PROTOCOLS_DEST, f));
  }
  console.log(`[copy-data] Copied ${files.length} composed-track file(s) from ${PROTOCOLS_SRC} → ${PROTOCOLS_DEST}`);
}

copyBenchmarkResults();
copyComposedHistory();
