import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/chrome/Header";
import { Footer } from "@/components/chrome/Footer";
import { Breadcrumb } from "@/components/chrome/Breadcrumb";
import { getLatestRun } from "@/lib/data/load";
import { shortCpuModel } from "@/lib/format";

export const metadata: Metadata = {
  title: "Methodology",
  description:
    "How Q-Advantage benchmarks post-quantum cryptography: open source, daily GitHub Actions runs, reproducible results, full environment capture.",
};

/**
 * Methodology page — the public contract.
 *
 * Editorial register (serif headings, prose) matching the marketing site,
 * not the dense dashboard. Technical details are pulled live from the
 * latest run where possible (CPU, instance, versions) so the page can't
 * drift from reality.
 */
export default function MethodologyPage() {
  const run = getLatestRun();
  const env = run.environment;

  return (
    <div className="marketing-bg min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 mx-auto max-w-[760px] px-6 md:px-8 py-12 md:py-16 w-full">
        <Breadcrumb back={{ label: "Home", href: "/" }} current="Methodology" />

        {/* Hero */}
        <div className="mt-8 mb-12">
          <div className="eyebrow mb-4">Methodology</div>
          <h1 className="font-serif text-[clamp(40px,6vw,64px)] font-normal leading-[1.05] tracking-[-0.02em] text-fg mb-5">
            Receipts, not <em className="italic">press releases.</em>
          </h1>
          <p className="text-lg text-fg-muted leading-[1.6] font-light">
            The quantum industry runs on press releases and analyst PDFs.
            Q-Advantage runs on GitHub Actions logs. Everything below is
            verifiable — clone the repo and run it yourself.
          </p>
        </div>

        {/* Three pillars */}
        <section className="space-y-8 mb-14">
          <Pillar
            num="01"
            title="Every benchmark, public"
            body="Source code, test parameters, and full result sets live in a public repository. There is no paywall, no NDA, no proprietary harness. The benchmark script, the result JSONs, and the workflow that runs them are all open."
          />
          <Pillar
            num="02"
            title="Every run, auditable"
            body="Benchmarks execute on scheduled GitHub Actions, daily at 06:00 UTC, on dedicated self-hosted hardware. Every workflow log is public. Every result commit is timestamped. Each data point on the dashboard links back to the run that produced it."
          />
          <Pillar
            num="03"
            title="Every score, reproducible"
            body="Clone the repository, run the workflow, and you should get numbers within run-to-run variance of ours. The methodology is the contract — if you can't reproduce a result, that's a bug worth filing."
          />
        </section>

        {/* How a run works */}
        <section className="mb-14">
          <h2 className="font-serif text-3xl font-normal tracking-tight text-fg mb-5">
            How a run works
          </h2>
          <div className="space-y-4 text-fg-muted leading-[1.7]">
            <p>
              Each benchmark measures the three core operations of every
              algorithm — for KEMs that&apos;s key generation, encapsulation,
              and decapsulation; for signatures it&apos;s key generation,
              signing, and verification. Every operation runs for 1,000
              iterations.
            </p>
            <p>
              Timing is taken with the garbage collector disabled and the
              process pinned to a single CPU core, so scheduler noise and
              GC pauses don&apos;t leak into the measurements. For each
              operation we record mean, median, p95, p99, standard
              deviation, min, max, and derived throughput (operations per
              second).
            </p>
            <p>
              Every run also captures its own runtime conditions — wall-clock
              duration, CPU steal time, and load average at start and end.
              On burstable cloud instances this is essential: it makes any
              throttling visible in the audit trail rather than silently
              corrupting the numbers. If a run was throttled, you can see it.
            </p>
          </div>
        </section>

        {/* Environment — pulled live */}
        <section className="mb-14">
          <h2 className="font-serif text-3xl font-normal tracking-tight text-fg mb-5">
            The environment
          </h2>
          <p className="text-fg-muted leading-[1.7] mb-6">
            Every result file embeds a complete snapshot of the machine and
            software stack that produced it. Here&apos;s the most recent run&apos;s
            environment, captured automatically:
          </p>
          <dl className="border border-border rounded-lg bg-bg-card divide-y divide-border-subtle">
            <EnvRow label="CPU" value={shortCpuModel(env.cpu_model)} />
            <EnvRow label="Instance type" value={env.ec2_instance_type} />
            <EnvRow label="Cores" value={`${env.cpu_cores_physical} physical / ${env.cpu_cores_logical} logical`} />
            <EnvRow label="OS" value={env.os_release} />
            <EnvRow label="Kernel" value={env.kernel} />
            <EnvRow label="Python" value={env.python_version} />
            <EnvRow label="liboqs" value={env.liboqs_version} />
            <EnvRow label="liboqs-python" value={env.liboqs_python_version} />
          </dl>
          <p className="text-xs text-fg-subtle mt-3">
            Captured live from the latest run committed to GitHub. Not
            hand-entered.
          </p>
        </section>

        {/* Reproduce */}
        <section className="mb-14">
          <h2 className="font-serif text-3xl font-normal tracking-tight text-fg mb-5">
            Reproduce it yourself
          </h2>
          <p className="text-fg-muted leading-[1.7] mb-5">
            The whole point is that you don&apos;t have to take our word for it.
            The benchmark harness, the workflow definition, and every result
            are public.
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href="https://github.com/Q-Advantage/q-advantage"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-[22px] py-[13px] bg-fg text-bg rounded-lg text-sm font-medium hover:-translate-y-px hover:opacity-95 transition-all"
            >
              View the source
              <span aria-hidden>→</span>
            </a>
            <a
              href="https://github.com/Q-Advantage/q-advantage/blob/main/METHODOLOGY.md"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-[22px] py-[13px] bg-transparent text-fg rounded-lg text-sm font-normal border border-border-strong hover:border-fg-muted transition-colors"
            >
              Full methodology doc
            </a>
            <a
              href="https://github.com/Q-Advantage/q-advantage/actions"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-[22px] py-[13px] bg-transparent text-fg rounded-lg text-sm font-normal border border-border-strong hover:border-fg-muted transition-colors"
            >
              GitHub Actions logs
            </a>
          </div>
        </section>

        {/* Standards note */}
        <section className="border-t border-border pt-8">
          <h2 className="font-serif text-2xl font-normal tracking-tight text-fg mb-4">
            On the algorithms
          </h2>
          <p className="text-sm text-fg-muted leading-[1.7]">
            Q-Shield benchmarks the NIST-standardized post-quantum
            algorithms: ML-KEM (FIPS 203) for key encapsulation, ML-DSA
            (FIPS 204) and SLH-DSA (FIPS 205) for digital signatures. These
            are the schemes finalized by NIST in August 2024 to replace
            RSA and elliptic-curve cryptography against the threat of
            cryptographically relevant quantum computers. We benchmark the
            parameter sets across NIST security levels 1 through 5, measured
            via the{" "}
            <a
              href="https://github.com/open-quantum-safe/liboqs"
              target="_blank"
              rel="noopener noreferrer"
              className="text-fg hover:text-accent transition-colors underline decoration-border-strong hover:decoration-accent underline-offset-2"
            >
              liboqs
            </a>{" "}
            library from the Open Quantum Safe project.
          </p>
        </section>

        <div className="mt-12">
          <Link
            href="/q-shield"
            className="inline-flex items-center gap-2 text-sm text-accent hover:gap-3 transition-all"
          >
            See the live benchmarks
            <span aria-hidden>→</span>
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}

function Pillar({ num, title, body }: { num: string; title: string; body: string }) {
  return (
    <div className="border-l-2 border-accent/40 pl-6">
      <div className="font-mono text-xs text-fg-subtle mb-2 tracking-[0.05em]">{num}</div>
      <h3 className="font-serif text-2xl font-normal mb-2 tracking-[-0.01em] text-fg">{title}</h3>
      <p className="text-sm text-fg-muted leading-[1.7]">{body}</p>
    </div>
  );
}

function EnvRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <dt className="text-xs uppercase tracking-eyebrow text-fg-subtle font-mono">{label}</dt>
      <dd className="text-sm text-fg font-mono tabular-nums text-right">{value}</dd>
    </div>
  );
}
