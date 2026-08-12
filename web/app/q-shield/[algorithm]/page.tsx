import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { Header } from "@/components/chrome/Header";
import { Footer } from "@/components/chrome/Footer";
import { Breadcrumb } from "@/components/chrome/Breadcrumb";
import { AuditStrip } from "@/components/data/AuditStrip";
import { Sparkline } from "@/components/data/Sparkline";
import { ComplianceBadges } from "@/components/data/ComplianceBadges";
import {
  getAlgorithmHistory,
  getLatestRun,
  loadAllRuns,
} from "@/lib/data/load";
import {
  formatBytes,
  formatDuration,
  formatOpsPerSec,
  githubCommitUrl,
  shortSha,
} from "@/lib/format";
import type {
  NormalizedAlgorithm,
  Operation,
  OperationStats,
} from "@/lib/data/types";

interface PageProps {
  params: { algorithm: string };
}

/**
 * Statically prerender one page per algorithm at build time.
 * The list comes from the latest run's algorithm set.
 */
export function generateStaticParams() {
  const latest = getLatestRun();
  return latest.algorithms.map((a) => ({ algorithm: a.id }));
}

export function generateMetadata({ params }: PageProps): Metadata {
  const latest = getLatestRun();
  const algo = latest.algorithms_by_id[params.algorithm];
  if (!algo) return { title: "Algorithm not found" };
  return {
    title: `${algo.display_name} — benchmarks`,
    description: `Performance benchmarks for ${algo.display_name} (${algo.family}). Auditable, reproducible, public.`,
  };
}

export default function AlgorithmPage({ params }: PageProps) {
  const latest = getLatestRun();
  const algo = latest.algorithms_by_id[params.algorithm];
  if (!algo) notFound();

  const totalRuns = loadAllRuns().length;

  // KEMs have keygen/encap/decap; signatures have keygen/sign/verify
  const operations: Operation[] =
    algo.kind === "kem"
      ? ["keygen", "encap", "decap"]
      : ["keygen", "sign", "verify"];

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 mx-auto max-w-[1200px] px-6 md:px-8 py-10 md:py-12 w-full space-y-10">
        <Breadcrumb back={{ label: "Q-Shield", href: "/q-shield" }} current={algo.display_name} />

        {/* Header */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="eyebrow">{algo.family}</span>
            <span className="text-fg-faint">·</span>
            <span className="text-2xs uppercase tracking-eyebrow text-fg-subtle">
              {algo.kind === "kem" ? "Key encapsulation" : "Digital signature"}
            </span>
            <span className="text-fg-faint">·</span>
            <span className="text-2xs uppercase tracking-eyebrow text-fg-subtle">
              NIST level {algo.nist_level}
            </span>
          </div>
          <h1 className="font-serif text-[clamp(36px,5vw,56px)] font-normal leading-[1.05] tracking-[-0.02em] text-fg">
            {algo.display_name}
          </h1>
          <p className="text-base text-fg-muted max-w-2xl leading-relaxed font-light">
            {describeAlgorithm(algo)}
          </p>
          {algorithmNote(algo) && (
            <div className="max-w-2xl mt-1 flex gap-2.5 px-4 py-3 border border-status-warn/25 bg-status-warn/[0.06] rounded-md">
              <span className="text-status-warn text-sm leading-none mt-0.5" aria-hidden>
                ⚠
              </span>
              <p className="text-xs text-fg-muted leading-relaxed">{algorithmNote(algo)}</p>
            </div>
          )}
        </div>

        {/* Audit strip */}
        <AuditStrip run={latest} />

        {/* Static parameters card */}
        <section className="border border-border rounded-md bg-bg-surface">
          <header className="px-4 py-3 border-b border-border">
            <h2 className="text-sm font-semibold text-fg">Parameters</h2>
          </header>
          <dl className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-3 px-4 py-4 text-xs">
            <Field label="Family" value={algo.family} />
            <Field label="Parameter set" value={algo.parameter_set} />
            <Field label="Public key" value={formatBytes(algo.pubkey_bytes)} mono />
            <Field label="Private key" value={formatBytes(algo.privkey_bytes)} mono />
            {algo.kind === "kem" && (
              <Field
                label="Ciphertext"
                value={formatBytes(algo.ciphertext_bytes!)}
                mono
              />
            )}
            {algo.kind === "sig" && (
              <Field
                label="Signature"
                value={formatBytes(algo.signature_bytes!)}
                mono
              />
            )}
            <Field
              label="Iterations / op"
              value={(algo.operations[operations[0]]!.n_iterations).toLocaleString("en-US")}
              mono
            />
            <Field label="liboqs key" value={algo.liboqs_key} mono />
          </dl>
        </section>

        {/* Regulatory approval status */}
        <ComplianceBadges family={algo.family} />

        {/* One section per operation: stats + sparkline */}
        {operations.map((op) => {
          const stats = algo.operations[op];
          if (!stats) return null;
          const history = getAlgorithmHistory(algo.id, op);
          return (
            <OperationSection
              key={op}
              operation={op}
              stats={stats}
              totalRuns={totalRuns}
              history={history.map((h) => ({
                timestamp: h.run.environment.iso_timestamp,
                mean_us: h.mean_us,
                p95_us: h.p95_us,
                full_sha: h.run.full_sha,
                short_sha: shortSha(h.run.full_sha),
              }))}
            />
          );
        })}
      </main>
      <Footer />
    </div>
  );
}

