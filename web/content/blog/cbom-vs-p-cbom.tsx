import { A, Code, H2, Note, P, Prose, Strong, UL } from "@/components/blog/Prose";
import type { PostMeta } from "@/lib/blog/posts";

export const meta: PostMeta = {
  slug: "cbom-vs-p-cbom",
  title: "CBOM tells you what you run. P-CBOM tells you what it costs.",
  date: "2026-08-03",
  category: "Standards",
  summary:
    "A Cryptography Bill of Materials inventories the algorithms in your estate. It says nothing about what they cost to run. P-CBOM is the CC0 extension that closes that gap.",
  sourceNote:
    "Design description sourced to the published P-CBOM specification and tooling at github.com/Q-Advantage/p-cbom. Performance figures are deliberately not quoted here — read them live on Q-Shield, where each one carries its own run and commit.",
};

export default function Post() {
  return (
    <Prose>
      <P>
        A CBOM tells you what cryptography you run. It doesn&rsquo;t tell you what it costs. That gap
        is the whole reason P-CBOM exists.
      </P>
      <P>
        CycloneDX&rsquo;s Cryptography Bill of Materials is a genuinely good artifact, and it&rsquo;s
        arriving at the right time — EO 14412 names the CBOM in federal post-quantum work, which
        means a lot of organisations are about to generate their first one. What it gives you is an
        inventory: this component uses ML-DSA-65, standardised under FIPS 204, implemented by this
        library. Full stop.
      </P>
      <P>
        That is exactly the information you need to answer &ldquo;what do we have?&rdquo; It is
        exactly none of the information you need to answer{" "}
        <Strong>&ldquo;what will it cost us to run this?&rdquo;</Strong> An inventory line for
        ML-DSA-65 doesn&rsquo;t tell you how it performs on the hardware you&rsquo;re about to put it
        on, how large its signatures are on your wire, or how much of your connection budget it eats.
        Those are the numbers a migration is actually planned against, and the CBOM has no slot for
        them.
      </P>

      <H2>What P-CBOM adds</H2>
      <P>
        One thing: a performance record, attached to the same component the CBOM already describes,
        carrying the four fields that make a number checkable rather than quotable —{" "}
        <Strong>a source, a run reference, a commit, and a timestamp.</Strong>
      </P>
      <P>
        That combination is the entire point. A performance figure with no commit and no date is a
        claim. The same figure carrying the run that produced it is a measurement someone else can
        reproduce or dispute. Attaching it to the inventory entry means the artifact your auditor
        already asks for starts carrying the evidence your architect already needs.
      </P>

      <H2>The design constraint, which is the interesting part</H2>
      <P>
        P-CBOM does <em>not</em> extend CycloneDX&rsquo;s <Code>cryptoProperties</Code> object. That
        schema is closed by design, and adding a custom key inside it would produce documents that
        fail validation — which would make the extension worse than useless, because it would break
        the very tooling ecosystem that gives the CBOM its value.
      </P>
      <P>
        Instead it rides in the <Code>properties[]</Code> array, CycloneDX&rsquo;s own sanctioned
        extension point, under a dedicated namespace. The consequence is the design goal:{" "}
        <Strong>
          a tool that has never heard of P-CBOM still parses the document as valid CycloneDX and
          quietly ignores the extra fields.
        </Strong>{" "}
        No forks, no dialect, no flag day. Extending an ecosystem artifact that regulation already
        references beats inventing a competing one, and the way you earn that is by being invisible
        to anything that doesn&rsquo;t want you.
      </P>

      <Note>
        <Strong>On the numbers in this post — there aren&rsquo;t any.</Strong> That&rsquo;s
        deliberate. Quoting a specific performance figure inside an article about why performance
        figures need provenance would be a small joke at our own expense. The live values, each with
        its own run and commit, are on <A href="/q-shield">Q-Shield</A>; the schema and a worked
        example are in the spec repo.
      </Note>

      <H2>Why we published it CC0</H2>
      <P>
        The specification is CC0; the tooling is Apache-2.0. A standard nobody can adopt without
        asking permission isn&rsquo;t a standard, it&rsquo;s a product with a marketing problem. We
        would rather P-CBOM end up in someone else&rsquo;s emitter, uncredited, than own a format
        nobody uses.
      </P>
      <P>
        There&rsquo;s a self-interested version of that argument too, and it&rsquo;s worth stating
        plainly rather than pretending otherwise: an inventory format that carries measured
        performance data is more useful when there is a continuously-measured source to populate it
        from. We run one. We also think the format should exist whether or not you use ours, which is
        why the spec doesn&rsquo;t name us as the required source.
      </P>

      <H2>Where this goes</H2>
      <P>The open questions are the ones worth watching, and we don&rsquo;t have all the answers:</P>
      <UL>
        <li>
          <Strong>What makes an entry trustworthy?</Strong> A source and a timestamp are necessary.
          Whether they&rsquo;re sufficient depends on whether the source re-runs.
        </li>
        <li>
          <Strong>What happens when the number goes stale?</Strong> A performance record with a
          timestamp from eighteen months ago is honest but not useful. Freshness has to be legible in
          the artifact itself.
        </li>
        <li>
          <Strong>Who else populates it?</Strong> The format is more valuable the moment a second
          independent measurer emits into it.
        </li>
      </UL>
      <P>
        Spec and tooling:{" "}
        <A href="https://github.com/Q-Advantage/p-cbom">github.com/Q-Advantage/p-cbom</A>.
      </P>
    </Prose>
  );
}
