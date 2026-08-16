// web/scripts/build-openapi.mjs
//
// Emits public/openapi.json.
//
// Generated rather than hand-written so the spec cannot drift from what the
// routes actually serve: the path list is derived from the route handlers on
// disk, and the enumerable parameter values (run dates, algorithm ids) come
// from the committed data itself. A spec that documents an endpoint we removed
// is the API equivalent of an uncited number.
//
// Run automatically via `prebuild`.

import { readdirSync, existsSync, writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = resolve(__dirname, "..");
const API_ROOT = join(WEB_ROOT, "app", "api", "v1");
const RESULTS = join(WEB_ROOT, "data", "results");
const OUT = join(WEB_ROOT, "public", "openapi.json");

/** Walk app/api/v1 and collect every directory containing a route.ts. */
function discoverRoutes(dir, prefix = "/api/v1") {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const child = join(dir, entry.name);
    const segment = entry.name.startsWith("[") ? `{${entry.name.slice(1, -1)}}` : entry.name;
    const path = `${prefix}/${segment}`;
    if (existsSync(join(child, "route.ts"))) found.push(path);
    found.push(...discoverRoutes(child, path));
  }
  return found.sort();
}

function committedDates() {
  if (!existsSync(RESULTS)) return [];
  return readdirSync(RESULTS)
    .map((f) => /^results-(\d{4}-\d{2}-\d{2})/.exec(f)?.[1])
    .filter(Boolean)
    .sort();
}

function committedAlgorithmIds() {
  const dates = readdirSync(RESULTS).filter((f) => f.endsWith(".json")).sort();
  const newest = dates[dates.length - 1];
  if (!newest) return [];
  const raw = JSON.parse(readFileSync(join(RESULTS, newest), "utf8"));
  return Object.keys(raw.algorithms ?? {})
    .map((k) => k.toLowerCase().replace(/_/g, "-"))
    .sort();
}

const routes = discoverRoutes(API_ROOT);
const dates = committedDates();
const algorithmIds = committedAlgorithmIds();

const DESCRIPTIONS = {
  "/api/v1/availability": [
    "List what can be asked for",
    "Discovery. Returns the algorithms, operations, protocol tracks, architectures and run-date range actually present, plus the endpoint list. Start here rather than guessing identifiers.",
  ],
  "/api/v1/latest": [
    "Read the newest run",
    "The most recent daily benchmark run in full: every algorithm, every operation, all nine timing fields, with the run's provenance block.",
  ],
  "/api/v1/runs": [
    "List all runs",
    "Index of every committed run, newest first, each with its commit, Actions run URL, CPU-steal figure and a link to the full payload.",
  ],
  "/api/v1/runs/{date}": [
    "Read one run",
    "One run by date (YYYY-MM-DD). Only dates present in the index resolve; anything else is a 404 rather than an empty run.",
  ],
  "/api/v1/algorithms/{id}/history": [
    "Read an algorithm's measured series",
    "Every committed measurement for one algorithm, per operation, oldest first. Measured points only — there is no value between two runs and the series must not be resampled as though it were continuous.",
  ],
  "/api/v1/protocols": [
    "Read the composed protocol tracks",
    "TLS and SSH handshake suites with their phase decomposition, wire sizes, amplification factor and classical baseline, plus the signature, AES-GCM and stateful-signature tracks, per architecture.",
  ],
  "/api/v1/reliability": [
    "Read measurement reliability",
    "Per-run counts of algorithm measurements attempted and succeeded, with CPU steal. Reported as counts rather than a bare percentage — the same rate over two runs and over ninety-four are different claims.",
  ],
};

const paths = {};
for (const route of routes) {
  const [summary, description] = DESCRIPTIONS[route] ?? [route, ""];
  const parameters = [];
  if (route.includes("{date}")) {
    parameters.push({
      name: "date",
      in: "path",
      required: true,
      description: "Run date, YYYY-MM-DD. Must be a date present in /api/v1/runs.",
      schema: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$", enum: dates },
    });
  }
  if (route.includes("{id}")) {
    parameters.push({
      name: "id",
      in: "path",
      required: true,
      description: "Algorithm id as returned by /api/v1/availability.",
      schema: { type: "string", enum: algorithmIds },
    });
  }

  paths[route] = {
    get: {
      summary,
      description,
      operationId: route.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, ""),
      parameters: parameters.length ? parameters : undefined,
      responses: {
        200: { description: "OK", content: { "application/json": { schema: { type: "object" } } } },
        ...(parameters.length
          ? {
              404: {
                description: "No such record",
                content: {
                  "application/json": {
                    schema: { type: "object", properties: { error: { type: "string" } } },
                  },
                },
              },
            }
          : {}),
      },
    },
  };
}

const spec = {
  openapi: "3.1.0",
  "x-generated-by": "web/scripts/build-openapi.mjs — do not hand-edit; runs on prebuild",
  info: {
    title: "Q-Advantage public data API",
    version: "1.0.0",
    summary: "Post-quantum cryptography benchmark measurements, as published.",
    description: [
      "Every response is a projection of measurements committed to the public repository and",
      "produced by a GitHub Actions run. Nothing is interpolated, smoothed, or estimated: where a",
      "value does not exist the field is null and stays null. Every measurement carries a",
      "`run_url` pointing at the Actions run that produced it.",
      "",
      "Responses are prerendered at build time, so they are static files. No authentication, no",
      "rate limits, no keys.",
    ].join(" "),
    license: { name: "See repository", url: "https://github.com/Q-Advantage/q-advantage" },
  },
  servers: [{ url: "https://qadvantage.io", description: "Production" }],
  paths,
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(spec, null, 2) + "\n");
console.log(
  `[openapi] wrote ${OUT} — ${routes.length} paths, ${dates.length} run dates, ${algorithmIds.length} algorithm ids`,
);
