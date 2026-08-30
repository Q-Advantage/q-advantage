import type { Metadata } from "next";
import { Suspense } from "react";
import { PageShell } from "@/components/chrome/PageShell";
import { GitHubStarPopup } from "@/components/chrome/GitHubStarPopup";
import {
  AuditBand,
  Caveat,
  DataTable,
  ExportRow,
  RowName,
  Section,
  Tag,
} from "@/components/product/kit";
import { TrendsChart } from "@/components/data/TrendsChart";
import { getLatestRun, loadAllRuns } from "@/lib/data/load";
import { currentEra, deriveHostEras } from "@/lib/data/hosts";
import { availableOperations, getMetric } from "@/lib/data/board-metrics";
import {
  buildTrends,
  defaultSelection,
  seriesChangePct,
  spreadPct,
  type TrendsResult,
} from "@/lib/data/trends";
import { computeStealPercent, formatStealPercent, shortCpuModel } from "@/lib/format";

export const metadata: Metadata = {
  title: "Trends — Q-Shield",
  description:
    "Every post-quantum algorithm measured daily since May 2026. Latency, percentiles and throughput over time — measured points only, never interpolated.",
};

export const dynamic = "force-static";

/**
 * /q-shield/trends — the historical view.
 *
 * The daily runs have existed since 2026-05-11 and surfaced as exactly one
 * sparkline, of one metric, on one algorithm page. This is the surface that
 * makes the record itself the product.
 */

/**
 * The default selection as a plain table.
 *
 * Rendered as real page content rather than a Suspense fallback: the chart is
 * a client component reading search params, so on this force-static page its
 * subtree is not prerendered and nothing inside it reaches the served HTML.
 * This is the record in markup — crawlable, readable without JavaScript, and
 * worth having next to the chart regardless.
 */
function TrendsSummary({ data, metricId }: { data: TrendsResult; metricId: string }) {
  const fmt = getMetric(metricId).format;
  return (
    <DataTable
      head={["Algorithm", "First", "Latest", "Change", "Observed range", "Points", "Gaps"]}
      rows={data.series.map((s) => {
        const first = s.points[0];
        const last = s.points[s.points.length - 1];
        const change = seriesChangePct(s);
        return {
          key: s.id,
          cells: [
            <RowName key="n" name={s.label} note={s.family} href={`/q-shield/${s.id}`} />,
            `${fmt(first.value)} · ${first.date}`,
            `${fmt(last.value)} · ${last.date}`,
            change == null ? "—" : `${change > 0 ? "+" : ""}${change.toFixed(1)}%`,
            `${fmt(s.min)} – ${fmt(s.max)}`,
            String(s.points.length),
            s.gaps > 0 ? <Tag key="g">{s.gaps}</Tag> : "0",
          ],
        };
      })}
    />
  );
}

