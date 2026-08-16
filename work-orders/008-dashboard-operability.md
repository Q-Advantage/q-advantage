# 008 — Make the data surfaces operable

**Status:** in progress
**Branch:** `work-order/008-kit-operations` (+ follow-on branches per phase)
**Opened:** 2026-08-16
**Prompted by:** founder comparison against InferenceX (`inferencex.semianalysis.com`), 2026-08-16

---

## What

Turn Q-Shield and the Q-Day Index from static tables into surfaces an analyst can operate —
sort, decompose, trace to source, and take the data away — without inventing a single number.

## Why now

The founder compared our dashboards to InferenceX and found ours markedly less useful: weaker
charts, weaker comparison, "no downloadable stuff." A live study of their product and an
inventory of ours found the gap is worse than chart quality, in two specific ways.

### 1. We built the interactivity and then unplugged it

Four finished, interactive components have **zero importers** — orphaned when the #006/#007
product-kit rebuilds replaced them with static `kit.tsx` tables:

| Component | Lines | What is unreachable |
|---|---|---|
| `web/components/protocols/ProtocolsView.tsx` | 558 | per-arch tabs, phase decomposition, AES-GCM card, stateful-sig card, raw-JSON link |
| `web/components/data/QDayIndexView.tsx` | 837 | sortable columns, expandable rows, glossary hovercards, **the per-field provenance table**, threat gauge |
| `web/components/data/AlgorithmTable.tsx` | 197 | row-link into `/q-shield/[algorithm]` |
| `web/components/data/PresetComparisons.tsx` + `web/lib/data/presets.ts` | 378 | superseded by the live `ComparisonIndex` |

### 2. We measure a great deal the site never shows

No new benchmarking is needed for any of this:

- **`phases`** — a 9-field timing block per handshake phase, measured daily since June.
  `/q-shield/protocols` advertises "decomposed phase by phase" (page copy, lines 20 and 80)
  and renders no phase at all.
- **AES-GCM** — measured cleanly every day since 2026-08-14, rendered by nothing live.
- **Q-Day `provenance`** — `{value, source, confidence, method, as_of, notes}` for eight fields
  per system, with real cited URLs. This is the evidence layer the "receipts, not press releases"
  claim rests on, and it is invisible.
- **`max_us`** — tail latency, read by zero components (X25519MLKEM768: median 226.7 µs, max
  1198.6 µs — a 5.3× tail we measure and hide).
- Falcon-512/1024 keygen, `median_us`, `stdev_us`, `cross_validation`, `steal_time_pct`.

94 daily runs since 2026-05-11 are parsed on every build and surface as one sparkline, of one
metric, on one page. The only download in the application is a single CSV button on `/compare`
producing six rows.

## A measurement fact this work-order establishes

The handshake mean is **composed**, not independently measured, and the phases account for it
exactly:

```
handshake_mean = kem_keygen + kem_encaps + kem_decaps + 2 × (classical_keygen + classical_derive)
```

Verified across all 548 committed TLS and SSH suites: maximum relative error **0.0016%**. The
classical phases count twice because both parties perform keygen and derive; the KEM phases
count once each. This is what `identity.mode: "composed"` has always meant.

Consequence for the UI: the phase bars are a **true 100% decomposition**, provided the classical
phases are labelled ×2 (client and server). An earlier reading of the same data — that the phases
sum to only 64% of the handshake and the rest is unattributed — was wrong, and rendering it that
way would have published a misleading 36% "overhead" figure that does not exist. The methodology
page must state that the handshake figure is composed from phase measurements rather than timed
end-to-end.

## Phases

Each phase is its own PR off `main`.

| # | Phase | Status |
|---|---|---|
| 1 | Kit primitives: sortable/expandable table, tabs, provenance table, stacked bar | this branch |
| 2 | Protocols: phase decomposition, AES-GCM, tail latency | queued |
| 3 | Q-Day Index: per-field provenance, readiness decomposition, deep links | queued |
| 4 | Data access, API-first: static JSON API + OpenAPI + `/api` page, then CSV/JSON controls | queued |
| 5 | Historical trends across 94 runs; run-reliability surface | queued |

Orphaned components are deleted in the phase that supersedes them, not in a separate sweep.

## Design constraint

New product surfaces are built from `web/components/product/kit.tsx`, and the approved renders
are the contract (#007 was "Q-Shield rebuilt 1:1 with the render"). The orphans are **not**
re-imported — their operations are ported onto kit primitives with the current look preserved.
Phase 1 adds behaviour, not new visual language; `QDayIndexView`'s radial threat gauge is
dropped rather than reintroduced, since the approved render uses `StatBand` for that score.

## Deliberately not copied from InferenceX

Their Historical Trends and TCO Calculator are explicitly **interpolated** ("Values are
interpolated from real benchmark data"). Under guardrail 1 an interpolated figure is an authored
number. Our trends plot measured points only; where a reader wants a value between runs, we say
we do not have one. State this on the methodology page — it is a positioning advantage, not a
limitation.

## Not in this work-order

Layer B packet capture. Runner redundancy (guardrail 3). The LMS/XMSS liboqs rebuild that
work-order 003 leaves open. Third-party benchmark submissions. A TCO/cost model — we do not
measure cost and will not model it.
