# ADR 0004: PQC Arena — public criteria, gated ratings, and vendor data in a private repo

## Status

Accepted — 2026-08-13

## Context

The founder's vault specs **PQC Arena** (`10-strategy/pqc-arena-spec.md`, 2026-08-08): a relative
rating of named PQC *vendors* across ten dimensions, six tiers, modeled on SemiAnalysis's ClusterMAX.
Build intent: `work-orders/004-pqc-arena-v1.md`.

Three facts about that spec decide this repo's architecture for it.

**1. The spec forbids publishing a rating today.** Its worked examples cover 2 of 10 dimensions for 3
of ~7 candidate vendors, and it explicitly assigns no tier to anyone on that basis. It then lists four
preconditions before *anything* publishes:

- [ ] The entity exists. *(Filing in progress as of this ADR — not done.)*
- [ ] The itemized rated-parties/COI policy is **published**, not just written. *(Closed by
      `work-order/004a` — the policy page ships in this work-order.)*
- [ ] Legal review of the comparative-rating / trade-libel exposure has happened. *(Not done.)*
- [ ] TR-61's rubric, once visible, has been reconciled against the ten dimensions. *(Draft not yet
      visible.)*

**2. The PQC Readiness Index's legal groundwork does not cover Arena, and must not be assumed to.**
The vault's `measurement-ethics.md §10` builds its defense on the Index publishing "one narrow class of
fact that the institution already broadcasts to every visitor on the internet" — a public server's
negotiated protocol configuration. Arena publishes something categorically different: comparative
judgments about named companies' *commercial claims*, with direct commercial consequence if a rating
costs a vendor a sale. The spec flags this as its own open legal question rather than inheriting the
Index's, and this ADR records that as binding. Worth noting: §10's own nearest-authority search
surfaced *Enigma Software Group USA, LLC v. Malwarebytes, Inc.* (a security vendor labelling a
competitor's product) and set it aside as a different fact pattern **for the Index** — it is materially
closer to Arena's fact pattern than to the Index's.

**3. `q-advantage` is public (guardrail 4), and ADR 0003 already solved this exact shape of problem.**
For the Readiness Index, committing named-institution data here — "even unpublished on the site" —
would have put it into public git history, with public Actions logs compounding the exposure. That
data went to a private sibling repo instead. Arena's data is *more* sensitive: adverse assessments of
commercial vendors, pre-legal-review, pre-entity.

## Decision

**Split the product along the publishable/gated line, and keep vendor data out of this repo entirely.**

### Public in `q-advantage`, shipping now

The criteria and the policy — everything that names no company:

- The ten rating dimensions as structured, cited data (`web/lib/data/arena-criteria.ts`), rendered at
  `/pqc-arena`.
- The six-tier definitions, including `Unavailable`'s deliberately non-punitive "not enough signal
  yet" framing.
- The itemized rated-parties/COI policy at `/pqc-arena/policy`. **Publishing this closes precondition
  #2.** It carries the per-vendor itemized-disclosure requirement — every rated vendor's page must
  state its own commercial relationship line, never a general policy statement standing in for one —
  which is the spec's deliberate improvement on ClusterMAX, whose only COI language is a blanket
  denial with no itemized disclosure.
- A methodology section (`/methodology#pqc-arena`) stating plainly what is and is not yet assessed.

Publishing criteria in advance of ratings is the ClusterMAX mechanism, not a workaround: it is what
makes the eventual rating a procurement reference rather than an attack, and the spec's own
methodology names advance notice of criteria as part of the method.

**Scope on these pages is described by category only** — PQC library/SDK vendors, HSM vendors with PQC
firmware, PKI/CA vendors, TLS/network security vendors. The named candidate pool does not appear.

### Built but dark in `q-advantage`

Types, tier logic, and the vendor index/detail rendering ship complete and tested, with **no vendor
dataset**. The per-vendor route uses the same per-file pause pattern already proven on the Readiness
Index (`const PAUSED: boolean = true; if (PAUSED) notFound();`). When the gates clear, publishing is a
flag flip plus a dataset — not a build.

A smoke test asserts the shipped dataset is empty, so a stray commit of real vendor data into this
public repo fails CI loudly rather than quietly publishing pre-gate judgments.

### Private, when there is data: `Q-Advantage/pqc-arena`

Vendor assessments — the public-claims audit findings, certification-registry results, per-dimension
scoring, draft tier assignments — go to a new **private** sibling repo, directly following ADR 0003's
precedent and for the same reasons, amplified. Not created by this ADR: it gets created when Track 1/3
work actually produces data, which is not in v1. Creating it is a founder/org action.

## Consequences

- **Arena exists publicly before it rates anyone.** `/pqc-arena` is live and useful (criteria, tiers,
  policy) while stating plainly that no vendor has been rated and what must be true first. This is a
  deliberate posture, not an unfinished state, and the page says so.
- **The neutrality claim needs an argument, and now has one.** "Vendor-neutral" is a brand pillar
  (home page, site description, README) and `benchmark/scoring.py` states a neutrality firewall for
  the Q-Day Index — *no winner is named*. A tiered vendor ranking is a deliberate departure. The
  resolution recorded here: vendor-neutral means **no stake in which vendor wins**, not a refusal to
  compare. Arena never sells to, takes payment from, or accepts influence from a rated party in
  exchange for position.
- **Arena's defensibility is different in kind from Q-Day's, and must not borrow its language.**
  The methodology page claims the Q-Day rating is *mechanical* — computed from per-field confidence
  tags, not assigned editorially. Arena is deliberately the opposite: the spec specifies **relative,
  not points-weighted** scoring, rejecting a 1–100 formula as false precision. Arena is defensible
  through published criteria, per-claim citation, right of reply, and critical-failure gates —
  **not** through a formula. Any future copy that implies Arena is mechanical is wrong.
- **Two repos will carry this product**, same as the Readiness Index: this one holds criteria, policy,
  rendering, and the decision trail; the private repo holds the assessments. Anyone picking it up
  needs both.
- **If `Q-Advantage/pqc-arena` is ever made public**, that is a distinct decision requiring its own
  history-and-logs audit — not a default this ADR pre-approves. Same clause as ADR 0003.
