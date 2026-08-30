import type { Metadata } from "next";
import { Header } from "@/components/chrome/Header";
import { Footer } from "@/components/chrome/Footer";
import { PageShell } from "@/components/chrome/PageShell";
import {
  CATEGORY_LABEL,
  CATEGORY_ORDER,
  GLOSSARY,
  byCategory,
  termAnchor,
  unsourced,
  type GlossaryTerm,
} from "@/lib/data/glossary";

export const metadata: Metadata = {
  title: "Glossary | Q-Advantage",
  description:
    "The terms used across Q-Shield and the Q-Day Index, each defined once and cited to a primary source — or marked unverified where there isn't one.",
};

function Entry({ t }: { t: GlossaryTerm }) {
  return (
    <div id={termAnchor(t.term)} className="scroll-mt-24 border-b border-border-subtle py-5 last:border-b-0">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="text-[16px] font-bold tracking-[-0.01em] text-fg">{t.term}</h3>
        {t.aka?.length ? (
          <span className="text-[12px] text-fg-subtle">also {t.aka.join(", ")}</span>
        ) : null}
        {t.source === null && (
          <span
            className="text-2xs font-bold uppercase tracking-eyebrow text-status-warn"
            title="No primary source cited for this definition"
          >
            #unverified
          </span>
        )}
      </div>

      <p className="mt-1.5 max-w-[70ch] text-[14px] leading-relaxed text-fg-muted">{t.definition}</p>

      {t.commonlyConfusedWith && (
        <p className="mt-2 max-w-[70ch] border-l-2 border-border-strong pl-3 text-[13px] leading-relaxed text-fg-subtle">
          <strong className="font-bold text-fg-muted">Commonly confused with:</strong>{" "}
          {t.commonlyConfusedWith}
        </p>
      )}

      <p className="mt-2 text-[11px] text-fg-subtle">
        {t.source ? (
          <>
            Source:{" "}
            {t.source.url ? (
              <a
                href={t.source.url}
                className="underline decoration-border-strong underline-offset-2 hover:text-accent"
              >
                {t.source.label}
              </a>
            ) : (
              t.source.label
            )}
          </>
        ) : (
          <>
            No primary source cited. Treated as <code>#unverified</code> rather than presented as
            settled.
          </>
        )}
      </p>
    </div>
  );
}

export default function GlossaryPage() {
  const uncited = unsourced();

  return (
    <div className="marketing-bg flex min-h-screen flex-col">
      <Header />
      <PageShell variant="panel" width="narrow">
        <div className="flex flex-col gap-3">
          <div className="eyebrow">Reference</div>
          <h1 className="max-w-[24ch] text-balance text-[clamp(28px,3.6vw,40px)] font-bold leading-[1.08] tracking-[-0.03em] text-fg">
            Glossary
          </h1>
          <p className="max-w-[68ch] text-[15px] font-medium leading-relaxed text-fg-muted">
            Every term this site uses, defined once. A glossary is nothing but technical-factual
            claims, so each entry either names the document it comes from or is marked{" "}
            <code className="text-[13px]">#unverified</code> &mdash; the same rule every other number
            here follows. {GLOSSARY.length} terms, {uncited.length} of them currently uncited.
          </p>
          <p className="max-w-[68ch] text-[14px] leading-relaxed text-fg-subtle">
            Several entries carry a &ldquo;commonly confused with&rdquo; note. Those are the terms
            where a plausible-sounding wrong definition is the usual case rather than the exception,
            and stating the correction is more useful than stating the definition alone.
          </p>
        </div>

        <div className="mt-8 space-y-10">
          {CATEGORY_ORDER.map((cat) => {
            const terms = byCategory(cat);
            if (terms.length === 0) return null;
            return (
              <section key={cat}>
                <h2 className="border-b border-border pb-2 text-[11px] font-bold uppercase tracking-eyebrow text-fg-subtle">
                  {CATEGORY_LABEL[cat]}
                </h2>
                <div>
                  {terms.map((t) => (
                    <Entry key={t.term} t={t} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        <div className="mt-10 rounded border border-border bg-bg-surface p-4">
          <div className="text-[11px] font-bold uppercase tracking-eyebrow text-fg-subtle">
            On the uncited entries
          </div>
          <p className="mt-2 max-w-[68ch] text-[13px] leading-relaxed text-fg-muted">
            {uncited.length} of {GLOSSARY.length} entries have no primary source named. They are
            marked rather than quietly mixed in with the cited ones. Most are terms of art with no
            single authoritative definition &mdash; &ldquo;harvest now, decrypt later&rdquo; is a
            description of a threat model, not a standard &mdash; and one,{" "}
            <code className="text-[12px]">X25519MLKEM768</code>, is a code point we have seen
            negotiated but have not yet confirmed against the IANA registry. Agreement between our own
            table and one implementation is not a primary source.
          </p>
        </div>
      </PageShell>
      <Footer />
    </div>
  );
}
