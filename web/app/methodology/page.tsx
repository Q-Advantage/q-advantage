import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/chrome/Header";
import { Footer } from "@/components/chrome/Footer";
import { Breadcrumb } from "@/components/chrome/Breadcrumb";
import { GitHubStarPopup } from "@/components/chrome/GitHubStarPopup";
import { getLatestRun } from "@/lib/data/load";
import { shortCpuModel } from "@/lib/format";

export const metadata: Metadata = {
  title: "Methodology",
  description:
    "How Q-Advantage benchmarks the quantum era: open source, daily GitHub Actions runs, " +
    "vendor-published or peer-reviewed sources only, full environment capture, every figure dated.",
};

/**
 * Methodology page — the public contract.
 *
 * Two sections at full depth:
 *   - Q-Shield: how the PQC benchmarks are produced
 *   - Q-Day Index: how the threat score is computed
 *
 * Plus anchor IDs that the Q-Day Index dashboard's hovercards deep-link to,
 * and a glossary at the bottom for every measurement-method term shown in
 * the data tables.
 *
 * Editorial register (serif headings, prose) matches the marketing site.
 * Q-Shield environment block is pulled live from the latest run so the
 * page can't drift from reality.
 */
export default function MethodologyPage() {
  const run = getLatestRun();
  const env = run.environment;

  return (
    <div className="marketing-bg min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 mx-auto max-w-[760px] px-6 md:px-8 py-12 md:py-16 w-full">
        <Breadcrumb back={{ label: "Home", href: "/" }} current="Methodology" />

        {/* ============ HERO ============ */}
        <div className="mt-8 mb-12">
          <div className="eyebrow mb-4">Methodology</div>
          <h1 className="font-serif text-[clamp(40px,6vw,64px)] font-normal leading-[1.05] tracking-[-0.02em] text-fg mb-5">
            How we build, what we trust, what we won&apos;t do.
          </h1>
          <p className="text-lg text-fg-muted leading-[1.6] font-light">
            The quantum industry runs on press releases and analyst PDFs. Q-Advantage runs on
            GitHub Actions logs and peer-reviewed citations. Everything below is verifiable —
            clone the repo and run it yourself, or click any number on a dashboard and chase its
            source.
          </p>

          <nav aria-label="On this page" className="mt-10 border-t border-b border-border py-5">
            <div className="eyebrow mb-3">On this page</div>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <li><a href="#three-pillars" className="text-fg-muted hover:text-accent transition-colors">Three pillars</a></li>
              <li><a href="#q-shield" className="text-fg-muted hover:text-accent transition-colors">Q-Shield methodology</a></li>
              <li><a href="#q-day-index" className="text-fg-muted hover:text-accent transition-colors">Q-Day Index methodology</a></li>
              <li><a href="#pqc-readiness-index" className="text-fg-muted hover:text-accent transition-colors">PQC Readiness Index methodology</a></li>
              <li><a href="#glossary" className="text-fg-muted hover:text-accent transition-colors">Measurement-method glossary</a></li>
              <li><a href="#challenge" className="text-fg-muted hover:text-accent transition-colors">Challenge a result</a></li>
            </ul>
          </nav>
        </div>

        {/* ============ THREE PILLARS ============ */}
        <section id="three-pillars" className="space-y-8 mb-16 scroll-mt-20">
          <Pillar
            num="01"
            title="Every benchmark, public"
            body="Source code, test parameters, scoring engine, dataset, and full result sets live in a public repository. There is no paywall, no NDA, no proprietary harness. The benchmark script, the result JSONs, the workflow that runs them, and the scoring code that produces the dashboard numbers are all open."
          />
          <Pillar
            num="02"
            title="Every run, auditable"
            body="Q-Shield benchmarks execute on scheduled GitHub Actions, daily at 06:00 UTC, on dedicated self-hosted hardware. Every workflow log is public. Every result commit is timestamped and signed by github-actions[bot]. Each data point on the dashboard links back to the run that produced it."
          />
          <Pillar
            num="03"
            title="Every score, reproducible"
            body="Clone the repository, run the workflow, and you should get numbers within run-to-run variance of ours. For the Q-Day Index, the scoring engine is deterministic against the committed dataset — same inputs produce identical scores to the third decimal. If you can't reproduce a result, that's a bug worth filing."
          />
        </section>

        {/* ====================================================================== */}
        {/* ============ Q-SHIELD ============ */}
        {/* ====================================================================== */}
        <section id="q-shield" className="mb-20 scroll-mt-20">
          <div className="eyebrow mb-3">Section 1</div>
          <h2 className="font-serif text-[clamp(32px,4.5vw,44px)] font-normal leading-[1.1] tracking-[-0.02em] text-fg mb-6">
            Q-Shield — post-quantum cryptography benchmarks
          </h2>
          <p className="text-base text-fg-muted leading-[1.7] font-light mb-12">
            Q-Shield measures the wall-clock performance of the NIST-standardized post-quantum
            algorithms — key generation, key encapsulation/decapsulation for KEMs; key generation,
            signing, and verification for signatures. Re-run daily on dedicated infrastructure with
            CPU pinning and garbage collection disabled during measurement, so scheduler noise
            doesn&apos;t leak into the numbers.
          </p>

          <H3 id="q-shield-how-a-run-works">How a run works</H3>
          <Prose>
            <p>
              Each benchmark measures the three core operations of every algorithm — for KEMs
              that&apos;s key generation, encapsulation, and decapsulation; for signatures it&apos;s
              key generation, signing, and verification. Every operation runs for 1,000 timed
              iterations, preceded by 50 untimed warmup iterations.
            </p>
            <p>
              Timing uses <code>time.perf_counter_ns()</code> with the garbage collector disabled and
              the process pinned to a single CPU core for the duration of measurement, so scheduler
              noise and GC pauses don&apos;t corrupt the measurements. For each operation we record
              mean, median, p95, p99, standard deviation, min, max, and derived throughput
              (operations per second), plus the relevant artifact sizes — public key, private key,
              ciphertext or signature length in bytes.
            </p>
            <p>
              Every run also captures its own runtime conditions in a <code>runtime_metrics</code>
              {" "}block: wall-clock duration, CPU steal-time (delta of Linux kernel steal jiffies
              across the timed loop), and load averages at start and end. On burstable cloud
              instance classes this is essential — non-zero sustained steal-time signals throttling
              that would otherwise silently slow timed iterations. Healthy runs show near-zero steal.
              If a run was throttled, the audit trail shows it.
            </p>
          </Prose>

          <H3 id="q-shield-environment">The environment</H3>
          <p className="text-fg-muted leading-[1.7] mb-6">
            Every result file embeds a complete snapshot of the machine and software stack that
            produced it. Here&apos;s the most recent run&apos;s environment, captured automatically:
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
            Captured live from the latest run committed to GitHub. Not hand-entered.
          </p>

          <H3 id="q-shield-hardware-rationale">Hardware choice and the burstable caveat</H3>
          <Prose>
            <p>
              The current runner is an AWS EC2 t3.medium in us-east-1: a burstable instance class
              with CPU performance guaranteed at a baseline and the ability to burst above when CPU
              credits are available. Under sustained load with depleted credits, the instance
              throttles to baseline — which would silently slow timed iterations unless the audit
              trail catches it.
            </p>
            <p>
              The earlier plan called for a fixed-performance c7i.large migration. We deferred that
              to Month 3 once the <code>runtime_metrics</code> block showed steal-time consistently
              near zero (around 0.24% on representative runs), meaning the burstable instance is
              running clean. Migration will happen when budget or load justifies it; when it does,
              this document will be updated, historical runs from the burstable period will remain
              available, and the hardware change will be explicitly dated. Results will not be
              silently migrated.
            </p>
            <p>
              Access to the runner is through AWS SSM Session Manager (no port 22 open to the
              public internet). The runner itself is registered as a systemd-managed self-hosted
              GitHub Actions runner so it survives reboots and reconnects automatically.
            </p>
          </Prose>

          <H3 id="q-shield-ci-discipline">CI discipline</H3>
          <Prose>
            <p>
              The benchmark workflow at <code>.github/workflows/benchmark.yml</code> has two triggers
              only: scheduled (daily at 06:00 UTC) and manual <code>workflow_dispatch</code>. There
              is deliberately no <code>pull_request</code> trigger — running expensive measurement
              jobs on untrusted PR code is exactly the kind of supply-chain mistake we won&apos;t
              make. A concurrency group on the workflow serializes runs so a second trigger queues
              behind the first rather than racing on result-file writes.
            </p>
            <p>
              <code>permissions:</code> is scoped to <code>contents: write</code> at the workflow
              level (least privilege; we only need to commit the result file back). The bot&apos;s
              commit message includes <code>[skip ci]</code> to prevent the workflow from
              re-triggering on its own commits.
            </p>
          </Prose>

          <H3 id="q-shield-result-files">Result-file layout</H3>
          <Prose>
            <p>
              Each run writes <code>benchmark/results/results-YYYY-MM-DD-{"{short_sha}"}.json</code>
              {" "}— every run is its own file, named by date and the git commit SHA the benchmark
              was running. The dashboard reads the full series so history is preserved on disk and
              every chart point has a stable identity. The loader handles both this filename pattern
              and the older <code>results-YYYY-MM-DD.json</code> pattern from early Week 2 for
              backward compatibility.
            </p>
          </Prose>

          <H3 id="q-shield-software-stack">Software stack</H3>
          <Prose>
            <p>
              <code>liboqs</code> 0.15.0, built from source with{" "}
              <code>-DOQS_DIST_BUILD=ON</code> for runtime CPU dispatch. <code>liboqs-python</code>
              {" "}is pinned to the matching 0.15.0 in a Python 3.12 virtual environment to avoid the
              version-skew warnings that older mismatched pairs produce. The exact versions for the
              latest run appear in the &ldquo;Environment&rdquo; table above and in every result
              file&apos;s <code>environment</code> block.
            </p>
            <p>
              A naming subtlety worth knowing: SLH-DSA variants in liboqs 0.15+ are exposed as{" "}
              <code>SLH_DSA_PURE_SHAKE_128S</code> and <code>SLH_DSA_PURE_SHAKE_128F</code> — the
              <code> PURE</code> prefix and underscored form differ from earlier liboqs releases and
              from some documentation. The benchmark script uses these exact identifiers.
            </p>
          </Prose>

          <H3 id="q-shield-cross-validation">Cross-validation and measurement context</H3>
          <Prose>
            <p>
              Three patterns emerge when Q-Shield results are compared against eBACS/SUPERCOP
              reference cycle counts for the same liboqs 0.15.0 primitives. Understanding them
              is necessary to read the numbers correctly.
            </p>
            <p>
              <strong>ML-KEM: measured faster than eBACS reference (+24&ndash;27%).</strong>{" "}
              ML-KEM-768 decapsulation measures ~48&thinsp;&mu;s on the production box, faster than
              X25519 (~161&thinsp;&mu;s). This is real: AVX2-dispatched lattice arithmetic genuinely
              outperforms elliptic-curve scalar multiplication for this operation, confirmed by
              liboqs reference data. The +24&ndash;27% delta versus eBACS is a methodology
              difference: our harness reuses pre-allocated key material across iterations, whereas
              the liboqs <code>speed_kem</code> tool includes fresh keygen in its timing loop.
              We measure the encapsulation and decapsulation operations in isolation; eBACS
              includes keygen overhead. Net result: our Python harness, despite its binding
              overhead, reports lower latency for encaps/decaps than the eBACS figure.
            </p>
            <p>
              <strong>ML-DSA and Falcon: measured slower than eBACS reference (&minus;28 to &minus;36%).</strong>{" "}
              ML-DSA-44 sign median is 105&thinsp;&mu;s; Falcon-512 sign median is
              343&thinsp;&mu;s. Two causes compound. First, our harness reuses a fixed message
              across iterations; the liboqs <code>speed_sig</code> tool calls{" "}
              <code>OQS_randombytes()</code> per iteration, inflating its reported sign time with
              randomness generation cost. Our times should therefore be <em>lower</em> than eBACS
              &mdash; the fact that they are higher reveals the second cause: t3.medium burstable
              CPU throttling. Under the sustained sequential load of 1,000-iteration loops, CPU
              steal time degrades throughput and the 2.50&thinsp;GHz nominal clock is not
              reliably available. This manifests as elevated sign times and high p99 variance
              (ML-DSA-44 sign p99: 416&thinsp;&mu;s vs. median 105&thinsp;&mu;s &mdash; a 4&times;
              spread). Sign operations are more throttle-sensitive than verify because they are
              compute-heavier. Verify times and keygen times are reliable on the production box;
              sign times for lattice schemes should be read as upper bounds.
            </p>
            <p>
              <strong>SLH-DSA: tight cross-validation (&plusmn;1%).</strong>{" "}
              SLH-DSA-SHAKE-128S sign median is 1,289&thinsp;ms on the production box &mdash; slow
              by design for the small-signature parameter set. The tight agreement with eBACS is
              expected: SLH-DSA is dominated by Keccak/SHA3 hashing, and the SHA3 path on this
              host dispatches to AVX512VL (<code>OQS_USE_SHA3_AVX512VL=1</code>, confirmed in{" "}
              <code>oqsconfig.h</code>) &mdash; the same well-optimised route eBACS exercises.
              Hashing is also less sensitive to burstable throttling than lattice operations.
              The 128F (fast) variant signs in ~61&thinsp;ms at the cost of a larger signature
              (17&thinsp;KB vs. 7.9&thinsp;KB for 128S).
            </p>
            <p>
              The planned migration to a c7i.large dedicated-core instance will eliminate the
              burstable-throttle caveat on lattice sign times. Results before and after migration
              will be annotated as a measurement-environment change, not treated as a continuous
              series.
            </p>
          </Prose>
	  <H3 id="q-shield-algorithms">Algorithms covered</H3>
          <p className="text-fg-muted leading-[1.7] mb-4">
            Q-Shield benchmarks the NIST-standardized post-quantum cryptographic algorithms
            finalized in August 2024 to replace RSA and elliptic-curve cryptography against the
            threat of cryptographically relevant quantum computers:
          </p>
            <p>
              <strong>Cross-arch validation on ARM.</strong>{" "}
              The same suites re-ran on an AWS Graviton3 c7g.large (Ubuntu 24.04 arm64,
              liboqs 0.15.0 built with <code>OQS_DIST_BUILD</code> +{" "}
              <code>OQS_DIST_ARM64_V8_BUILD=1</code>, NEON paths confirmed active in{" "}
              <code>oqsconfig.h</code>). The counterintuitive result &mdash; ML-KEM-768 measured
              faster than X25519 &mdash; holds on ARM: &minus;47.7% on Graviton3 vs &minus;46.9%
              on x86. Confirmed by the underlying liboqs <code>speed_kem</code> reference on both
              hosts, so it is a real property of the algorithms and libraries, not a harness or
              arch artefact. Graviton3 is non-burstable, which also removes the throttle caveat
              on the lattice sign times noted above &mdash; ML-DSA sign medians on ARM sit tight
              across runs where x86 shows right-skew from burst credit depletion.
            </p>
          <ul className="text-fg-muted leading-[1.8] space-y-1 list-disc pl-6 mb-6">
            <li><strong>KEMs (FIPS 203 — ML-KEM):</strong> ML-KEM-512, ML-KEM-768, ML-KEM-1024 (NIST security levels 1, 3, 5)</li>
            <li><strong>Lattice signatures (FIPS 204 — ML-DSA):</strong> ML-DSA-44, ML-DSA-65, ML-DSA-87</li>
            <li><strong>Hash-based signatures (FIPS 205 — SLH-DSA):</strong> SLH_DSA_PURE_SHAKE_128S, SLH_DSA_PURE_SHAKE_128F</li>
          </ul>
          <p className="text-fg-muted leading-[1.7]">
            All measured via the{" "}
            <a
              href="https://github.com/open-quantum-safe/liboqs"
              target="_blank"
              rel="noopener noreferrer"
              className="text-fg hover:text-accent transition-colors underline decoration-border-strong hover:decoration-accent underline-offset-2"
            >
              liboqs
            </a>
            {" "}library from the Open Quantum Safe project. liboqs is a prototyping library, not a
            production cryptographic implementation; numbers are representative of the algorithms
            but should not be cited as authoritative for a specific production deployment.
          </p>

          <div className="mt-8">
            <Link
              href="/q-shield"
              className="inline-flex items-center gap-2 text-sm text-accent hover:gap-3 transition-all"
            >
              See the live Q-Shield benchmarks
              <span aria-hidden>→</span>
            </Link>
          </div>
        </section>

        {/* ====================================================================== */}
        {/* ============ Q-DAY INDEX ============ */}
        {/* ====================================================================== */}
        <section id="q-day-index" className="mb-20 scroll-mt-20">
          <div className="eyebrow mb-3">Section 2</div>
          <h2 className="font-serif text-[clamp(32px,4.5vw,44px)] font-normal leading-[1.1] tracking-[-0.02em] text-fg mb-6">
            Q-Day Index — distance to breaking RSA-2048
          </h2>
          <p className="text-base text-fg-muted leading-[1.7] font-light mb-12">
            The Q-Day Index is a 0–100 score measuring how close today&apos;s quantum hardware is to
            breaking RSA-2048 with Shor&apos;s algorithm. It is the answer to a single question, set
            against a named published target, with every input sourced. The score for nearly every
            machine is zero today, and that is the honest answer.
          </p>

          {/* anchor #q-day-anchor-moving-target — linked from the dashboard hovercards */}
          <H3 id="q-day-anchor-moving-target">The anchor is algorithm-specific, and it&apos;s moving</H3>
          <Prose>
            <p>
              The target the score is computed against is the Gidney 2025 estimate:{" "}
              <a
                href="https://arxiv.org/abs/2505.15917"
                target="_blank"
                rel="noopener noreferrer"
                className="text-fg hover:text-accent transition-colors underline decoration-border-strong hover:decoration-accent underline-offset-2"
              >
                &ldquo;How to factor 2048-bit RSA integers with less than a million noisy qubits&rdquo;
              </a>{" "}
              — roughly 1,000,000 physical qubits, under a week of runtime, to factor RSA-2048 with
              Shor&apos;s algorithm. This is a peer-reviewed resource estimate, not a law of physics,
              and it is the most important caveat on the entire dashboard.
            </p>
            <p>
              The target fell <strong>roughly 20×</strong> in six years on algorithmic and
              error-correction progress alone. The 2019 Gidney &amp; Ekera paper estimated{" "}
              <a
                href="https://arxiv.org/abs/1905.09749"
                target="_blank"
                rel="noopener noreferrer"
                className="text-fg hover:text-accent transition-colors underline decoration-border-strong hover:decoration-accent underline-offset-2"
              >
                20 million qubits over 8 hours
              </a>
              ; the 2025 paper does it in under a million, under a week, with hardware assumptions
              held identical. The scores on the dashboard are distance to that 2025 figure today.
              If the target moves again — and it will — every score moves with it, and the new
              anchor is cited.
            </p>
            <p>
              The scoring formula is built so the anchor can be swapped (for Bitcoin/ECDSA-256,
              RSA-3072, TLS, etc.) by changing one numeric constant. The launch target is RSA-2048
              only.
            </p>
          </Prose>

          <H3 id="q-day-threat-formula">The threat-score formula</H3>
          <Prose>
            <p>The score is computed as a multiplicative gate:</p>
          </Prose>
          <pre className="bg-bg-card border border-border rounded-md p-5 my-5 text-sm font-mono text-fg-muted overflow-x-auto leading-relaxed">
{`Threat = LogicalCapacity
       × FidelityGate
       × ECSignal
       × 100`}
          </pre>
          <Prose>
            <p>
              <strong>LogicalCapacity</strong> is how many standing, error-corrected logical qubits
              the system has divided by what the anchor demands. Today this is zero for every
              scored system — there are no standing, always-on logical qubits anywhere — so the
              entire product zeroes out. That is the honest answer for nearly all hardware.
            </p>
            <p>
              <strong>FidelityGate</strong> is a 0-to-1 multiplier on whether the system&apos;s
              two-qubit gate fidelity clears the fault-tolerance threshold required for that
              system&apos;s error-correction code to actually suppress errors. Below threshold,
              more qubits don&apos;t help — they add more errors than they correct.
            </p>
            <p>
              <strong>ECSignal</strong> rewards systems that have publicly demonstrated a
              below-threshold error-correction result (the next section). Until a system has shown
              error suppression scales with code distance, it has no demonstrated path to standing
              logical qubits, and the multiplier reflects that.
            </p>
            <p>
              The multiplicative structure is the point. Any of the three components going to zero
              takes the score to zero. There is no &ldquo;mostly there&rdquo; halfway state where a
              machine with great qubits but no error correction earns partial credit. Breaking RSA
              requires all of these; the score reflects all of them.
            </p>
          </Prose>

          {/* anchor #q-day-below-threshold-rule */}
          <H3 id="q-day-below-threshold-rule">ECSignal: the below-threshold rule</H3>
          <Prose>
            <p>
              A system earns the ECSignal multiplier only with a publicly reported demonstration
              that adding error-correction code distance reduces logical error rate — the
              fundamental below-threshold result. This is a rule, not editorial: the score reflects
              what has been demonstrated, not what is plausible or claimed.
            </p>
            <p>
              At the time of writing, one system in the dataset clears this bar. That system is not
              named in the hero of the dashboard — the table names it. The frontier is non-zero
              today only because of this rule; as other systems clear the same bar, the ranking
              will shift accordingly.
            </p>
          </Prose>

          {/* anchor #q-day-field-frontier */}
          <H3 id="q-day-field-frontier">Field frontier, not a winner</H3>
          <Prose>
            <p>
              The hero number on the dashboard is the field frontier — the highest threat score
              currently held by any scored machine — not a named winner. The reason is editorial
              hygiene: leading with &ldquo;Vendor X is closest to breaking RSA&rdquo; would be
              equivalent to crowning a winner, which is incompatible with neutrality. The
              per-system table beneath the hero names every machine and its score. The reader
              concludes; we don&apos;t.
            </p>
          </Prose>

          {/* anchor #q-day-readiness-axis */}
          <H3 id="q-day-readiness-axis">The readiness axis — what would change this score</H3>
          <Prose>
            <p>
              The threat score is uncompromising: until a system has standing error-corrected
              logical qubits, the score is zero. But that creates a problem — the dashboard would
              show only one non-zero score and look static. So the dashboard also surfaces a
              separate <strong>readiness</strong> axis, with its own visual treatment (stacked
              bars, never a gauge), showing how far each system has progressed through the
              preconditions: fidelity progress, error-correction progress, scale progress.
            </p>
            <p>
              <strong>Readiness is not the threat score.</strong> It does not measure distance to
              breaking RSA. It measures preconditions assembled. A system can have 80% readiness
              and zero threat at the same time, and that is exactly the situation for most of the
              field today. The two are deliberately rendered as structurally different visuals
              (gauge vs stacked bars) so they can&apos;t be confused.
            </p>
          </Prose>

          {/* anchor #q-day-sourcing-bar */}
          <H3 id="q-day-sourcing-bar">The sourcing bar</H3>
          <Prose>
            <p>
              Every numeric input to the score must come from one of:
            </p>
            <ul className="list-disc pl-6 space-y-1.5">
              <li>A peer-reviewed publication (arXiv preprints accepted to a venue, journal of record)</li>
              <li>An official vendor technical document or specification page</li>
            </ul>
            <p>
              Press releases, blog posts, secondary aggregators, and content-mill restatements{" "}
              <strong>do not clear the bar</strong>. Where a published value differs from a press
              figure, the published value wins and the gap is noted on the row — for example,
              Google&apos;s blog says coherence is &ldquo;approaching 100 µs,&rdquo; the Nature
              paper says 68 µs; the dataset cites the paper. When the bar fails for a given system
              (Atom Computing&apos;s next-generation array hasn&apos;t shipped per-system T1/T2,
              for example), the value is null and a note explains the omission. Null is an honest
              value.
            </p>
            <p>
              Every numeric field also carries: its <strong>source URL</strong>, its{" "}
              <strong>confidence level</strong> (peer-reviewed vs vendor-published), its{" "}
              <strong>measurement method</strong> (XEB vs median ECR error vs randomized
              benchmarking vs direct RB, etc.; see glossary below), and the{" "}
              <strong>date</strong> the figure was true.
            </p>
          </Prose>

          {/* anchor #q-day-cross-method-fidelity */}
          <H3 id="q-day-cross-method-fidelity">Cross-method fidelity: the load-bearing comparability problem</H3>
          <Prose>
            <p>
              The raw two-qubit gate fidelity column on the dashboard is{" "}
              <strong>deliberately not displayed as a ranking</strong>. The reason: a 99.4% from
              Google measured via cross-entropy benchmarking (XEB) is not the same physical
              quantity as a 99.2% from IBM measured via median ECR error, which is not the same as
              a 99.8% from Quantinuum measured via randomized benchmarking on a trapped-ion gate.
              They are different measurement protocols on different physical hardware and they are
              not comparable to the third decimal.
            </p>
            <p>
              Each fidelity value on the dashboard carries its measurement method as a tag (hover
              the tag in any expanded row to see the definition; see also the{" "}
              <a href="#glossary" className="text-fg hover:text-accent transition-colors underline decoration-border-strong hover:decoration-accent underline-offset-2">
                glossary
              </a>{" "}
              below). The scoring formula treats fidelity through the FidelityGate term against the
              fault-tolerance threshold, not as a ranked comparison across vendors — which is the
              only way to use these numbers honestly.
            </p>
          </Prose>

          {/* anchor #q-day-analog-systems */}
          <H3 id="q-day-analog-systems">Analog systems get N/A, not a low score</H3>
          <Prose>
            <p>
              Analog Hamiltonian simulators — QuEra Aquila, Pasqal Orion Alpha — have no
              gate-model two-qubit fidelity in the discrete-gate sense, and no gate-model pathway
              to factoring RSA in the launch scoring sense. They are not bad gate-model machines;
              they are a different category of machine, useful for different physics problems.
            </p>
            <p>
              The score for these systems is shown as explicit <strong>N/A</strong>, never as a low
              numeric score. Conflating &ldquo;category mismatch&rdquo; with &ldquo;low
              performance&rdquo; would be a methodological error.
            </p>
          </Prose>

          {/* anchor #q-day-input-confidence */}
          <H3 id="q-day-input-confidence">Input confidence, surfaced</H3>
          <Prose>
            <p>
              Each scored system carries an aggregate input-confidence rating shown on the row:
            </p>
            <ul className="list-disc pl-6 space-y-1.5">
              <li><strong>High:</strong> all required fields sourced to peer-reviewed publications.</li>
              <li><strong>Medium:</strong> a mix of peer-reviewed and vendor-published sources.</li>
              <li><strong>Low:</strong> primarily vendor-published, with one or more fields lacking a peer-reviewed citation.</li>
            </ul>
            <p>
              The rating is mechanical — it&apos;s computed from the per-field confidence tags, not
              hand-assigned. A high score on a low-confidence row should be read with appropriate
              skepticism.
            </p>
          </Prose>

          {/* anchor #q-day-neutrality */}
          <H3 id="q-day-neutrality">Neutrality firewall</H3>
          <Prose>
            <p>
              No quantum hardware vendor pays for placement, ranking, ordering, or early access on
              the Q-Day Index. The dataset is independent. The hero is the field frontier, not a
              named machine. The per-system table presents every system at the same depth, with
              every input sourced. If we ever take vendor sponsorship of any kind, it will be
              announced publicly, with the terms in writing, and the affected rows will be
              flagged.
            </p>
          </Prose>

          <H3 id="q-day-projection">On projecting a Q-Day year</H3>
          <Prose>
            <p>
              We do not publish a projected Q-Day year. A projection is only as good as its
              underlying trajectory model, and we have not yet built one that survives hostile
              inspection. The historical entries in the dataset (Sycamore 2019, Eagle 2021, Condor
              2023) exist so that a future trajectory model has data to fit, but the model itself
              is held internal until it is defensible. When we publish a projected year, the model,
              the assumptions, and the inputs will all be open at the same time. Anything else
              would be a guess dressed up as analysis.
            </p>
          </Prose>

          <div className="mt-8">
            <Link
              href="/q-day-index"
              className="inline-flex items-center gap-2 text-sm text-accent hover:gap-3 transition-all"
            >
              See the live Q-Day Index
              <span aria-hidden>→</span>
            </Link>
          </div>
        </section>

        {/* ====================================================================== */}
        {/* ============ PQC READINESS INDEX ============ */}
        {/* ====================================================================== */}
        <section id="pqc-readiness-index" className="mb-20 scroll-mt-20">
          <div className="eyebrow mb-3">Section 3</div>
          <h2 className="font-serif text-[clamp(32px,4.5vw,44px)] font-normal leading-[1.1] tracking-[-0.02em] text-fg mb-6">
            PQC Readiness Index — key exchange vs. authentication, named
          </h2>
          <p className="text-base text-fg-muted leading-[1.7] font-light mb-12">
            A weekly, per-institution measurement of the observable post-quantum posture of named
            banks, exchanges, card networks, and certificate authorities — negotiated TLS version,
            key-exchange group, and certificate chain, nothing more. Two tracks, never merged into
            one score.
          </p>

          <H3 id="pqc-what-is-measured">What is measured, and what isn&apos;t</H3>
          <Prose>
            <p>
              Every measurement is an ordinary TLS handshake with a publicly-advertised hostname on
              a standard port — the same handshake any browser completes visiting the page. We
              record only the negotiated protocol parameters the server voluntarily presents:
              highest negotiated TLS version, whether TLS 1.2 is still accepted, which key-exchange
              groups the server accepts when offered, and the certificate chain&apos;s metadata
              (signature algorithm, public key algorithm, key size, issuer, validity dates).
            </p>
            <p>
              We never authenticate, never scan for vulnerabilities, never touch a non-standard
              port, and never parse or store page content. If an endpoint blocks, rate-limits, or
              refuses a connection, that is the answer — it is recorded as not measurable and we
              move on. We do not work around it.
            </p>
          </Prose>

          <H3 id="pqc-support-not-preference">Support, not preference</H3>
          <Prose>
            <p>
              Key-exchange group support is measured by connecting once per candidate group and
              observing whether the server accepts it — not by reading which group the server
              happens to negotiate by default when several are offered. &ldquo;Accepts
              X25519MLKEM768 when it&apos;s the only group offered&rdquo; and &ldquo;prefers it in
              a normal handshake&rdquo; are different claims. Conflating them is the first
              correction request we would receive, and would deserve.
            </p>
          </Prose>

          <H3 id="pqc-two-track">The two-track model, and why it&apos;s never merged</H3>
          <Prose>
            <p>
              <strong>KEX</strong> is the share of an institution&apos;s measurable endpoints that
              accept at least one hybrid post-quantum key-exchange group
              (<code>X25519MLKEM768</code>, <code>SecP256r1MLKEM768</code>). <strong>AUTH</strong>
              {" "}is the share presenting a post-quantum or hybrid certificate signature. They are
              reported side by side, always, never combined into one number.
            </p>
            <p>
              The reason is the finding the whole index exists to surface: as of this methodology
              version, ML-DSA is not permitted in publicly-trusted TLS certificates at all — the
              CA/Browser Forum&apos;s Baseline Requirements (v2.2.9 §6.1.5) permit only RSA and
              ECDSA key pairs, full stop. AUTH is at or near zero across the entire index today, by
              construction, while KEX moves. A single composite score would average those two facts
              into a misleading middle, exactly hiding the finding.
            </p>
            <p>
              An institution with zero measurable endpoints (every endpoint blocked, unreachable,
              or excluded) shows <strong>&ldquo;—&rdquo;</strong> in both tracks, never
              {" "}<strong>0%</strong>. Those are different claims — one is &ldquo;we don&apos;t
              know,&rdquo; the other is a specific, false &ldquo;we know, and the answer is
              none.&rdquo;
            </p>
          </Prose>

          <H3 id="pqc-hygiene-flags">Hygiene flags — not scored, always shown</H3>
          <Prose>
            <p>
              Four flags are recorded and displayed on every row, independent of the two-track
              score: whether TLS 1.2 is still accepted, a weak or deprecated certificate signature
              algorithm, a certificate key below the recommended minimum size, and a certificate
              that is expired or within 90 days of expiry. These are not scored — they are shown
              because they are independently worth knowing, and folding them into a score would
              obscure which specific thing is wrong.
            </p>
          </Prose>

          <H3 id="pqc-pinned-client">The pinned client configuration</H3>
          <Prose>
            <p>
              Negotiated parameters depend on the client as well as the server — the measurement
              paper this index builds on notes this explicitly. Every scan run publishes its exact
              client configuration (OpenSSL version, offered group list, candidate groups probed)
              as a hash stamped on every record. A configuration change is a methodology-version
              change, dated and disclosed, never a silent shift in what a score means.
            </p>
          </Prose>

          <H3 id="pqc-institution-selection">Institution and endpoint selection</H3>
          <Prose>
            <p>
              Institutions are drawn from public regulator and association listings — the
              Financial Stability Board&apos;s G-SIB list, national bank-holding-company and
              systemic-institution lists (US Federal Reserve, EU EBA O-SII list, UK ring-fencing
              regime), the CA/Browser ecosystem&apos;s own trusted-root reports, and well-known card
              networks — never scraped or crawled. Endpoints (the specific hostnames measured per
              institution) are discovered only from what the institution has itself published:
              linked login pages, announced developer portals, documented mobile endpoints. No
              endpoint is guessed from a naming convention and left unverified.
            </p>
          </Prose>

          <H3 id="pqc-rate-limits">Rate limits and identification</H3>
          <Prose>
            <p>
              At most one connection per second to any single hostname; at most one concurrent
              connection to any one institution; a full sweep once per week. Any connection refusal
              or reset ends measurement of that host for the entire sweep immediately — not just
              the probe that hit it. The scanning source is a single, stable, publicly-disclosed
              address with correct reverse DNS and a monitored abuse contact, so any institution
              that notices the traffic can identify it and request exclusion.
            </p>
          </Prose>

          <H3 id="pqc-exclusion">Exclusion, honestly labeled</H3>
          <Prose>
            <p>
              Any institution may request exclusion from measurement, unconditionally, without
              justification. An excluded institution is not silently removed from the index and is
              not scored as zero — its row states plainly &ldquo;excluded at the institution&apos;s
              request,&rdquo; dated, with no score in either track. Silent removal would let the
              index be edited by whoever complains; scoring an exclusion as zero would make opting
              out punitive. Naming the exclusion is the only version that is neither.
            </p>
          </Prose>

          <H3 id="pqc-right-of-reply">Right of reply</H3>
          <Prose>
            <p>
              Every institution sees its own complete data — every endpoint, every negotiated
              parameter, both track scores — before its row is ever published for the first time,
              with 14 calendar days to respond. Material changes (a track score crossing a
              published threshold, a new hygiene flag) trigger a shorter notice window before the
              change goes live. Silence is not consent and is not a veto — after the window elapses
              without response, publication proceeds with a note that reply was invited.
            </p>
          </Prose>

          <H3 id="pqc-corrections">Corrections and disputes</H3>
          <Prose>
            <p>
              A permanent, published address plus a correction link on every row accepts reports
              from anyone, not only the rated institution. Every report is acknowledged within 5
              business days; a disputed row is marked <strong>disputed</strong> publicly while under
              review. A confirmed correction updates the row, carries a visible correction notice
              for one full refresh cycle, and gets a dated entry in a permanent public corrections
              log — a wrong number is never silently fixed.
            </p>
          </Prose>

          <H3 id="pqc-cdn-caveat">Known limitation: CDN attribution</H3>
          <Prose>
            <p>
              Some measured posture reflects a CDN or edge provider in front of an institution
              rather than the institution&apos;s own infrastructure — &ldquo;your PQ readiness is
              rented&rdquo; is itself part of the finding, per the spec this index is built from.
              Automatic CDN detection and per-row attribution is specified but not yet built; until
              it is, a strong key-exchange score should be read with that caveat in mind, not as a
              claim about the institution&apos;s own stack.
            </p>
          </Prose>

          <H3 id="pqc-independence">Independence</H3>
          <Prose>
            <p>
              Rated institutions may buy data, reports, and analyst time. They receive no influence
              over methodology, scoring, their own position, or publication timing. No pre-publication
              access exists beyond right of reply, identical for customers and non-customers. We do
              not sell migration tools or remediation services to a rated institution — selling the
              fix for the problem we score would end the only thing that makes the score worth
              reading.
            </p>
          </Prose>

          <div className="mt-8">
            <Link
              href="/pqc-readiness-index"
              className="inline-flex items-center gap-2 text-sm text-accent hover:gap-3 transition-all"
            >
              See the PQC Readiness Index
              <span aria-hidden>→</span>
            </Link>
          </div>
        </section>

        {/* ====================================================================== */}
        {/* ============ GLOSSARY ============ */}
        {/* ====================================================================== */}
        <section id="glossary" className="mb-16 scroll-mt-20">
          <div className="eyebrow mb-3">Glossary</div>
          <h2 className="font-serif text-[clamp(28px,3.5vw,38px)] font-normal leading-[1.1] tracking-[-0.02em] text-fg mb-6">
            Measurement methods, in one place
          </h2>
          <p className="text-fg-muted leading-[1.7] mb-8">
            Every fidelity, coherence, and readout figure on the Q-Day Index dashboard is tagged
            with the measurement method that produced it. These tags are not interchangeable —
            different methods measure different physical quantities. Hover any tag on a row in the
            dashboard, or read the definitions below.
          </p>

          <dl className="space-y-5">
            <Term id="glossary-median-ECR-error" name="Median ECR error">
              Median error of IBM&apos;s echoed cross-resonance two-qubit gate, taken across the
              device&apos;s qubit pairs. IBM&apos;s native 2-qubit metric on superconducting
              transmon hardware.
            </Term>
            <Term id="glossary-randomized-benchmarking" name="Randomized benchmarking (RB)">
              A protocol that estimates gate fidelity by running random sequences of Clifford
              gates and fitting the decay of the survival probability. Isolates gate error from
              state-preparation and measurement (SPAM) error.
            </Term>
            <Term id="glossary-direct-RB" name="Direct RB">
              A streamlined randomized-benchmarking variant that measures gate error more
              directly per-gate-type. Used by IonQ for Forte&apos;s two-qubit fidelity.
            </Term>
            <Term id="glossary-XEB" name="Cross-entropy benchmarking (XEB)">
              Fidelity estimated from sampling distributions of random quantum circuits. Google&apos;s
              headline metric for Sycamore and Willow.
            </Term>
            <Term id="glossary-XEB-and-logical-error-per-cycle" name="XEB + logical error per cycle">
              Google&apos;s preferred way of reporting Willow: random-circuit XEB on the physical
              qubits combined with logical error per error-correction cycle. The load-bearing
              signal is error correction below threshold, not an isolated 2-qubit fidelity number.
            </Term>
            <Term id="glossary-simultaneous-gate-fidelity" name="Simultaneous gate fidelity">
              Gate fidelity measured with multiple gates running in parallel — a stricter, more
              realistic figure than isolated single-pair measurements.
            </Term>
            <Term id="glossary-median-iSWAP-fidelity" name="Median iSWAP fidelity">
              Median fidelity of the general-purpose iSWAP two-qubit gate, used by Rigetti as the
              universal-gate metric.
            </Term>
            <Term id="glossary-median-fSim-fidelity" name="Median fSim fidelity">
              Median fidelity of the specialized fSim gate used primarily for random-circuit
              sampling. Higher than the universal iSWAP fidelity on the same hardware; not a
              substitute for general-purpose computation.
            </Term>
            <Term id="glossary-vendor-reported-2Q-fidelity" name="Vendor-reported 2Q fidelity">
              A two-qubit fidelity stated by the vendor without a published benchmarking protocol.
              Flagged with lower confidence than RB- or XEB-tagged values.
            </Term>
            <Term id="glossary-analog-not-applicable" name="Analog (not applicable)">
              The system is an analog Hamiltonian simulator, not a gate-model machine. It has no
              discrete two-qubit gate, so gate fidelity does not apply.
            </Term>
            <Term id="glossary-device-specification" name="Device specification">
              Value taken from the vendor&apos;s published device specification sheet.
            </Term>
            <Term id="glossary-surface-code-demonstration" name="Surface-code demonstration">
              A logical qubit shown via a surface-code error-correction experiment, not standing
              hardware. The logical qubit exists only during the experiment.
            </Term>
            <Term id="glossary-surface-code-lambda-2.14" name="Surface code Λ = 2.14">
              Willow&apos;s headline result: logical error suppressed by a factor of 2.14 per
              added code distance. This is the below-threshold result that earns ECSignal on the
              Q-Day Index.
            </Term>
            <Term id="glossary-median-SX-error" name="Median SX error">
              Median error of the single-qubit SX gate, an IBM single-qubit baseline.
            </Term>
            <Term id="glossary-median-device-snapshot" name="Median device snapshot">
              A dated median across the device&apos;s qubits, not a live calibration reading.
              Reproducible because the date and the median are fixed.
            </Term>
            <Term id="glossary-mean-T1" name="Mean T1">
              Average energy-relaxation time across qubits, in microseconds for superconducting
              devices.
            </Term>
            <Term id="glossary-T2-CPMG" name="T2 CPMG">
              Phase-coherence time measured using the Carr–Purcell–Meiboom–Gill (CPMG) pulse
              sequence — a dynamical decoupling protocol that suppresses low-frequency noise.
            </Term>
            <Term id="glossary-readout-fidelity" name="Readout fidelity">
              Probability that a qubit&apos;s state is measured correctly. Distinct from gate
              fidelity.
            </Term>
            <Term id="glossary-average-coherence-time" name="Average coherence time">
              A single averaged coherence figure used when T1 and T2 are not separately reported.
            </Term>
            <Term id="glossary-clifford-RB" name="Clifford RB">
              Randomized benchmarking over Clifford gates — the standard single-qubit fidelity
              method.
            </Term>
            <Term id="glossary-publication-date" name="Publication date">
              The figure is dated by its peer-reviewed publication.
            </Term>
          </dl>
        </section>

        {/* ====================================================================== */}
        {/* ============ CHALLENGE ============ */}
        {/* ====================================================================== */}
        <section id="challenge" className="border-t border-border pt-10 scroll-mt-20">
          <h2 className="font-serif text-2xl font-normal tracking-tight text-fg mb-4">
            How to challenge a result
          </h2>
          <p className="text-fg-muted leading-[1.7] mb-4">
            Open a GitHub issue, a pull request, or use the feedback form at the bottom of the
            Q-Day Index page. Every Q-Shield run logs <code>git_commit</code>, <code>cpu_model</code>,
            and full environment in its result file. Every Q-Day Index figure has its source URL,
            measurement method, and date attached. If you can reproduce a Q-Shield discrepancy of
            more than 2 standard deviations on equivalent hardware, or if you have a sourced
            correction for a Q-Day Index value, we want to hear about it.
          </p>
          <div className="flex flex-wrap gap-3 mt-6">
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
              href="https://github.com/Q-Advantage/q-advantage/issues/new"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-[22px] py-[13px] bg-transparent text-fg rounded-lg text-sm font-normal border border-border-strong hover:border-fg-muted transition-colors"
            >
              Open an issue
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
      </main>
      <Footer />
      <GitHubStarPopup />
    </div>
  );
}

// ---------------------------------------------------------------------------

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

function H3({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h3 id={id} className="font-serif text-[22px] md:text-2xl font-normal text-fg mt-10 mb-4 tracking-[-0.01em] scroll-mt-20">
      {children}
    </h3>
  );
}

function Prose({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-4 text-fg-muted leading-[1.75] [&_code]:font-mono [&_code]:text-[13px] [&_code]:bg-bg-card [&_code]:border [&_code]:border-border [&_code]:rounded [&_code]:px-1.5 [&_code]:py-0.5 [&_strong]:text-fg [&_strong]:font-medium">
      {children}
    </div>
  );
}

function Term({ id, name, children }: { id: string; name: string; children: React.ReactNode }) {
  return (
    <div id={id} className="border-l border-border-strong pl-4 scroll-mt-20">
      <dt className="text-fg font-medium text-[15px] mb-1">{name}</dt>
      <dd className="text-sm text-fg-muted leading-[1.6]">{children}</dd>
    </div>
  );
}
