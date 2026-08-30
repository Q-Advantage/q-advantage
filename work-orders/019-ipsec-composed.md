# 019 — `ipsec_composed.py`, the IKEv2 track

**Status:** in progress, 2026-08-30. Source: `qshield-update-spec.md` §15 Tier 2, CFDIR use case 3.12.

## Why this one first, of the five Tier 2 items

It is the only one that **moves the CFDIR use-case count**. Everything shipped so far moved *line
items* — ER, UE, T — while coverage stayed at 2 of 13 fully covered and 6 not covered. 3.12 (Network
layer) goes from **not covered to partial**, which is the first time the denominator has shifted.

The spec also records a correction worth honouring: `calculator-suite-spec.md` assumed a VPN/IPsec
calculator would be *"cheap once Network exists… a reskin of the network calculator's layer 2."*
Checked against the harness, it isn't a reskin — it's a missing track.

## The honest finding, stated rather than hidden

**The crypto multiplicity of an IKEv2 key establishment is identical to a TLS 1.3 handshake's.** Both
peers generate a classical keypair and both derive; the post-quantum key exchange contributes one
keygen, one encapsulation, one decapsulation. So `HANDSHAKE_WEIGHTS` applies unchanged.

The temptation was to invent a different weighting so the track looked distinct. It doesn't, and the
`weights_note` in every result says so — with a test asserting the phrase survives editing, because
this is exactly the kind of thing a later edit quietly "improves".

## What genuinely differs

**The wire encoding.** IKEv2 sends an ECP public value as raw `x||y` (RFC 5903 §7); TLS sends a SEC1
uncompressed point with a leading `0x04`. So:

| | up | down |
|---|---|---|
| IKEv2 `ecp256+mlkem768` | 1,248 | 1,152 |
| TLS `SecP256r1MLKEM768` | 1,249 | 1,153 |

One byte each way. Small, but real — and copying the TLS table across, which is what "a reskin" would
have meant in practice, would have published a wrong number. There is a test asserting the difference
is exactly one byte in each direction.

**The operational context.** An IPsec tunnel rekeys on a timer or byte budget, so the number of key
exchanges over its life is far higher than TLS's one per connection. That multiplier is a property of
a deployment's configuration, not of the cryptography, so it is disclaimed rather than modelled.

## Two gaps named in the output, not just here

**MODP groups are absent, and group 14 in particular matters.** MODP-2048 is still extremely common in
deployed IPsec — arguably the most representative classical baseline of all. It is omitted because
measuring it correctly means using the exact RFC 3526 prime, and **a mistranscribed prime would still
compute a shared secret and still produce a plausible timing while measuring a group that is not
14.** That is a fabricated-identity failure of precisely the kind CLAUDE.md's sourcing standard
exists to prevent. Left unmeasured rather than measured wrongly; the reason ships in the result.

**MACsec shares CFDIR 3.12 and is not measured.** That is why 3.12 renders **partial**, never covered,
even with the track fully populated — there is a test asserting it can't become "covered".

## The baseline choice

Deltas are against `curve25519`, for consistency with the TLS and SSH tracks so a reader can compare
across all three. That is *not* the most representative baseline for deployed IPsec, and the result
says so — which is why `ecp256` is measured **in the same run**, so a same-run delta against the more
realistic classical arm is available to anyone who wants it. Every pairwise delta in the file is
same-run; the 2026-08-16 sign flip came from comparing across passes.

## Suites

`curve25519` (group 31), `ecp256` (group 19), `mlkem768` (pure PQC), `curve25519+mlkem768`,
`ecp256+mlkem768`. Post-quantum arms are carried as an additional key exchange under RFC 9370,
negotiated in IKE_SA_INIT and performed in IKE_INTERMEDIATE.

A suite the runner's liboqs cannot provide reports `unavailable` with the harness's own reason rather
than being dropped — silently omitting rows would make an incomplete run look complete.

## Schema

`identity.protocol` was a closed enum of `["tls", "ssh"]` and rejected the first IPsec record. That is
the enum doing its job: a typo becomes a validation failure rather than a silently orphaned track. Now
`["tls", "ssh", "ipsec"]`, with a test asserting `"ipsek"` is still rejected.

## Tests

16 harness cases and 6 more on CFDIR coverage. The load-bearing ones are about restraint: the wire
sizes are not copied from TLS, the shared weighting is explained rather than disguised, MODP's absence
explains *why*, 3.12 becomes partial and never covered, and the track does not emit a `tls_version`
for a protocol that has no TLS version.

## Still needed to make it run — founder action

`benchmark.yml` is off-limits under guardrail 3, so the track will not run daily until this step is
added alongside the others:

```yaml
      - name: Run benchmark — IPsec/IKEv2 composed (Layer A)
        run: |
          source ~/q-advantage/venv/bin/activate
          python3 benchmark/protocols/ipsec_composed.py \
            --output-dir benchmark/results/protocols
```

`build_manifest.py` discovers tracks by filename prefix, so it needs no change — `ipsec-composed-*`
is picked up automatically once the first file lands. Until then `/q-shield/protocols` shows no IPsec
tab and CFDIR 3.12 correctly still reads "not covered", because coverage is computed from data rather
than declared.

## Not in this work-order

The remaining Tier 2 items: cryptographic throughput under contention, JWT/JOSE composition,
certificate-chain sizing, application compatibility, and cross-library diversity.
