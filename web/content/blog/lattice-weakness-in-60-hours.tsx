import { A, H2, Note, P, Prose, Strong, UL } from "@/components/blog/Prose";
import type { PostMeta } from "@/lib/blog/posts";

export const meta: PostMeta = {
  slug: "lattice-weakness-in-60-hours",
  title: "A model found a lattice weakness in 60 hours. What that does and doesn't mean.",
  date: "2026-07-30",
  category: "Field development",
  summary:
    "An AI model cut the best-known attack on a NIST post-quantum candidate by a factor of 67 million. The algorithm isn't deployed, no production software has to change, and the result still matters.",
  sourceNote:
    "Primary source: Anthropic, “Discovering cryptographic weaknesses with Claude,” published 2026-07-28. Corroborating coverage checked against CSO Online, CyberScoop, The Hacker News, Matthew Green's Cryptography Engineering, and The Quantum Insider — all consistent on the core facts.",
};

export default function Post() {
  return (
    <Prose>
      <P>
        On 28 July, Anthropic published a result worth reading carefully rather than reacting to: a
        model found a genuine, novel weakness in a post-quantum signature scheme. The scheme
        isn&rsquo;t deployed anywhere. No production system needs to change. Both of those things are
        true at the same time as the result being significant, and the gap between those readings is
        where most of the commentary is going to go wrong.
      </P>

      <H2>What was actually found</H2>
      <P>
        The target was <Strong>HAWK</Strong>, a lattice-based signature scheme submitted to
        NIST&rsquo;s post-quantum standardisation process. It is a third-round candidate. It is not
        standardised, not deployed, and not something you have in production.
      </P>
      <P>
        The best-known key-recovery attack on HAWK-256 was cut from roughly 2<sup>64</sup>{" "}
        operations to about 2<sup>38</sup> — <Strong>a reduction of around 67 million-fold</Strong>.
        The route in was a nontrivial automorphism in HAWK&rsquo;s lattice structure, which is a real
        cryptanalytic finding rather than an implementation bug.
      </P>
      <P>The conditions are the part worth sitting with:</P>
      <UL>
        <li>About 60 hours of work.</li>
        <li>Roughly $100,000 in API cost.</li>
        <li>
          One researcher, <Strong>without a background in lattice cryptography</Strong>.
        </li>
      </UL>
      <P>
        It was disclosed to HAWK&rsquo;s authors in June 2026 and handled through coordinated
        disclosure on the NIST mailing list — which is the process working exactly as intended.
      </P>

      <H2>The AES result, which is smaller than the headlines suggest</H2>
      <P>
        The same work produced an attack on a <em>reduced-round</em> AES: 7 of AES-128&rsquo;s 10
        rounds, 200 to 800 times faster than the prior best meet-in-the-middle approach, via a
        technique Anthropic calls Mobius Bridge. It assumes 2<sup>105</sup> chosen plaintexts, which
        is not remotely practical.{" "}
        <Strong>Full AES-128 is untouched.</Strong> Reduced-round attacks are a normal and expected
        part of how block ciphers are studied; they are how margin gets measured, not how ciphers
        get broken.
      </P>

      <Note>
        Anthropic&rsquo;s own framing, which is more restrained than most of the coverage of it:{" "}
        <em>
          neither of these results has a practical impact on today&rsquo;s computer systems; no
          production software will have to change.
        </em>{" "}
        We&rsquo;d rather quote that than improve on it.
      </Note>

      <H2>Why it still matters</H2>
      <P>
        The interesting variable isn&rsquo;t the attack. It&rsquo;s the cost curve behind it. A
        single researcher without domain expertise, in under three days, for the price of a
        mid-range car, moved a published bound on a NIST candidate by twenty-six bits. Whatever you
        think that says about the model, it says something concrete about how quickly the analysis
        surrounding these algorithms can now move.
      </P>
      <P>
        For anyone selecting algorithms, the practical read is narrow and boring, which is usually
        the correct kind:
      </P>
      <UL>
        <li>
          <Strong>Nothing about your migration plan changes.</Strong> ML-KEM, ML-DSA and SLH-DSA are
          the standardised set, and none of them were touched by this.
        </li>
        <li>
          <Strong>Candidate schemes are candidates for a reason.</Strong> This is the review process
          doing the job it exists to do, faster than usual.
        </li>
        <li>
          <Strong>Crypto-agility stops being a slogan.</Strong> If the cost of finding structural
          weaknesses is falling, the ability to change algorithm without re-architecting is worth
          more than it was last year. That&rsquo;s an argument about your own systems, not about any
          particular scheme.
        </li>
      </UL>

      <H2>The thing not to do</H2>
      <P>
        Don&rsquo;t let this become a reason to wait. The predictable misreading — &ldquo;if AI can
        break post-quantum crypto, why migrate at all?&rdquo; — inverts the actual finding. A
        candidate that was never standardised got weakened, under laboratory conditions, by an attack
        requiring 2<sup>38</sup> operations against an algorithm nobody is running. Meanwhile the
        deprecation dates on RSA and ECC have not moved.
      </P>
      <P>
        The honest summary is that the field got faster at examining itself. That&rsquo;s good news
        told in an alarming register, and separating those two is most of the work.
      </P>
      <P>
        Primary source:{" "}
        <A href="https://www.anthropic.com/research/discovering-cryptographic-weaknesses">
          Discovering cryptographic weaknesses with Claude
        </A>
        .
      </P>
    </Prose>
  );
}
