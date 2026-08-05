import type { Metadata } from "next";
import { Header } from "@/components/chrome/Header";
import { Footer } from "@/components/chrome/Footer";
import { Breadcrumb } from "@/components/chrome/Breadcrumb";
import { GitHubStarPopup } from "@/components/chrome/GitHubStarPopup";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How Q-Advantage collects, uses, and protects your personal information — what we collect, " +
    "why, who we share it with, and your rights under GDPR and CCPA.",
};

const CONTACT_EMAIL = "hello@qadvantage.io";
const LAST_UPDATED = "August 2026";

/**
 * Privacy policy — legal/utility page.
 *
 * Deliberately not wrapped in .marketing-bg (no glow/noise overlay) since
 * this is a disclosure document, not a marketing surface. Narrow reading
 * column (760px) matches the methodology page's prose treatment; same
 * Header/Footer/Breadcrumb chrome as every other page.
 */
export default function PrivacyPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 mx-auto max-w-[760px] px-6 md:px-8 py-12 md:py-16 w-full">
        <Breadcrumb back={{ label: "Home", href: "/" }} current="Privacy Policy" />

        {/* ============ HERO ============ */}
        <div className="mt-8 mb-14">
          <div className="eyebrow mb-4">Legal</div>
          <h1 className="font-serif text-[clamp(36px,5.5vw,56px)] font-normal leading-[1.05] tracking-[-0.02em] text-fg mb-5">
            Privacy Policy
          </h1>
          <p className="text-lg text-fg-muted leading-[1.6] font-light">
            Q-Advantage collects as little personal information as the site needs to function,
            uses it only for the purpose you gave it to us, and never sells it. This page explains
            what we collect, why, how long we keep it, who we share it with, and how to exercise
            your rights over it.
          </p>
          <p className="mt-5 font-mono text-xs uppercase tracking-eyebrow text-fg-subtle">
            Last updated · {LAST_UPDATED}
          </p>
        </div>

        <Section title="1. Who we are">
          <Prose>
            <p>
              Q-Advantage (&ldquo;Q-Advantage,&rdquo; &ldquo;we,&rdquo; &ldquo;us&rdquo;) publishes
              independent benchmarks and analysis for the post-quantum cryptography transition at{" "}
              <span className="text-fg">qadvantage.io</span>. For the purposes of the EU General
              Data Protection Regulation (GDPR) and the California Consumer Privacy Act (CCPA), we
              are the data controller for the personal information described below.
            </p>
            <p>
              Questions, requests, or complaints about this policy or your data can be sent to{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="text-fg hover:text-accent transition-colors underline decoration-border-strong hover:decoration-accent underline-offset-2"
              >
                {CONTACT_EMAIL}
              </a>
              .
            </p>
          </Prose>
        </Section>

        <Section title="2. Information we collect">
          <Prose>
            <p>We collect two categories of information:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Email address.</strong> When you submit the newsletter subscribe form, we
                collect the email address you provide. That&apos;s the only field the form asks
                for — we don&apos;t collect your name, IP address, or any other identifier through
                that form.
              </li>
              <li>
                <strong>Usage data.</strong> If Vercel Analytics is active on the site, it collects
                aggregated, privacy-preserving usage data — pages visited, referrers, device and
                browser type, and approximate (city-level) location derived from IP address.
                Vercel Analytics does not use cookies and does not track you across other sites.
              </li>
            </ul>
            <p>
              We do not run advertising trackers, third-party marketing pixels, or cross-site
              tracking scripts of any kind.
            </p>
          </Prose>
        </Section>

        <Section title="3. Why we collect it">
          <Prose>
            <p>
              <strong>Email address</strong> is used solely to send you the newsletter you signed
              up for — new benchmark results, Q-Day Index movements, and related analysis. Our
              legal basis is your consent, given when you submit the form, or our legitimate
              interest in keeping subscribers informed of content they explicitly requested. We do
              not use your email for any other purpose, and we do not share it with advertisers.
            </p>
            <p>
              <strong>Usage data</strong> is used to understand which pages and benchmarks are
              useful, diagnose performance problems, and improve the site. Our legal basis is
              legitimate interest in operating and improving the service.
            </p>
          </Prose>
        </Section>

        <Section title="4. How long we keep it">
          <Prose>
            <p>
              Your email address is kept for as long as you remain subscribed. If you unsubscribe,
              it is removed from our mailing list provider and is not retained for further contact.
            </p>
            <p>
              Usage data collected via Vercel Analytics is retained according to Vercel&apos;s own
              data retention policy, which governs aggregated analytics data on our behalf. We do
              not separately export or archive this data beyond what Vercel provides.
            </p>
          </Prose>
        </Section>

        <Section title="5. Who we share it with">
          <Prose>
            <p>
              We use a small number of third-party service providers to operate the site. Each
              processes only the data necessary to provide its service, under its own privacy
              policy and terms:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Beehiiv</strong> — our email newsletter platform. Subscriber email
                addresses are stored and processed by Beehiiv to deliver the newsletter and handle
                unsubscribe requests.
              </li>
              <li>
                <strong>Vercel</strong> — our hosting provider. Vercel serves the site and, if
                enabled, provides the aggregated usage analytics described above.
              </li>
            </ul>
            <p>
              The contact form on this site does not submit to us or to any third party — it opens
              a pre-filled draft in your own email client, addressed to {CONTACT_EMAIL}. We only
              see what you choose to send.
            </p>
            <p>
              We do not sell personal information to anyone, and we do not share it with any party
              not listed above, except where required by law.
            </p>
          </Prose>
        </Section>

        <Section title="6. Your rights">
          <Prose>
            <p>
              If you are in the European Economic Area, the UK, or another jurisdiction with
              similar data protection law, you have the right to:
            </p>
            <ul className="list-disc pl-6 space-y-1.5">
              <li>Access the personal information we hold about you</li>
              <li>Correct inaccurate information</li>
              <li>Request deletion (&ldquo;erasure&rdquo;) of your information</li>
              <li>Restrict or object to certain processing</li>
              <li>Receive your data in a portable format</li>
              <li>Withdraw consent at any time, without affecting past processing</li>
            </ul>
            <p>
              If you are a California resident, the CCPA gives you the right to know what personal
              information we collect, request its deletion, and opt out of its sale. We do not
              sell personal information, so there is nothing to opt out of on that front — but you
              can still exercise your access and deletion rights at any time.
            </p>
            <p>
              The fastest way to exercise any of these rights, or to unsubscribe from the
              newsletter, is to email{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="text-fg hover:text-accent transition-colors underline decoration-border-strong hover:decoration-accent underline-offset-2"
              >
                {CONTACT_EMAIL}
              </a>
              . Every newsletter email also includes a one-click unsubscribe link.
            </p>
          </Prose>
        </Section>

        <Section title="7. Cookies">
          <Prose>
            <p>
              The site itself does not set tracking or advertising cookies. Vercel Analytics, if
              active, is cookie-less by design.
            </p>
          </Prose>
        </Section>

        <Section title="8. International data transfers">
          <Prose>
            <p>
              Our service providers — Beehiiv and Vercel — operate infrastructure in the United
              States. If you are located outside the United States, your information may be
              transferred to, stored, and processed in the United States or other countries where
              these providers or their sub-processors operate. Each provider maintains its own
              safeguards for cross-border transfers, including standard contractual clauses where
              applicable.
            </p>
          </Prose>
        </Section>

        <Section title="9. Data security">
          <Prose>
            <p>
              We rely on the security practices of our infrastructure providers (Vercel for
              hosting, Beehiiv for email storage) and do not maintain a separate database of
              subscriber information ourselves. No method of transmission or storage is perfectly
              secure, but we work only with providers that maintain industry-standard security
              certifications and practices.
            </p>
          </Prose>
        </Section>

        <Section title="10. Children's privacy">
          <Prose>
            <p>
              Q-Advantage is a professional/industry publication and is not directed at children.
              We do not knowingly collect personal information from anyone under 16. If you believe
              a child has provided us with personal information, contact us at{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="text-fg hover:text-accent transition-colors underline decoration-border-strong hover:decoration-accent underline-offset-2"
              >
                {CONTACT_EMAIL}
              </a>{" "}
              and we will delete it.
            </p>
          </Prose>
        </Section>

        <Section title="11. Changes to this policy">
          <Prose>
            <p>
              We may update this policy as the site or our providers change. Material changes will
              be reflected by updating the &ldquo;Last updated&rdquo; date above. We encourage you
              to review this page periodically.
            </p>
          </Prose>
        </Section>

        <Section title="12. Contact us">
          <Prose>
            <p>
              For anything related to this policy or your personal information, email{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="text-fg hover:text-accent transition-colors underline decoration-border-strong hover:decoration-accent underline-offset-2"
              >
                {CONTACT_EMAIL}
              </a>
              . We aim to respond to all privacy requests within 30 days.
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
