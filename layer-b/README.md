# Layer B — live-handshake benchmarking

Spec: `q-advantage-vault/10-strategy/layer-b-spec.md`. This directory is **§3a's
controlled testbed**, v1 foundation only.

## What Layer A cannot answer, and why this exists

Layer A (`benchmark/`) composes a handshake in-process: it times each
cryptographic phase in its own loop and sums them. That produces clean,
comparable primitive numbers, and it structurally cannot produce packets per
handshake, `initcwnd` crossing, fragmentation, real RTT degradation, downgrade
behaviour, or connections per core — because there is no socket and no network.

Layer B runs two containers we control, negotiating a real TLS handshake over a
real network, captured with `tcpdump`.

## The one non-negotiable design rule

**Everything about what was negotiated is read from wire bytes, never from a
stack's own report string.**

This is Osborne's first finding (`layer-b-telemetry-methodology-check.md`) and
`layer-b-spec.md` §4 makes it binding rather than aspirational: `s_client`-style
output is ambiguous about which group was actually used, and a measurement
instrument that trusts it reproduces the exact reporting gap it exists to
expose. `capture/tls_wire.py` parses the ServerHello `key_share` extension and
reports the group from the two bytes on the wire.

## What is in v1

- `Dockerfile` — pinned OpenSSL + liboqs + oqs-provider reference stack
- `compose.yml` — server, client and a capture sidecar on a shared bridge
- `capture/tls_wire.py` — TLS record/handshake parser over captured bytes
- `capture/parse_capture.py` — pcap → one result file
- `schema/layer_b_result.schema.json` — the result shape
- Deliberate-misconfiguration mode, so a downgrade is a **labelled outcome**
  rather than an error nobody classified

## What is deliberately NOT in v1

Named so it does not grow silently, per spec §6: the middlebox stack
(nginx/HAProxy/Envoy/Suricata), cross-region RTT pairs, N-way concurrency
orchestration, §3b public-endpoint checks, multi-hop/proxy-chain telemetry, and
any form of scanning or fuzzing — the last is never in scope, per
`measurement-ethics.md` §2.

## Timing numbers from this directory are not Q-Shield figures

A handshake timed inside CI, or on a laptop, is not a published measurement.
Layer B's *structural* outputs — packet counts, byte counts, negotiated group,
fragmentation, downgrade outcome — are properties of the protocol exchange and
are meaningful wherever they run. Its *timings* are not, until it runs on the
measurement host. The result schema separates the two so nothing can quietly
cross that line.
