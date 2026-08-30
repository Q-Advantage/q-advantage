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

## Confirmed working, 2026-08-30

CI run `33289960347`, both jobs green. The image built, the stack negotiated, and the pipeline read
the result back out of the wire:

```json
"outcome":  { "outcome": "negotiated", "detail": "Negotiated X25519MLKEM768." },
"negotiated_group": { "code": 4588, "name": "X25519MLKEM768",
                      "identity_verified": false,
                      "source": "wire bytes (ServerHello key_share extension)" },
"client_hello_bytes": 1388,   "server_hello_bytes": 1210,
"packets_total": 19,          "packets_client_to_server": 11,
                              "packets_server_to_client": 8,
"wire_bytes_total": 9489,     "ip_fragments": 0
```

**`packets_total: 19` is the first Layer B measurement this repo has ever produced**, and it closes a
gap Layer A is structurally incapable of answering — the composed harness has no socket, so
"packets per handshake" has been named as unmeasurable in the calculator's own disclaimer since it
shipped. This is a captured count, not an estimate.

Two other things the run confirms: the oqs-provider pin is correct (previously asserted, not
verified), and `/usr/local/include/oqs/sig_stfl.h` is present in the image — **the LMS/XMSS build
flags work**, which is what the rebuild on the measurement host still needs.

`code 4588` is `0x11EC`, matching the mapping in `tls_wire.py`. It remains flagged
`identity_verified: false` because agreement between our table and one implementation is not a
primary source; the IANA registry check is still outstanding.

## What the first CI run caught, and why it mattered

The run before this one built the image, negotiated a real handshake, captured it — and reported
**`no_traffic_captured`**. The handshake was fine; the reader was not. `tcpdump -i any` on a modern
kernel writes `LINKTYPE_LINUX_SLL2` (276), not the `LINUX_SLL` (113) the reader handled, so every
packet fell through and was skipped.

The missing linktype is the shallow half. The dangerous half is the failure mode: **"no traffic
captured" is a real Layer B outcome** — it is exactly what a client that never connected looks like —
so an unreadable capture was indistinguishable from a genuine negative result. An instrument whose
parse failures are silently reported as findings is worse than one that crashes.

`iter_packets` now raises on any linktype it cannot parse, `tcpdump` runs packet-buffered (`-U`), and
the orchestration no longer tears the stack down between the handshake and the flush. Three tests
cover it, including one asserting that an unsupported linktype raises rather than reporting no
traffic.

---

# 014b — The scenarios, and the site

**Status:** in progress, 2026-08-30. Six live scenario jobs green in CI (run `33292970824`).

## What the instrument now measures

| Scenario | Outcome | Packets | Wire bytes | First flight |
|---|---|---|---|---|
| pairwise | negotiated X25519MLKEM768 | 19 | 9,488 | 1,762 B — **fits**, 12,838 B headroom |
| mismatch | **no_server_hello** | 10 | 2,126 | — |
| rtt (±50 ms) | negotiated | **28** | 10,136 | 1,762 B |
| concurrency (50) | 50/50 negotiated | — | — | median 110.8 ms, p95 182.9 ms |
| middlebox — HAProxy 3.0 | negotiated | 18 | 9,416 | fits |
| middlebox — nginx 1.27 | negotiated | 19 | 9,489 | fits |

**Four of these are things Layer A structurally cannot answer.**

1. **Packets per handshake: 19.** Named as unmeasurable in the calculator's own disclaimer since it
   shipped, because a composed harness has no socket.
2. **The initcwnd cliff is not currently binding.** `network-calculator-spec.md` §7 carries the
   ~14.6 KB congestion-window cliff as a qualitative callout by explicit design. Measured, the
   server's first flight for an X25519MLKEM768 handshake is **1,762 bytes** — 12,838 bytes of
   headroom. The cliff is real as a mechanism; at this suite it is nowhere near being hit. That is a
   more useful published statement than the warning it replaces, and it is a number rather than a
   caveat.
3. **This server fails closed.** The deliberately mismatched pair produced `no_server_hello` — a
   clean rejection, not a silent fall back to classical. From outside those two look identical, and
   telling them apart is the whole reason the misconfiguration mode exists.
4. **Both passthrough proxies pass PQC through undamaged**, at 18 and 19 packets against 19 direct.
   Recorded narrowly: this product, this version, this config.

Latency costs packets, visibly: 19 → **28** with 50 ms injected each way.

## Two corrections the real runs forced

**The first RTT run reported 40 µs against 50 ms injected, and nothing was broken.** The capture sits
in the server's network namespace; netem was on the *client's* egress, so the delay happened before
the SYN arrived and the server answered immediately. A server-side observer correctly saw no round
trip. The measurement was right and the label was wrong. The field is now `syn_to_synack_seconds`,
travels with `observed_at` and `is_full_round_trip: false`, and `assert-scenario.py` fails any run
claiming otherwise. The scenario applies the delay to both egress paths — the condition under which
an endpoint capture can see a round trip at all — and it now reads **0.050060 s**.

The generalisation is worth keeping: an endpoint capture measures the network it can see, and
presenting a one-sided observation as a path property is the same class of error as trusting a
stack's own report of what it negotiated.

**The first live run reported `no_traffic_captured` on a capture containing a real handshake.**
`tcpdump -i any` writes `LINKTYPE_LINUX_SLL2` (276); the reader handled `LINUX_SLL` (113) and skipped
every packet. The missing linktype is the shallow half — the dangerous half is that "no traffic
captured" is a *real* Layer B outcome, so an unreadable capture was indistinguishable from a genuine
negative result. The reader now raises on any linktype it cannot parse.

## The site

`/q-shield/layer-b`, fed from `layer-b/results/` through `publish-results.py`.

**`lib/layer-b/derive.ts` is the gate.** `publishableDuration()` is the only supported way to get a
duration out of a result and returns null unless the run asserted the measurement host — the point of
the flag is lost the moment a component reads `duration_seconds` directly. `publish-results.py`
**strips** those durations rather than trusting the site to hide them: a value that never reaches the
bundle cannot be rendered by a component that forgets to ask. Both are asserted by
`scripts/smoke-layerb.ts` against the real committed data.

Also in the gate: `crossedTheCliff()` returns null rather than false when the flight was not
measurable, because not seeing a flight and the flight fitting are different claims; `outcomeTone()`
reads a downgrade as a **finding** rather than an error, since rendering the most valuable thing the
instrument produces in the failure style would bury it; and an unverified group code point always
renders with its marker.

Middlebox results are labelled per product. Two proxies collapsing onto one label would have
silently overwritten one product's finding with the other's.

## Still not done, and why

- **§3b public-endpoint checks.** Buildable and in v1 scope. It is outward-facing, so the trigger
  belongs to a human rather than to an overnight session. It inherits `measurement-ethics.md` whole.
- **Cross-library interop** (BoringSSL, AWS-LC, wolfSSL). Shares this container investment and is the
  natural next build, but it is a real one, not a finish-up.
- **TLS-terminating middlebox, and DPI/inspection appliances.** Different questions from passthrough;
  folding them into the same scenario would produce a result nobody could interpret.
- **Bytes per half-open connection** is refused, not measured. SYN_RECV is genuinely brief under
  honest concurrency and the sampler caught zero observations. Manufacturing more would mean building
  a SYN flood tool. Peak established connections (14) is real and is reported.
- The hybrid group code points remain `#unverified` against the IANA registry. Agreement between our
  table and one implementation is not a primary source.