export default function TrendsPage() {
  const run = getLatestRun();
  const runs = loadAllRuns();
  const oldest = runs[runs.length - 1];

  const ops = availableOperations(run.algorithms);
  const op = ops[0] ?? "keygen";
  const selection = defaultSelection(run.algorithms);
  const initial = buildTrends(selection, "mean", op, "all");

  const totalGaps = initial.series.reduce((a, s) => a + s.gaps, 0);

  // Hardware eras, derived from the runs themselves (lib/data/hosts.ts).
  const eras = deriveHostEras(runs);
  const era = currentEra(eras);

  // CPU steal observed across the CURRENT era only. This paragraph used to
  // carry the literal string "0.13% to 10.51%", written by hand against the
  // t3.medium record; on a host change it would have gone quietly stale while
  // still reading as a live figure. Computed now, per era, so it cannot.
  const eraSteal = runs
    .filter((r) => r.host_era_id === era?.id)
    .map((r) =>
      r.runtime_metrics
        ? computeStealPercent(
            r.runtime_metrics.cpu_steal_seconds,
            r.runtime_metrics.wall_clock_seconds,
          )
        : null,
    )
    .filter((v): v is number => v != null);
  const minSteal = eraSteal.length ? Math.min(...eraSteal) : null;
  const maxSteal = eraSteal.length ? Math.max(...eraSteal) : null;

  // Everything the noise caveat states is computed from the same series the
  // chart draws — no figure in that paragraph is written by hand.
  const fmt = getMetric("mean").format;
  const spreads = initial.series
    .map((s) => spreadPct(s))
    .filter((v): v is number => v != null);
  const minSpread = spreads.length ? Math.min(...spreads) : 0;
  const maxSpread = spreads.length ? Math.max(...spreads) : 0;

  const widestSeries = [...initial.series].sort(
    (a, b) => Math.abs(seriesChangePct(b) ?? 0) - Math.abs(seriesChangePct(a) ?? 0),
  )[0];
  const widestChange = widestSeries ? seriesChangePct(widestSeries) : null;
  const widest = {
    label: widestSeries?.label ?? "—",
    change:
      widestChange == null ? "—" : `${widestChange > 0 ? "+" : ""}${widestChange.toFixed(0)}%`,
    low: widestSeries ? fmt(widestSeries.min) : "—",
    high: widestSeries ? fmt(widestSeries.max) : "—",
  };

  return (
    <>
      <PageShell variant="frame" className="space-y-8">
        <div className="flex flex-col gap-3">
          <div className="eyebrow">Historical record · {runs.length} daily runs</div>
          <h1 className="max-w-[22ch] text-balance text-[clamp(28px,3.6vw,40px)] font-bold leading-[1.08] tracking-[-0.03em] text-fg">
            The same measurement, every day since May.
          </h1>
          <p className="max-w-[66ch] text-[15px] font-medium leading-relaxed text-fg-muted">
            A single benchmark is a snapshot; a run every day on the same hardware is a record. This
            is that record — {runs.length} runs from {oldest.date_string} to {run.date_string}, with
            every point linking to the GitHub Actions run that produced it.
          </p>
        </div>

        <AuditBand
          cells={[
            { k: "Runs", v: String(runs.length) },
            { k: "First", v: oldest.date_string },
            { k: "Latest", v: run.date_string },
            { k: "Host", v: shortCpuModel(run.environment.cpu_model) },
            { k: "Instance", v: run.environment.ec2_instance_type },
            { k: "liboqs", v: run.environment.liboqs_version },
          ]}
        />

        <Section
          eyebrow="Over time"
          title="Pick a metric and watch it move — or not."
          hint={`Up to four algorithms at once, so no colour is ever reused for two lines. ${
            totalGaps > 0
              ? `${totalGaps} run-gaps in the default view are shown as breaks, not bridged.`
              : "Breaks in a line are runs with no measurement."
          }`}
        >
          <Suspense fallback={null}>
            <TrendsChart
              algorithms={run.algorithms}
              initial={initial}
              initialSelection={selection}
            />
          </Suspense>
        </Section>

        {/* Rendered unconditionally, not as a Suspense fallback.
            The chart is a client component reading search params, so on a
            force-static page its subtree is not prerendered — anything inside
            that boundary is absent from the served HTML. The summary below is
            the record in plain markup: present for a crawler, present without
            JavaScript, and useful on its own. */}
        <Section
          eyebrow="Summary"
          title="First measurement, latest, and everything between."
          hint="The default selection. Change is first-to-last; read it against the observed range in the next column, not on its own."
        >
          <TrendsSummary data={initial} metricId="mean" />
        </Section>

        <Caveat label="Why the line breaks">
          Other benchmark publishers interpolate: they fit a curve through measured points and read
          a value off it at whatever operating point you ask for. We do not, and the gaps in these
          lines are the visible consequence. A run that did not happen produces no point, and the
          line breaks rather than being drawn through a value nobody measured. If you need a figure
          for a date between two runs, the honest answer is that we do not have one — and the{" "}
          <a
            href="/api/v1/availability"
            className="font-semibold underline decoration-border-strong underline-offset-2 hover:text-accent"
          >
            API
          </a>{" "}
          says the same thing in its own payload.
        </Caveat>

        <Caveat label="Why none of this is called a trend">
          Across these {runs.length} runs the observed range on a single algorithm&rsquo;s keygen
          mean is {Math.round(minSpread)}–{Math.round(maxSpread)}% of its own minimum. Every
          first-to-last change in the table above sits inside that band. So does the largest of
          them: {widest.label} reads {widest.change} end to end, but it alternates between roughly{" "}
          {widest.low} and {widest.high} from one run to the next rather than drifting — the
          endpoints only say which mode each happened to land in.
          <br />
          <br />
          The cause is the host, not the algorithms.{" "}
          {era?.burstable ? (
            <>
              {era.label} is a burstable instance class, so sustained load can change the clock
              underneath a measurement.
            </>
          ) : (
            <>
              {era?.label ?? run.environment.ec2_instance_type} is a fixed-performance instance
              class, which removes burst-credit throttling as a cause but does not by itself make
              a day-to-day trend readable.
            </>
          )}{" "}
          {minSteal != null && maxSteal != null && (
            <>
              CPU steal across this hardware era has ranged from {formatStealPercent(minSteal)} to{" "}
              {formatStealPercent(maxSteal)}.{" "}
            </>
          )}
          We publish this rather than smooth it, and it is the honest reason not to read a trend
          line here as a performance change. Comparisons between algorithms measured in the{" "}
          <strong className="font-bold text-fg">same run</strong> are sound — that is what{" "}
          <a
            href="/q-shield/compare"
            className="font-semibold underline decoration-border-strong underline-offset-2 hover:text-accent"
          >
            compare
          </a>{" "}
          is for. Detecting real change over time would need a dedicated instance, and until there
          is one this page is a record of what we measured, not a claim about what changed.
        </Caveat>

        <Section
          eyebrow="Take the data"
          title="The whole series, as JSON."
          hint="This page reads the same public endpoint you can — no privileged access to its own data."
        >
          <ExportRow
            items={[
              { label: "API reference →", href: "/api", primary: true },
              { label: "Algorithm history", href: `/api/v1/algorithms/${selection[0]}/history` },
              { label: "Run reliability", href: "/api/v1/reliability" },
              { label: "Compare →", href: "/q-shield/compare" },
              { label: "Methodology", href: "/methodology" },
            ]}
          />
        </Section>
      </PageShell>
      <GitHubStarPopup />
    </>
  );
}
