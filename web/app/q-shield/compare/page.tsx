import type { Metadata } from "next";
import { Header } from "@/components/chrome/Header";
import { Footer } from "@/components/chrome/Footer";
import { Breadcrumb } from "@/components/chrome/Breadcrumb";
import { AuditStrip } from "@/components/data/AuditStrip";
import { CompareView } from "@/components/data/CompareView";
import { ComparisonIndex } from "@/components/data/ComparisonIndex";
import { getLatestRun } from "@/lib/data/load";
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

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 mx-auto max-w-[1200px] px-6 md:px-8 py-10 md:py-12 w-full space-y-12">
        <Breadcrumb back={{ label: "Q-Shield", href: "/q-shield" }} current="Compare" />

        <div className="flex flex-col gap-3">
          <div className="eyebrow">Q-Shield · Compare</div>
          <h1 className="font-serif text-[clamp(36px,5vw,64px)] font-normal leading-[1.05] tracking-[-0.02em] text-fg">
            Every PQC pair, <em className="italic">measured.</em>
          </h1>
          <p className="text-[17px] text-fg-muted max-w-2xl leading-[1.55] font-light">
            {totalPairs} head-to-head comparisons across ML-KEM, ML-DSA, and
            SLH-DSA. Each opens a side-by-side detail view with latency,
            percentiles, and key sizes — measured daily on the same hardware.
          </p>
        </div>

        <AuditStrip run={run} />

        <ComparisonIndex
          groups={groups}
          algorithmsById={run.algorithms_by_id}
        />

        <div id="detail" className="border-t border-border pt-12 space-y-6 scroll-mt-24">
          <div>
            <div className="eyebrow mb-2">Detail view</div>
            <h2 className="font-serif text-[clamp(28px,3.5vw,40px)] font-normal leading-[1.1] tracking-[-0.02em] text-fg">
              Side by <em className="italic">side.</em>
            </h2>
            <p className="text-[15px] text-fg-muted mt-2 max-w-2xl leading-relaxed font-light">
              Pick any two PQC algorithms and an operation. Numbers come from
              the latest daily run, same hardware, same iteration count.
            </p>
          </div>

          <CompareView algorithms={run.algorithms} />
        </div>
      </main>
      <Footer />
    </div>
  );
}
