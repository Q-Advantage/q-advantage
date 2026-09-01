# 025 — Unblock LMS, publish what we already measured, open Tier 3

**Closes / advances:** `qshield-update-spec.md` §17.7 (liboqs rebuild), §17.4b (the JOSE half of the
repatriation), §15 Tier 2 durability (023/024), §15 Tier 3 (all seven rows).
**Branch:** `work-order/025-lms-publication-and-tier3`

## Why this work-order exists

Measurement capability is roughly a month ahead of the publication surface. Tier 2 closed on
2026-08-30 with all five items built — and only two of the five reached a page a stranger can see.
Two more findings exist only inside CI artifacts that expire. Meanwhile the one algorithm family the
site promises and cannot deliver, LMS/XMSS, has been reporting `unavailable` every day since
2026-08-14 for a reason that is one rebuild away from resolved.

So this is not a "new track" work-order. Three of its four parts publish or preserve work that is
already paid for. Only Part D buys new measurement.

Ordered by leverage per hour, not by size.

---

## Part A — LMS/XMSS: make the rebuild a command, not a project

**Status: blocked on the founder, and that is the correct place for it.**

`benchmark/protocols/lms_xmss.py` has run daily since 2026-08-14. Every scheme reports
`status: "unavailable"`, `reason: "not in get_enabled_stateful_sig_mechanisms()"`. The harness is
right; the runner's liboqs 0.15.0 was built without `OQS_ENABLE_SIG_STFL_LMS` /
`OQS_ENABLE_SIG_STFL_XMSS`.

Two things are already true and worth not re-deriving:

- **The flags are proven.** Layer B's pinned image sets both and CI confirms `sig_stfl.h` is
  present. The rebuild is a copy-paste, not an experiment.
- **Option A is the decided route** — verify-only, no
  `OQS_HAZARDOUS_EXPERIMENTAL_ENABLE_SIG_STFL_KEY_SIG_GEN`. Upstream explicitly discourages that
  third flag; verification is also the operation that matters for firmware signing, where a
  signature is produced once and checked on every boot. `lms_xmss.py` already falls back to timing
  verification against committed KAT vectors and records why the full path was unavailable.

**What this work-order does about it.** It cannot run commands on the measurement host — that box is
reached by the founder, and `benchmark.yml` and the runner config are off-limits under guardrail 3.
What it can do is remove every reason for the rebuild to go wrong:

1. A committed, idempotent rebuild script so the procedure is one command instead of a runbook
   sketch that says "to be confirmed against however liboqs was originally installed".
2. A **preflight** that reports the current build's state and what a rebuild would change, run
   before touching anything.
3. A `workflow_dispatch`-only **verification** workflow that runs on the bench runner and prints
   `oqs.get_enabled_stateful_sig_mechanisms()`, so the founder gets a green/red answer without SSH
   and without editing `benchmark.yml`.

**Done looks like:** the founder runs one script on the box, dispatches one workflow, and sees either
the four mechanisms listed or a specific reason they are not. The next daily run then produces
`status: "ok"`, `mode: "verify_only"`, a `verify` timing block, and no keygen/sign block — absent
because this build cannot produce them, not zero.

**Not in scope:** Option B. Enabling signing changes what may be published and carries a disclosure
obligation on the methodology page. That is a founder decision and is not made here.

---

## Part B — The JOSE half of the repatriation

**Status: half-built, and the tree says so out loud.**

Spec §17.4b records that CFDIR's two real findings — certificate-chain sizing and JOSE token sizing —
moved to `/q-shield/protocols` when the CFDIR tab came down. Only certificates arrived.

The function on the protocols page is named `SizingSections` and documented *"Certificate and token
sizing… the room runs out in places nobody budgets for — a congestion window, a cookie"*. The
congestion window is rendered. The cookie is not. `jose-composed-*.json` has been committed every day
through today and renders on exactly one page: `/q-shield/cfdir`, which is `noindex` and unlinked.

**Done looks like:** a token-sizing Section on `/q-shield/protocols`, in Q-Advantage's own voice with
the framework unnamed, reading from the daily `jose-composed` track. The 023 finding is what makes it
publishable rather than alarming: **nothing broke** — nginx, HAProxy and Node each accepted every
token size up to ML-DSA-87's ~6.5 KB in both an `Authorization` header and a `Cookie`. RFC 6265's
4,096 bytes is a floor servers are asked to support, not a ceiling they enforce. The honest headline
is that the token gets big and the servers we tested did not care, which is a more useful thing to
tell a migrating reader than a warning that turns out not to bite.

**Not in scope:** naming CFDIR anywhere on the page. That decision stands.

---

## Part C — 023 and 024 must survive their artifacts expiring

**Status: findings exist, durably nowhere.**

Every job in `layer-b.yml` — `compat`, `crosslib`, `crosslib-merge` — ends at `upload-artifact`.
Nothing commits a result to the repo and nothing ships one to `web/public/data/`. The 6.5 KB token
result and the three-library ML-KEM corroboration currently live in CI artifact storage, which
expires, and in work-order prose. `crosslib` appears nowhere under `web/` at all.

