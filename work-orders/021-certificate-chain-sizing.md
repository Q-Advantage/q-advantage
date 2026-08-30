# 021 — Certificate-chain sizing

**Closes:** `qshield-update-spec.md` §15 Tier 2 (certificate-chain sizing), §16.2's CFDIR 3.5 gap.
**Branch:** `work-order/021-certificate-chain-sizing`

## What

Mint real certificate chains — classical and post-quantum — and measure what a TLS handshake
actually sends. Then compose that against the initial congestion window and publish the result.

## Why now

CFDIR 3.5 ("TLS certificates") has been sitting at *partial* with the gap text *"timings yes, but
certificate-chain bytes are out of scope — and the chain is the cost here."* That was accurate and
it was also the largest cheaply-closable hole on the coverage page: Layer B's container already
carries `oqs-provider`, so minting an ML-DSA chain is mostly wiring.

There is a second reason, which only became visible once the numbers existed. Earlier the same day
this repo published that the initcwnd cliff `network-calculator-spec.md` §7 warns about **was not
binding**, on the strength of Layer B measuring a real first flight at 1,762 bytes. That measurement
is correct. The conclusion drawn from it was too broad, and certificate sizing is what exposes it.

## Done looks like

- Chains minted with `oqs-provider` and measured as DER, not summed from key sizes.
- Only the leaf and intermediate counted as *sent* — the root is already in the client's trust store
  in the common WebPKI deployment, and counting it would overstate every handshake. The full chain
  is published too, because which figure applies depends on the deployment.
- A comparison against a classical baseline. An absolute chain size prices nothing; a missing
  baseline is refused rather than substituted.
- The congestion consequence published with its assumptions attached, and labelled as what it is.
- CFDIR 3.5 moves to *covered* **by derivation**, not by retyping the row.

## What was measured

CI run `33319905023`, chains minted in the Layer B container:

| Certificate | Leaf | Intermediate | Sent (DER) | vs ECDSA-P256 |
|---|---|---|---|---|
| ecdsa-p256 | 466 | 431 | 897 | — |
| rsa-2048 | 860 | 822 | 1,682 | 1.88× |
| rsa-3072 | 1,116 | 1,078 | 2,194 | 2.45× |
| ML-DSA-44 | 4,059 | 4,020 | 8,079 | **9.01×** |
| ML-DSA-65 | 5,588 | 5,549 | 11,137 | **12.42×** |
| ML-DSA-87 | 7,546 | 7,507 | 15,053 | **16.78×** |

## The correction this produced

Composing a first flight — measured ServerHello from Layer B's captured X25519MLKEM768 handshake,
measured chain, measured CertificateVerify signature — against a 14,600 B window (10 segments at a
1460-byte MSS, RFC 6928):

| Certificate | Composed first flight | Against the window |
|---|---|---|
| ECDSA-P256 | 2,249 B | fits, 12,351 B spare |
| ML-DSA-44 | 11,779 B | fits, 2,821 B spare |
| **ML-DSA-65** | **15,726 B** | **over by 1,126 B** |
| **ML-DSA-87** | **20,960 B** | **over by 6,360 B** |

So the cliff **is** binding — just not where it was first looked for. It is the certificate chain
that crosses it, at ML-DSA-65 and above, not the key exchange.

Layer B could not have seen this: its testbed serves a throwaway ECDSA certificate by design,
because certificate sizing was out of scope for that work. Its flight contains no post-quantum
certificate at all. Both findings are correct answers to different questions, and the page says so
rather than letting them read as a contradiction.

## Two caveats that travel with the numbers

1. **The congestion figures are a composition, not a capture.** Every term is measured; the
   flight's *structure* is assumed — ServerHello, EncryptedExtensions, Certificate,
   CertificateVerify, Finished, with no OCSP stapling, no client authentication, no session ticket.
   A real deployment carrying more pushes the total up, not down. `congestionIsComposed()` reads
   this off the data so the caveat stops printing on its own the day a capture replaces it.
2. **The chain figures are a floor.** Short names, one SAN, no Certificate Transparency extensions,
   where a real WebPKI certificate carries more — which makes a real chain larger, and the
   post-quantum penalty on a real chain larger still.

## The claim boundary

These byte counts bear directly on an active standards debate about shortening post-quantum chains.
The arithmetic of omitting an intermediate is published, because it is arithmetic over measurements.
No draft, mechanism or proposal is named anywhere in the output, and
`test_no_draft_or_mechanism_is_named_anywhere_in_the_output` is where that decision gets re-made if
anyone ever wants to change it. An uncited identity claim is the same failure mode as a fabricated
benchmark.

## Not in scope

Issuance and rotation cost (CFDIR 3.3 — a different use case), chain validation cost in situ, and
anything about how often a chain is re-sent versus resumed.

## The honest way to settle the congestion question

Make Layer B's testbed serve a post-quantum certificate and capture the flight directly. That is now
the most valuable single item left in the Layer B queue.
