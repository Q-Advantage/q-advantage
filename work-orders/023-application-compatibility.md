# 023 — Application compatibility

**Closes:** `qshield-update-spec.md` §15 Tier 2 (application compatibility).
**Branch:** `work-order/023-application-compatibility`

## What

Two probes that ask what happens when real software, on its **default configuration**, meets
post-quantum-sized artifacts.

- **`probe_headers`** — tokens of the JOSE track's measured sizes, sent at three HTTP front doors
  with three different defaults, in both of the carriers a token actually travels in.
- **`probe_parsers`** — real ML-DSA certificates handed to tooling that does not know the algorithm.

## Why now

The spec calls this *"curated test-matrix work — the harder part is choosing representative
software, not the mechanics of running it."* That was right, and it was also blocked on something:
there were no oversized post-quantum artifacts to run anything against. Work-order 021 minted real
ML-DSA chains and 022 measured real token sizes, so the input now exists.

## The question that makes it worth building

Not *"does it break"* but **"does it break quietly."**

A rejection with `431 Request Header Fields Too Large` costs an engineer about four seconds. A bare
`400`, or a silent connection reset, costs a week — and it is exactly the kind of thing that shows
up in a failed migration rather than in a benchmark chart. Both are "it broke." Only one is
survivable, and the difference is invisible unless somebody actually sends the request.

## What the first real run found

**Front doors: nothing broke.** nginx, HAProxy and Node.js each accepted every token size tested up
to ML-DSA-87's ~6.5 KB, on default configuration, in an `Authorization` header. That is a useful
negative result and it is published as one.

**Certificate parsers: the reassuring middle outcome.** Stock OpenSSL with only the default provider
read every ML-DSA certificate's subject, expiry and serial, and could not read the public key —
`parsed_structure_key_opaque`, not `refused_the_file`. That distinction is the whole point of the
probe: an inventory built on this is **complete**, and the unknown algorithm is a labelling problem
rather than a data problem. Had it been `refused_the_file`, every ML-DSA certificate would be
invisible to scanners, and an inventory that silently omits the certificates a migration is about is
worse than no inventory.

## Two gaps the first run exposed in the probe itself

Both are fixed, and both are worth recording because they were failures of the instrument rather
than findings about the software.

1. **Only the `Authorization` header was probed.** The JOSE track's finding was about the
   4,096-byte **cookie** default (RFC 6265 §6.1). A clean result would have looked like it
   *contradicted* that finding while never having tested the path it was about. Both carriers are
   now probed and every row says which one it used.
2. **The second parser never ran.** `python-cryptography` reported `not_installed` on every
   certificate, silently reducing "two independent parsers" to one — and one implementation cannot
   distinguish *"this certificate is malformed"* from *"this tool cannot read this algorithm"*,
   which is the entire reason there are two.

## Done looks like

- Every outcome **labelled**, none inferred from absence. A connection that closes with no status
  line is `connection_closed_without_response`, never a fall-through to accepted.
- A failure to connect reported as a **broken probe**, never published as a product dropping
  requests. The CI job fails on that specifically, and only on that — a rejection is the result.
- A run that rejected *every* size, including the classical baseline, says so in words that point at
  the probe rather than at post-quantum.
- Configs set **no buffer tuning in either direction**. Raising a limit would measure the config
  file; lowering it would manufacture the finding.

## The claim boundary

Every limit exercised is a **configurable default**, not a protocol constant. A rejection is a
statement about what happens to somebody who deploys without changing anything — which is what most
people do — and nothing more. Stock builds, named and versioned. No claim about any product's
roadmap, intent, or suitability relative to another.

The header probe **exercises no algorithm at all**: the tokens are filler of a measured *length*.
That is deliberate, and it means these results hold regardless of which post-quantum scheme is
eventually deployed.

## Not in scope

TLS-terminating middleboxes negotiating post-quantum groups — that is the existing `middlebox`
scenario, a different question. Java/JSSE, which the spec names and which needs a JVM in the testbed.
Anything about request *rates*.
