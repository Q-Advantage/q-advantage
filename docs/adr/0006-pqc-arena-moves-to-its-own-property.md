# ADR 0006 — PQC Arena moves to its own private repo and its own property

**Status:** accepted — 2026-08-17
**Supersedes:** ADR 0004 (never merged to `main`; see the note on numbering below)
**Related:** ADR 0003 (Readiness Index topology), ADR 0005 (light default and design system)

## Context

PQC Arena — the vendor rating — was built inside this repo on two branches,
`work-order/004a-pqc-arena-criteria` and `work-order/004b-pqc-arena-instrument`. Neither was merged.
Both were held dark pending entity formation.

ADR 0004 was written on those branches to record a split: publish the criteria and the
conflict-of-interest policy here, keep vendor data in a private `Q-Advantage/pqc-arena` repo. Because
that ADR only ever existed on unmerged branches, **`main` has a gap at 0004** and always did. This
ADR takes 0006 rather than reusing 0004, so that a reader who finds ADR 0004 on an old branch is not
looking at a document that silently changed meaning.

Two things then changed at once.

**The entity was formed**, releasing the precondition that had gated the product's public existence.

**Reading the reference product properly changed the assessment of where Arena belongs.** ClusterMAX
is not a section of `semianalysis.com`. It is a separate property: its own domain, navigation, visual
identity, footer, and — notably — its own legal notice covering trademark fair use, non-endorsement,
and a prohibition on using the ratings to construct financial instruments. The topology is not
incidental to that product; it is how a comparative rating of named companies is kept at arm's length
from the analysis business that publishes it.

## Decision

**PQC Arena leaves this repo entirely. It becomes a standalone Next.js app in a private
`Q-Advantage/pqc-arena` repo, deployed to `arena.qadvantage.io`.**

### Why leaving is better than the ADR 0004 split

ADR 0004's hardest constraint was *"no company is named anywhere in this public repo."* That
constraint was never a property of PQC Arena. It was a property of `q-advantage` being public. Under
the split, the product could ship its criteria and its machinery here and could never ship the thing
it exists to produce: an assessment of a named vendor. Every real output would have lived elsewhere
while the rendering lived here, permanently straddling a boundary.

Moving the product resolves the constraint at its source instead of engineering around it. It also
means this repo's guardrail 4 gets simpler rather than more strained — there is now no reason for a
vendor name to appear in `q-advantage` at all.

### What stays here

- `work-orders/004-pqc-arena-v1.md`, closed, with a dated update recording where the product went.
- This ADR.
- `web/lib/nav.ts` keeps PQC Arena as `status: "coming"` with no `href`, until the subdomain is live.
  The existing rule holds unchanged: "coming" never dresses up as "live", and nothing links to a 404.

Nothing else. The two branches are retired unmerged.

### What was wrong with the built version, beyond its address

Recorded because it was not visible from the branch names, and because it is the general hazard of
leaving built work unmerged:

The branches were **24 commits behind `origin/main`**. Their three page components were written
against the pre-ADR-0005 chrome — inline `Header` / `Breadcrumb` / `Footer`, no `PageShell`, and not
a single import from `components/product/kit.tsx`. `TierBadge` coloured tiers with raw `cyan-300`,
`amber-300` and `orange-300`, chosen when dark was the default theme and **illegible on the light
ground that ADR 0005 made default**.

The instrument underneath was sound and carried over nearly unchanged: the rating types, the
tier-eligibility rules, the validator, the criteria data. **Data and logic aged well across a design
system change; presentation did not.** That is worth remembering the next time work is built and
parked rather than merged.

## Consequences

**Good.**

- Arena can hold real vendor assessments, which is the entire point of the product.
- This repo stops carrying a product it could never complete, and its public-repo guardrail gets
  easier to hold rather than harder.
- Arena gets its own editorial voice, legal notice, versioning cadence and release rhythm, without
  negotiating any of them against the measurement instruments.
- The measurement products keep a clean separation from the one surface that publishes comparative
  judgements about named companies — which is the separation that matters if a rating is ever
  disputed.

**Costs, stated plainly.**

- Two repos, two CI setups, two Vercel projects, two dependency trees to keep patched.
- **The design kit is now forked.** `kit.tsx`, `PageShell`, the tokens and the Tailwind config were
  copied into the new repo, not shared through a package. A fix in one does not reach the other. This
  was chosen deliberately over extracting an internal design package: for one person and two
  properties, the versioning and publishing overhead of the package exceeds the drift cost of the
  copy. Revisit if a third property appears.
- A reader crossing from `qadvantage.io` to `arena.qadvantage.io` crosses a domain boundary. The
  shared `qadv-theme` storage key and a back-link in Arena's header are the only threads holding the
  two properties together. Both are deliberate.
- `docs/adr/` now has a permanent gap at 0004. Preferred over renumbering, which would have made an
  old branch's ADR reference point at a different document.

## Still open, and not resolved by this ADR

Publication of the ratings themselves is gated in the new repo behind a flag, on two preconditions
this decision does not touch:

- Legal review of the comparative-rating / trade-libel exposure. Distinct from the Readiness Index's
  own legal review and not covered by it — the Index reports an institution's own public
  configuration, which is a different fact pattern from a comparative judgement about a vendor's
  commercial claims.
- Reconciliation of the ten dimensions against ASC X9's TR-61 rubric, once that draft is visible.

The criteria, tiers, methodology and conflict-of-interest policy are not gated by either, and publish
with the new property.
