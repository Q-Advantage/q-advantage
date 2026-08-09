# 002 — PQC Readiness Index, Phase 1 (target list, scanner, storage)

## Status (2026-08-08)

**Components 1–4 built** in `Q-Advantage/pqc-readiness-index`. Target list: 316 institutions, sourced
(FSB G-SIBs complete, CCADB CAs complete, FFIEC/EBA/BoE national retail banks complete for US/EU/UK,
exchanges/CCPs still `unverified: true` pending WFE member-portal access — confirmed login-gated, not
just fetch-blocked). Scanner: built, **verified by actually running it** — a real Python interpreter
was installed specifically to stop relying on manual code tracing, and the first live smoke test
caught a real bug (the connectedness check tested for a string, `"CONNECTION ESTABLISHED"`, that only
`openssl s_client -brief` prints; this code doesn't use `-brief`, so every probe was silently reporting
failure regardless of the real outcome, and all 37 mocked unit tests passed throughout because the
mock fixtures shared the same wrong assumption). Fixed and re-verified — see the private repo's commit
history for the full account. CI now runs the suite on every push. Weekly GitHub Actions workflow
built and disjoint-scheduled per the ADR 0003 mutex design.

**Not done:** endpoint discovery (every institution still has `endpoints: []` by design — this is the
founder-reviewed pass, not autonomous), the runner-availability precondition (manual, GitHub org
settings — since resolved, see PR #7), and full WFE exchange-list verification.

## Update, 2026-08-09 — Phase 1 operating, Phase 2 fully built

**Phase 1 is running for real**, not just built: a founder-approved pilot batch (all 29 G-SIBs, top
bucket first) has sourced endpoints; 15 of them have real scan results — the first data this product
has ever produced. Headline finding on that pilot: every certificate returned is `rsaEncryption`
(zero PQC authentication), key exchange is mixed and varies even within one institution's own
subdomains — exactly the KEX-moved/AUTH-didn't gap the index exists to measure.

**All of Phase 2 (components D–H) is now built** in the private repo and this PR, matching the vault's
full E/F/G/H spec, not stubs:
- **D (scoring):** the two-track model, real-run against the pilot data
- **E (methodology):** a full section on `q-advantage`'s methodology page, same depth as Q-Shield/
  Q-Day Index
- **F (right-of-reply):** contact discovery via RFC 9116 `security.txt`, data-pack generation,
  dispatch tracking — prepares what a human sends, never sends anything itself
- **G (corrections):** intake + disputed-status tracking in the private repo, a real `/corrections`
  page in this PR, wired end to end (a disputed institution shows a badge on the index and a notice
  on its own page)
- **H (public rendering):** this PR — real index table, per-institution pages, synthetic placeholder
  data only (see the PR description for why real data can't enter this repo pre-gate)

Two real bugs shipped past 100%-passing mocked tests and were only caught by testing live against
real, non-target servers — see the private repo's `docs/ARCHITECTURE.md` §6 for the full account and
the house rule it sets for anything future work adds here.

## Update, 2026-08-09 (later) — data pipeline built; endpoint coverage expanded to 59/316

**The private→public data pipeline now exists** (`scripts/export_public_data.js` in the private repo):
transforms real scan/score output into exactly the JSON shape this repo's UI expects. It deliberately
stops at the private repo's boundary — writes only inside that repo, never opens a PR or commits here,
never runs on a schedule. Getting real data onto `qadvantage.io` is still a manual, founder-confirmed
step (gates 1 & 3 first) — see the private repo's `docs/ARCHITECTURE.md` §7 for the exact promotion
steps. Until that happens, this repo's UI correctly keeps showing the synthetic placeholder data.

**Endpoint coverage: 59 of 316 institutions**, up from 29 — added the 6 card networks and the top 24
(by asset rank) US large national retail banks, same live-verification discipline as the G-SIB
batches. Pushed to the private repo's `main` ahead of today's scheduled weekly scan (Sundays 14:00
UTC), so the runner picks up all 59 automatically, unattended, rate-limited as designed — no live
in-session scanning was run against real production endpoints.

**Not done, honestly:** the other 257 institutions — 16 more US BHCs, ~150 EU/UK O-SII banks, 47 CAs,
58 still-unverified exchanges — need the same per-institution primary-source verification, which is
real ongoing labor, not a one-time unblock. Full-scale bulk scanning of all ~300 also still needs
identification infrastructure (stable elastic IP, correct reverse DNS, monitored WHOIS abuse contact,
exclusion page per `measurement-ethics.md` §4) that requires founder-level AWS action this session
cannot perform.

## Update, 2026-08-09 (later still) — public UI paused

**Founder wasn't satisfied with the launched page** and asked for it to come fully down while it's
polished further. `/pqc-readiness-index`, `/pqc-readiness-index/[id]`, and `/corrections` (only makes
sense alongside the index) now 404 via a single `PAUSED` flag per page — nothing deleted, nothing
rewritten, everything underneath is untouched and ready to re-enable by flipping that flag. Nav links
(header, footer) and the dead cross-link from the methodology page's PQC Readiness Index section are
also removed for the duration. Private repo, pipeline, and endpoint-sourcing work from earlier today
are unaffected — this is a public-rendering-only pause.

**Gate 4 (CA/Browser Forum ML-DSA status) is resolved**, not just researched harder: the current TLS
Baseline Requirements (v2.2.9 §6.1.5) explicitly permit only RSA/ECDSA — "no other algorithms or key
sizes are permitted." ML-DSA is not permitted in publicly-trusted certificates today; the enabling
ballot hasn't even been formally numbered yet. **Gate 2's content is ready** (the corrections policy
page in this PR matches it). **Gates 1 (entity) and 3 (legal review) remain open** — still the
founder's to close, not something this session can do.

**A consolidated architecture doc** now exists in the private repo
(`docs/ARCHITECTURE.md`) connecting business intent → requirements → architecture → work orders →
code → testing → production maintenance for this product specifically — start there for anything
beyond this work-order's own scope.

## What this is

Build Phase 1 of the PQC Readiness Index per the vault's GO decision
(`context/decisions/0002-pqc-readiness-index-go-no-go.md`) and full spec (vault
`10-strategy/magnet-spec-v0.md`). See `docs/adr/0003-pqc-readiness-index-repo-topology.md` for why
this builds in a **separate private repo**, `Q-Advantage/pqc-readiness-index` — not here. This
work-order records the intent; implementation happens against that repo, most naturally by pointing
`work-order-runner` (or an equivalent build session) at a checkout of it.

**Phase 1 only.** No scoring, no methodology page, no right-of-reply workflow, no corrections
process, no `qadvantage.io` rendering. Those are Phase 2, blocked on the entity, a published
corrections policy, legal review, and CA/Browser Forum verification — none of which are done.

## Why it matters

The spec's central point: PQ key exchange has moved (~50% of measured traffic); PQ authentication has
not (~0% of measured certificates). Nobody maintains a continuous, named, per-institution measurement
of that gap — the closest thing (a June 2026 arXiv paper, 32,011 domains) is a single point-in-time
sweep with no continuity. **The time series cannot be reconstructed after the fact** — every week
Phase 1 isn't running is a week of moat permanently lost, independent of whether or when Phase 2 ever
publishes.

## What "done" looks like

### 1. Target-list schema + sourced compilation

JSON schema for `{institution, category, endpoints: [{hostname, purpose}]}`. Categories per spec
scope: global-SIB/large-national-retail banks, regulated exchanges/clearing houses, card
networks/payment processors, publicly-trusted CAs.

The institution-level compilation (not the per-institution endpoints) is a **sourced research task**,
not fabrication and not founder busywork — pull from real, live, citable primary lists:
- G-SIBs: FSB's official 2025 list (29 named banks) — https://www.fsb.org/2025/11/2025-list-of-global-systemically-important-banks-g-sibs/
- CAs: CCADB's "Server Authentication" root CA report — https://www.ccadb.org/resources
- Exchanges/CCPs: World Federation of Exchanges member directory — https://www.world-exchanges.org/
- Card networks/processors: small, well-known named set

Do **not** use the arXiv paper's 32,011-domain set as the seed — it's Tranco (traffic-ranked) + 127
RBI-listed Indian banks, not a sector-curated frame. Fine as a cross-validation reference later, not
as the source.

**Endpoint discovery is the genuinely manual part** — each institution's ~12 real hostnames (primary
web, online banking login, public API, dev portal, mobile API, OCSP/CRL for CAs) come from the
institution's own published documentation and DNS, never scraping or guessing (per vault
`measurement-ethics.md`, bridged at `context/measurement-ethics.md`). Founder spot-checks and approves
the compiled list before it's ever used against real servers — this is the approval gate that matters,
not the compilation labor.

