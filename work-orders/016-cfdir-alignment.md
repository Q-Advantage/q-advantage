# 016 — CFDIR alignment

**Status:** in progress, 2026-08-30. Source: `qshield-update-spec.md` §16.

## The structural fact that governs everything here

§16.1 states it: **CFDIR's framework is use-case shaped; Q-Shield's output is algorithm shaped.**
Their convention 3 is explicit — *"migration will be applied on a use case basis, not a system-wide
basis"* — and their ledger is fourteen named use cases against eleven line items. A CFO-facing cost
model cannot consume `algorithm → operation → timing` directly.

The good news, and it is why this work-order is small: the composed-protocol tracks are **already**
the use-case layer. There are two of them against fourteen use cases. **The gap is breadth, not
shape**, so this is a declaration rather than a re-architecture.

## What ships

**Each composed track declares which CFDIR use case it prices**, in the record itself
(`identity.use_cases`). `tls_composed` → `cfdir-3.4` (TLS cipher suites). `ssh_composed` →
`cfdir-3.13` (SSH/SFTP distributed).

Both declarations are deliberately **narrow**. TLS does not also claim 3.5 (TLS certificates),
because the certificate chain is out of scope for this measurement and the chain is the cost in 3.5.
SSH does not claim 3.14, which needs a key-management dimension this track lacks. Over-claiming here
would be worse than not declaring at all, because a cost model would then trust it — so there is a
test for each non-claim, not just for each claim.

**Why declare it per track rather than in a table.** CFDIR's own assumption 8 warns that *"redundant
costs may be accounted for in different line items… It is left to the reader to ensure that this does
not occur."* They punt it. Once anything sums several tracks, double-counting is a live arithmetic
risk — their own worked example is TLS cipher suites and TLS certificates riding the same server
upgrade. A per-track declaration makes de-duplication mechanical rather than editorial.

**The framework version is pinned** (`identity.cfdir_framework: "v.01"`), the same way liboqs and
OpenSSL versions are. Their document is dated 2026-06-29 and states it will be reviewed annually, so a
revision is a methodology event here rather than a silent change in what our mapping means.

**The TLS version is recorded explicitly** (`identity.tls_version: "1.3"`) rather than implied by the
suite name. This is the inherent/net boundary drawn through the measurement: CFDIR notes that PQC
migration may also require moving from TLS 1.2 to 1.3, and that this uplift is **independent** of
quantum-safe migration. A classical arm on 1.2 would silently bundle that uplift into every delta
published as the PQC increment — inflating the net figure by exactly the amount their document warns
about. We were already correct; the requirement was to make the choice defensible rather than
incidental.

## The Operating Cost Delta, and why there is no total

§16.4.3, and the reason is specific to our data rather than general caution: **pure ML-KEM is faster
than X25519 on CPU while being heavier on the wire.** Those components have opposite signs. Any single
blended "PQC costs X% more" figure has to pick a weighting between microseconds and bytes to collapse
them, and whatever it picks, it destroys the most interesting finding this product has.

`web/lib/protocols/ocd.ts` emits components with their signs intact and **no total**. `blendedTotal`
exists as an explicitly-null field with a stated reason, so the omission reads as a decision rather
than as something nobody got round to. CFDIR itself notes costs may be negative; a model that cannot
represent one cannot consume ours.

The anomaly gate from work-order 013 applies here too: a structurally impossible comparison yields no
delta at all. A cost model fed an impossible number produces a confident wrong answer rather than an
obvious one.

## `/q-shield/cfdir`

§16.6.2 calls this *"the cheapest differentiated output on this entire list; the data already
exists"*, and asks for the uncovered cells to be **visibly empty** — because the empty cells are the
roadmap, published honestly.

**Coverage is computed, not declared.** The use-case taxonomy is CFDIR's and is necessarily authored,
but whether we *cover* a use case is derived from which tracks actually produced data in the build. A
track that stops running downgrades its own row, rather than a stale table continuing to claim it. The
page distinguishes those two cases: a use case nothing measures reads differently from one whose track
has gone quiet.

The headline count is computed from the same function that fills the table, so the sentence and the
number cannot disagree.

## Two line items moved

§16.3 named ER and MIA as *"blocking dependencies for a revenue product"*, not optional breadth. Both
have moved this session, for reasons outside this work-order:

- **ER** (Expansion & retention) — `secret_key_bytes` now recorded (work-order 015). Chain bytes and
  at-rest key-hierarchy sizing remain out of scope.
- **UE** (Unexpected events) — Layer B now produces downgrade and clean-rejection outcomes plus
  middlebox pass/fail (work-order 014). Interoperability across independent implementations is still
  absent.
- **MIA** — Layer B measures connections-per-core over live sockets. The *cryptographic* throughput
  question under CPU contention is still open, and must not share the label.

Coverage remains **2 of 13 scorable use cases fully covered, 5 partial, 6 not**. The line items moved;
the use-case count did not.

## Tests

- `benchmark/tests/test_cfdir.py` — 12 cases. The ones that matter assert the *non*-claims (TLS does
  not claim 3.5, SSH does not claim 3.14), that an undeclared protocol claims nothing at all, that the
  declaration is a copy rather than the shared mapping, and that a malformed use-case id is rejected by
  the schema.
- `web/lib/data/cfdir.test.ts` — 16 cases, including that a track producing no data downgrades its row,
  that a missing track is distinguishable from a use case nothing measures, and that the not-applicable
  row stays not-applicable regardless of data.
- `web/lib/protocols/ocd.test.ts` — 11 cases, led by "never emits a blended total, and says why".

## Not in this work-order

§16.4.2's parallel-operation (dual-stack) measurement — genuinely new harness work, nothing currently
measures running both stacks at once. The glossary page. Classical signature baselines. Everything in
Tier 2.
