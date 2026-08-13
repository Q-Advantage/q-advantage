# 004 — PQC Arena v1: publish the instrument, hold the verdicts

**Status:** in build. Split across two PRs (`004a` criteria/policy, `004b` gated instrument).

## What

PQC Arena is the vendor-rating product — a relative rating of named PQC *suppliers* (crypto
library/SDK vendors, HSM vendors with PQC firmware, PKI/CA vendors, TLS/network security vendors),
modeled on SemiAnalysis's ClusterMAX. It is the last unfilled slot in the product map, and it is
structurally the thing the PQC Readiness Index cannot produce: the Index rates *deployers* (an
observation of the world), Arena rates *suppliers* (a comparison a buyer acts on).

Full spec is vault-only (`10-strategy/pqc-arena-spec.md`, 2026-08-08) and stays there — this file
carries build intent, not the spec.

## What v1 actually ships

**The instrument and the published criteria. No verdicts.**

- Ten rating dimensions, published as data and rendered as public criteria pages — definitions,
  itemized checklists, stated data source per dimension.
- The six-tier system (Platinum / Gold / Silver / Bronze / Underperform / Unavailable), defined.
- The itemized rated-parties / conflict-of-interest policy, published.
- The rating machinery — types, tier logic, vendor index and detail rendering — built, tested, and
  **dark**: no vendor data ships, and the per-vendor route is behind the same `PAUSED` flag pattern
  used for the Readiness Index.

## Why no ratings in v1

Two independent reasons, either sufficient on its own:

1. **There is not enough data to rate anyone.** The spec's own worked examples cover 2 of 10
   dimensions for 3 of ~7 candidate vendors, and the spec explicitly declines to assign a tier on
   that basis. Publishing a tier now would be the exact overconfident-number failure the sourcing
   standard exists to prevent.
2. **Four publish preconditions are open** (entity, published COI policy, legal review of
   comparative-rating exposure, TR-61 reconciliation). Publishing the COI policy in this work-order
   closes one of them. See `docs/adr/0004-pqc-arena-topology-and-publish-gates.md`.

Publishing criteria *before* ratings is not a fallback — it is how ClusterMAX works. Criteria
published in advance are what make a rating a procurement reference rather than a hit piece, and the
spec's own methodology names advance notice of criteria as part of the method. The criteria pages
double as the vendor-outreach artifact.

## Hard constraints

- **No company is named anywhere in this public repo.** Scope is described by category only. The
  candidate vendor pool, and any assessment of any vendor, stays out of `q-advantage` entirely — see
  ADR 0004 for where it goes instead.
- **Arena data is researched/curated, not measured.** It must never live under `benchmark/results/`
  or `data/quantum_hardware.json` (guardrail 1 covers those as measured-only). The
  `web/lib/data/*.ts` + `*.generated.json` slot is the sanctioned home for authored-but-cited data.
- **Every technical claim cited or `#unverified`**, using the `verification: "confirmed" |
  "search-corroborated"` convention already established in `web/lib/data/compliance.ts`.

## Not in v1 — named, not dropped

- Any tier assignment or named vendor (blocked, above).
- Track 1 (public claims audit) and Track 3 (certification-registry checks) — these produce the
  pre-publication vendor material that needs a private home first.
- Track 2 (Q-Shield testing of vendor SDKs) — the spec marks it **Unscoped**; it depends on which
  vendors expose a testable public surface, which nobody has investigated.
- Creating the private `Q-Advantage/pqc-arena` repo — decided in ADR 0004, created when there is data
  to put in it. Founder's action.
- The tier-gated cost calculator hook, and the renaming of the M4 Q-Shield leaderboard displaced by
  this product taking the "PQC Arena" name.

## Founder actions this surfaces

- `web/app/about/page.tsx` says "There is no paid tier." The spec contemplates rated parties buying
  data and reports. No contradiction in v1 (nothing is sold), but that line needs revisiting before
  Arena monetizes.
- The GitHub org repo description for `q-advantage` still reads "Q-Arena (algorithms)" — a stale name
  for a shelved quantum-circuit product, now confusable with this one. Org-settings edit.