The path already exists for other tracks and is manual: someone downloads the artifact and commits it
into `web/public/data/` as part of the work-order's PR. Cert-chain got that in #49, Layer B in #46.
023 and 024 did not. Note those are frozen one-time snapshots rather than a daily refresh —
`web/public/data/cert-chain/` holds exactly one file.

**Done looks like:**

1. A committed result for each of 023 and 024, captured from a real CI run, under the same
   convention the cert-chain and Layer B results already use. Measured output, committed verbatim —
   guardrail 1 applies exactly as it does to `benchmark/results/`.
2. A publish step in `layer-b.yml` that makes the capture reproducible instead of a remembered
   manual chore, following whatever `publish-results.py` already does for the scenarios.
3. Cross-library corroboration visible on a public page. This one has unusual reader value: it is
   the only evidence on the site that a Q-Shield ML-KEM figure describes the **algorithm** rather
   than liboqs's rendition of it.

**Carry the probe's own caveats with it.** Both absences 024 documented are properties of the
vantage point, not the libraries: a speed inventory lists primitives, so a TLS group like
X25519MLKEM768 cannot appear in one even where the library ships it; and no ML-DSA row appeared
anywhere, which is `#unverified`. A reader who takes either at face value draws the wrong conclusion
from a true observation.

---

## Part D — Tier 3, which is further along than the spec's table suggests

Spec §15's Tier 3 table was written 2026-08-23, before Layer B existed. Layer B v1 shipped
2026-08-30 and already answers four of the seven rows. Re-reading the table against the tree:

| Tier 3 row | Actual status |
|---|---|
| Long-distance / RTT degradation | **Built** — `rtt` scenario, netem-injected latency |
| Failure / downgrade behaviour | **Built** — `mismatch` scenario, the deliberate non-negotiation |
| Network fragmentation | **Built** — `ip_fragments`, `segment_sizes`, `largest_segment_bytes` captured per handshake |
| Load-balancer / proxy compatibility | **Partial** — nginx and HAProxy built and passing. Envoy is named in `compose.yml`'s comment but `layer-b/middlebox/` holds only two configs. No DPI/inspection case at all. |
| Interoperability, actually tested | **Partial, and cheaper than it was.** `pairwise` today is oqs-provider negotiating with itself, which is a control, not an interop test. 024 now builds BoringSSL, AWS-LC and wolfSSL from pinned tags — the images the real matrix needs already exist. |
| Downgrade **detection** (not just behaviour) | **Not built.** The methodology check this depends on is scoped in the vault; this is the step past it — wiring a detection capability rather than auditing whether one is possible. |
| Certificate-chain impact on page-load | **Not built.** Composition of Part C's chain work, a live HTTPS server, and a request-timing harness. |

**So Tier 3 is not a from-scratch build.** It is three real items and two extensions, and one of the
three got materially cheaper last night.

**Sequencing, by differentiated finding per unit of work:**

1. **Interop matrix** — highest value, lowest remaining cost. Middlebox breakage and stack
   disagreement are exactly what shows up in a failed migration and never in a benchmark chart, and
   the stacks are already built and pinned.
2. **Envoy + an inspection case** — completes the row the spec calls the biggest Tier 3 item and the
   most differentiated finding on the whole list.
3. **Downgrade detection** — the capability, not the audit.
4. **Chain page-load** — last, because it depends on the other three settling.

**Explicitly not promised in one pass.** Tier 3 is the largest remaining engineering block in the
spec. This work-order opens it and commits to the sequence above; it does not claim to close all
seven rows in one PR, and any PR that says otherwise should be disbelieved.

---

## The rule this work-order inherits

023's header probe, 023's parser probe and 024's library probe each needed the same control: **a
failing classical baseline points at the instrument, not at post-quantum.** Only the first had it by
design. The parser probe reported every algorithm as partially readable — classical arms included —
because it read an attribute that did not exist in the installed version. The library probe reported
BoringSSL as exposing nothing, which is false. Both would have been published as findings about other
people's software.

Every probe added under this work-order carries that control from the start.

## The claim boundary

Structural facts are portable; timings are not. Packets, bytes, negotiated group, fragmentation,
outcome and token size are properties of the protocol exchange and are the same anywhere. Timings are
properties of the machine, so anything produced in CI carries `publishable: false` unless it ran on
the measurement host. A CI handshake is capability evidence, never a Q-Shield figure.

## Guardrails that bind this work-order specifically

- `benchmark.yml` and the runner config are not edited. Part A needs no change to either.
- No measured value is authored, interpolated or hand-corrected. Part C commits real captured output
  or it commits nothing.
- Every technical claim carries a primary source or an explicit `#unverified`. The hybrid group code
  points are still `#unverified` against the IANA registry; agreement with one implementation is not
  a primary source.
