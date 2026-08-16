import { A, Code, H2, Note, P, Prose, Strong, UL } from "@/components/blog/Prose";
import type { PostMeta } from "@/lib/blog/posts";

export const meta: PostMeta = {
  slug: "how-we-measure",
  title: "How we measure — and where our own numbers are soft.",
  date: "2026-08-16",
  category: "Methodology",
  summary:
    "The run protocol, the hardware, the sourcing bar, and the week the audit trail caught our own instance throttling. If you're going to cite a number from here, this is the page that tells you how much weight it holds.",
  sourceNote:
    "Written from the canonical methodology at qadvantage.io/methodology, which is the version that wins if this article ever drifts from it. Steal-time figures are from the runs of 2026-08-13 and 2026-08-15 as committed.",
};

export default function Post() {
  return (
    <Prose>
      <P>
        Everything we publish is meant to be checkable. That&rsquo;s easy to say and slightly
        awkward to live with, because it means publishing the conditions a number was produced
        under even when those conditions are unflattering. This week they were. That part is at the
        bottom, and it&rsquo;s the most useful section here.
      </P>

      <H2>Three pillars</H2>
      <P>
        <Strong>Every benchmark, public.</Strong> Source code, test parameters, scoring engine,
        dataset and full result sets live in a public repository. No paywall, no NDA, no proprietary
        harness. If the harness is secret, the number is an assertion.
      </P>
      <P>
        <Strong>Every run, auditable.</Strong> Benchmarks execute on a schedule, daily, on dedicated
        hardware. Every workflow log is public, every result commit is timestamped, and every data
        point on the dashboard links back to the run that produced it.
      </P>
      <P>
        <Strong>Every score, reproducible.</Strong> The Q-Day Index scoring engine is deterministic
        against the committed dataset — the same inputs produce identical scores to the third
        decimal. Q-Shield numbers reproduce within run-to-run variance on equivalent hardware. If
        you can&rsquo;t reproduce one, that&rsquo;s a bug worth filing, and we&rsquo;d rather have
        the issue than the benefit of the doubt.
      </P>

      <H2>The run protocol</H2>
      <P>
        Q-Shield measures wall-clock performance of the NIST-standardized algorithms: key
        generation, encapsulation and decapsulation for KEMs; key generation, signing and
        verification for signatures. Coverage is FIPS 203 (ML-KEM), FIPS 204 (ML-DSA) and FIPS 205
        (SLH-DSA), measured through{" "}
        <A href="https://github.com/open-quantum-safe/liboqs">liboqs</A> 0.15.0 with{" "}
        <Code>liboqs-python</Code> pinned to the matching version.
      </P>
      <P>Each operation runs 1,000 timed iterations after 50 untimed warmups, with:</P>
      <UL>
        <li>
          timing via <Code>time.perf_counter_ns()</Code>,
        </li>
        <li>the garbage collector disabled,</li>
        <li>the process pinned to a single CPU core.</li>
      </UL>
      <P>
        We record mean, median, p95, p99, standard deviation, min, max and operations per second —
        not just an average, because the shape of the distribution is frequently the whole story.
        ML-DSA&rsquo;s signing loop uses rejection sampling, so its worst case has no realistic
        upper bound; a mean alone would hide that entirely.
      </P>
      <P>
        Each run writes its own file, named by date and commit SHA. Runs are never overwritten. The
        dashboard reads the full series, which is what makes drift visible instead of invisible.
      </P>

      <H2>The sourcing bar</H2>
      <P>
        For the Q-Day Index, every numeric input comes from a peer-reviewed publication or an
        official vendor technical document. Press releases and secondary aggregators don&rsquo;t
        clear the bar, and where a press release conflicts with a published figure,{" "}
        <Strong>the published figure wins.</Strong> A concrete example: one vendor&rsquo;s blog
        describes coherence as approaching 100µs while the corresponding Nature paper says 68µs. The
        dataset cites the paper.
      </P>
      <P>
        Two related refusals, both deliberate. We don&rsquo;t rank raw two-qubit gate fidelity,
        because a figure measured by cross-entropy benchmarking is not the same physical quantity as
        one measured by median ECR error, and putting them in a sorted column would imply otherwise.
        And we don&rsquo;t publish a projected Q-Day year — a projection is only as good as its
        trajectory model, and we haven&rsquo;t built one that survives hostile inspection. The
        historical entries exist so that a future model has something to fit; the model itself stays
        internal until it&rsquo;s defensible.
      </P>

      <H2>Where our own numbers are soft</H2>
      <P>
        The benchmark box is an AWS t3.medium — a burstable instance. Burstable means the host can
        take CPU away from you under contention, which shows up as <em>steal time</em>. Every result
        file carries a runtime-metrics block recording steal time across the timed loop, precisely so
        throttling lands in the audit trail instead of silently corrupting a number.
      </P>
      <P>
        Until recently that block read as reassurance: representative runs sat around{" "}
        <Strong>0.24%</Strong> steal, which is clean, and the planned migration to a dedicated-core
        instance was deferred on that basis. Then it stopped being reassurance and started doing its
        actual job.
      </P>

      <Note>
        <Strong>What happened this week.</Strong> The run of 2026-08-13 carried 0.30% steal. The run
        of 2026-08-15 carried <Strong>10.51%</Strong>. That inflated the classical X25519 baseline
        from 171.7µs to 187.4µs — and because the hybrid-versus-classical comparison is a ratio
        against that baseline, <Strong>the sign of the delta flipped.</Strong> On the 13th, hybrid
        TLS measured 37.1% slower than classical. On the 15th, the same suites measured 17.2%{" "}
        <em>faster</em>. The cryptography did not change. The instance did.
      </Note>

      <P>
        The honest reading is that <Strong>timing deltas from this host are a distribution, not a
        verdict</Strong>, and that the deferral of the instance migration was the wrong call — made
        on a steal-time figure that was true when it was measured and stopped being true later,
        which is the exact failure mode this whole publication exists to complain about. It is now
        scheduled rather than deferred.
      </P>
      <P>
        What does <em>not</em> move: the byte counts. A hybrid X25519MLKEM768 handshake carries 2,336
        bytes against classical X25519&rsquo;s 64 regardless of how busy the host is, because that
        figure is determined by the protocol, not the processor. On the homepage and in the
        comparison views, the wire column is the durable number and the timing column is the noisy
        one. We&rsquo;d rather tell you which is which than present them as equally solid.
      </P>

      <H2>The other limitations, stated up front</H2>
      <UL>
        <li>
          <Strong>liboqs is a prototyping library</Strong>, not a production cryptographic
          implementation. Our numbers are representative of the algorithms; they should not be cited
          as authoritative for a specific production deployment.
        </li>
        <li>
          <Strong>Hardware coverage is narrow.</Strong> x86_64 and Graviton3 today. Broader silicon
          is a deliverable, not a claim.
        </li>
        <li>
          <Strong>Q-Day Index depth is limited</Strong> by how many vendors publish qualifying
          specs. Coverage grows as they do.
        </li>
      </UL>

      <H2>How to challenge a result</H2>
      <P>
        Open an issue or a pull request. Every Q-Shield run logs its commit, CPU model and full
        environment; every Q-Day Index figure carries its source URL, measurement method and the
        date it was true. If you can reproduce a Q-Shield discrepancy of more than two standard
        deviations on equivalent hardware, or you have a sourced correction to an index value, we
        want it — a corrections policy that never gets used usually means nobody is checking.
      </P>
      <P>
        The canonical, always-current version of all of this lives at{" "}
        <A href="/methodology">the methodology page</A>. If this article and that page ever
        disagree, the page wins.
      </P>
    </Prose>
  );
}