### 2. Scanner + parser

New code (this codebase has no existing live-TLS-handshake/`openssl s_client` invocation to extend —
`benchmark/protocols/common.py`'s TLS code is in-process liboqs timing, a different thing). Follow the
`benchmark/` idioms already established: `argparse` CLI, `@dataclass` records, `subprocess.run(...,
capture_output=True, text=True, timeout=...)` wrapped the way `common.py`'s `_run()` helper does. One
connection per candidate key-exchange group (spec §3.2): highest negotiated TLS version, whether TLS
1.2 is still accepted, supported groups (X25519MLKEM768, SecP256r1MLKEM768, X25519, secp256r1,
secp384r1), certificate chain fields, HTTP version/Alt-Svc.

### 3. Storage

Append-only JSON per (hostname, sweep) in the new private repo, committed (private repo — this is
safe here, unlike in `q-advantage`). Never overwrite a prior sweep. Certificates deduplicated by
SHA-256 fingerprint. Methodology version stamped on every record.

### 4. Weekly scheduled workflow

New GitHub Actions workflow in `pqc-readiness-index`, `[self-hosted, q-advantage-bench]`, weekly
cron disjoint from the daily benchmark's window (see ADR 0003 for the full mutex design — schedule
separation + best-effort process check + `nice`/`ionice`, since a same-repo `concurrency:` mutex
isn't available across repos). Job summary limited to aggregate counts even though the repo is
private (good hygiene, not strictly required).

## Explicitly out of scope

Scoring/two-track model, methodology page, right-of-reply workflow, corrections/disputes intake, any
`web/` or `qadvantage.io` change. No `web/lib/data/` touched — this work-order doesn't trip the
testing standard's "must have tests" bullet for that directory.

## Manual preconditions (not this work-order's code)

- Founder curates/approves the final endpoint list before first real scan.
- Founder (or a subsequent session with org access) makes the self-hosted runner reachable by
  `pqc-readiness-index`'s Actions (org-level runner group, or a second registration).

## Test strategy

Parser/loader unit tests against synthetic fixtures — obviously-fake institution names and hostnames,
same spirit as this repo's `-1`/`9999` benchmark sentinels, never real ones. Filename/schema
validation tests. No live network calls in tests.
