import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Header } from "@/components/chrome/Header";
import { Footer } from "@/components/chrome/Footer";
import { Breadcrumb } from "@/components/chrome/Breadcrumb";
import { TierBadge, NotAssessedBadge } from "@/components/data/TierBadge";
import { ARENA_CRITERIA } from "@/lib/data/arena-criteria";
import { getVendorRating, getVendorRatings, assertRatingsWellFormed } from "@/lib/data/arena";
import type { DimensionAssessment, AssessmentStanding } from "@/lib/data/arena-types";

/**
 * PAUSED, 2026-08-13 — PQC Arena publishes criteria only. No vendor has been
 * rated, and the publish preconditions in
 * docs/adr/0004-pqc-arena-topology-and-publish-gates.md are open (entity,
 * legal review of comparative-rating exposure, sector-rubric reconciliation).
 *
 * Flip this to false ONLY when those gates are cleared AND a reviewed vendor
 * dataset exists. Same per-file pattern as the PQC Readiness Index pause;
 * typed `boolean` rather than the literal `true` so TypeScript keeps
 * narrowing the rest of this file instead of marking it unreachable.
 */
const PAUSED: boolean = true;

interface PageProps {
  params: { vendor: string };
}

export function generateStaticParams() {
  if (PAUSED) return [];
  return getVendorRatings().map((v) => ({ vendor: v.id }));
}

export function generateMetadata({ params }: PageProps): Metadata {
  if (PAUSED) return { title: "Not found" };
  const rating = getVendorRating(params.vendor);
  if (!rating) return { title: "Rating not found" };
  return {
    title: `${rating.displayName} — PQC Arena rating`,
    description: `Q-Advantage's independent PQC Arena assessment of ${rating.displayName}, against ten published criteria.`,
  };
}

const STANDING_LABEL: Record<AssessmentStanding, string> = {
  leads: "Leads",
  adequate: "Adequate",
  trails: "Trails",
  "critical-failure": "Critical failure",
  "not-assessed": "Not assessed",
};

const STANDING_CLASS: Record<AssessmentStanding, string> = {
  leads: "text-emerald-500 border-emerald-500/30",
  adequate: "text-fg-muted border-border",
  trails: "text-amber-500 border-amber-500/30",
  "critical-failure": "text-status-err border-status-err/40",
  "not-assessed": "text-fg-subtle border-border border-dashed",
};

export default function VendorRatingPage({ params }: PageProps) {
  if (PAUSED) notFound();

  // A malformed rating breaks the build rather than reaching a reader — see
  // assertRatingsWellFormed().
  assertRatingsWellFormed();

  const rating = getVendorRating(params.vendor);
  if (!rating) notFound();

  const byCriterion = new Map<string, DimensionAssessment>(
    rating.assessments.map((a) => [a.criterionId, a]),
  );

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 mx-auto max-w-[900px] px-6 md:px-8 py-10 md:py-12 w-full space-y-10">
        <Breadcrumb back={{ label: "PQC Arena", href: "/pqc-arena" }} current={rating.displayName} />

        {/* Header */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            {rating.tier ? <TierBadge tier={rating.tier} /> : <NotAssessedBadge />}
            <span className="text-2xs uppercase tracking-eyebrow text-fg-subtle font-mono">
              Reviewed {rating.reviewedOn} · by {rating.reviewedBy} · methodology v{rating.methodologyVersion}
            </span>
          </div>
          <h1 className="font-serif text-[clamp(32px,4.5vw,48px)] font-normal leading-[1.05] tracking-[-0.02em] text-fg">
            {rating.displayName}
          </h1>
          {rating.tier === null && rating.tierWithheldReason && (
            <p className="text-sm text-fg-muted leading-relaxed max-w-2xl border-l-2 border-border pl-3">
              <strong className="text-fg font-medium">No tier assigned.</strong>{" "}
              {rating.tierWithheldReason}
            </p>
          )}
        </div>

        {/* Commercial relationship — required on every rating by the policy */}
        <section className="border border-border rounded-md bg-bg-inset px-5 py-4">
          <div className="eyebrow mb-2">Commercial relationship</div>
          <p className="text-sm text-fg-muted leading-relaxed">
            {rating.commercialRelationship.statement}
          </p>
        </section>

        {/* Per-dimension assessments */}
        <section>
          <h2 className="font-serif text-[clamp(22px,3vw,28px)] font-normal leading-tight tracking-[-0.01em] text-fg mb-5">
            Assessment by dimension
          </h2>
          <div className="grid grid-cols-1 gap-4">
            {ARENA_CRITERIA.map((criterion) => {
              const assessment =
                byCriterion.get(criterion.id) ??
                ({
                  criterionId: criterion.id,
                  standing: "not-assessed",
                  finding: null,
                  evidence: [],
                } satisfies DimensionAssessment);
              return (
                <article
                  key={criterion.id}
                  className="border border-border rounded-md bg-bg-inset px-5 py-4"
                >
                  <header className="flex items-baseline gap-3 mb-2 flex-wrap">
                    <span className="font-mono text-2xs text-fg-subtle tabular-nums">
                      {String(criterion.number).padStart(2, "0")}
                    </span>
                    <h3 className="text-fg font-medium flex-1 min-w-[200px]">{criterion.name}</h3>
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-2xs uppercase tracking-eyebrow ${STANDING_CLASS[assessment.standing]}`}
                    >
                      {STANDING_LABEL[assessment.standing]}
                    </span>
                  </header>

                  {assessment.standing === "not-assessed" ? (
                    <p className="text-sm text-fg-subtle leading-relaxed">
                      Not assessed. This is not a score of zero and not an assumption in the
                      vendor&apos;s favour &mdash; the work has not been done.
                    </p>
                  ) : (
                    <>
                      <p className="text-sm text-fg-muted leading-relaxed">{assessment.finding}</p>
                      {assessment.evidence.length > 0 && (
                        <ul className="mt-3 space-y-1.5">
                          {assessment.evidence.map((e) => (
                            <li key={e.sourceUrl + e.claim} className="text-2xs leading-relaxed">
                              <a
                                href={e.sourceUrl}
                                className="text-fg-muted hover:text-accent transition-colors underline decoration-border-strong hover:decoration-accent underline-offset-2"
                              >
                                {e.claim} ↗
                              </a>
                              <span className="text-fg-subtle"> · retrieved {e.retrieved}</span>
                              {e.verification === "search-corroborated" && (
                                <span className="text-amber-500/90"> · not read directly</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </>
                  )}
                </article>
              );
            })}
          </div>
        </section>

        {/* Limitations — required on every rating, including the best one */}
        <section className="border border-border rounded-md bg-bg-inset px-5 py-4">
          <div className="eyebrow mb-3">Limitations</div>
          <ul className="space-y-2 text-sm text-fg-muted leading-relaxed list-disc pl-4">
            {rating.limitations.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </section>

        {rating.dispute && (
          <section className="border border-amber-500/30 rounded-md bg-amber-500/[0.04] px-5 py-4">
            <div className="eyebrow mb-2">Disputed by the vendor</div>
            <p className="text-sm text-fg-muted leading-relaxed">
              Raised {rating.dispute.raisedOn}
              {rating.dispute.resolved ? " · resolved" : " · open"}. {rating.dispute.summary}
            </p>
          </section>
        )}
      </main>
      <Footer />
    </div>
  );
}
