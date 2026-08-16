import type { Metadata } from "next";
import { PageShell } from "@/components/chrome/PageShell";
import { Breadcrumb } from "@/components/chrome/Breadcrumb";
import { GitHubStarPopup } from "@/components/chrome/GitHubStarPopup";
import { AuditStrip } from "@/components/data/AuditStrip";
import { AlgorithmTable } from "@/components/data/AlgorithmTable";
import { PresetComparisons } from "@/components/data/PresetComparisons";
import { getLatestRun } from "@/lib/data/load";
import { getHomeMetrics } from "@/lib/data/home-metrics";
import { StatBand } from "@/components/chrome/ProductNav";
import { formatDuration, formatStealPercent } from "@/lib/format";

export const metadata: Metadata = {
  title: "Q-Shield — PQC benchmarks",
  description:
    "Independent performance benchmarks for ML-KEM, ML-DSA, and SLH-DSA. Auditable, reproducible, public on GitHub.",
};

export default function QShieldPage() {
  const run = getLatestRun();
  const m = getHomeMetrics();
  const kems = run.algorithms.filter((a) => a.kind === "kem");
  const sigs = run.algorithms.filter((a) => a.kind === "sig");

  return (
    <>
      <PageShell variant="frame" className="space-y-10">

        {/* Page title block */}
        <div className="flex flex-col gap-3">
          <div className="eyebrow">FIPS 203 · 204 · 205 · measured daily</div>
          <h1 className="max-w-[20ch] text-balance text-[clamp(28px,3.6vw,40px)] font-bold leading-[1.08] tracking-[-0.03em] text-fg">
            Post-quantum cryptography, measured.
          </h1>
          <p className="max-w-[66ch] text-[15px] font-medium leading-relaxed text-fg-muted">
            Every NIST-standardized post-quantum algorithm, benchmarked on real x86 and ARM silicon
            and composed into full TLS and SSH handshakes. One thousand timed iterations per
            operation, GC disabled, process pinned to a core. Every number links to the run that
            produced it.
          </p>
        </div>

        {/* Headline figures — derived, never literals */}
        <StatBand
          items={[
            {
              k: "Algorithms tracked",
              v: String(run.algorithms.length),
              d: `${kems.length} KEMs, ${sigs.length} signature schemes`,
            },
            {
              k: "Signing spread",
              v: m.signatures ? Math.round(m.signatures.ratio).toLocaleString() : "—",
              unit: m.signatures ? "×" : undefined,
              d: m.signatures
                ? `${m.signatures.fastestName} against ${m.signatures.slowestName}. Both FIPS-approved`
                : "Signature track unavailable for this run",
            },
            {
              k: "Hybrid TLS wire cost",
              v: m.wire ? m.wire.ratio.toFixed(1) : "—",
              unit: m.wire ? "×" : undefined,
              d: m.wire
                ? `${m.wire.hybridBytes.toLocaleString()} B against classical ${m.wire.classicalBytes} B`
                : "Protocol track unavailable for this run",
            },
            {
              k: "Run integrity",
              v: m.run.stealPct != null ? formatStealPercent(m.run.stealPct) : "—",
              d: `CPU steal on ${m.run.instanceType}. Disclosed, not hidden`,
            },
          ]}
        />

        {/* Audit-trail strip — the dashboard's signature element */}
        <AuditStrip run={run} />

        {/* Quick Comparison preset cards */}
        <PresetComparisons />

        {/* KEM table */}
        <AlgorithmTable
          title="Key Encapsulation (KEM)"
          caption="ML-KEM — FIPS 203. Replaces RSA/ECC key exchange."
          algorithms={kems}
          operations={["keygen", "encap", "decap"]}
        />

        {/* Signature table */}
        <AlgorithmTable
          title="Digital Signatures"
          caption="ML-DSA (FIPS 204, lattice-based) and SLH-DSA (FIPS 205, hash-based)."
          algorithms={sigs}
          operations={["keygen", "sign", "verify"]}
        />

        {/* Methodology hint */}
        <aside className="border border-border rounded-md bg-bg-inset px-5 py-4 text-xs text-fg-muted leading-relaxed">
          <p>
            Benchmarks run on a self-hosted GitHub Actions runner with CPU
            pinning and GC disabled during measurement. 1,000 iterations per
            operation. CPU steal-time and load average captured per run so
            burstable-instance throttling is detectable in the audit trail.
            Full methodology and source on{" "}
            <a
              href="https://github.com/Q-Advantage/q-advantage"
              target="_blank"
              rel="noopener noreferrer"
              className="text-fg hover:text-accent transition-colors underline decoration-border-strong hover:decoration-accent underline-offset-2"
            >
              GitHub
            </a>
            .
          </p>
        </aside>
      </PageShell>
       <GitHubStarPopup />
    </>
  );
}
