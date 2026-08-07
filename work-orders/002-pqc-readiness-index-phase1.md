# 002 — PQC Readiness Index, Phase 1 (target list, scanner, storage)

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
