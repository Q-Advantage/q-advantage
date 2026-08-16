# 009 — Network / TLS Migration Cost Calculator, v1

**Status:** in progress
**Branch:** `work-order/009-network-cost-calculator`
**Opened:** 2026-08-16
**Spec:** `network-calculator-spec.md` (vault `10-strategy/`, 2026-08-16, "spec complete — build-ready")
**Defaults:** `network-calculator-defaults-research.md` (vault, 2026-08-16)

---

## What

`/calculator` — a public, open tool: pick TLS suites to compare, describe your traffic, get a
dollar-per-month delta with a breakdown of what drives it. First calculator in the suite to ship,
and the first surface in this repo that **models** rather than reports.

On-page name **PQC Migration Cost Calculator**, cost-first framing per the spec's open item 1,
founder-confirmed. The "ROI of PQC migration" search language lives in the meta description only —
it protects the "we don't sell migration tools" neutrality line.

## Why this one

It is the only calculator whose Layers 1–2 are already real, published, cited data. Q-Shield's
composed TLS track gives per-suite handshake medians and wire sizes; nothing new needs measuring.
The spec's own build-order table puts it first for exactly that reason, and `tcm-spec.md` needs one
calculator shipping real numbers before its formula layer is buildable.

## The four layers, and where each comes from

| Layer | Source | Status |
|---|---|---|
| 1 · Primitives — per-suite handshake performance | Q-Shield `tls-composed` | measured, cited per run |
| 2 · Composition — timings → handshake budget | Q-Shield phase decomposition | measured |
| 3 · Workload profile — handshakes/day, session reuse | public defaults, editable | sourced, cited, editable |
| 4 · Cost mapping — CPU time & bytes → dollars | AWS public pricing | sourced, cited, editable |

## The governing rule this inherits

From the suite spec, restated because it is the whole discipline of the thing: **every input the
customer does not give us ships as an editable field with a cited default, never an invented
constant.** Where no public proxy exists, the field carries an honest range and an `#unverified`
tag rather than false precision. No number on this page is authored by us except the arithmetic.

Every figure carries a provenance tag — Measured / Public default / Bounded estimate / Customer
input — reusing `tcm-spec.md §6`'s labels rather than inventing a scheme.

## Deliberate deviations from the spec

Recorded here rather than silently taken.

1. **Suite list is the four we measure**, not the spec's Classical group of ECDSA P-256/P-384/
   RSA-2048. Those are authentication algorithms; the spec's own §11 scopes v1 to key exchange
   only. Offering a comparison we have no measurement for would be the exact failure this product
   exists to avoid. Ships: X25519 (classical baseline), X25519+ML-KEM-768, SecP256r1+ML-KEM-768,
   ML-KEM-768 (pure PQC).
2. **Data ingestion uses `web/lib/protocols/load.ts`**, not the vault's
   `chart-of-the-day/qshield-import.js` as the spec suggests. Vault code does not enter this repo
   (CLAUDE.md, context bridge). The repo's loader already parses the identical JSON shape and is
   what every other data surface runs on.
3. **Egress is charged on server→client bytes only**, not `bytes_total`. Cloud egress bills
   outbound traffic; inbound is free on AWS. Charging the full wire delta would overstate the
   egress term by roughly half. Both directions are still shown.
4. **Save uses `localStorage` plus full-state URLs**, not the spec's email-gated persistent link.
   Same user value — a scenario you can come back to and share — with no backend and no
   data-collection surface. The email capture stays unbuilt pending a deliberate decision.
5. **The baseline delta comes from `vsBaselinePct`**, recomputed same-run. The stored
   `pct_over_classical` field was sign-flipped in production until PR #32; a cost model built on it
   would have quietly published negative dollar deltas. See that PR.

## v1 scope

In: the four suites, both architectures, three workload archetypes, session-reuse rate, editable
AWS pricing, comparison table with relative multipliers, attribution chart, time-horizon toggle,
provenance tags, dynamic per-result citations plus a static reference list, full action bar
(share / save / load examples / reset / download), and the TCP-window cliff as a **qualitative
callout only**.

Out, per the spec's own scoping: modelling the cliff as a step function (needs Layer B packet
capture, not built), GCP/Azure pricing (AWS sourced only), the SSH track, a PQC-authenticated
cert-chain toggle, and the App/DB/Blockchain calculators.

## What makes this different from every other surface here

Everything else in this repo projects a measurement. This computes numbers nobody measured. That
is legitimate — it is arithmetic over cited inputs — but it needs its own discipline, and the
discipline is that a reader can always see which inputs are measured, which are public defaults,
and which they supplied. If that distinction is ever lost, this becomes the thing the company
criticises other people for.

## Not in this work-order

The TCM formula layer this feeds. The P-CBOM web tool cross-links. Multi-cloud pricing. Anything
that requires the readiness index, which is paused.
