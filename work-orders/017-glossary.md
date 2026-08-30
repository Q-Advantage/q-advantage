# 017 — The glossary

**Status:** in progress, 2026-08-30. Source: `qshield-update-spec.md` §5, the lowest-priority item on
that list and the one deferred through work-order 003.

## Why it is not just a list of definitions

The spec calls this "content work, not engineering", and it mostly is. But this repo has a sourcing
standard that changes the shape of the job:

> Any technical-factual claim (an OID, a security level, an algorithm identity, a reference figure)
> must be cited to a primary source, or flagged `#unverified`. An uncited identity block is the same
> failure mode as a fabricated benchmark.

**A glossary is nothing but technical-factual claims.** So every entry either names the document it
comes from or is explicitly `null`, and `glossary.test.ts` refuses to let an entry ship with neither.
The page marks the uncited ones and prints the count, so an entry drifting into that pile has to be a
visible choice rather than an omission nobody noticed.

`null` rather than `undefined` is doing work there: `undefined` is an entry nobody decided about,
`null` is a decision the page then surfaces.

## The corrections are the point

Several of these terms attract a plausible-sounding wrong definition as the *usual* case rather than
the exception. Those entries state the correction, not just the definition:

- **SLH-DSA vs LMS/XMSS.** All three are hash-based. SLH-DSA is *stateless*; the other two are not,
  and reusing a leaf index breaks the guarantee completely. That word is the whole difference between
  a drop-in replacement and something that needs careful state persistence — which is why LMS and
  XMSS belong to firmware signing rather than TLS.
- **ML-KEM vs Kyber.** Closely related, not interchangeable: FIPS 203 differs from the Kyber
  submission, so an implementation of one is not automatically an implementation of the other.
- **Composed handshake.** Not a handshake timed end to end. There is no socket and no network, which
  is exactly why packets, fragmentation and congestion behaviour are unmeasurable at Layer A.
- **Confidence interval vs standard deviation.** The one this site most needs a reader to get right,
  since both now appear next to each other on every algorithm page.
- **AES-GCM.** Not something that needs replacing. The migration is a public-key problem.
- **initcwnd.** Not a fixed property of the network — a tunable default, which is why any verdict
  about crossing it must state the value it assumed.

## Uncited entries, and why each one is

Five of twenty-three. Most are terms of art with no single authoritative definition — "harvest now,
decrypt later" describes a threat model, not a standard. One is different in kind:
`X25519MLKEM768`'s code point is a value we have watched get negotiated in Layer B, but agreement
between our own table and one implementation is not a primary source. It is flagged here and in the
Layer B output, consistently.

## Tests

15 cases. The load-bearing ones are about the standard rather than the content: every entry has a
decided source, no source is a bare URL (a link rots, a document name survives it), the uncited set
stays a minority, anchors are unique and URL-safe, and each term appears in exactly one rendered
category. Four assert that specific corrections survive editing — the stateless/stateful distinction,
the confidence-interval confusion, and the unverified code point.

## Not in this work-order

§5's three-way Table/Chart/Radar split, which needs `CompareView` decomposed and is not content work.
