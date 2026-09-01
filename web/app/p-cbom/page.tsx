import type { Metadata } from "next";
import { PageShell } from "@/components/chrome/PageShell";
import { Section } from "@/components/product/kit";
import { PcbomTool } from "@/components/pcbom/PcbomTool";
import { getPcbomCatalog } from "@/lib/pcbom/catalog";

export const metadata: Metadata = {
  title: "P-CBOM Snippet Generator",
  description:
    "Pick an algorithm Q-Shield measures, get back a live, cited, downloadable P-CBOM v0.1 record — the performance extension to CycloneDX's Cryptography Bill of Materials.",
};

export const dynamic = "force-static";

/**
 * /p-cbom — P-CBOM algorithm snippet generator. Work-order 012, Capability 1
 * of `pcbom-web-tool-spec.md` (vault). Capability 2 (upload-and-enrich a
 * user's own CBOM) is a separate, later work-order — see the spec's §8 build
 * table and this work-order's "Not in this work-order".
 */
export default function PcbomPage() {
  const { entries, arch } = getPcbomCatalog();

  return (
    <PageShell variant="frame" className="min-w-0 space-y-10">
      {/* --------------------------------------------------------- hero */}
      <div className="flex flex-col gap-4">
        <div className="eyebrow">Free · no signup · nothing leaves your browser</div>
        <h1 className="max-w-[24ch] text-balance text-[clamp(30px,4vw,44px)] font-bold leading-[1.05] tracking-[-0.03em] text-fg">
          Your CBOM says you&rsquo;re running ML-KEM-768.
          <span className="text-accent-ink"> It doesn&rsquo;t say what that costs.</span>
        </h1>
        <p className="max-w-[62ch] text-[17px] font-medium leading-relaxed text-fg">
          A Cryptography Bill of Materials tells you which algorithms are in your estate. It has no
          field for how fast they are, how many bytes they add, or what they cost against the
          algorithm they replaced &mdash; so the inventory that&rsquo;s meant to drive a migration
          budget can&rsquo;t price one.
        </p>
        <p className="max-w-[62ch] text-[15px] leading-relaxed text-fg-muted">
          P-CBOM adds that field. Pick an algorithm below and get a record carrying a real,
          measured, cited number &mdash; ready to drop into the inventory you already have.
        </p>

        {/* Three steps, not three disclaimers. A reader should be able to tell
            from here whether this is worth thirty seconds of their time. */}
        <ol className="mt-2 grid gap-4 border-t border-border pt-5 sm:grid-cols-3">
          {[
            {
              n: "1",
              k: "Pick an algorithm",
              v: "Every algorithm Q-Shield measures, with the operation you care about — keygen, encapsulation, signing, verification.",
            },
            {
              n: "2",
              k: "Get a cited record",
              v: "Native P-CBOM or CycloneDX-compatible, carrying the run it came from, the commit, and the date it was measured.",
            },
            {
              n: "3",
              k: "Check the number",
              v: "Every figure links back to the run that produced it. Nothing here is interpolated, estimated, or typed in by hand.",
            },
          ].map((c) => (
            <li
              key={c.k}
              className="flex min-w-0 flex-col gap-1.5 rounded-lg border border-l-[3px] border-border border-l-accent bg-bg-card px-4 py-3.5"
            >
              <div className="flex items-baseline gap-2">
                <span className="num text-[15px] font-bold leading-none text-accent-ink">{c.n}</span>
                <span className="text-[13px] font-bold text-fg">{c.k}</span>
              </div>
              <p className="text-[12.5px] leading-relaxed text-fg-muted">{c.v}</p>
            </li>
          ))}
        </ol>
      </div>

      {/* ------------------------------------------------------- generator */}
      <Section
        eyebrow="Generate"
        title="Pick an algorithm and an operation."
        hint="Only algorithms Q-Shield has actually measured appear here. If something is missing, it is because no run has produced it — not because it was left out."
      >
        <PcbomTool entries={entries} arch={arch} />
      </Section>

      {/* ------------------------------------------------- what it covers */}
      <Section
        eyebrow="What it covers"
        title="Algorithms, not whole handshakes — yet."
        hint="Stated plainly because it changes what you can do with the output."
      >
        <p className="max-w-[70ch] text-[13.5px] leading-relaxed text-fg-muted">
          A P-CBOM v0.1 record describes one algorithm doing one operation, which is the level a
          CBOM already inventories. A full hybrid handshake &mdash; X25519 together with ML-KEM-768,
          priced as one thing &mdash; is a protocol asset rather than an algorithm, and lands in
          v0.2. Q-Shield already{" "}
          <a
            href="/q-shield/protocols"
            className="font-semibold text-link underline decoration-border-strong underline-offset-2"
          >
            measures those handshakes
          </a>
          ; this generator just doesn&rsquo;t emit them yet.
        </p>
        <p className="mt-3 max-w-[70ch] text-[13.5px] leading-relaxed text-fg-muted">
          Where a record compares against the classical algorithm being replaced, a negative{" "}
          <code>pct_over_classical</code> means the post-quantum one is{" "}
          <strong className="font-bold text-status-ok">faster</strong>. That happens more often than
          people expect, and the sign convention is the schema&rsquo;s, not ours.
        </p>
      </Section>

      {/* ---------------------------------------------- sources & citations */}
      <Section eyebrow="Provenance" title="Where every number comes from.">
        <ul className="space-y-2 text-[12.5px] leading-relaxed text-fg-muted">
          <li>
            <a
              href="https://github.com/Q-Advantage/p-cbom/blob/main/SPEC.md"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-fg underline decoration-border-strong underline-offset-2 hover:text-accent"
            >
              P-CBOM v0.1 spec (CC0)
            </a>{" "}
            — the standard this tool implements.
          </li>
          <li>
            <a
              href="https://github.com/Q-Advantage/p-cbom"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-fg underline decoration-border-strong underline-offset-2 hover:text-accent"
            >
              Q-Advantage/p-cbom
            </a>{" "}
            — the reference implementation this page ports (Apache-2.0 tooling).
          </li>
          <li>
            <a
              href="https://cyclonedx.org/docs/1.6/json/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-fg underline decoration-border-strong underline-offset-2 hover:text-accent"
            >
              CycloneDX 1.6 specification
            </a>{" "}
            — the CBOM standard P-CBOM extends.
          </li>
          <li>
            Every generated record carries its own citation
            (<code>performance.source</code>, <code>ref_url</code>, <code>last_measured</code>,{" "}
            <code>commit</code>) — rendered above the JSON, not only inside it.
          </li>
        </ul>
        <p className="mt-4 text-[11px] text-fg-subtle">
          Q-Advantage is not affiliated with CycloneDX or OWASP. P-CBOM extends their published standard;
          it does not carry any formal endorsement or relationship.
        </p>
      </Section>
    </PageShell>
  );
}
