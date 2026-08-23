import type { Metadata } from "next";
import { PageShell } from "@/components/chrome/PageShell";
import { Caveat, Section } from "@/components/product/kit";
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
        <div className="eyebrow">Standard · free, no signup</div>
        <h1 className="max-w-[20ch] text-balance text-[clamp(30px,4vw,44px)] font-bold leading-[1.05] tracking-[-0.03em] text-fg">
          P-CBOM Snippet Generator
        </h1>
        <p className="max-w-[62ch] text-[17px] font-medium leading-relaxed text-fg">
          P-CBOM extends CycloneDX&rsquo;s Cryptography Bill of Materials — the standard EO 14412
          (June 2026) already names in federal PQC work — with a cited performance record, rather than
          forking it. Pick an algorithm and operation Q-Shield measures below and get back a real,
          downloadable record: no signup, no upload, nothing leaves your browser.
        </p>

        <div className="grid gap-4 border-t border-border pt-5 sm:grid-cols-3">
          {[
            {
              k: "What it is",
              v: "A hosted front-end for Q-Advantage/p-cbom's published spec and reference emitter — same schema, same fields, not a redesign.",
            },
            {
              k: "The problem",
              v: "A CBOM says an algorithm is present. It says nothing about what that algorithm costs to run.",
            },
            {
              k: "What you get",
              v: "A P-CBOM v0.1 record — native or CycloneDX-compatible — carrying real Q-Shield timing and its own citation.",
            },
          ].map((c) => (
            <div key={c.k} className="min-w-0">
              <div className="eyebrow">{c.k}</div>
              <p className="mt-1 text-[13px] leading-relaxed text-fg-muted">{c.v}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ------------------------------------------------------- generator */}
      <Section eyebrow="Generate" title="Pick an algorithm">
        <PcbomTool entries={entries} arch={arch} />
      </Section>

      {/* --------------------------------------------------------- caveats */}
      <Section eyebrow="Scope" title="Caveats">
        <div className="space-y-3">
          <Caveat label="Coverage">
            Only algorithms Q-Shield has actually measured are listed — nothing here is interpolated or
            guessed. ML-KEM currently appears only where a pure (non-hybrid) composed suite exists in
            Q-Shield&rsquo;s TLS track; ML-DSA and SLH-DSA come from the signature track. LMS/XMSS and
            AES-256-GCM are measured elsewhere on the site but not yet wired into this generator.
          </Caveat>
          <Caveat label="Scope">
            P-CBOM v0.1 binds to algorithm-scope assets only. A full composed handshake (a hybrid TLS
            suite like X25519+ML-KEM-768) is a protocol asset — v0.2 scope, not generated here.
          </Caveat>
          <Caveat label="Baseline convention">
            Where a classical-baseline comparison is shown, a negative <code>pct_over_classical</code>{" "}
            means the post-quantum algorithm is faster than the classical one it replaces — the same
            signed convention the P-CBOM schema defines.
          </Caveat>
        </div>
      </Section>

      {/* ---------------------------------------------- sources & citations */}
      <Section eyebrow="Provenance" title="Sources & Citations">
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
