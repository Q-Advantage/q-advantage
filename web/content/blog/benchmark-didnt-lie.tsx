import { A, Code, H2, Note, P, Prose, Strong } from "@/components/blog/Prose";
import type { PostMeta } from "@/lib/blog/posts";

export const meta: PostMeta = {
  slug: "benchmark-didnt-lie",
  title: "The benchmark didn't lie. The library changed underneath it.",
  date: "2026-07-27",
  category: "Methodology",
  summary:
    "Why static PQC benchmark numbers rot within weeks — and why continuous cross-validation against eBACS and liboqs, not a one-time report, is the only defensible way to measure post-quantum performance.",
  sourceNote:
    "Figures from the Q-Shield run of 2026-07-26 08:18 UTC, commit d8df129, with protocol and cross-architecture figures from the same day's protocol tracks. Historical by design — the point of the piece is that they move.",
};

export default function Post() {
  return (
    <Prose>
      <P>
        Nothing about the math changed. The labels did — and if you were diffing benchmark output by
        algorithm name instead of by what the algorithm actually does, you&rsquo;d have silently lost
        your own historical series and never noticed.
      </P>

      <H2>The thing static numbers can&rsquo;t survive</H2>
      <P>
        Here&rsquo;s what happened on our own box. liboqs 0.15 shipped, and SLH-DSA&rsquo;s two
        most-used parameter sets stopped being called what they used to be called. They now expose as{" "}
        <Code>SLH_DSA_PURE_SHAKE_128S</Code> and <Code>SLH_DSA_PURE_SHAKE_128F</Code> — the{" "}
        <Code>PURE</Code> prefix and the underscored form are new. Nobody emailed us. Nothing in the
        release notes was framed as a breaking change for a benchmark pipeline. We just started
        getting output that didn&rsquo;t match the shape of last month&rsquo;s, and had to go figure
        out why.
      </P>
      <P>
        That&rsquo;s a small, boring, entirely typical event in the life of a cryptography library.
        It&rsquo;s also the whole argument for this post. A report commissioned in March and
        delivered in June cannot know that the algorithm it measured got renamed in between — worse,
        it can&rsquo;t know whether the <em>numbers</em> moved too, because nobody re-ran it to
        check. A dashboard that runs daily catches the rename the morning it ships, because the
        parser either finds the name it expects or it doesn&rsquo;t.
      </P>

      <H2>Why this matters more in PQC than anywhere else</H2>
      <P>
        Every FIPS-approved post-quantum algorithm is new enough that its implementations are still
        moving targets. Silicon changes — we run the same suite on Intel Xeon and on AWS Graviton3
        and get meaningfully different pictures. Compilers change. And the reference libraries
        themselves are still being actively developed: liboqs ships new releases with performance
        regressions, performance wins, and cosmetic renames, on a cadence measured in months.
      </P>
      <P>
        The standards bodies gave you three approved signature schemes and told you they&rsquo;re all
        valid. They did not tell you that the roughly seven-and-a-half-thousand-fold gap between the
        fastest and slowest of them is a number that will look different again next quarter — not
        because the cryptography changed, but because the library implementing it did.{" "}
        <Strong>
          A benchmark that can&rsquo;t tell you when its numbers were true is a benchmark you
          can&rsquo;t rely on to make a deployment decision.
        </Strong>
      </P>
      <P>
        There&rsquo;s a compliance clock underneath all of this, which is what turns interesting
        engineering trivia into someone&rsquo;s actual deadline. NIST IR 8547, the EU&rsquo;s NIS-CG
        roadmap, and the UK NCSC&rsquo;s migration timeline all converged independently on the same
        shape: deprecation of RSA and ECC starting 2030, full disallowance by 2035. Three regulatory
        bodies, one target, arrived at separately. That&rsquo;s a real deadline, which means the
        algorithm-selection decisions being made against it are real decisions — and a real decision
        deserves a number that&rsquo;s still true when someone checks it.
      </P>
      <P>
        This is the case for why eBACS is our friend rather than a competitor.{" "}
        <A href="https://bench.cr.yp.to/">eBACS</A> and the liboqs speed tools are the reference the
        field already trusts for raw cycle counts. We don&rsquo;t try to beat those numbers or
        replace them — every Q-Shield run is cross-checked against them as a sanity floor. What we
        add is the part a point-in-time reference table structurally cannot provide: the same
        measurement, repeated on the same hardware, every day, so the <em>drift</em> becomes visible
        instead of invisible. Cite-don&rsquo;t-fight is the posture, because the alternative —
        quietly disagreeing with the field&rsquo;s own reference numbers without saying so — is how
        you lose the argument before anyone reads your data.
      </P>

      <H2>The numbers, as of that morning</H2>
      <P>
        The run of 2026-07-26, 08:18 UTC, commit <Code>d8df129</Code>, put ML-DSA-65 signing at
        185.1µs against SLH-DSA-SHAKE-128s at 1.397s — a <Strong>7,500× gap</Strong>, both
        FIPS-approved, both defensible, and the standard doesn&rsquo;t pick between them for you.
        Widen the lens and SLH-DSA&rsquo;s own fast-versus-small tradeoff is 20.6×, while
        ML-DSA&rsquo;s smallest-to-largest parameter set spans 2.02× on signing alone. None of these
        are exotic edge cases — they&rsquo;re the first three numbers anyone comparing FIPS 204
        against FIPS 205 will hit.
      </P>
      <P>
        Cross-architecture, the picture gets more specific than &ldquo;PQC is faster&rdquo; or
        &ldquo;PQC is slower.&rdquo; Pure ML-KEM-768 key exchange beat X25519 by 62.5% on x86 and by
        47.6% on Graviton3 — both real, both current, and notably different from each other. But the
        number every TLS-facing team actually needs is the <em>hybrid</em> figure, because nobody
        ships pure ML-KEM alone yet: X25519 combined with ML-KEM-768, as an actual TLS handshake, ran{" "}
        <Strong>38.3% slower than plain X25519 on x86</Strong> and 52.3% slower on ARM — because a
        hybrid handshake pays for both algorithms, not instead of the classical one. That&rsquo;s the
        honest answer to &ldquo;what does turning on hybrid PQC cost me,&rdquo; and it&rsquo;s a
        different question from &ldquo;is ML-KEM fast.&rdquo;
      </P>
      <P>
        It&rsquo;s not an X25519 quirk either. Swap the classical side for SecP256r1 — the NIST curve
        rather than the Bernstein one — and the hybrid handshake still ran slower than the classical
        baseline alone: 48.9% on ARM, 37.5% on x86. Different curve, same shape of cost. If your
        stack is standardized on P-256 because of internal policy or an HSM constraint, that&rsquo;s
        the figure that applies to you, and it&rsquo;s not the one most people quote.
      </P>

      <Note>
        <Strong>Where the number is soft.</Strong> Our benchmark box is an AWS t3.medium — a
        burstable instance, one physical core, two logical. Under sustained load, CPU steal shows up.
        We measure it and publish it next to the numbers rather than pretending the hardware is
        quiet. Lattice-signature timings on this box should be read as upper bounds, not floors,
        until a planned move to a dedicated-core instance removes the caveat. We&rsquo;d rather tell
        you where a number is soft than have you find out later that we didn&rsquo;t.
      </Note>

      <P>
        &ldquo;Continuous&rdquo; isn&rsquo;t a slogan here — it&rsquo;s a scheduled job, running
        daily, writing to a public run history that supersedes rather than overwrites. Every number
        on the dashboard links back to the run that produced it. That&rsquo;s the mechanical
        difference between an instrument and a snapshot: a snapshot is a document someone emails you
        once; an instrument is something you can check again next Tuesday and get an answer,
        including &ldquo;it changed, and here&rsquo;s exactly when.&rdquo;
      </P>

      <H2>What this means if you&rsquo;re the one signing off</H2>
      <P>
        If you&rsquo;re choosing between ML-DSA and SLH-DSA for a system that has to survive an
        auditor&rsquo;s questions in eighteen months, the number you cite today needs to still be
        true when someone checks it. That means two things in practice. First: don&rsquo;t copy a PQC
        performance figure out of a vendor deck or an analyst report into an architecture decision
        record without a date and a source attached — the figure has a shelf life, and the record
        should say so. Second: prefer a source that re-runs itself. Not because continuity is a
        feature we&rsquo;re selling, but because a number that can&rsquo;t be re-verified against a
        live, dated run is functionally a rumour, no matter how official the document it&rsquo;s
        printed in looks.
      </P>
      <P>
        The practical test is simple. Ask whoever handed you a PQC benchmark number: what commit,
        what date, what hardware, and does it still match if you ran it again this morning? If the
        answer is a shrug, you don&rsquo;t have a measurement — you have a press release with a chart
        attached.
      </P>
      <P>
        If you&rsquo;re the one who has to explain the choice upward rather than make it, the same
        test just moves up a level. &ldquo;Why this algorithm&rdquo; is a question an auditor will
        eventually ask in exactly that form, and &ldquo;a vendor told us&rdquo; doesn&rsquo;t survive
        it. &ldquo;Here&rsquo;s the run, here&rsquo;s the commit, here&rsquo;s the date, and
        here&rsquo;s what changed since&rdquo; does.
      </P>

      <H2>The takeaway</H2>
      <P>
        A library update quietly renamed two of the algorithms we benchmark daily, and the only
        reason it cost us an hour instead of costing someone else a bad migration decision is that we
        were looking the same week it happened, not the same quarter. That&rsquo;s not a flattering
        story about foresight. It&rsquo;s an honest one about why a snapshot and an instrument are
        not the same kind of thing — and <em>receipts, not press releases</em> only means something
        if the receipts are dated.
      </P>
    </Prose>
  );
}
