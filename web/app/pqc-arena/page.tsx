import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "@/components/chrome/Header";
import { Footer } from "@/components/chrome/Footer";
import { Breadcrumb } from "@/components/chrome/Breadcrumb";
import { GitHubStarPopup } from "@/components/chrome/GitHubStarPopup";
import { TierBadge } from "@/components/data/TierBadge";
import {
  ARENA_CRITERIA,
  ARENA_TIERS,
  type ArenaCriterion,
  type CriterionReference,
} from "@/lib/data/arena-criteria";

export const metadata: Metadata = {
  title: "PQC Arena — vendor rating criteria",
  description:
    "The published criteria PQC Arena rates post-quantum vendor implementations against: ten dimensions, " +
    "itemized checklists, stated evidence sources, and a six-tier system. Criteria published before any " +
    "rating exists.",
};

/**
 * /pqc-arena — the public face of the vendor rating, before any vendor is rated.
 *
 * This page exists in a deliberate state: the instrument is published, the
 * verdicts are not. That is ClusterMAX's own mechanism — criteria published in
 * advance are what make a rating a procurement reference instead of an attack
 * — and it is also the only honest option given that the assessment work is
 * incomplete and the publish preconditions are open.
 *
 * NO COMPANY IS NAMED ON THIS PAGE. Scope is described by category only. See
 * docs/adr/0004-pqc-arena-topology-and-publish-gates.md.
 */

/**
 * PAUSED, 2026-08-15 — by founder decision, nothing about PQC Arena goes
 * public until the entity is formed.
 *
 * This page names no vendor and so is not blocked by the *rating* gates, but
 * it does publicly commit Q-Advantage to a methodology and a policy, and it
 * signals the product to the market. That is a decision to take once, from a
 * formed entity, rather than to take early and walk back.
 *
 * Flip to false together with the same flag in ./policy/page.tsx and
 * ARENA_PUBLIC in app/methodology/page.tsx, and restore the header nav links
 * and sitemap entries removed alongside this. Nothing was deleted.
 */
const PAUSED: boolean = true;

const SCOPE_IN = [
  "Post-quantum crypto library and SDK vendors",
  "HSM vendors shipping PQC firmware",
  "PKI and certificate authority vendors with PQC issuance capability",
  "TLS and network security vendors shipping PQC support",
];

const SCOPE_OUT = [
  "Systems integrators and delivery consultancies — reviewed as sources, never rated as subjects",
  "Advisory practices selling labour rather than implementations",
];

const PRECONDITIONS: { label: string; done: boolean; detail: string }[] = [
  {
    label: "The publishing entity exists",
    done: false,
    detail: "Formation in progress.",
  },
  {
    label: "The rated-parties and conflict-of-interest policy is published",
    done: true,
    detail: "Published — see the policy page linked below.",
  },
  {
    label: "Legal review of comparative-rating exposure has happened",
    done: false,
    detail:
      "A distinct question from the Readiness Index's review, not a consequence of it. Publishing a comparative judgement about a named company is a different exposure than publishing a configuration fact.",
  },
  {
    label: "Criteria reconciled against the sector standard for third-party provider evaluation",
    done: false,
    detail: "Blocked until that draft is visible.",
  },
];

