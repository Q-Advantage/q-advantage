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

copyBenchmarkResults();
