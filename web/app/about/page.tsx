import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/chrome/Header";
import { Footer } from "@/components/chrome/Footer";
import { PageShell } from "@/components/chrome/PageShell";
import { Breadcrumb } from "@/components/chrome/Breadcrumb";
import { GitHubStarPopup } from "@/components/chrome/GitHubStarPopup";

export const metadata: Metadata = {
  title: "About — Q-Advantage",
  description:
    "Independent, vendor-neutral benchmarks and analysis for the post-quantum transition. " +
    "Q-Shield measures how the standardized PQC algorithms actually perform, every day.",
};

const GITHUB_ORG = "https://github.com/Q-Advantage";
const GITHUB_REPO = "https://github.com/Q-Advantage/q-advantage";

export default function AboutPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <PageShell variant="panel">
        <Breadcrumb back={{ label: "Home", href: "/" }} current="About" />

        {/* ============ HERO ============ */}
        <section className="mt-8 md:mt-10 max-w-[820px]">
          <div className="eyebrow mb-4">About Q-Advantage</div>
          <h1 className="text-[clamp(32px,4.6vw,54px)] font-bold leading-[1.06] tracking-[-0.03em] text-fg text-balance">
            The independent measurement layer over the post-quantum migration.
          </h1>
          <p className="mt-7 text-lg leading-[1.6] text-fg-muted font-medium">
            NIST finished choosing the algorithms. What is left is harder and more expensive: every
            organisation now has to decide when to turn post-quantum encryption on, and what it costs
            them — in latency, in connections per core, in bytes on the wire, in hardware bought
            sooner than planned. Nobody neutral has priced that.
          </p>
          <p className="mt-5 text-lg leading-[1.6] text-fg-muted font-medium">
            We exist to make it measurable. Our mission is to make the true cost of post-quantum
            cryptography independently verifiable, so a migration decision can be checked instead of
            trusted. Every benchmark re-runs on a schedule. Every figure links to the run or the
            cited source that produced it.
          </p>
          <p className="mt-5 text-lg leading-[1.6] text-fg font-semibold">
            We do not sell migration tools, and we never will. Selling them would destroy the only
            thing the market actually needs from us.
          </p>
        </section>

        {/* ============ THREE PRODUCTS — expanded ============ */}
        <section className="mt-20 md:mt-24">
          <div className="eyebrow mb-5">What we measure</div>
          <h2 className="text-[clamp(28px,3.8vw,42px)] font-bold leading-[1.1] tracking-[-0.022em] text-fg mb-3">
            We measure, track, rate, and price.
          </h2>
          <p className="text-base text-fg-muted leading-[1.6] font-medium max-w-[760px] mb-12">
            Four instruments, each answering a different part of the same question. Two are live
            today; the rating and the cost calculator are named here honestly as not yet published,
            rather than pre-announced as shipped. The discipline is identical across all of them:
            vendor-published or peer-reviewed sources only, every figure dated and methodology-tagged,
            every result reproducible from a public commit.
          </p>

          <div className="space-y-10">
            <ProductBlock
              status="live"
              name="Q-Day Index"
              tag="The threat horizon"
              href="/q-day-index"
              measures="A 0–100 score for how close today's quantum hardware is to breaking RSA-2048, computed against a named, published resource estimate (Gidney 2025, currently &lt;1M physical qubits)."
              methodology="A multiplicative-gate score: distance is governed by logical-qubit capacity, two-qubit gate fidelity at the fault-tolerance threshold, and a multiplier rewarding a demonstrated below-threshold error-correction result. Every system's inputs come from a vendor data sheet or peer-reviewed paper, with the measurement method (XEB vs ECR vs randomized benchmarking) surfaced alongside the value. The 'readiness' axis — preconditions assembled toward breaking RSA — is shown as a separate, structurally different visual so the two are never confused."
              status_note="Eight scored systems plus two analog (N/A) entries and four footnoted candidates. Frontier sits in the low single digits today; the trajectory is the story."
            />
            <ProductBlock
              status="live"
              name="Q-Shield"
              tag="PQC benchmarks · daily"
              href="/q-shield"
              measures="Independent performance benchmarks for the NIST-standardized post-quantum cryptographic algorithms — ML-KEM (FIPS 203), ML-DSA (FIPS 204), and SLH-DSA (FIPS 205)."
              methodology="Each algorithm is benchmarked across keygen, encap/decap (KEMs) and sign/verify (signatures) on a self-hosted GitHub Actions runner. CPU pinned to a single core, garbage collection disabled during measurement, 1,000 timed iterations per operation after 50 warmups. Full environment captured per run — CPU model, kernel version, liboqs version, git SHA, instance type — so every result is reproducible bit-for-bit. CPU steal-time and load average are captured so burstable-instance throttling is visible in the audit trail."
              status_note="Re-runs daily at 06:00 UTC. Every data point on the dashboard deep-links to the exact Actions run that produced it."
            />
          </div>
        </section>

        {/* ============ REPRODUCIBILITY ============ */}
        <section className="mt-20 md:mt-24">
          <div className="eyebrow mb-5">How it works</div>
          <h2 className="text-[clamp(28px,3.8vw,42px)] font-bold leading-[1.1] tracking-[-0.022em] text-fg mb-7">
            Reproducibility is the product.
          </h2>
          <p className="text-base text-fg-muted leading-[1.6] font-medium max-w-[760px] mb-12">
            Every chart, score, and comparison on this site is the output of code in a public repo.
            The recipe, the run, the artifacts, and the result are linked end-to-end so anyone can
            audit, re-run, or fork what we publish.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
            <Pillar
              num="01"
              title="Recipe in the repo."
              desc="The benchmark scripts, the scoring engine, and the dataset live in the public q-advantage repo. Every figure on the dashboard traces back to a versioned file."
            />
            <Pillar
              num="02"
              title="Runs on real hardware."
              desc="Q-Shield benchmarks execute on a self-hosted GitHub Actions runner with CPU pinning and GC disabled during measurement. Full environment captured per run — CPU model, kernel version, liboqs version, git SHA — so every result is reproducible bit-for-bit."
            />
            <Pillar
              num="03"
              title="Public Actions logs."
              desc="Every benchmark run is a public GitHub Actions workflow. Logs and artifacts are retained for 90 days; periodic database snapshots will be published as public releases for longer auditability."
            />
            <Pillar
              num="04"
              title="Every result links back."
              desc="Every data point on the dashboard carries a deep-link to the exact Actions run that produced it. Click a sparkline dot, hit the run page, inspect the logs. No black box."
            />
          </div>

          <div className="mt-12 flex flex-wrap gap-3">
            <a
              href={`${GITHUB_REPO}/actions?query=branch%3Amain`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md border border-border-strong text-sm text-fg-muted hover:text-fg hover:border-fg-muted transition-colors"
            >
              Browse workflow runs
              <span aria-hidden>↗</span>
            </a>
            <a
              href={`${GITHUB_REPO}/tree/main/benchmark`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md border border-border-strong text-sm text-fg-muted hover:text-fg hover:border-fg-muted transition-colors"
            >
              View benchmark recipes
              <span aria-hidden>↗</span>
            </a>
            <a
              href={GITHUB_REPO}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md border border-accent/40 bg-accent/10 text-sm font-medium text-accent hover:bg-accent/15 hover:border-accent/60 transition-colors"
            >
              Source repository
              <span aria-hidden>↗</span>
            </a>
          </div>
        </section>

        {/* ============ INDEPENDENCE + WHO ============ */}
        <section className="mt-20 md:mt-24">
          <div className="eyebrow mb-5">Independence</div>
          <h2 className="text-[clamp(28px,3.8vw,42px)] font-bold leading-[1.1] tracking-[-0.022em] text-fg mb-7">
            The constraint is the product.
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8 max-w-[980px]">
            <div>
              <p className="text-base text-fg-muted leading-[1.65] font-medium">
                Every performance claim a buyer currently sees comes from someone selling something.
                That is the gap we occupy, and it only stays occupied if we are structurally unable
                to become one of those sellers. So the constraints are written down rather than
                promised:
              </p>
              <ul className="mt-5 space-y-3 text-base text-fg-muted leading-[1.6] font-medium list-disc pl-5 marker:text-fg-faint">
                <li>
                  <span className="text-fg font-semibold">No migration tooling, ever.</span> Not a
                  stage we are at — a permanent constraint.
                </li>
                <li>
                  <span className="text-fg font-semibold">No positions in anything we measure.</span>
                </li>
                <li>
                  <span className="text-fg font-semibold">No rated party sees a result early</span>, or
                  influences methodology, scope, or timing.
                </li>
                <li>
                  <span className="text-fg font-semibold">Public methodology, published corrections.</span>{" "}
                  Surviving scrutiny is the credential.
                </li>
              </ul>
            </div>

            <div>
              <p className="text-base text-fg-muted leading-[1.65] font-medium">
                Q-Advantage is built and run by <span className="text-fg font-semibold">Joshua Opaka</span>,
                a solo founder — six years in production software engineering, with security as the
                through-line, and work spanning crypto infrastructure, banking, AI, and quantum. That
                span is the shape of the post-quantum value chain itself.
              </p>
              <p className="mt-4 text-base text-fg-muted leading-[1.65] font-medium">
                Two things worth stating before anyone asks. There is no vendor employment history
                and no product to sell, which is what makes the independence structurally credible
                rather than merely asserted. And this is not a credentialed cryptography lab — which
                is exactly why the methodology is fully public and every run is cross-validated
                against eBACS and liboqs&rsquo;s own speed tools rather than published on trust.
              </p>
              <p className="mt-4 text-base text-fg-muted leading-[1.65] font-medium">
                The pipeline runs daily without a team because it was built to. If a number here is
                wrong, the fastest way to fix it is to tell us in public.
              </p>
            </div>
          </div>
        </section>

        {/* ============ FAQ ============ */}
        <section className="mt-20 md:mt-24">
          <div className="eyebrow mb-5">Frequently asked</div>
          <h2 className="text-[clamp(28px,3.8vw,42px)] font-bold leading-[1.1] tracking-[-0.022em] text-fg mb-10">
            Questions worth asking.
          </h2>

          <div className="divide-y divide-border">
            <Faq q="What is Q-Advantage?">
              The independent measurement-and-intelligence layer over the post-quantum migration.
              Not a migration vendor, not a security product. Q-Shield measures how the standardized
              PQC algorithms actually perform on production hardware, daily; the Q-Day Index tracks
              distance to a cryptographically relevant quantum computer. A vendor-implementation
              rating and a migration cost calculator are specced and not yet published. The through
              line is the same: what does turning post-quantum encryption on actually cost, and can
              you check the answer yourself.
            </Faq>
            <Faq q="Who runs Q-Advantage?">
              Joshua Opaka, solo, currently without external funding. The codebase, data, methodology,
              and Actions logs are all open for inspection. There is no paid tier today. When that
              changes — data subscriptions, reports, analyst access — it will be announced publicly
              with the terms in writing, and the line between what stays free and what is paid will
              be published as a principle rather than introduced quietly later. What will never be
              sold is migration tooling.
            </Faq>
            <Faq q="What does “vendor-neutral” mean in practice?">
              No quantum hardware or PQC software vendor pays for placement, ranking, or early access.
              The Q-Day Index hero is the field frontier, not a named winner; the table lists every
              machine with its own score and inputs. Every spec carries its source, measurement method,
              and confidence level so readers can judge the data, not trust ours.
            </Faq>
            <Faq q="Why does the Q-Day Index threat score sit in the single digits?">
              Because that is the honest reading today. The score is a multiplicative gate — it goes
              to zero whenever a system lacks demonstrated, standing, error-corrected logical qubits.
              Only one system in the dataset clears that bar at the time of writing. The trajectory
              is the story, not the absolute digit, and the readiness column tracks that trajectory.
            </Faq>
            <Faq q="Is there a projected Q-Day year?">
              Not yet. A projection is only as good as its model, and we have not built one that
              survives hostile inspection. When we publish one, the model, the assumptions, and the
              inputs will all be open. Anything else would be a guess dressed up as analysis.
            </Faq>
            <Faq q="How do you handle systems that don't fit the schema?">
              Analog Hamiltonian simulators (QuEra Aquila, Pasqal Orion Alpha) have no gate-model
              two-qubit fidelity, so they appear in the table as explicit N/A — a category difference,
              not a low score. Photonic and silicon-spin systems with peer-reviewed credentials but no
              deployed multi-qubit processor appear as footnotes with the specific reason they fall
              short of the scoring bar.
            </Faq>
            <Faq q="What is the sourcing bar for the dataset?">
              Vendor-published or peer-reviewed only. Every numeric field carries its URL, its
              confidence level (peer-reviewed vs vendor-published), the measurement method (XEB vs ECR
              vs randomized benchmarking, etc.), and the date the figure was true. Press releases,
              blog posts, and secondary aggregators do not clear the bar. Where they conflict with
              published values, the published value wins and the gap is noted — for example,
              Google&apos;s blog says &ldquo;approaching 100 µs&rdquo; coherence, the Nature paper says
              68 µs; we cite the paper.
            </Faq>
            <Faq q="Can I challenge a number?">
              Yes — please. There is a feedback form at the bottom of the{" "}
              <Link href="/q-day-index" className="text-accent hover:text-fg transition-colors underline decoration-accent/40 underline-offset-2">
                Q-Day Index page
              </Link>
              , and a public{" "}
              <a
                href={`${GITHUB_REPO}/issues`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:text-fg transition-colors underline decoration-accent/40 underline-offset-2"
              >
                GitHub Issues
              </a>{" "}
              tracker for anything you want a public record of. Concrete corrections improve every
              subsequent run.
            </Faq>
            <Faq q="Can I re-run a benchmark myself?">
              Yes. The Q-Shield benchmark script (
              <code className="font-mono text-[12.5px] bg-bg-card border border-border rounded px-1.5 py-0.5">benchmark/benchmark.py</code>
              ) is a standalone Python program; clone the repo, install liboqs at the matching version,
              and it produces the same JSON. The Q-Day Index emitter (
              <code className="font-mono text-[12.5px] bg-bg-card border border-border rounded px-1.5 py-0.5">benchmark/build-q-day-index.py</code>
              ) runs against the committed dataset and reproduces the dashboard JSON deterministically.
            </Faq>
            <Faq q="Is everything open source?">
              The benchmark code, the scoring engine, the dataset, the methodology document, and the
              frontend are all in the public{" "}
              <a
                href={GITHUB_REPO}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:text-fg transition-colors underline decoration-accent/40 underline-offset-2"
              >
                q-advantage repository
              </a>
              .
            </Faq>
          </div>
        </section>

        {/* ============ CONTRIBUTE ============ */}
        <section className="mt-20 md:mt-24 mb-8 border-t border-border pt-12">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_1.2fr] gap-8 md:gap-16 items-start">
            <div>
              <div className="eyebrow mb-4">Contribute</div>
              <h2 className="text-[clamp(24px,3vw,34px)] font-bold leading-[1.15] tracking-[-0.022em] text-fg">
                Public critique is how this stays honest.
              </h2>
            </div>
            <div className="space-y-5">
              <p className="text-base text-fg-muted leading-[1.6] font-medium">
                If you spot a wrong number, a weak source, a missing system, or a method tag we have
                misapplied — say so. If you want to discuss the scoring formula, the anchor target, or
                whether a vendor&apos;s claim clears the bar — open an issue.
              </p>
              <div className="flex flex-wrap gap-3">
                <a
                  href={GITHUB_ORG}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md border border-border-strong text-sm text-fg-muted hover:text-fg hover:border-fg-muted transition-colors"
                >
                  GitHub organisation
                  <span aria-hidden>↗</span>
                </a>
                <a
                  href={`${GITHUB_REPO}/issues/new`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md border border-border-strong text-sm text-fg-muted hover:text-fg hover:border-fg-muted transition-colors"
                >
                  Open an issue
                  <span aria-hidden>↗</span>
                </a>
                <a
                  href="mailto:hello@qadvantage.io"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md border border-accent/40 bg-accent/10 text-sm font-medium text-accent hover:bg-accent/15 hover:border-accent/60 transition-colors"
                >
                  hello@qadvantage.io
                </a>
              </div>
            </div>
          </div>
        </section>
      </PageShell>
      <Footer />
      <GitHubStarPopup />
    </div>
  );
}

// ---------------------------------------------------------------------------

/**
 * Heavier product block — title, status, then three labelled fields:
 *   - "What it measures" (the deliverable)
 *   - "How" (one-paragraph methodology summary)
 *   - "Status" (where it is in its lifecycle)
 * Plus a link to the live page where one exists.
 */
function ProductBlock({
  status,
  name,
  tag,
  href,
  measures,
  methodology,
  status_note,
}: {
  status: "live" | "preview";
  name: string;
  tag: string;
  href: string | null;
  measures: string;
  methodology: string;
  status_note: string;
}) {
  const statusLabel = status === "live" ? "Live" : "In preview";
  const statusClass =
    status === "live"
      ? "text-accent border-accent/30 before:bg-accent before:shadow-[0_0_6px_rgba(74,222,128,0.5)]"
      : "text-status-warn border-status-warn/30 before:bg-status-warn before:shadow-[0_0_6px_rgba(251,191,36,0.5)]";

  return (
    <article className="bg-bg-card border border-border rounded-xl p-6 md:p-8">
      <header className="flex items-start justify-between gap-4 mb-5 flex-wrap">
        <div>
          <div className="text-[28px] font-bold tracking-[-0.022em] text-fg leading-tight">
            {name}
          </div>
          <div className="font-mono text-[11px] uppercase tracking-eyebrow text-fg-subtle mt-1.5">
            {tag}
          </div>
        </div>
        <div
          className={`inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-eyebrow px-2.5 py-1 border rounded-full ${statusClass} before:content-[''] before:w-[5px] before:h-[5px] before:rounded-full`}
        >
          {statusLabel}
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-[160px_1fr] gap-x-6 gap-y-4 text-sm leading-[1.6]">
        <div className="eyebrow pt-0.5">What it measures</div>
        <p className="text-fg-muted font-medium">
          <span dangerouslySetInnerHTML={{ __html: measures }} />
        </p>

        <div className="eyebrow pt-0.5">How</div>
        <p className="text-fg-muted font-medium">{methodology}</p>

        <div className="eyebrow pt-0.5">Status</div>
        <p className="text-fg-muted font-medium">{status_note}</p>
      </div>

      {href && (
        <div className="mt-6">
          <Link
            href={href}
            className="inline-flex items-center gap-2 text-sm text-accent hover:text-fg transition-colors underline decoration-accent/40 underline-offset-2"
          >
            Open {name}
            <span aria-hidden>→</span>
          </Link>
        </div>
      )}
    </article>
  );
}

function Pillar({ num, title, desc }: { num: string; title: string; desc: string }) {
  return (
    <div className="border-l border-border-strong pl-5">
      <div className="font-mono text-[11px] text-accent mb-2 tracking-[0.05em]">{num}</div>
      <div className="text-[22px] font-bold mb-2 tracking-[-0.01em] text-fg leading-tight">
        {title}
      </div>
      <div className="text-sm text-fg-muted leading-[1.65]">{desc}</div>
    </div>
  );
}

// Plain expandable FAQ. Uses <details>/<summary> so it works without JS,
// styles the chevron, and animates on open.
function Faq({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <details className="group py-5 marker:hidden [&::-webkit-details-marker]:hidden">
      <summary className="flex items-start justify-between gap-6 cursor-pointer list-none">
        <span className="text-base md:text-[17px] text-fg font-bold leading-snug">{q}</span>
        <span
          aria-hidden
          className="font-mono text-fg-muted text-xs mt-1.5 transition-transform group-open:rotate-45 flex-shrink-0"
        >
          +
        </span>
      </summary>
      <div className="mt-4 text-[15px] text-fg-muted leading-[1.65] font-medium pr-10">
        {children}
      </div>
    </details>
  );
}
