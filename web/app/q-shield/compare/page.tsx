import type { Metadata } from "next";
import { PageShell } from "@/components/chrome/PageShell";
import { AuditBand, Section } from "@/components/product/kit";
import { shortCpuModel, formatStealPercent } from "@/lib/format";
import { computeStealPercent } from "@/lib/format";
import { CompareViewTabs } from "@/components/data/CompareViewTabs";
import { ComparisonIndex } from "@/components/data/ComparisonIndex";
import { HybridVsClassical } from "@/components/data/HybridVsClassical";
import { getLatestRun } from "@/lib/data/load";
import { loadProtocolsData } from "@/lib/protocols/load";
import { GITHUB_REPO } from "@/lib/format";
import {
  getComparisonGroups,
  countTotalPairs,
} from "@/lib/data/comparison-pairs";

export const metadata: Metadata = {
  title: "Compare algorithms",
  description:
    "Browse every PQC algorithm pair measured by Q-Shield. ML-KEM, ML-DSA, and SLH-DSA — latency, percentiles, and key sizes from the latest daily run.",
};

// Force static generation — CompareView handles URL state at runtime.
export const dynamic = "force-static";

/**
 * /q-shield/compare — PQC algorithm browse + detail.
 *
 * Two regions:
 *   1. ComparisonIndex (top): the inferencex-style hierarchical browse —
 *      groups, subgroups, pair cards. Static at build time.
 *   2. CompareView (#detail): the existing side-by-side detail picker.
 *      Reads ?a=, ?b=, ?op= from the URL and updates on selection.
 *
 * Clicking a card in the index updates the URL and scrolls to #detail.
 * Direct deep links (?a=X&b=Y&op=Z) still work — backwards compatible.
 */
export default function ComparePage() {
  const run = getLatestRun();
  const groups = getComparisonGroups(run.algorithms);
  const totalPairs = countTotalPairs(groups);

  const protocolsData = loadProtocolsData();
  const protocolArches = Object.keys(protocolsData.byArch);
  const primaryBucket = protocolsData.byArch["x86_64"] ?? protocolsData.byArch[protocolArches[0]];

  return (
    <>
      <PageShell variant="frame" className="space-y-8">

        <div className="flex flex-col gap-3">
          <div className="eyebrow">Head-to-head · measured daily</div>
          <h1 className="text-[clamp(28px,3.6vw,40px)] font-bold leading-[1.05] tracking-[-0.028em] text-fg">
            Every PQC pair, measured.
          </h1>
          <p className="max-w-[66ch] text-[15px] font-medium leading-relaxed text-fg-muted">
            {totalPairs} head-to-head comparisons across ML-KEM, ML-DSA, and
            SLH-DSA. Each opens a side-by-side detail view with latency,
            percentiles, and key sizes — measured daily on the same hardware.
          </p>
        </div>

        <AuditBand
          cells={[
            { k: "Run date", v: run.date_string },
            { k: "Commit", v: run.short_sha ?? run.full_sha.slice(0, 7), tone: "link" },
            { k: "Host", v: shortCpuModel(run.environment.cpu_model) },
            { k: "Instance", v: run.environment.ec2_instance_type },
            { k: "liboqs", v: run.environment.liboqs_version },
            {
              k: "CPU steal",
              v: run.runtime_metrics
                ? formatStealPercent(
                    computeStealPercent(
                      run.runtime_metrics.cpu_steal_seconds,
                      run.runtime_metrics.wall_clock_seconds
                    )
                  )
                : "—",
              tone: "warn",
            },
          ]}
        />

        <ComparisonIndex
          groups={groups}
          algorithmsById={run.algorithms_by_id}
        />

        {primaryBucket && (
          <Section
            eyebrow="Hybrid vs classical"
            title="What turning it on costs inside a real handshake."
            hint="Amplification factor is server bytes returned per client byte sent — not published elsewhere for these suites."
          >
            <HybridVsClassical
              tlsSuites={primaryBucket.tls?.suites}
              sshSuites={primaryBucket.ssh?.suites}
            />
          </Section>
        )}

        {!primaryBucket?.lmsXmss && (
          <div className="border border-dashed border-border rounded-md px-5 py-4 flex items-center justify-between gap-3 flex-wrap">
            <div>
              <span className="text-sm text-fg font-medium">Hash-based signatures (LMS/XMSS)</span>
              <span className="ml-2 text-2xs text-fg-subtle border border-border rounded px-1.5 py-0.5">
                queued — first run pending
              </span>
              <p className="text-xs text-fg-subtle mt-1 max-w-xl leading-relaxed">
                Harness code exists; no real run has landed yet. Shown here rather than left silently
                absent — see <a href="/q-shield/protocols" className="hover:text-accent underline decoration-border-strong underline-offset-2">/q-shield/protocols</a> once it does.
              </p>
            </div>
          </div>
        )}

        <div className="flex items-center justify-end">
          <a
            href={`https://github.com/${GITHUB_REPO}/tree/main/benchmark/results`}
            className="text-xs text-fg-muted hover:text-accent transition-colors"
          >
            Full history on GitHub ↗
          </a>
        </div>

        <div id="detail" className="border-t border-border pt-12 space-y-6 scroll-mt-24">
          <div>
            <div className="eyebrow mb-2">Detail view</div>
            <h2 className="text-[clamp(28px,3.5vw,40px)] font-bold leading-[1.1] tracking-[-0.028em] text-fg">
              Side by side.
            </h2>
            <p className="text-[15px] text-fg-muted mt-2 max-w-2xl leading-relaxed font-medium">
              Pick any two PQC algorithms and an operation. Numbers come from
              the latest daily run, same hardware, same iteration count.
            </p>
          </div>

          <CompareViewTabs algorithms={run.algorithms} />
        </div>
      </PageShell>
    </>
  );
}
