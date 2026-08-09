import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Header } from "@/components/chrome/Header";
import { Footer } from "@/components/chrome/Footer";
import { Breadcrumb } from "@/components/chrome/Breadcrumb";
import { CorrectionForm } from "@/components/chrome/CorrectionForm";

export const metadata: Metadata = {
  title: "Corrections & Disputes — PQC Readiness Index",
  description:
    "How to report an error in the PQC Readiness Index, what happens next, and the public " +
    "changelog of every correction we've made.",
};

// Paused, 2026-08-09 — this page only makes sense alongside the index
// itself, which is also paused (see web/app/pqc-readiness-index/page.tsx).
// Bring both back together. Typed `boolean`, not the literal `true`, so
// TS doesn't drop narrowing in the rest of the component.
const PAUSED: boolean = true;

export default function CorrectionsPage() {
  if (PAUSED) notFound();

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 mx-auto max-w-[720px] px-6 md:px-8 py-10 md:py-16 w-full">
        <Breadcrumb back={{ label: "PQC Readiness Index", href: "/pqc-readiness-index" }} current="Corrections & Disputes" />

        <div className="mt-8 mb-12">
          <div className="eyebrow mb-4">Corrections &amp; Disputes</div>
          <h1 className="font-serif text-[clamp(32px,5vw,48px)] font-normal leading-[1.1] tracking-[-0.02em] text-fg mb-5">
            If we&apos;re wrong, we say so publicly.
          </h1>
          <p className="text-fg-muted leading-[1.7] font-light">
            We publish measurements about named institutions. We get things wrong sometimes — a
            hostname we scanned isn&apos;t the one that matters, a certificate rotated between our
            sweep and your read of the page, a configuration we recorded as &ldquo;not
            supported&rdquo; was actually a transient network issue on our end. When that happens,
            we want to know, and we want the fix to be visible, not quiet.
          </p>
        </div>

        <div className="space-y-4 text-fg-muted leading-[1.75] mb-12">
          <p>
            <strong className="text-fg">Before publication:</strong> every institution we cover
            gets its own data shown to it first, with a 14-day window to respond, before that
            institution&apos;s row is ever made public — see the{" "}
            <Link href="/methodology#pqc-right-of-reply" className="text-fg hover:text-accent transition-colors underline decoration-border-strong hover:decoration-accent underline-offset-2">
              right-of-reply methodology
            </Link>
            . This page covers what happens <em>after</em> a row is already live.
          </p>
          <p>
            <strong className="text-fg">Anyone can report an error</strong> — you don&apos;t need
            to be the institution in question, and you don&apos;t need to identify yourself.
          </p>
          <p>
            <strong className="text-fg">What happens next:</strong> we log every submission the
            day it arrives. We acknowledge within <strong className="text-fg">2 business
            days</strong>, every report, including ones we think are wrong. We reach a
            determination within <strong className="text-fg">5 business days</strong> — if it
            genuinely needs longer, we say so before the 5 days elapse and give a date, rather than
            going quiet. <strong className="text-fg">While a report is open, the row is publicly
            marked &ldquo;disputed&rdquo;</strong> on the index, visible to anyone reading it. A
            confirmed error is fixed within <strong className="text-fg">2 business days</strong>
            {" "}of that determination.
          </p>
          <p>
            A confirmed correction updates the row <em>and</em> gets a dated entry in the
            changelog below — what changed, why, and when. We don&apos;t quietly edit a number and
            hope nobody notices the old one.
          </p>
        </div>

        <h2 className="font-serif text-2xl font-normal text-fg mb-2">Report an error</h2>
        <Suspense fallback={<div className="mt-8 h-[420px]" />}>
          <CorrectionForm />
        </Suspense>

        <div className="mt-16 pt-10 border-t border-border">
          <h2 className="font-serif text-2xl font-normal text-fg mb-6">Changelog</h2>
          <div className="border border-border rounded-lg bg-bg-card p-5">
            <p className="text-fg-subtle text-sm">
              No corrections have been logged yet. Every confirmed correction will appear here,
              newest first, permanently — nothing is ever removed or rewritten.
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
