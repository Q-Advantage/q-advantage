# 004 — PQC Arena v1: publish the instrument, hold the verdicts

**Status:** closed 2026-08-17. **The product moved out of this repo** — see the update at the foot of
this file and `docs/adr/0006-pqc-arena-moves-to-its-own-property.md`. The two branches this work-order
was built on (`work-order/004a-pqc-arena-criteria`, `work-order/004b-pqc-arena-instrument`) are
retired unmerged.

The body below is the original intent, kept unedited as the record of what was decided at the time.

> **Update, 2026-08-15 — everything is paused until the entity is formed.** Founder decision. The
> criteria and policy pages name no vendor, so they were not blocked by the rating gates — but
> publishing them still commits Q-Advantage to a methodology and a conflicts policy, and signals the
> product to the market. That is a decision worth taking once, from a formed entity, rather than
> taking early and walking back.
>
> Paused: `/pqc-arena`, `/pqc-arena/policy`, and methodology Section 4 (which links to both and states
> the criteria "are published"). Header nav links and sitemap entries removed alongside, so nothing on
> the live site points at a 404 — the same discipline applied when the Readiness Index was paused.
>
> Nothing was deleted. Going live is three flags: `PAUSED` in both Arena pages, `ARENA_PUBLIC` in
> `web/app/methodology/page.tsx`, plus restoring the nav links and sitemap entries (both marked with
> dated comments at their removal sites).

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

---

## Update, 2026-08-17 — the entity exists, and the product left this repo

Two things changed at once, and the second follows from the first.

**The entity was formed**, releasing the precondition that had been holding everything dark. Vault
decision 0003 had converted "the entity exists" from a gate on *ratings* into a gate on the product's
*public existence*; that gate is now open.

**The founder's call: PQC Arena becomes its own private repo, deployed as a standalone property at
`arena.qadvantage.io`.** Not a section of this site.

### Why that is the right shape, and not just a preference

This work-order's own hardest constraint was *"No company is named anywhere in this public repo."*
That constraint was never about PQC Arena. It was about `q-advantage` being public. It meant the
product could ship its criteria and its machinery here and never ship the thing it exists to
produce — an assessment of a named vendor. The private repo removes the constraint at its source
rather than working around it.

It also matches the reference product's own topology. ClusterMAX is a separate property from
SemiAnalysis — its own domain, navigation, identity, footer and legal notice — not a page of the
parent site. A rating that comparatively judges named companies carries different editorial and legal
weight than the measurement instruments alongside it, and housing them together dilutes both.

### What was actually wrong with the built version, beyond its address

Worth recording, because it was not visible from the branch names. The two branches were **24 commits
behind `origin/main`**, and their three page components had been written against the pre-ADR-0005
chrome — inline `Header`/`Breadcrumb`/`Footer`, no `PageShell`, not one import from
`components/product/kit.tsx`. `TierBadge` coloured tiers with raw `cyan-300` / `amber-300` /
`orange-300`, chosen when dark was the default theme and **illegible on the light ground that has
been default since ADR 0005**. The instrument underneath — types, tier-eligibility, validation,
criteria data — was sound and carried over almost unchanged. The presentation did not.

### What shipped instead

In the new repo, rebuilt on the current design system:

- The ten dimensions grown from flat checklists into **59 itemized requirements** with nested
  sub-points, per-requirement citations, and scoping by vendor category — the axis that does for
  Arena what deployment scenario does for the reference product.
- A criteria surface: one collapsible panel per dimension, scoping by vendor category, a dimension ×
  category counts matrix, per-dimension permalinks, and a Markdown export generated from the same
  source the pages render — so the document a vendor is sent is the document they are held to. That
  export is the vendor-outreach artifact the methodology calls for, and print CSS forces every panel
  open so a printed copy is complete regardless of what the reader had expanded.
- The candidate pool and three worked vendor reviews, each re-verified against its primary source on
  2026-08-17, each carrying **no tier** — 2 of 10 assessed dimensions sits below the threshold of 7,
  which is now founder-confirmed.
- Rankings and reviews built and gated. Two publish preconditions remain open: legal review of the
  comparative-rating exposure, and TR-61 reconciliation.
- The six tiers unchanged from this work-order's original description. An evidence-grade ladder
  (Verified / Substantiated / Documented / Asserted) was built as an alternative and reverted by
  founder decision on 2026-08-18; the reasoning is recorded in the private repo rather than here,
  because the argument for it was partly a legal-framing one that belongs next to the code it would
  change. One piece of that pass was kept: the gate wording is now **"conformance gate"** rather than
  "critical failure".

### Where it went

`Q-Advantage/pqc-arena`, private, created and pushed 2026-08-18. Deploys to `arena.qadvantage.io`
once the Vercel project is wired up — note its root directory is `/`, not `web/`, because that repo
*is* the app rather than containing one.

### What stays here

Nothing Arena-shaped. `web/lib/nav.ts` keeps PQC Arena as `status: "coming"` with no `href` until the
subdomain is live — the same rule as before, that "coming" never dresses up as "live".

### The founder actions this work-order raised are still open

Both listed above remain outstanding, and one has grown a third sibling:

- `web/app/about/page.tsx` still says "There is no paid tier."
- The GitHub org description for `q-advantage` still reads "Q-Arena (algorithms)".
- **New:** an unresolved conflict-of-interest question affecting at least one vendor in Arena's
  candidate pool. The rated-parties policy requires a positive per-vendor disclosure line on every
  rating, and only the founder can write it. Details are recorded in the private Arena repo, not here.
  It is enforced rather than remembered: the validator refuses to render a rating whose disclosure
  line is empty, so an affected vendor structurally cannot be rated until the line exists.
