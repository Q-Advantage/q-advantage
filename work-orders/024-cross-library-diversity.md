# 024 — Cross-library diversity

**Closes:** `qshield-update-spec.md` §15 Tier 2 (cross-library diversity) — the last Tier 2 item.
**Branch:** `work-order/024-cross-library-diversity`

## What

BoringSSL, AWS-LC and wolfSSL, each built from a pinned source tag in its own image and its own CI
job, each asked what post-quantum primitives the resulting binary actually exposes.

## Why

Every post-quantum number Q-Shield publishes comes from liboqs. That is one implementation, and one
implementation cannot distinguish a property of the **algorithm** from a property of the **library**.
If liboqs were the odd one out — a wrong parameter set, a slow implementation, a mislabelled
mechanism — nothing anywhere in this repo's measurement path would catch it. There has never been a
second opinion.

## What it found

All three built, all three passed their control, all three reported.

| | ML-KEM-512 | ML-KEM-768 | ML-KEM-1024 | Spelling used |
|---|---|---|---|---|
| **AWS-LC** 1.37.0 | ✓ | ✓ | ✓ | both `ml-kem-768` and `kyber768` |
| **BoringSSL** | — | ✓ | ✓ | `ml-kem-768` |
| **wolfSSL** | ✓ | ✓ | ✓ | `kyber768` |

**ML-KEM-768 and ML-KEM-1024 are corroborated by all three independent implementations.** That is
the result the track exists to produce, and it is worth having precisely because it is boring: it is
evidence that a Q-Shield ML-KEM figure describes the algorithm rather than liboqs's rendition of it.

The spellings are informative on their own. AWS-LC's inventory names the same algorithm *both* ways,
mid-migration from the pre-FIPS name; wolfSSL is still entirely on `Kyber`; BoringSSL has moved. A
probe matching only the FIPS spelling would have reported wolfSSL as lacking an algorithm it ships.

## Two absences that are about the probe, not the libraries

Both are stated in the published scope, because a reader who took them at face value would draw
exactly the wrong conclusion from a true observation.

1. **`X25519MLKEM768` appears nowhere.** These probes read each library's own *speed inventory*,
   which lists **primitives**. A TLS group is a negotiation construct, not a primitive, so it does
   not appear in one even in a library that ships it — and BoringSSL negotiates that group in
   production Chrome. Every hybrid-group row means "not visible from this vantage point". Settling
   it needs a handshake, which is Layer B's job, not this track's.
2. **No ML-DSA row appeared in any of the three** — including a wolfSSL build configured with
   `--enable-dilithium`. Unresolved, published as unresolved, flagged `#unverified`. It may be that
   these speed tools cover KEMs and not signature schemes, or that a flag did not take. It is **not**
   evidence that these libraries lack ML-DSA.

## No timings, deliberately

These builds run on a shared, unpinned, co-tenanted GitHub runner. Every number this product
publishes comes from a dedicated measurement host, and a cross-library *speed* comparison measured
here would undo that in one commit. Availability is a property of the build and is portable in
exactly the way a timing is not. Timing belongs on the measurement host or nowhere.

## The claim boundary

A negative means **"this build, with these flags, did not expose this primitive"** — never "this
library does not support it". A library may support an algorithm behind a flag this image did not
pass, in a version it did not pin, or under a name the alias table does not know. Every
classification carries the raw output lines it came from, so the inference can be checked rather
than trusted.

## The control, and why it exists

The first successful run reported BoringSSL and AWS-LC as exposing **nothing at all**. That is
false; `bssl speed` had simply produced no output, and the probe turned that silence into seven
negative claims about somebody else's software.

A build's output must now name at least one primitive the library certainly implements — RSA, AES,
SHA, ECDSA, X25519 — or the probe reports `inconclusive` and publishes **no negative at all**: not an
empty list, no `exposed`/`not_exposed` keys, so nothing can read absence out of it. An `inconclusive`
row is not counted as having reported, or a broken invocation would become corroborating silence.

That rule caught a second bug immediately: with the control in place, both `bssl` runs came back
`inconclusive` because a full `bssl speed` inventory takes longer than the 180-second cap it was
given. Raising it to 900s is what produced the table above.

This is the third probe in three work-orders to need a control of exactly this shape — a failing
classical baseline points at the instrument, not at post-quantum. It should have been there first.

## Not in scope

**API-level equivalence.** Two libraries exposing ML-KEM-768 is not two libraries agreeing on what
ML-KEM-768 *produces*. Checking that needs shared test vectors driven through each library's own API
— a small C program per stack rather than a CLI inventory — and it is the natural next slice, and the
one that would turn corroboration into genuine cross-validation.
