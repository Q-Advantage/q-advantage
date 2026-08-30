import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

// Unit tests for the pure logic under lib/. Deliberately node-environment and
// deliberately narrow: everything worth unit-testing in this repo is a pure
// projection of committed measurements, so there is no DOM to stand up.
//
// This does NOT replace scripts/smoke-*.ts. Those run the same logic against
// the real committed record and assert its invariants still hold — a different
// question from "does this function do what it says". Both run in CI.
export default defineConfig({
  resolve: {
    alias: { "@": resolve(__dirname, ".") },
  },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "tests/**/*.test.ts"],
    passWithNoTests: false,
  },
});
