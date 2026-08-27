import Link from "next/link";
import { Header } from "@/components/chrome/Header";
import { Footer } from "@/components/chrome/Footer";
import { SubscribeForm } from "@/components/chrome/SubscribeForm";
import { GitHubStarPopup } from "@/components/chrome/GitHubStarPopup";
import { getHomeMetrics } from "@/lib/data/home-metrics";
import { getRecentPosts } from "@/lib/blog/posts";
import { PRODUCTS, TOOLS } from "@/lib/nav";
import {
  formatDuration,
  formatOpsPerSec,
  formatStealPercent,
} from "@/lib/format";

/**
 * qadvantage.io — the company homepage.
 *
 * Not a Q-Shield brochure. Q-Shield is one of four instruments named here, and
 * the page's job is the company's argument: post-quantum arrives as a bill
 * nobody has published, and we measure the inputs to it.
 *
 * Design is treatment A from work-order 005 — floating panels on a contoured
 * ground, the register InferenceX uses. Product surfaces get treatment C (a
 * continuous framed grid) so they read as separate properties, the same way
 * ClusterMAX and InferenceX don't share a skin.
 *
 * Every number on this page comes from lib/data/home-metrics.ts, which derives
 * it from the measured runs. There are no numeric literals below.
 */
export default function HomePage() {
  const m = getHomeMetrics();
  const posts = getRecentPosts(3);

  return (
    <div className="contour flex min-h-screen flex-col">
      <Header />

      <main className="flex-1 pt-6">
        {/* ======================= HERO ======================= */}
        <section className="panel">
          <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:gap-11">
            <div>
              <h1 className="mb-5 text-balance text-[clamp(31px,3.9vw,46px)] font-bold leading-[1.08] tracking-[-0.03em] text-fg">
                Every system you run needs new cryptography.{" "}
                <span className="block font-semibold text-fg-muted">Nobody has priced it.</span>
              </h1>

              <p className="mb-6 max-w-[56ch] text-[15.5px] leading-[1.62] text-fg-muted">
                Independent measurement of what post-quantum encryption actually costs — across
                implementations, protocols and processors. Latency, throughput, bytes on the wire,
                and the dollars behind them, so the migration can be budgeted instead of estimated.
              </p>

              <div className="flex flex-wrap gap-2.5">
                <Link
                  href="/q-shield"
                  className="inline-flex h-[42px] items-center gap-2 rounded-lg bg-fg px-[18px] text-[13.5px] font-bold text-bg transition-transform hover:-translate-y-px"
                >
                  See today&rsquo;s numbers <span aria-hidden>→</span>
                </Link>
                {/* Points at the article rather than /methodology: the spec
                    page is the canonical reference and stays linked in the
                    footer, but a first-time visitor is better served by the
                    written version that explains why the protocol looks the
                    way it does. */}
                <Link
                  href="/blog/how-we-measure"
                  className="inline-flex h-[42px] items-center rounded-lg border border-border bg-bg-card px-[18px] text-[13.5px] font-semibold text-fg transition-transform hover:-translate-y-px"
                >
                  How we measure
                </Link>
              </div>
            </div>

            <HeroTile m={m} />
          </div>
        </section>

        {/* ======================= PORTFOLIO ======================= */}
        <section className="panel">
          <SectionHead
            eyebrow="The portfolio"
            title="We measure, track, rate, and price."
            note="Four instruments, one rule: every number links to the run or the source that produced it."
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <VerbCard
              verb="Measure"
              surface={PRODUCTS[0]}
              body="Every NIST-standardized algorithm, daily, on real x86 and ARM silicon — composed into full TLS and SSH handshakes, not primitives in a box."
              cta="Open Q-Shield →"
            />
            <VerbCard
              verb="Track"
              surface={PRODUCTS[2]}
              body="Weekly posture of named institutions. Where key exchange has moved, where authentication hasn't, and how far apart the two have drifted."
              cta="Not yet published"
            />
            <VerbCard
              verb="Rate"
              surface={PRODUCTS[1]}
              body="A rating of named vendor implementations against criteria published before any verdict exists. Rated parties get no influence over the result."
              cta="Criteria published first"
            />
            <VerbCard
              verb="Price"
              surface={TOOLS[1]}
              body="What the handshake delta actually costs across an estate: connections per second, session reuse, bytes on the wire — converted to dollars."
              cta="Open the calculator →"
            />
          </div>
        </section>

        {/* ======================= QUICK COMPARISONS ======================= */}
        <section className="panel">
          <SectionHead
            eyebrow="Jump straight in"
            title="Quick comparisons."
            note="The questions people actually arrive with, each opening the live compare view with both algorithms already loaded."
          />
          <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
            <QuickCard
              title="Hybrid vs classical TLS"
              desc="What turning on post-quantum key exchange costs per handshake, in time and in bytes."
              href="/q-shield/protocols"
              tags={["Most opened", "X25519MLKEM768", "X25519"]}
              featured
            />
            <QuickCard
              title="Lattice vs hash signatures"
              desc={
                m.signatures
                  ? `A ${Math.round(m.signatures.ratio).toLocaleString()}× signing gap between two schemes NIST approved on the same day.`
                  : "The signing gap between two schemes NIST approved on the same day."
              }
              href="/q-shield/compare?a=ml-dsa-65&b=slh-dsa-shake-128s&op=sign"
              tags={["ML-DSA-65", "SLH-DSA-128s"]}
            />
            <QuickCard
              title="Security level, what it costs"
              desc="Moving from level 3 to level 5: the price of the upgrade in latency and key size."
              href="/q-shield/compare?a=ml-kem-768&b=ml-kem-1024&op=encap"
              tags={["ML-KEM-768", "ML-KEM-1024"]}
            />
            <QuickCard
              title="TLS vs SSH composition"
              desc="The same primitive costs different amounts depending on the protocol wrapped around it."
              href="/q-shield/protocols"
              tags={["Protocol tracks"]}
            />
          </div>
        </section>

        {/* ======================= RANKED ======================= */}
        {m.ranked.length > 0 && (
          <section className="panel">
            <SectionHead
              eyebrow="TLS key exchange · x86_64"
              title="The gap, ranked."
              note="Same host, same harness, every night. Re-run it yourself — the harness is public."
            />
            <RankedTable m={m} />
          </section>
        )}

        {/* ======================= THESIS ======================= */}
        <section className="panel">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-11">
            <blockquote className="m-0 text-balance text-[clamp(19px,2.2vw,24px)] font-bold leading-[1.3] tracking-[-0.022em] text-fg">
              &ldquo;What does moving to post-quantum encryption cost the business?&rdquo;
              <span className="mt-2.5 block text-link">
                The only question left — and nobody neutral has answered it.
              </span>
            </blockquote>
            <div className="text-[14.5px] leading-[1.68] text-fg-muted">
              <p className="mb-3.5">
                This is not one migration. It is every TLS endpoint, every internal PKI, every
                database connection, every VPN tunnel, every code-signing key, every API gateway,
                every blockchain and the wallets and validators on it, and every device shipping
                today with a ten-year field life — each on a different clock, with no central
                operator and no single switch to throw.
              </p>
              <p className="mb-3.5">
                And it arrives as{" "}
                <strong className="font-bold text-fg">
                  two separate bills, neither of which has been published.
                </strong>{" "}
                The one-time one: discovery, engineering hours, certificate reissuance, hardware
                security module refresh, validation cycles. Then the permanent one — larger
                handshakes and larger signatures, paid on every connection, every day,
                indefinitely, in latency, in connections per core, in bytes on the wire, and in the
                hardware you buy sooner than you planned to.
              </p>
              <p className="m-0">
                So the return on any of it is currently unknowable. Vendors quote the slice they
                sell. Academic cycle counts don&rsquo;t compose into an invoice.{" "}
                <strong className="font-bold text-fg">
                  We measure the inputs and publish them — so your ROI is a calculation, not a
                  guess.
                </strong>
              </p>
            </div>
          </div>
        </section>

        {/* ======================= BLOG ======================= */}
        {posts.length > 0 && (
          <section className="panel">
            <SectionHead
              eyebrow="Blog"
              title="The analysis behind the numbers."
              note="Written for the people who have to justify the decision to someone else."
              action={{ label: "All posts →", href: "/blog" }}
            />
            <div className="border-t border-border-subtle">
              {posts.map((p) => (
                <Link
                  key={p.slug}
                  href={`/blog/${p.slug}`}
                  className="grid grid-cols-1 items-baseline gap-x-5 gap-y-1 border-b border-border-subtle px-0.5 py-3.5 transition-colors hover:bg-bg-surface sm:grid-cols-[92px_1fr_auto]"
                >
                  <span className="num text-[11.5px] font-semibold text-fg-subtle">{p.date}</span>
                  <span className="text-[14.5px] font-bold tracking-[-0.022em] text-fg">
                    {p.title}
                  </span>
                  <span className="whitespace-nowrap text-[11.5px] text-fg-muted">
                    {p.category}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ======================= SUBSCRIBE ======================= */}
        <section className="panel" id="subscribe">
          <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-2 lg:gap-11">
            <div>
              <div className="eyebrow">The briefing</div>
              <h2 className="mt-1.5 text-balance text-[clamp(22px,2.5vw,28px)] font-bold leading-[1.16] tracking-[-0.022em] text-fg">
                One email a week. Numbers first.
              </h2>
              <p className="mt-3 max-w-[48ch] text-[13px] text-fg-muted">
                What post-quantum is costing the systems you&rsquo;re responsible for, and what
                changed this week — measured, sourced, and short enough to read before the meeting
                you&rsquo;ll need it for.
              </p>
            </div>
            <div>
              <SubscribeForm />
              <p className="mt-2.5 text-[11.5px] text-fg-subtle">
                Free. Unsubscribe anytime. Security leaders · investors · researchers.
              </p>
            </div>
          </div>
        </section>
      </main>

      <Footer />
      <GitHubStarPopup />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hero tile — the card kept from the previous homepage, restatted around the
// figures the ICP actually budgets against rather than raw primitive timings.
// ---------------------------------------------------------------------------

function HeroTile({ m }: { m: ReturnType<typeof getHomeMetrics> }) {
  return (
    <Link
      href="/q-shield"
      className="block rounded-xl border border-border bg-bg-card px-6 pb-[18px] pt-[22px] transition-colors hover:border-border-strong"
    >
      <div className="eyebrow mb-4">Q-Shield · Latest run</div>

      {m.wire ? (
        <>
          <div className="eyebrow mb-1 text-fg-subtle">Added to every TLS handshake</div>
          <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-1">
            <span className="text-[52px] font-bold leading-none tracking-[-0.045em] text-accent-ink">
              +{m.wire.deltaBytes.toLocaleString()}
            </span>
            <span className="text-xl text-fg-muted">bytes</span>
            {/*
             * This figure is constant and always will be: ML-KEM-768's key and
             * ciphertext sizes are fixed in FIPS 203, so the hybrid suite is
             * 2,336 B and classical X25519 is 64 B on every run. It is still
             * read from the measured data rather than hardcoded — guardrail 1
             * — but labelling it stops a returning visitor reading an unchanged
             * headline as a stale page. The rows below are what move.
             */}
            <span className="ml-1 rounded bg-bg-surface px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-eyebrow text-fg-subtle">
              fixed by FIPS 203
            </span>
          </div>
          <p className="mt-2 text-xs leading-snug text-fg-muted">
            Hybrid X25519MLKEM768 against classical X25519 — {m.wire.ratio.toFixed(1)}× the wire
            cost, paid on every connection, forever.
          </p>
        </>
      ) : (
        <p className="text-sm text-fg-muted">Protocol track unavailable for this run.</p>
      )}

      <div className="my-4 h-px bg-border-subtle" />

      {/*
       * The moving half of the tile. Handshake latency varies materially run to
       * run — roughly a 35% spread across a recent week on the same instance
       * type — so these are what tell a returning visitor the page is live.
       * Marked once, on the section rather than per row, to avoid turning the
       * card into a field of badges.
       */}
      {m.handshake && (
        <>
          <div className="eyebrow mb-2 text-fg-subtle">Measured this run</div>
          <TileRow k="Hybrid handshake" v={formatDuration(m.handshake.hybridMeanUs)} />
          <TileRow
            k="Handshakes / sec / core"
            v={formatOpsPerSec(m.handshake.hybridOpsPerSec)}
          />
        </>
      )}
      {m.representativeSignature && (
        // Signature sizes are quoted in bytes in every spec and every paper,
        // so they stay in bytes here rather than rounding up to KB.
        <TileRow
          k={`${m.representativeSignature.name} signature`}
          v={`${m.representativeSignature.sigBytes.toLocaleString()} B`}
        />
      )}
      {m.kem && <TileRow k="ML-KEM-768 encap" v={formatDuration(m.kem.encapUs)} />}

      <div className="mt-4 flex flex-wrap justify-between gap-2 border-t border-border-subtle pt-3">
        <span className="eyebrow">
          {m.run.date} · {m.run.shortSha}
        </span>
        <span className="eyebrow">
          {m.run.instanceType}
          {m.run.stealPct != null && ` · ${formatStealPercent(m.run.stealPct)} steal`}
        </span>
      </div>

      <div className="mt-3 text-right text-[11.5px] font-bold text-link">View full dashboard →</div>
    </Link>
  );
}

function TileRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="mb-2 flex items-baseline justify-between gap-3 text-[12.5px]">
      <span className="text-fg-muted">{k}</span>
      <span className="num font-bold text-fg">{v}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ranked TLS table
// ---------------------------------------------------------------------------

function RankedTable({ m }: { m: ReturnType<typeof getHomeMetrics> }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-bg-card">
      <div className="overflow-x-auto">
        <div className="min-w-[640px]">
          <div className="grid grid-cols-[38px_minmax(200px,1.5fr)_1fr_1fr_1fr] items-center gap-3 bg-bg-surface px-[18px] py-3 text-2xs font-bold uppercase tracking-eyebrow text-fg-subtle">
            <div>#</div>
            <div>Suite</div>
            <div>Mean handshake</div>
            <div>Bytes on wire</div>
            <div>vs classical</div>
          </div>

          {m.ranked.map((row, i) => (
            <div
              key={row.name}
              className={`grid grid-cols-[38px_minmax(200px,1.5fr)_1fr_1fr_1fr] items-center gap-3 border-t border-border-subtle px-[18px] py-3 ${
                row.isBaseline ? "bg-bg-surface" : ""
              }`}
            >
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-md text-[11.5px] font-bold ${
                  row.isBaseline
                    ? "text-fg-subtle"
                    : i === 0
                      ? "bg-accent text-accent-fg"
                      : "bg-bg-surface text-fg-muted"
                }`}
              >
                {row.isBaseline ? "—" : i + 1}
              </div>
              <div>
                <div className="text-[13.5px] font-bold tracking-[-0.012em] text-fg">
                  {row.name}
                </div>
                <div className="mt-px text-[11.5px] text-fg-muted">{row.note}</div>
              </div>
              <div className={`num text-[13px] ${row.isBaseline ? "text-fg-subtle" : "font-bold text-fg"}`}>
                {formatDuration(row.meanUs)}
              </div>
              <div className={`num text-[13px] ${row.isBaseline ? "text-fg-subtle" : "font-bold text-fg"}`}>
                {/* Exact bytes, not rounded KB. This column is the one the
                    caveat below calls durable — rounding it away would undercut
                    the whole point of pointing at it. */}
                {row.bytesTotal != null ? `${row.bytesTotal.toLocaleString()} B` : "—"}
              </div>
              <div className="num text-[13px]">
                {row.pctOverClassical == null ? (
                  <span className="text-fg-subtle">baseline</span>
                ) : (
                  <span className={row.pctOverClassical < 0 ? "font-bold text-status-ok" : "font-bold text-fg"}>
                    {row.pctOverClassical < 0 ? "−" : "+"}
                    {Math.abs(row.pctOverClassical).toFixed(1)}%
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/*
        The standing caveat. This is not a disclaimer bolted on — it is the
        brand argument made literally. Timing deltas on a burstable instance
        move enough between runs to flip sign; byte counts do not. Saying so on
        the homepage costs a little polish and buys the only thing the company
        sells.
      */}
      <p className="border-t border-border-subtle bg-bg-surface px-[18px] py-3.5 text-xs leading-relaxed text-fg-muted">
        <span className="mr-2 text-2xs font-bold uppercase tracking-eyebrow text-status-warn">
          Read this first
        </span>
        {m.run.stealPct != null && (
          <>
            This run carried{" "}
            <strong className="font-bold text-fg">
              {formatStealPercent(m.run.stealPct)} CPU steal
            </strong>{" "}
            on a burstable instance, which inflates the classical baseline and compresses every
            timing delta above.{" "}
          </>
        )}
        <strong className="font-bold text-fg">
          Timing deltas move run to run. The byte counts do not.
        </strong>{" "}
        Read the wire column as the durable number and the timing column as a distribution, not a
        verdict.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small shared pieces
// ---------------------------------------------------------------------------

function SectionHead({
  eyebrow,
  title,
  note,
  action,
}: {
  eyebrow: string;
  title: string;
  note: string;
  action?: { label: string; href: string };
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h2 className="mt-1.5 text-balance text-[clamp(22px,2.5vw,28px)] font-bold leading-[1.16] tracking-[-0.022em] text-fg">
          {title}
        </h2>
      </div>
      <div className="flex items-end gap-5">
        <p className="max-w-[42ch] text-[13px] text-fg-muted">{note}</p>
        {action && (
          <Link
            href={action.href}
            className="whitespace-nowrap text-[12.5px] font-bold text-link hover:underline"
          >
            {action.label}
          </Link>
        )}
      </div>
    </div>
  );
}

function VerbCard({
  verb,
  surface,
  body,
  cta,
}: {
  verb: string;
  surface: { name: string; href?: string; status: "live" | "coming" };
  body: string;
  cta: string;
}) {
  const inner = (
    <>
      <div className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-accent-ink">
        {verb}
      </div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[15px] font-bold tracking-[-0.022em] text-fg">{surface.name}</span>
        <span
          className={`rounded px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-eyebrow ${
            surface.status === "live"
              ? "bg-status-ok/15 text-status-ok"
              : "bg-bg-surface text-fg-subtle"
          }`}
        >
          {surface.status === "live" ? "Live" : "Coming"}
        </span>
      </div>
      <p className="mb-3.5 text-[12.5px] leading-[1.5] text-fg-muted">{body}</p>
      <span
        className={`mt-auto text-xs font-bold ${
          surface.href ? "text-link" : "font-semibold text-fg-subtle"
        }`}
      >
        {cta}
      </span>
    </>
  );

  const cls =
    "flex min-w-0 flex-col rounded-lg border border-border bg-bg-card px-[17px] pb-[15px] pt-[17px]";

  return surface.href ? (
    <Link href={surface.href} className={`${cls} transition-colors hover:border-border-strong`}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

function QuickCard({
  title,
  desc,
  href,
  tags,
  featured,
}: {
  title: string;
  desc: string;
  href: string;
  tags: string[];
  featured?: boolean;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col gap-1.5 rounded-lg border border-l-[3px] border-border border-l-accent bg-bg-card px-[17px] py-[15px] transition-transform hover:-translate-y-px"
    >
      <div className="flex items-center justify-between gap-2.5">
        <span className="text-sm font-bold tracking-[-0.012em] text-fg">{title}</span>
        <span aria-hidden className="text-fg-muted">
          →
        </span>
      </div>
      <p className="text-[12.5px] leading-[1.5] text-fg-muted">{desc}</p>
      <div className="mt-0.5 flex flex-wrap gap-1.5">
        {tags.map((t, i) => (
          <span
            key={t}
            className={`rounded-full border px-2 py-0.5 text-[10.5px] font-semibold ${
              featured && i === 0
                ? "border-accent bg-accent/15 text-accent-ink"
                : "border-border text-fg-muted"
            }`}
          >
            {t}
          </span>
        ))}
      </div>
    </Link>
  );
}
