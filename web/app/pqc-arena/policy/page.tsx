import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "@/components/chrome/Header";
import { Footer } from "@/components/chrome/Footer";
import { Breadcrumb } from "@/components/chrome/Breadcrumb";
import { GitHubStarPopup } from "@/components/chrome/GitHubStarPopup";

export const metadata: Metadata = {
  title: "PQC Arena — Rated-parties & conflict-of-interest policy",
  description:
    "What a rated vendor can and cannot buy from Q-Advantage, and the itemized commercial-relationship " +
    "disclosure that appears on every PQC Arena rating.",
};

const CONTACT_EMAIL = "hello@qadvantage.io";
const LAST_UPDATED = "August 2026";
const POLICY_VERSION = "1.0";

/**
 * PQC Arena rated-parties / conflict-of-interest policy.
 *
 * This page is a precondition, not decoration: PQC Arena cannot publish a
 * rating until this policy is published. It is deliberately live before any
 * vendor is rated, so it reads as principle rather than as damage control
 * after a complaint.
 *
 * Same disclosure-document treatment as /privacy — narrow reading column, no
 * marketing background.
 *
 * PAUSED, 2026-08-15 — see the identical flag in ../page.tsx for the
 * reasoning. Publishing a conflicts policy is a commitment made on behalf of
 * a business; it waits for the entity. Flip both flags together.
 */
const PAUSED: boolean = true;