interface OperationSectionProps {
  operation: Operation;
  stats: OperationStats;
  totalRuns: number;
  history: {
    timestamp: string;
    mean_us: number;
    p95_us: number;
    full_sha: string;
    short_sha: string;
  }[];
}

function OperationSection({ operation, stats, totalRuns, history }: OperationSectionProps) {
  return (
    <section className="border border-border rounded-md bg-bg-surface overflow-hidden">
      <header className="px-4 py-3 border-b border-border flex items-baseline justify-between gap-4 flex-wrap">
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-fg uppercase text-xs tracking-wider font-medium">
            {operation}
          </span>
          <span className="text-2xs text-fg-subtle">{describeOperation(operation)}</span>
        </div>
        <div className="eyebrow">
          {history.length} of {totalRuns} run{totalRuns === 1 ? "" : "s"}
        </div>
      </header>

      {/* Stat grid */}
      <dl className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-x-4 gap-y-3 px-4 py-4 text-xs border-b border-border-subtle">
        <StatField label="Mean" value={formatDuration(stats.mean_us)} highlight />
        <StatField label="Median" value={formatDuration(stats.median_us)} />
        <StatField label="p95" value={formatDuration(stats.p95_us)} />
        <StatField label="p99" value={formatDuration(stats.p99_us)} />
        <StatField label="Stdev" value={formatDuration(stats.stdev_us)} />
        <StatField label="Min" value={formatDuration(stats.min_us)} />
        <StatField label="Ops/sec" value={formatOpsPerSec(stats.ops_per_sec)} highlight />
      </dl>

      {/* Sparkline */}
      <div className="px-4 py-4">
        <div className="eyebrow mb-2">Mean over time</div>
        <Sparkline data={history} height={140} full />
        <p className="text-2xs text-fg-subtle mt-2">
          Click any point to view the GitHub Actions run that produced it.
        </p>
      </div>
    </section>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="eyebrow mb-1">{label}</dt>
      <dd className={`text-fg truncate ${mono ? "font-mono tabular-nums" : ""}`}>
        {value}
      </dd>
    </div>
  );
}

function StatField({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="eyebrow mb-1">{label}</dt>
      <dd
        className={`font-mono tabular-nums truncate ${
          highlight ? "text-fg text-sm" : "text-fg-muted"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

function algorithmNote(algo: NormalizedAlgorithm): string | null {
  // Parameter-set-specific advisories. Keyed off the canonical id.
  switch (algo.id) {
    case "ml-kem-512":
      return "ML-KEM-512 targets NIST security level 1 — the lowest of the standardized parameter sets. Most deployments choosing a post-quantum KEM today select ML-KEM-768 (level 3) as the default; 512 is benchmarked here for completeness and for constrained environments, not as a general recommendation.";
    case "slh-dsa-shake-128s":
      return "The \u201Cs\u201D (small) variant optimizes for signature size at the cost of signing speed — note the sign time is measured in seconds, not microseconds. Choose the \u201Cf\u201D (fast) variant when signing throughput matters more than signature size.";
    default:
      return null;
  }
}

function describeAlgorithm(algo: NormalizedAlgorithm): string {
  if (algo.family === "ML-KEM") {
    return "ML-KEM (FIPS 203) is a lattice-based key encapsulation mechanism, standardized by NIST in August 2024. It replaces RSA and elliptic-curve Diffie-Hellman for establishing shared secrets in a post-quantum world.";
  }
  if (algo.family === "ML-DSA") {
    return "ML-DSA (FIPS 204) is a lattice-based digital signature scheme, standardized by NIST in August 2024. Built on Module Learning With Errors, it offers fast verification and moderate signature sizes.";
  }
  return "SLH-DSA (FIPS 205) is a stateless hash-based signature scheme, standardized by NIST in August 2024. It relies only on the security of cryptographic hash functions — no number-theoretic assumptions. Larger signatures and slower signing, but the most conservative security basis.";
}

function describeOperation(op: Operation): string {
  switch (op) {
    case "keygen":
      return "Generate a fresh key pair.";
    case "encap":
      return "Encapsulate: produce a shared secret and ciphertext under the recipient's public key.";
    case "decap":
      return "Decapsulate: recover the shared secret from the ciphertext using the private key.";
    case "sign":
      return "Produce a signature over a message using the private key.";
    case "verify":
      return "Verify a signature against a message and public key.";
  }
}
