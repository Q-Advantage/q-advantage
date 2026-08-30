# 014 — Layer B v1 foundation

**Status:** in progress, 2026-08-30. Spec: `q-advantage-vault/10-strategy/layer-b-spec.md` §3a.

## Why now

Layer B had been queued for two months as a large, blocked item. It is not blocked. §3a is Docker
containers — no EC2, no EventBridge, no self-hosted runner, no AWS credentials — so it builds and runs
on any machine and in CI today. The spec's own estimate for the whole thing is 2.5–3 weeks, but it
names the reference-stack containers as *"the foundational piece, everything else in this spec sits on
top of it"*. That foundation plus the capture layer and result schema is what this work-order builds.

Layer A composes a handshake in-process: it times each cryptographic phase in its own loop and sums
them. That is what makes the primitive numbers clean, and it structurally cannot produce packets per
handshake, `initcwnd` crossing, fragmentation, RTT degradation, downgrade behaviour, or connections
per core — there is no socket and no network. Seven of §15's Tier 3 gaps trace to that one limit.

## The design rule everything else follows

**Every fact about what was negotiated is read from wire bytes, never from a stack's own report.**

This is Osborne's first finding, and `layer-b-spec.md` §4 makes it binding rather than aspirational:
`s_client`-style output is ambiguous about which group was actually used, and an instrument that
trusts it reproduces the exact reporting gap it exists to expose. `capture/tls_wire.py` parses the
ServerHello `key_share` extension and reports the group from the two bytes on the wire.
`scripts/client.sh` drives traffic and deliberately never parses its own output. The emitted result
publishes the provenance of the claim (`"source": "wire bytes (ServerHello key_share extension)"`)
so no consumer has to take it on trust.

## What is here

- **`layer-b/Dockerfile`** — pinned OpenSSL + liboqs 0.15.0 (matching Layer A exactly, so a difference
  between the layers is a difference in the build, not the distribution) + oqs-provider. **It also
  sets `OQS_ENABLE_SIG_STFL_LMS=ON` and `OQS_ENABLE_SIG_STFL_XMSS=ON`**, deliberately not the
  hazardous keygen flag — so the flags, the KAT vectors and Layer A's `lms_xmss.py` verify-only path
  are all proven correct here *before* anyone rebuilds the box that produces the product's data.
- **`layer-b/compose.yml`** — server, client, and a capture sidecar sharing the server's network
  namespace so the capture is taken at the endpoint. `GROUPS_CLIENT` and `GROUPS_SERVER` are separate
  variables: setting them to non-overlapping lists *is* the deliberate-misconfiguration mode.
- **`capture/tls_wire.py`** — TLS 1.3 record and extension parser. Named groups carry an
  `identity_verified` flag; the hybrid code points are `#unverified` pending a primary-source check
  and say so in every result, per CLAUDE.md's sourcing standard. An unknown code point renders as its
  hex value rather than a guess.
- **`capture/pcap_reader.py`** — dependency-free libpcap reader and TCP reassembler. No scapy, no
  dpkt: METHODOLOGY.md already promises a reader can reproduce our numbers, and that is easier to
  honour with a reader of a well-specified format than a large third-party parser that becomes one
  more thing to pin. IP fragments are **counted, never stitched** — whether a PQC handshake fragments
  is one of Layer B's own outputs.
- **`capture/parse_capture.py`** — capture in, one result file out.
- **`schema/layer_b_result.schema.json`** — the result shape.
- **`.github/workflows/layer-b.yml`** — parser tests on every relevant change; a full image build and
  real captured handshake on Layer B changes and on demand.

## The line the schema enforces

Layer B produces two kinds of output and they are **not** equally portable.

**Structural facts** — packets per handshake, wire bytes, negotiated group, fragmentation, downgrade
outcome — are properties of the protocol exchange. They are identical on a laptop, in CI, and on the
measurement host, so they are publishable from wherever the capture was taken.

**Timings** are a property of the machine. A handshake timed inside a shared GitHub runner is not a
Q-Shield figure. So the result separates them and the timing block carries `publishable: false`
unless the caller explicitly asserts the run happened on the measurement host. A test asserts CI
output is never marked publishable, and the CI job asserts it too.

## Tests

53 pytest cases, none of which need Docker, a network, or liboqs — every capture is assembled byte by
byte from the libpcap and RFC 8446 formats, so the assertions are about the parser and nothing else.
Coverage includes: the negotiated group read from a ClientHello split across two segments (a hybrid
key share does not always fit in one packet, and a reader that only looked at the first would see no
key share at all); a downgrade classified as a labelled outcome; a clean rejection distinguished from
a silent downgrade; HelloRetryRequest as its own outcome; unknown code points never guessed;
retransmissions counted as packets but not double-counted into the parsed stream; and six malformed
captures that must report less rather than raise.

## Not in v1, named so it does not grow silently

Per spec §6: the middlebox stack (nginx/HAProxy/Envoy/Suricata — the spec's own *"most likely to be
underestimated"* item), cross-region RTT pairs, N-way concurrency orchestration, §3b public-endpoint
checks, multi-hop/proxy-chain telemetry (out per §4 and Osborne's own limit), and any scanning or
fuzzing, which is never in scope per `measurement-ethics.md` §2.

**§7's tension, resolved as the spec directs:** Tier 2's number is *"cryptographic throughput under
load"*; Layer B's is *connections per core*. Two different numbers must never share one casual label.

## Open

The oqs-provider version pin is asserted, not yet confirmed — the CI image build is what confirms it.
The hybrid group code points are `#unverified` against the IANA registry. Neither blocks the
foundation; both are flagged in the code rather than assumed.
