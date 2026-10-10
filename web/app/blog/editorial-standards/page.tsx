import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/chrome/Header";
import { Footer } from "@/components/chrome/Footer";
import { BrandClose } from "@/components/chrome/BrandClose";
import { Prose, H2, P } from "@/components/blog/Prose";
export const metadata: Metadata = { title: "Editorial standards", description: "Coldproof’s evidence-first research and human publication review policy.", alternates: { canonical: "https://coldproof.io/blog/editorial-standards" } };
export default function EditorialStandards() {
  return <div className="coldproof-site research-page"><Header /><main><div className="cpv2-wrap"><article className="research-standards-page research-body"><Prose><Link href="/blog" className="text-link">← Research</Link><div className="eyebrow mt-8">Our editorial standard</div><h1 className="my-6 text-4xl font-bold leading-tight text-fg">Evidence before estimates.</h1>
    <P>Coldproof does not publish numbers merely because an AI model can generate them. Every substantive financial claim must be measured, independently sourced, or explicitly modelled with disclosed assumptions.</P>
    <H2>How we classify evidence</H2><dl className="space-y-5">{[
      ["Measured", "Link to the measurement record, method, hardware or environment, and date. Report uncertainty and limits."],
      ["Independently sourced", "Identify the original source, publication date and relevant context. A quotation or vendor claim is not our measurement."],
      ["Modelled", "Disclose the calculation, inputs, units, scenario and sensitivity. An estimate is not an observed result."],
      ["Assumption", "Label the input explicitly and explain its role. Do not present a scenario assumption as an established fact."],
      ["Unverified", "Identify the gap. Unknown information must not silently become a numeric input or a factual conclusion."],
    ].map(([term, meaning]) => <div key={term}><dt className="font-bold text-fg">{term}</dt><dd>{meaning}</dd></div>)}</dl>
    <H2>Human review before publication</H2><P>AI tools may assist with research, drafting, calculations and graphics. A human editor must review the evidence, assumptions, claims and approved assets before publication. Approval metadata records that decision; the founder’s review and merge remain the operational publishing gate.</P>
    <H2>Traceability and revisions</H2><P>Research reports should include methodology, financial assumptions, sources, limitations and uncertainty. Material changes should carry an updated date and report version. Historical publications retain their original dates and source notes; appearance in the archive does not imply that they have been re-audited.</P>
    <P>Questions or corrections? <Link href="/contact" className="text-link underline">Contact Coldproof</Link>. For measurement details, see our <Link href="/methodology" className="text-link underline">methodology</Link>.</P>
  </Prose></article></div></main><Footer /><BrandClose /></div>;
}
