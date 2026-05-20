import Link from "next/link";
import { Header } from "@/components/chrome/Header";
import { Footer } from "@/components/chrome/Footer";
import { SubscribeForm } from "@/components/chrome/SubscribeForm";
import { LiveShieldPreview } from "@/components/chrome/LiveShieldPreview";
import { PresetComparisons } from "@/components/data/PresetComparisons";

/**
 * Marketing landing — qadvantage.io home.
 *
 * Editorial register: Instrument Serif italic display headings, animated
 * radial gradient bg + noise overlay, reveal animations on first paint.
 *
 * Hero card is the LIVE Q-Shield preview — pulls actual benchmark data.
 * This proves the brand promise ("the data is live") on first viewport.
 *
 * Quick Comparison cards mirror the ones on /q-shield, so the home page
 * has substance, not just product cards.
 */
export default function HomePage() {
  return (
    <div className="marketing-bg min-h-screen flex flex-col">
      <Header />

      {/* ============================ HERO ============================ */}
      <header className="py-20 md:py-[120px] relative z-[2]">
        <div className="mx-auto max-w-[1200px] px-6 md:px-8">
          <div className="grid grid-cols-1 md:grid-cols-[1.2fr_1fr] gap-12 md:gap-20 items-center">
            <div>
              <div className="reveal reveal-1 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-eyebrow text-fg-muted px-3 py-1.5 border border-border-strong rounded-full mb-8">
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full bg-accent animate-pulse-soft"
                  style={{ boxShadow: "0 0 8px rgba(74, 222, 128, 0.4)" }}
                />
                <span>Daily benchmarks · Open methodology · Auditable on GitHub</span>
              </div>

              <h1 className="reveal reveal-2 font-serif text-[clamp(48px,7vw,88px)] font-normal leading-[1.02] tracking-[-0.025em] text-fg mb-7">
                The intelligence layer for the{" "}
                <em className="italic opacity-95">quantum era.</em>
              </h1>

              <p className="reveal reveal-3 text-lg leading-[1.55] text-fg-muted max-w-[560px] mb-10 font-light">
                Q-Advantage is the gateway for post-quantum cryptography
                adoption — independent benchmarks for the technology that
                will rewrite cryptography, redraw threat models, and rewire
                every system built on top of both.
              </p>

              <div className="reveal reveal-4 flex gap-3 items-center flex-wrap">
                <Link
                  href="/q-shield"
                  className="inline-flex items-center gap-2 px-[22px] py-[13px] bg-fg text-bg rounded-lg text-sm font-medium hover:-translate-y-px hover:opacity-95 transition-all"
                >
                  View Q-Shield benchmarks
                  <span aria-hidden>→</span>
                </Link>
                <a
                  href="#subscribe"
                  className="inline-flex items-center gap-2 px-[22px] py-[13px] bg-transparent text-fg rounded-lg text-sm font-normal border border-border-strong hover:border-fg-muted transition-colors"
                >
                  Subscribe to the briefing
                </a>
              </div>
            </div>

            {/* LIVE Q-Shield preview — replaces the sample Q-Day card */}
            <LiveShieldPreview />
          </div>
        </div>

        {/* Trust strip */}
        <div className="reveal reveal-5 border-t border-b border-border py-8 mt-10 relative z-[2]">
          <div className="mx-auto max-w-[1200px] px-6 md:px-8 flex items-center justify-center gap-6 md:gap-12 flex-wrap">
            {[
              "Daily GitHub Actions runs",
              "Open methodology",
              "Reproducible results",
              "Vendor-neutral",
            ].map((item) => (
              <div
                key={item}
                className="font-mono text-xs text-fg-muted flex items-center gap-2.5 tracking-[0.02em]"
              >
                <span className="w-[5px] h-[5px] bg-fg-subtle rounded-full" />
                {item}
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* ============================ QUICK COMPARISONS ============================ */}
      <section className="py-20 md:py-[100px] relative z-[2]">
        <div className="mx-auto max-w-[1200px] px-6 md:px-8">
          <PresetComparisons
            eyebrow="From this week's run"
            title="The takeaways."
            subtitle="Live ratios from the latest daily benchmark. Click any card to open the full comparison."
            showOpenLink={false}
          />
        </div>
      </section>

      {/* ============================ PRODUCTS ============================ */}
      <section id="products" className="py-20 md:py-[100px] border-t border-border relative z-[2]">
        <div className="mx-auto max-w-[1200px] px-6 md:px-8">
          <div className="text-center max-w-[720px] mx-auto mb-[72px]">
            <div className="eyebrow mb-5">What we measure</div>
            <h2 className="font-serif text-[clamp(36px,4.5vw,56px)] font-normal leading-[1.05] tracking-[-0.02em] mb-5">
              Three benchmarks that <em className="italic">matter.</em>
            </h2>
            <p className="text-[17px] text-fg-muted leading-[1.55] font-light">
              From the threat horizon to the cryptography that replaces what
              quantum will break — measured, scored, and made public.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ProductCard
              status="preview"
              name="Q-Day Index"
              tag="The threat horizon"
              desc="A composite, transparent score for how close current quantum hardware is to breaking RSA-2048 and ECC-256. Updated as vendor specs change."
              href="#subscribe"
              cta="Get alerts on changes"
            />
            <ProductCard
              status="live"
              name="Q-Shield"
              tag="PQC benchmarks · daily"
              desc="Independent performance benchmarks for ML-KEM, ML-DSA, and SLH-DSA. Latency, throughput, key sizes — measured on auditable infrastructure."
              href="/q-shield"
              cta="View live dashboard"
              fullyClickable
            />
            <ProductCard
              status="soon"
              name="Q-Arena"
              tag="Algorithm leaderboard"
              desc="Real quantum algorithms run on real quantum hardware. Shor's, Grover's, VQE — success rates, circuit depths, and shot counts, fully transparent."
              cta="Hardware leaderboard soon"
            />
          </div>
        </div>
      </section>

      {/* ============================ METHODOLOGY ============================ */}
      <section id="methodology" className="py-20 md:py-[100px] border-t border-border relative z-[2]">
        <div className="mx-auto max-w-[1200px] px-6 md:px-8">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_1.4fr] gap-12 md:gap-20 items-start">
            <div>
              <div className="eyebrow mb-5">Methodology</div>
              <h2 className="font-serif text-[clamp(36px,4.5vw,56px)] font-normal leading-[1.05] tracking-[-0.02em] mb-5">
                Receipts, not <em className="italic">press releases.</em>
              </h2>
              <p className="text-[17px] text-fg-muted leading-[1.55] font-light mt-6">
                The quantum industry runs on press releases and analyst PDFs.
                Q-Advantage runs on GitHub Actions logs.
              </p>
              <div className="mt-8">
                <a
                  href="https://github.com/Q-Advantage/website/blob/main/docs/METHODOLOGY.md"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-[22px] py-[13px] bg-transparent text-fg rounded-lg text-sm font-normal border border-border-strong hover:border-fg-muted transition-colors"
                >
                  View full methodology
                </a>
              </div>
            </div>

            <div className="flex flex-col gap-8">
              <Pillar
                num="01"
                title="Every benchmark, public"
                desc="Source code, test parameters, and full result sets live in a public repo. Nothing happens behind a paywall or under NDA."
              />
              <Pillar
                num="02"
                title="Every run, auditable"
                desc="Benchmarks execute on scheduled GitHub Actions. Every workflow log is public. Every result commit is timestamped and signed."
              />
              <Pillar
                num="03"
                title="Every score, reproducible"
                desc="Clone the repo, run the workflow yourself, get the same numbers. The methodology document is the contract."
              />
            </div>
          </div>
        </div>
      </section>

      {/* ============================ SUBSCRIBE ============================ */}
      <section id="subscribe" className="py-[100px] border-t border-border text-center relative z-[2]">
        <div className="mx-auto max-w-[600px] px-6 md:px-8">
          <div className="eyebrow mb-5">The briefing</div>
          <h2 className="font-serif text-[clamp(36px,4.5vw,56px)] font-normal leading-[1.05] tracking-[-0.02em] mb-4">
            Signal, not <em className="italic">noise.</em>
          </h2>
          <p className="text-base text-fg-muted leading-[1.65] mb-4">
            One email a week. New benchmark results, Q-Day Index movements,
            and analysis on the companies and countries shaping the quantum
            industry.
          </p>
          <div className="font-mono text-[11px] text-fg-subtle uppercase tracking-eyebrow mb-9 flex justify-center gap-4 flex-wrap">
            <span>Security leaders</span>
            <span>·</span>
            <span>Investors</span>
            <span>·</span>
            <span>Researchers</span>
          </div>

          <SubscribeForm />

          <div className="mt-5 font-mono text-[11px] text-fg-subtle tracking-[0.05em]">
            Free · Unsubscribe anytime
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Product cards
// ---------------------------------------------------------------------------

function ProductCard({
  status,
  name,
  tag,
  desc,
  href,
  cta,
  fullyClickable,
}: {
  status: "live" | "preview" | "soon";
  name: string;
  tag: string;
  desc: string;
  href?: string;
  cta: string;
  fullyClickable?: boolean;
}) {
  const statusLabel =
    status === "live" ? "Live" : status === "preview" ? "In preview" : "Launching soon";
  const statusClass =
    status === "live"
      ? "text-accent border-accent/30 before:bg-accent before:shadow-[0_0_6px_rgba(74,222,128,0.5)]"
      : status === "preview"
        ? "text-status-warn border-status-warn/30 before:bg-status-warn before:shadow-[0_0_6px_rgba(251,191,36,0.5)]"
        : "text-fg-subtle border-border-strong";

  // If fullyClickable + has href: the entire tile becomes a link.
  // Otherwise: tile is a div, only the CTA link is clickable.
  const Inner = (
    <>
      <div
        className={`inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-eyebrow px-2.5 py-1 border rounded-full mb-6 ${statusClass} ${
          status !== "soon" ? "before:content-[''] before:w-[5px] before:h-[5px] before:rounded-full" : ""
        }`}
      >
        {statusLabel}
      </div>
      <div className="font-serif text-[32px] font-normal tracking-[-0.02em] mb-3 text-fg">
        {name}
      </div>
      <div className="font-mono text-[11px] uppercase tracking-eyebrow text-fg-subtle mb-5">
        {tag}
      </div>
      <p className="text-sm leading-[1.6] text-fg-muted mb-6">{desc}</p>
      {href ? (
        <span className="inline-flex items-center gap-1.5 text-[13px] text-fg font-medium group-hover:gap-2.5 transition-all">
          {cta}
          <span
            aria-hidden
            className="transition-transform group-hover:translate-x-0.5"
          >
            →
          </span>
        </span>
      ) : (
        <span className="inline-flex items-center gap-1.5 text-[13px] text-fg-subtle">
          {cta}
        </span>
      )}
    </>
  );

  const baseClass =
    "bg-bg-card border border-border rounded-xl p-7 md:p-8 relative overflow-hidden hover:border-border-strong hover:-translate-y-0.5 transition-all";

  if (fullyClickable && href) {
    return (
      <Link href={href} className={`block group ${baseClass}`}>
        {Inner}
      </Link>
    );
  }

  if (href) {
    return (
      <Link href={href} className={`block group ${baseClass}`}>
        {Inner}
      </Link>
    );
  }

  return <div className={baseClass}>{Inner}</div>;
}

function Pillar({ num, title, desc }: { num: string; title: string; desc: string }) {
  return (
    <div className="border-l border-border-strong pl-6">
      <div className="font-mono text-[11px] text-fg-subtle mb-2 tracking-[0.05em]">{num}</div>
      <div className="font-serif text-2xl font-normal mb-2 tracking-[-0.01em] text-fg">{title}</div>
      <div className="text-sm text-fg-muted leading-[1.6]">{desc}</div>
    </div>
  );
}
