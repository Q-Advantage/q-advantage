# 018 — Classical signature baselines

**Status:** in progress, 2026-08-30. Source: `qshield-update-spec.md` §2, and §16.3's **T** line item.

## Why this one, of everything left

The signature track has published ML-DSA, Falcon and SLH-DSA numbers since June with **nothing to
read them against**. §16.3 makes the consequence precise: CFDIR's **T** line item wants *"the
classical-vs-PQC delta per use case"*, and without a classical arm there is no delta — only an
absolute figure. TLS has had its classical arm (X25519) all along; signatures never did.

It was also the cheapest Tier-2-adjacent item with a real downstream unblock, which is why it ran
ahead of the rest of Tier 2.

## What ships

`benchmark/protocols/classical_sig.py`: **RSA-2048-PSS, RSA-3072-PSS, ECDSA-P256, ECDSA-P384**,
keygen/sign/verify timed in the same house style as everything else, with measured signature and
public-key sizes.

Measured locally to confirm the shape (not published figures — these came off a laptop):

| Scheme | sign | verify | keygen | sig | pubkey |
|---|---|---|---|---|---|
| RSA-2048-PSS | 459 µs | 44 µs | 29.7 ms | 256 B | 294 B |
| RSA-3072-PSS | 1.34 ms | 75 µs | 130 ms | 384 B | 422 B |
| ECDSA-P256 | 21 µs | 60 µs | 13 µs | 71 B | 91 B |
| ECDSA-P384 | 590 µs | 554 µs | 576 µs | 102 B | 120 B |

## Three decisions worth defending

**They live in the signature track, not a track of their own.** On 2026-08-16 the composed-TLS
harness measured its baseline in one pass and its suites in another, then compared across them; on a
host with this much run-to-run movement the two passes landed in different modes and a published
delta flipped sign. Putting the classical signature arms in a separate file would have reintroduced
exactly that bug somewhere new. They are benchmarked in the same run, written to the same file, by
the same loop — so a classical-vs-PQC signature delta is always a same-run comparison.

**No pairing is asserted.** "RSA-2048 is the classical equivalent of ML-DSA-44" is a security-level
argument, not a measurement. Each record publishes its documented strength (NIST SP 800-57 Part 1
Rev. 5, Table 2) and a `pairing_note` saying explicitly that no counterpart is named, so the argument
has to be made by whoever is making it. There is a test asserting no post-quantum scheme name appears
anywhere in a classical record.

**RSA key generation is sampled far less, and says so.** It searches for primes: RSA-3072 keygen
measured at 130 ms against ECDSA-P256's 13 µs — four orders of magnitude. Running it at the lattice
iteration count would push the daily run past its timeout. It runs at 20 and 10 iterations
respectively, and because `n_iterations` is already in every stats block, the smaller sample is
self-describing rather than a footnote someone has to find.

## Two details that would otherwise be wrong

**ECDSA signature length is measured, not assumed.** DER encoding is a byte or two shorter when a
component has a leading zero, so a hardcoded 72 would be wrong a good fraction of the time. The
harness publishes what it measured, and the test asserts a range rather than a constant.

**PSS salt length is recorded.** It is a real choice with a real effect on the signature, and leaving
a reader to assume the conventional one is how a benchmark stops being repeatable. Hash, padding and
salt length all travel in the record.

## CFDIR's T line item is now derived, not declared

The harness measures both arms as of this work-order, but **the record only carries them from the
next daily run onward**. Rather than edit a status string that would be wrong for a day and then
wrong again in the other direction, `hasClassicalSignatureArm()` reads the loaded data and
`lineItemsFor()` rewrites T's blocker once a classical arm has actually landed. The page tells the
truth on the day it happens, with nobody editing anything.

A scheme with no `kind` marker is **not** counted as classical. Every run committed before today
lacks the field, and absent is not the same as post-quantum — guessing there would be exactly the
over-claim the rest of this file guards against.

## Tests

- `benchmark/tests/test_classical_sig.py` — 17 cases. The load-bearing ones: no post-quantum name
  appears in a classical record, the refusal to pair is stated rather than merely absent, the reduced
  RSA keygen sample is visible in the output, ECDSA's signature length is a measured range, and a
  missing `cryptography` package yields an `unavailable` record rather than taking the whole
  signature track down.
- `web/lib/data/cfdir.test.ts` — 9 more cases on the derived T status, including that an unmarked
  scheme is not counted and that nothing else in the line-item table moves.

## Not in this work-order

The rest of Tier 2: concurrency (cryptographic throughput under contention, which must not share
Layer B's label), JWT/JOSE composition, certificate-chain sizing, application compatibility,
cross-library diversity, and `ipsec_composed.py`.
