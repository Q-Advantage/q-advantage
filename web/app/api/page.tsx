import type { Metadata } from "next";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PageShell } from "@/components/chrome/PageShell";
import { AuditBand, Caveat, DataTable, ExportRow, RowName, Section, Tag } from "@/components/product/kit";
import { availabilityPayload } from "@/lib/api/v1";

export const metadata: Metadata = {
  title: "Data API — Q-Advantage",
  description:
    "A public, unauthenticated JSON API over every post-quantum benchmark measurement Q-Advantage publishes. Every row traces to the GitHub Actions run that produced it.",
};

export const dynamic = "force-static";

interface SpecPath {
  get: { summary: string; description: string };
}

function readSpec(): { info: { version: string }; paths: Record<string, SpecPath> } {
  return JSON.parse(readFileSync(join(process.cwd(), "public", "openapi.json"), "utf8"));
}

/**
 * /api — the data API's reference page.
 *
 * Built from public/openapi.json, which is itself generated from the route
 * handlers on disk. Nothing here is a hand-maintained list, so the page cannot
 * document an endpoint that does not exist.
 */
export default function ApiReferencePage() {
  const spec = readSpec();
  const availability = availabilityPayload();
  const paths = Object.entries(spec.paths);

  return (
    <PageShell variant="frame" className="space-y-8">
      <div className="flex flex-col gap-3">
        <div className="eyebrow">Public data API · v{spec.info.version}</div>
        <h1 className="max-w-[24ch] text-balance text-[clamp(28px,3.6vw,40px)] font-bold leading-[1.08] tracking-[-0.03em] text-fg">
          Take the numbers. All of them.
        </h1>
        <p className="max-w-[66ch] text-[15px] font-medium leading-relaxed text-fg-muted">
          Every measurement Q-Advantage publishes is readable as JSON, without a key, a login, or a
          rate limit. Responses are prerendered at build time, so they are static files served from
          the edge — and every measurement carries the URL of the GitHub Actions run that produced
          it. If a number here cannot be traced to a run, it is a bug, not a rounding.
        </p>
      </div>

      <AuditBand
        cells={[
          { k: "Base URL", v: "qadvantage.io" },
          { k: "Version", v: `v${availability.api_version}` },
          { k: "Auth", v: "None" },
          { k: "Runs available", v: String(availability.runs.count) },
          { k: "Coverage", v: `${availability.runs.earliest} → ${availability.runs.latest}` },
          { k: "Spec", v: "OpenAPI 3.1", tone: "link" },
        ]}
      />

      <Section
        eyebrow="Quickstart"
        title="Discovery first, then the data."
        hint="Start at /availability so you are reading identifiers that exist rather than guessing them."
      >
        <div className="space-y-3">
          {[
            ["Discover what exists", "curl https://qadvantage.io/api/v1/availability"],
            ["Read the newest run", "curl https://qadvantage.io/api/v1/latest"],
            [
              "Follow one algorithm over time",
              "curl https://qadvantage.io/api/v1/algorithms/ml-kem-768/history",
            ],
            ["Inspect the machine-readable contract", "curl https://qadvantage.io/openapi.json"],
          ].map(([label, cmd]) => (
            <div key={cmd} className="rounded border border-border bg-bg-surface px-4 py-3">
              <div className="text-[11px] font-bold uppercase tracking-eyebrow text-fg-subtle">
                {label}
              </div>
              <code className="num mt-1 block overflow-x-auto text-[12.5px] font-semibold text-fg">
                {cmd}
              </code>
            </div>
          ))}
        </div>
      </Section>

      <Section
        eyebrow="Endpoints"
        title={`${paths.length} operations.`}
        hint="Generated from the route handlers themselves — this list cannot document something that does not exist."
      >
        <DataTable
          head={["Endpoint", "What it returns"]}
          rows={paths.map(([path, def]) => ({
            key: path,
            cells: [
              <RowName key="p" name={path} note={def.get.summary} href={path.includes("{") ? undefined : path} />,
              <span key="d" className="block max-w-[62ch] text-left text-[12px] font-medium leading-relaxed text-fg-muted">
                {def.get.description}
              </span>,
            ],
          }))}
        />
      </Section>

      <Section
        eyebrow="Conventions"
        title="What the fields mean."
        hint="Read this before you write a parser."
      >
        <div className="space-y-3 text-[13px] leading-relaxed text-fg-muted">
          <p>
            <Tag>null is null</Tag> A field that is absent or null was not measured. It is never
            zero-filled, defaulted, or carried over from a previous run. A zero timing would read as
            &ldquo;instant&rdquo;, which is a claim the data does not make.
          </p>
          <p>
            <Tag>run_url</Tag> Every measurement-bearing object carries the GitHub Actions run that
            produced it. This is the point of the whole thing.
          </p>
          <p>
            <Tag>units</Tag> Timings are microseconds (<span className="num">_us</span>), sizes are
            bytes (<span className="num">_bytes</span>), throughput is operations per second. Dates
            are <span className="num">YYYY-MM-DD</span>; timestamps are UTC ISO 8601.
          </p>
          <p>
            <Tag>additive</Tag> Fields get added, never repurposed or silently dropped. A breaking
            change gets a new version prefix.
          </p>
          <p>
            <Tag>404</Tag> A date or identifier that was never measured returns 404 with an{" "}
            <span className="num">error</span> string — never an empty record that a parser might
            read as &ldquo;measured, and it was nothing&rdquo;.
          </p>
        </div>
      </Section>

      <Caveat label="Gaps stay gaps">
        Other benchmark publishers interpolate between measured points to offer a value at any
        operating point you like. We do not, and the history endpoint says so in its own payload.
        There is no value between two daily runs — if you resample this series as though it were
        continuous, the numbers you get back are yours, not ours. This is a deliberate limit: the
        product is that every published figure traces to a run, and an interpolated figure traces to
        arithmetic instead.
      </Caveat>

      <Section
        eyebrow="Take the data"
        title="Or skip the API entirely."
        hint="The underlying result files are committed to the public repository — the API is a convenience over them, not a gate in front of them."
      >
        <ExportRow
          items={[
            { label: "OpenAPI spec", href: "/openapi.json", primary: true },
            { label: "Availability", href: "/api/v1/availability" },
            { label: "Latest run", href: "/api/v1/latest" },
            { label: "Raw result files", href: "https://github.com/Q-Advantage/q-advantage/tree/main/benchmark/results" },
            { label: "Methodology", href: "/methodology" },
          ]}
        />
      </Section>
    </PageShell>
  );
}
