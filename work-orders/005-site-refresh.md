# 005 — Homepage refresh and site design system

**Status:** in progress
**Branch:** `work-order/005-site-refresh`
**Opened:** 2026-08-16
**Design render (approved):** https://claude.ai/code/artifact/1ea118bc-fe57-40c8-8f77-ccc40e6ba039

---

## What

Rebuild `qadvantage.io/` as a company homepage rather than a Q-Shield brochure, and move the
site onto a new design system derived from InferenceX (`inferencex.semianalysis.com`) and
ClusterMAX (`clustermax.ai`).

The founder's framing: SemiAnalysis does not describe itself as a migration helper. It positions
itself as the intelligence layer the whole industry reads. Q-Advantage's homepage should do the
same job — and the products, when you click into them, should feel like separate properties.

## Why

Three things forced this now:

1. **The homepage was Q-Shield-forward.** `website-ia-spec.md §5` called for a portfolio-level
   homepage; it was specced 2026-08-09 and never built. `ProductCard` sat defined-but-unused in
   `app/page.tsx`.
2. **The hero line was pending a decision.** `positioning-canon.md` flags its own line ("Vendors
   will tell you what to buy") as Q-Shield-forward and narrower than the company now is, and
   carries an unconfirmed replacement from `qshield-update-spec.md §10`. `website-ia-spec.md §5`
   explicitly parks the homepage hero behind that decision. **This work-order resolves it** — see
   "Positioning decision" below.
3. **There was no publication surface.** `70-marketing/CLAUDE.md §5` names `qadvantage.io/blog` as
   where pillar posts live. The route did not exist. For a company modelled on SemiAnalysis, the
   writing is the product surface, so this is the biggest structural gap of the three.

## Positioning decision (resolves the open canon question)

The homepage no longer leads with "Vendors will tell you what to buy. We'll tell you what's true."
It leads with the **cost** framing from `pitch-canon.md §2`:

> Every system you run needs new cryptography. Nobody has priced it.

The audit test ("the vendor told me" doesn't survive an audit) is retained as the thesis section
but rewritten away from an algorithm-choice argument toward the **cost and ROI** argument — the
whole-estate scope, the two unpublished bills (one-time project cost, permanent operating delta),
and the fact that no neutral party has priced either.

**Vault follow-up owned by the founder, not this repo:** `positioning-canon.md` and
`qshield-update-spec.md §5` both still record the old decisions. Per `CLAUDE.md`, vault edits happen
in the vault, not through `context/`.

## Design decisions

- **Light is now the default theme; dark is the designed alternate.** This reverses
  `qshield-update-spec.md §5` ("explicitly not borrowed: InferenceX's light theme") and
  `website-ia-spec.md §1` ("dark stays dark"). Recorded in `docs/adr/0005-light-default-and-design-system.md`.
- **Type is DM Sans for text and numerals**, tabular figures, no separate mono face — verified as
  what InferenceX itself does. Replaces Inter Tight + Instrument Serif + Geist Mono.
- **Ground `#eaebec`, ink `#131416`** — sampled from InferenceX. Gold `#e8a830` is the brand
  accent, blue `#1a84c6` carries links and CTAs, green/amber/red stay strictly semantic.
- **Two section treatments.** Home uses floating rounded panels (treatment A). Product pages will
  use a continuous framed grid (treatment C). ClusterMAX and InferenceX do not share a skin
  either — each product reads as its own property.
- **The `navy` theme is retired.** Three themes was already one too many; the toggle is now
  light/dark.

## Navigation

Flat nav is replaced by: **Home · Blog · Products ▾ · Tools ▾ · Contact us.** Everything else
(About, Methodology, Corrections, Privacy, Benchmark source) moves to the footer.

| Group | Item | State |
|---|---|---|
| Products | Q-Shield | Live |
| Products | PQC Arena | Coming |
| Products | PQC Readiness Index | Coming |
| Tools | Q-Day Index | Live |
| Tools | Network Calculator | Coming |
| Tools | P-CBOM | Coming |

This supersedes `website-ia-spec.md §3`, which deferred dropdowns until a 4th product went live.
The trigger was a proxy for "the flat nav stops working"; six named surfaces reached that point
first.

## Data integrity

Every figure on the homepage reads from `benchmark/results/` through the existing data layer.
No literals. Specifically:

- Hero tile, ranked table, and quick-comparison metrics derive from the latest run.
- The **run-integrity disclosure is part of the design, not an afterthought** — the homepage shows
  CPU steal and instance type next to the numbers, and the ranked table carries a standing caveat
  explaining that timing deltas move run-to-run while byte counts do not.

**Raised by this work, not fixed by it:** the 2026-08-15 run carried **10.51% CPU steal** (against
0.30% on 2026-08-13), which inflated the classical X25519 baseline enough to flip the sign of the
hybrid-vs-classical delta — +37.1% slower on the 13th, −17.2% faster on the 15th. The canonical
figure in `qshield-update-spec.md` is 42.1% slower on x86. This is the burstable-instance artifact
`pitch-canon.md §11` earmarks the c7i.large migration for. **It deserves its own work-order.**

## Blog

Three posts, promoted from `30-content/drafts/` in the vault. Internal sourcing comments,
checklists and per-day LinkedIn scaffolding are stripped; only the article survives.

| Post | Source draft | Note |
|---|---|---|
| The benchmark didn't lie. The library changed underneath it. | `pillar-2026-07-27-ebacs-is-our-friend.md` | Full pillar, figures sourced to run `d8df129` |
| A model found a lattice weakness in 60 hours | `linkedin-2026-07-30-hawk-cryptanalysis.md` | Converted from post to article; primary source Anthropic, 5 corroborating outlets |
| CBOM tells you what you run. P-CBOM tells you what it costs. | `linkedin-2026-08-03-week11.md` | **Numbers deliberately not carried over** — that draft marks 7 figures `[CONFIRM]` and states they were retrieved through a summarizing model. The published post runs the conceptual argument and cites the live pages instead. |

## Definition of done

- [ ] `npm run type-check`, `npm run lint`, `npm run build` green in `web/`
- [ ] Homepage renders live numbers from the latest run, no hardcoded literals
- [ ] Light and dark both legible; no token defined only inside a media/attr block
- [ ] Nav dropdowns keyboard-reachable
- [ ] Existing routes (`/q-shield`, `/q-day-index`, `/methodology`, `/about`) still build and paint
- [ ] ADR written for the light-default reversal
- [ ] PR opened; founder merges

## Out of scope

- Q-Shield's own layout polish (treatment C) — follows once this lands
- The `/products` and `/tools` catalog pages — nav dropdowns cover the need for now
- Any change to `benchmark.yml`, the runner, or result data
- The c7i.large instance migration
