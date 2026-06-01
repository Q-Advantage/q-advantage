import type { Metadata } from "next";
import { Header } from "@/components/chrome/Header";
import { Footer } from "@/components/chrome/Footer";
import { Breadcrumb } from "@/components/chrome/Breadcrumb";
import { GitHubStarPopup } from "@/components/chrome/GitHubStarPopup";
import { AuditStrip } from "@/components/data/AuditStrip";
import { AlgorithmTable } from "@/components/data/AlgorithmTable";
import { PresetComparisons } from "@/components/data/PresetComparisons";
import { getLatestRun } from "@/lib/data/load";

export const metadata: Metadata = {
  title: "Q-Shield — PQC benchmarks",
  description:
    "Independent performance benchmarks for ML-KEM, ML-DSA, and SLH-DSA. Auditable, reproducible, public on GitHub.",
};

export default function QShieldPage() {
  const run = getLatestRun();
  const kems = run.algorithms.filter((a) => a.kind === "kem");
  const sigs = run.algorithms.filter((a) => a.kind === "sig");

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 mx-auto max-w-[1200px] px-6 md:px-8 py-10 md:py-12 w-full space-y-10">
        <Breadcrumb back={{ label: "Home", href: "/" }} current="Q-Shield" />

        {/* Page title block */}
        <div className="flex flex-col gap-3">
          <div className="eyebrow">Q-Shield · PQC benchmarks</div>
          <h1 className="font-serif text-[clamp(36px,5vw,56px)] font-normal leading-[1.05] tracking-[-0.02em] text-fg">
            Post-quantum cryptography, <em className="italic">measured.</em>
          </h1>
          <p className="text-base text-fg-muted max-w-2xl leading-relaxed font-light">
            Independent performance benchmarks for the NIST-standardized PQC
            algorithms — ML-KEM, ML-DSA, and SLH-DSA. Re-run daily on
            auditable infrastructure. Every data point links back to the
            GitHub commit that produced it.
          </p>
        </div>

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
      </main>
      <Footer />
       <GitHubStarPopup />
    </div>
  );
}