export default function ArenaPolicyPage() {
  if (PAUSED) notFound();

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 mx-auto max-w-[760px] px-6 md:px-8 py-12 md:py-16 w-full">
        <Breadcrumb back={{ label: "PQC Arena", href: "/pqc-arena" }} current="Rated-parties policy" />

        {/* ============ HERO ============ */}
        <div className="mt-8 mb-14">
          <div className="eyebrow mb-4">PQC Arena · Policy</div>
          <h1 className="font-serif text-[clamp(36px,5.5vw,56px)] font-normal leading-[1.05] tracking-[-0.02em] text-fg mb-5">
            Rated parties &amp; conflicts of interest
          </h1>
          <p className="text-lg text-fg-muted leading-[1.6] font-light">
            PQC Arena rates companies that could, in principle, become customers of Q-Advantage. That
            is a real conflict and pretending otherwise would be worse than disclosing it. This page
            states exactly what a rated vendor can buy, what it can never buy, and what gets disclosed
            on every single rating.
          </p>
          <p className="mt-5 font-mono text-xs uppercase tracking-eyebrow text-fg-subtle">
            Version {POLICY_VERSION} · Last updated {LAST_UPDATED}
          </p>
        </div>

        <div className="mb-14 border border-border rounded-md bg-bg-inset px-5 py-4">
          <p className="text-sm text-fg-muted leading-relaxed">
            <strong className="text-fg font-medium">Status:</strong> no vendor has been rated yet, and
            no vendor has ever paid Q-Advantage anything. This policy is published in advance of the
            first rating on purpose &mdash; a conflicts policy written after the first complaint is not
            a policy, it is a defence.
          </p>
        </div>

        <Section title="1. The rule">
          <Prose>
            <p>
              <strong>
                Rated parties may buy data and reports. They get no influence over methodology,
                ratings, or timing. This is disclosed on every rating.
              </strong>
            </p>
            <p>
              Everything below is an elaboration of that sentence. Where any other Q-Advantage
              document appears to soften it, this page governs.
            </p>
          </Prose>
        </Section>

        <Section title="2. What a rated vendor may buy">
          <Prose>
            <p>
              A company rated by PQC Arena is not barred from being a customer. It may purchase the
              same things any other organisation may purchase: data subscriptions, published reports,
              and analyst time. Barring rated parties from buying anything would, in a market this
              small, mean either rating nobody or selling to nobody.
            </p>
            <p>
              What it buys is access to work that already exists, on the same terms as anyone else. It
              is never buying a rating, an embargo, a revision, or a delay.
            </p>
          </Prose>
        </Section>

        <Section title="3. What no amount of money buys">
          <Prose>
            <ul className="list-disc pl-5 space-y-2">
              <li>A tier, a score, or a change to either.</li>
              <li>Removal from, or inclusion in, a rating cycle.</li>
              <li>Influence over the criteria, their weighting, or the critical-failure gates.</li>
              <li>Control over publication timing, or an embargo on an unfavourable result.</li>
              <li>Advance sight of a rating beyond the correction window described in section 5.</li>
              <li>
                Suppression of a limitation. Every rating states limitations, including for the
                highest-rated vendor.
              </li>
            </ul>
            <p>
              Q-Advantage does not offer paid placement, sponsored ratings, or &ldquo;certification&rdquo;
              programmes of any kind, and will not.
            </p>
          </Prose>
        </Section>

        <Section title="4. The itemized disclosure, on every rating">
          <Prose>
            <p>
              Every rated vendor&apos;s page carries a commercial-relationship line for{" "}
              <em>that vendor</em>, stated positively, every time. It reads either:
            </p>
            <div className="border border-border rounded-md bg-bg-inset px-5 py-4 font-mono text-xs text-fg-muted leading-relaxed">
              Commercial relationship: none.
            </div>
            <p>or, where one exists:</p>
            <div className="border border-border rounded-md bg-bg-inset px-5 py-4 font-mono text-xs text-fg-muted leading-relaxed">
              Commercial relationship: [vendor] purchased [what] on [date]. It had no access to or
              influence over this rating.
            </div>
            <p>
              <strong>A general policy statement never stands in for a per-vendor line.</strong>{" "}
              &ldquo;We have no relationships that affect our ratings&rdquo; is the industry norm and it
              is not good enough: it is unfalsifiable, and it puts the burden on the reader to trust
              rather than to check. A rating without its own disclosure line is incomplete and should
              be treated as such.
            </p>
          </Prose>
        </Section>

        <Section title="5. Right of reply and corrections">
          <Prose>
            <p>
              Before a rating is published, the vendor it concerns is offered a correction window: a
              chance to identify factual errors, point to evidence that was missed, or supply material
              that was not public.
            </p>
            <p>
              That window is for <strong>facts, not for conclusions.</strong> A vendor can show that a
              cited document was misread, that a certificate exists that was not found, or that a
              figure is out of date. It cannot negotiate a tier. Where a vendor disputes a conclusion
              rather than a fact, the dispute itself is published alongside the rating.
            </p>
            <p>
              After publication, corrections are made when shown to be warranted, dated, and recorded
              rather than silently edited.
            </p>
          </Prose>
        </Section>

        <Section title="6. Not participating is not penalised">
          <Prose>
            <p>
              Vendor cooperation is welcome and never required. A vendor that ignores every approach is
              still rated on public evidence: its published documentation, independent testing where its
              implementation is publicly testable, and public certification registries.
            </p>
            <p>
              A vendor lands in <strong>Unavailable</strong> only when there is genuinely not enough
              public signal to assess &mdash; never as a sanction for declining to engage. Unavailable
              is an absence of evidence, not a finding against the vendor, and it is not ranked below
              the rated tiers.
            </p>
          </Prose>
        </Section>

        <Section title="7. Independence, stated concretely">
          <Prose>
            <ul className="list-disc pl-5 space-y-2">
              <li>Q-Advantage does not sell migration tools, and does not compete with rated vendors.</li>
              <li>
                Q-Advantage holds no equity in, and receives no commission from, any rated vendor.
              </li>
              <li>
                Ratings are produced from published criteria and cited evidence, not from vendor
                briefings.
              </li>
              <li>
                Where a rating rests on a claim that could not be independently verified, the rating
                says so rather than presenting it as verified.
              </li>
            </ul>
            <p>
              If any of these ceases to be true, this page changes first &mdash; before the rating that
              would have been affected by it.
            </p>
          </Prose>
        </Section>

        <Section title="8. Questions and disputes">
          <Prose>
            <p>
              Corrections, disputes, and questions about this policy go to{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="text-fg hover:text-accent transition-colors underline decoration-border-strong hover:decoration-accent underline-offset-2"
              >
                {CONTACT_EMAIL}
              </a>
              .
            </p>
            <p>
              The criteria every rating is produced against are published in full at{" "}
              <Link
                href="/pqc-arena"
                className="text-fg hover:text-accent transition-colors underline decoration-border-strong hover:decoration-accent underline-offset-2"
              >
                PQC Arena
              </Link>
              , and the reasoning behind them at{" "}
              <Link
                href="/methodology#pqc-arena"
                className="text-fg hover:text-accent transition-colors underline decoration-border-strong hover:decoration-accent underline-offset-2"
              >
                methodology
              </Link>
              .
            </p>
          </Prose>
        </Section>
      </main>
      <Footer />
      <GitHubStarPopup />
    </div>
  );
}

// ---------------------------------------------------------------------------

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-12 scroll-mt-20">
      <h2 className="font-serif text-[22px] md:text-2xl font-normal text-fg mb-4 tracking-[-0.01em]">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Prose({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-4 text-fg-muted leading-[1.75] [&_strong]:text-fg [&_strong]:font-medium">
      {children}
    </div>
  );
}
