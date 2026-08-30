# 022 — JWT/JOSE composed signing

**Closes:** `qshield-update-spec.md` §15 Tier 2 ("JWT signing, ML-DSA vs RSA-PSS"), and the second
of the two blockers named in CFDIR 3.9's gap text.
**Branch:** `work-order/022-jwt-jose-composition` (stacked on 021)

## What

A composition layer that signs and verifies a real JOSE-shaped token — JWS Compact Serialization,
a realistic claim set, base64url throughout — rather than a bare message, across classical and
post-quantum arms in a single run.

## Why now

The spec named two dependencies for this item. The first — *"RSA-PSS isn't benchmarked at all yet"* —
was closed by `classical_sig.py`. This work-order is the second, and it was the only thing still
standing between CFDIR 3.9 and a non-empty cell.

## The finding

The signature track has published ML-DSA-65's signature as 3,309 bytes since June. In a compact
serialization that signature is base64url-encoded, so it arrives on the wire as **4,412 characters**
— and it arrives inside an HTTP header, where the limits are small, fixed, and enforced by software
nobody in a migration controls.

Composed tokens against the 4,096-byte cookie default (RFC 6265 §6.1):

| Scheme | Token | 4 KB cookie default |
|---|---|---|
| ECDSA-P256 (ES256) | ~414 B | fits |
| RSA-2048 (PS256) | ~660 B | fits |
| ML-DSA-44 | ~3,545 B | fits |
| **ML-DSA-65** | **~4,730 B** | **over** |
| **ML-DSA-87** | **~6,488 B** | **over** |

*(Composed locally from the published signature lengths; the committed figures come from the harness
on the measurement host.)*

That expansion is a property of the **encoding**, not of the algorithm, and it is invisible in every
number this repo published before this track existed. It is the same shape as work-order 021's
congestion finding — a cost that only appears once the primitive is put inside the envelope it
actually travels in — and, like that one, it breaks above a specific parameter set rather than
across the board.

## The claim boundary

**No registered JOSE `alg` identifier is asserted for any post-quantum scheme.** The `alg` header
carries the scheme's own name as a non-standard value, every record says so, and no standardisation
draft is named, cited or anticipated anywhere in the output —
`test_no_standardisation_draft_is_named_anywhere_in_the_output` enforces it. An uncited identity
claim is the same failure mode as a fabricated benchmark.

The classical arms use `PS256` and `ES256`, which are registered in RFC 7518 §3.1. The contrast
between an arm that has an identifier and an arm that does not is part of what this track shows, so
it has to be real on both sides.

The measurement does not depend on which identifier eventually wins: a token's size is driven by the
signature and by base64url, and the `alg` string's own contribution is counted in `header_bytes`
where a reader can see it.

**No verdict on whether a token "fits."** Every limit published is a configurable default, not a
protocol constant. Each carries its source. The judgement needs a reader who knows their own stack.

## Done looks like

- Both arms measured in a **single pass** — the 2026-08-16 sign-flip came from comparing across two.
- Token size and signing speed reported separately and never blended. They move independently here:
  on this host ML-DSA can sign faster than RSA while producing a token that no longer fits a cookie,
  and a single figure would erase exactly that.
- A run where an arm cannot be measured reports `unavailable` with a reason, never `failed` and
  never a zero — the distinction that put a raw exception string on the public compare page for
  thirteen days.
- CFDIR 3.9 moves off *none* **by derivation**, and stops at *partial* rather than *covered*.

## Why 3.9 stops at partial

The use case is named "SSO / SAML". SAML assertions are signed with XML-DSig — a different envelope
with a different size profile — and nothing here measures it. Claiming the row covered would
overstate it by half.

## Not in scope

XML-DSig / SAML assertion sizing. JWE (encrypted tokens) — a different composition. Any claim about
token issuance rates or session storage cost, which are use-case questions rather than measurements.