export default function PQCArenaPage() {
  if (PAUSED) notFound();

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 mx-auto max-w-[1000px] px-6 md:px-8 py-10 md:py-12 w-full space-y-14">
        <Breadcrumb back={{ label: "Home", href: "/" }} current="PQC Arena" />

        {/* ============ HERO ============ */}
        <div className="flex flex-col gap-4">
          <div className="eyebrow">PQC Arena</div>
          <h1 className="font-serif text-[clamp(36px,5vw,60px)] font-normal leading-[1.05] tracking-[-0.02em] text-fg">
            The criteria, <em className="italic">before</em> the verdicts.
          </h1>
          <p className="text-[17px] text-fg-muted max-w-2xl leading-[1.6] font-light">
            PQC Arena rates the companies selling post-quantum implementations &mdash; on whether their
            cryptography is correct, fast, integrated, certified, and honestly represented. These are
            the ten dimensions every rating will be produced against, published in full before any
            vendor has been rated.
          </p>
        </div>

        {/* ============ STATUS — the honest state ============ */}
        <section className="border border-border rounded-md bg-bg-inset px-6 py-6">
          <div className="flex items-start gap-3 flex-wrap">
            <span className="inline-flex items-center rounded-full border border-dashed border-border px-2.5 py-0.5 font-mono text-2xs uppercase tracking-eyebrow text-fg-subtle shrink-0 mt-0.5">
              No ratings published
            </span>
            <div className="flex-1 min-w-[260px] space-y-3">
              <p className="text-sm text-fg-muted leading-relaxed">
                <strong className="text-fg font-medium">
                  No vendor has been rated, and no tier has been assigned to anyone.
                </strong>{" "}
                Preliminary work has produced findings on two of the ten dimensions for a small number
                of candidates &mdash; not enough to rate anybody. Publishing a tier on that basis would
                be exactly the kind of overconfident number this instrument exists to replace.
              </p>
              <p className="text-sm text-fg-muted leading-relaxed">
                Where a dimension has not been assessed, it will say <em>not assessed</em> &mdash; not
                scored zero, and not assumed favourable.
              </p>
            </div>
          </div>

          <div className="mt-6 pt-5 border-t border-border">
            <div className="eyebrow mb-3">Before any rating publishes</div>
            <ul className="space-y-2.5">
              {PRECONDITIONS.map((p) => (
                <li key={p.label} className="flex items-start gap-3 text-sm">
                  <span
                    aria-hidden
                    className={`mt-0.5 shrink-0 font-mono text-xs ${p.done ? "text-accent" : "text-fg-subtle"}`}
                  >
                    {p.done ? "[x]" : "[ ]"}
                  </span>
                  <span>
                    <span className={p.done ? "text-fg-muted line-through decoration-border-strong" : "text-fg"}>
                      {p.label}
                    </span>
                    <span className="block text-2xs text-fg-subtle mt-0.5 leading-relaxed">{p.detail}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ============ SCOPE ============ */}
        <section>
          <SectionHead
            title="What gets rated"
            caption="Scope is by category. Individual candidate companies are not published in advance of being rated."
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="border border-border rounded-md bg-bg-inset px-5 py-4">
              <div className="eyebrow mb-3">In scope</div>
              <ul className="space-y-2 text-sm text-fg-muted leading-relaxed list-disc pl-4">
                {SCOPE_IN.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
            <div className="border border-border rounded-md bg-bg-inset px-5 py-4">
              <div className="eyebrow mb-3">Out of scope</div>
              <ul className="space-y-2 text-sm text-fg-muted leading-relaxed list-disc pl-4">
                {SCOPE_OUT.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ============ TIERS ============ */}
        <section>
          <SectionHead
            title="The tiers"
            caption="Five positions on a scale, plus one that deliberately is not."
          />
          <div className="grid grid-cols-1 gap-3">
            {ARENA_TIERS.map((tier) => (
              <div
                key={tier.id}
                className={`border rounded-md px-5 py-4 flex flex-col sm:flex-row sm:items-start gap-3 ${
                  tier.rank === null ? "border-dashed border-border bg-transparent" : "border-border bg-bg-inset"
                }`}
              >
                <div className="sm:w-36 shrink-0">
                  <TierBadge tier={tier.id} />
                </div>
                <p className="text-sm text-fg-muted leading-relaxed flex-1">{tier.summary}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ============ THE TEN DIMENSIONS ============ */}
        <section>
          <SectionHead
            title="The ten dimensions"
            caption="Each with what it asks, what is actually checked, and where the evidence comes from."
          />
          <div className="grid grid-cols-1 gap-5">
            {ARENA_CRITERIA.map((c) => (
              <CriterionCard key={c.id} criterion={c} />
            ))}
          </div>
        </section>

        {/* ============ FOOTER LINKS ============ */}
        <section className="border-t border-border pt-8 flex flex-col sm:flex-row gap-x-8 gap-y-3 text-sm">
          <Link href="/pqc-arena/policy" className="text-accent hover:underline underline-offset-4">
            Rated-parties &amp; conflict-of-interest policy →
          </Link>
          <Link href="/methodology#pqc-arena" className="text-accent hover:underline underline-offset-4">
            Why the rating is relative, not a formula →
          </Link>
        </section>
      </main>
      <Footer />
      <GitHubStarPopup />
    </div>
  );
}

// ---------------------------------------------------------------------------

function SectionHead({ title, caption }: { title: string; caption: string }) {
  return (
    <div className="flex flex-col gap-1.5 mb-5">
      <h2 className="font-serif text-[clamp(24px,3.2vw,32px)] font-normal leading-tight tracking-[-0.01em] text-fg">
        {title}
      </h2>
      <p className="text-sm text-fg-muted max-w-2xl leading-relaxed font-light">{caption}</p>
    </div>
  );
}

function CriterionCard({ criterion }: { criterion: ArenaCriterion }) {
  return (
    <article className="border border-border rounded-md bg-bg-inset px-5 py-5">
      <header className="flex items-baseline gap-3 mb-2 flex-wrap">
        <span className="font-mono text-2xs text-fg-subtle tabular-nums">
          {String(criterion.number).padStart(2, "0")}
        </span>
        <h3 className="text-fg font-medium">{criterion.name}</h3>
        {criterion.criticalFailure && (
          <span className="inline-flex items-center rounded-full border border-status-err/40 bg-status-err/[0.06] px-2 py-0.5 font-mono text-2xs uppercase tracking-eyebrow text-status-err">
            Critical-failure gate
          </span>
        )}
      </header>

      <p className="text-sm text-fg-muted leading-relaxed mb-4">{criterion.definition}</p>

      <div className="eyebrow mb-2">What is checked</div>
      <ul className="space-y-1.5 mb-4 text-sm text-fg-muted leading-relaxed list-disc pl-4">
        {criterion.checklist.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>

      {criterion.criticalFailure && (
        <div className="mb-4 border-l-2 border-status-err/40 pl-3">
          <div className="eyebrow mb-1">Critical failure</div>
          <p className="text-xs text-fg-muted leading-relaxed">{criterion.criticalFailure}</p>
        </div>
      )}

      <div className="text-2xs text-fg-subtle leading-relaxed">
        <span className="uppercase tracking-eyebrow font-mono">Evidence source</span>
        <span className="block mt-0.5 text-fg-muted">{criterion.dataSource}</span>
      </div>

      {criterion.references.length > 0 && (
        <div className="mt-4 pt-3 border-t border-border">
          <div className="eyebrow mb-2">References</div>
          <ul className="space-y-1.5">
            {criterion.references.map((r) => (
              <li key={r.label}>
                <ReferenceLine reference={r} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}

/**
 * Renders a reference with its verification level visible. An unverified
 * reference is shown as plain text with an explicit warning rather than as a
 * link — it is a lead, not a citation, and must not look like one.
 */
function ReferenceLine({ reference }: { reference: CriterionReference }) {
  if (reference.verification === "unverified") {
    return (
      <span className="block text-2xs leading-relaxed">
        <span className="text-fg-muted">{reference.label}</span>
        <span className="text-amber-500/90"> · #unverified — not checked by this project</span>
        {reference.note && <span className="block text-fg-subtle mt-0.5">{reference.note}</span>}
      </span>
    );
  }

  return (
    <span className="block text-2xs leading-relaxed">
      <a
        href={reference.url}
        className="text-fg-muted hover:text-accent transition-colors underline decoration-border-strong hover:decoration-accent underline-offset-2"
      >
        {reference.label} ↗
      </a>
      <span className="text-fg-subtle"> · retrieved {reference.retrieved}</span>
      {reference.verification === "search-corroborated" && (
        <span className="text-amber-500/90"> · not read directly, spot-check before citing</span>
      )}
      {reference.note && <span className="block text-fg-subtle mt-0.5">{reference.note}</span>}
    </span>
  );
}
