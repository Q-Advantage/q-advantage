# ADR 0003: PQC Readiness Index Phase 1 lives in a new private repo, not here

## Status

Accepted — 2026-08-07

## Context

The founder's vault (bridged read-only at `context/`) records a **GO, phased and gated** decision on
a new product, the **PQC Readiness Index**: weekly, per-institution measurement of ~100 named
banks/exchanges/payment networks/CAs' TLS posture — key exchange vs. authentication, the "~50% vs 0%"
gap the product is built around. Full spec: vault `10-strategy/magnet-spec-v0.md`. Decision record:
`context/decisions/0002-pqc-readiness-index-go-no-go.md`.

That decision splits the build into two phases with a hard gate between them:

- **Phase 1:** target list + scanner + storage. No publication, no entity needed. Reversible at zero
  cost. Its entire value is a time series that cannot be reconstructed retroactively.
- **Phase 2:** scoring, methodology page, right of reply, corrections process, public named
  publication. Blocked until all four are true: the entity exists, a corrections policy is published,
  legal review of naming exposure has happened, and CA/Browser Forum ML-DSA status is verified against
  the Forum's own tracker. As of this ADR, none of those are confirmed done.

`q-advantage` is a **public** repo (guardrail 4). Phase 1's dataset is a curated list of ~100 real,
named financial institutions and CAs, their hostnames, and weekly TLS scan results about them.
Committing that to `q-advantage` — even unpublished on the site — would already put named regulated
institutions' data into public git history, in tension with the decision doc's "names nobody" framing
for Phase 1 and ahead of any of the Phase 2 legal/entity protections. Public GitHub Actions logs
compound this: for a public repo, workflow run logs are visible to anyone, so even printing institution
names to a scan job's stdout would leak them, independent of what gets committed.

## Decision

**Phase 1 lives in a new private repo, `Q-Advantage/pqc-readiness-index`**, sibling to `q-advantage`
and `p-cbom` in the same GitHub org. It holds the real target list, the scanner code, and the
append-only weekly scan results. It has its own `CLAUDE.md` (adapted from this repo's guardrails —
scan-data integrity, secrets firewall, `main`/PR gate, no-harvesting) rather than inheriting this
repo's, since it is a separately-cloned, separately-governed repo with its own agent sessions.

Being private resolves both concerns above outright: institution names in commit history and in
workflow logs are both fine, since only repo collaborators can see either. Nothing about Phase 1
touches `q-advantage`'s public surface. `q-advantage`'s `web/` gets no changes in Phase 1 — this repo
only carries the decision trail (this ADR) and the build intent
(`work-orders/002-pqc-readiness-index-phase1.md`).

**Forward-looking, not built yet:** the founder intends `qadvantage.io` to eventually surface this
product at the top level, next to Q-Shield. That's a Phase 2 site/nav decision, recorded here for
continuity, out of scope until the Phase 2 gate clears.

### Mutex against the daily benchmark, without touching `benchmark.yml`

The spec calls a hard mutex against the daily benchmark run mandatory (box contamination — not
capacity — is the real risk of co-scheduling on `q-advantage-bench`). Because the scanner now lives in
a **different repo** from `benchmark.yml`, GitHub Actions' `concurrency:` groups can't provide it —
concurrency groups are scoped per-repository and don't span repos even with an identical group name.
And `benchmark.yml` itself remains off-limits to modify (this repo's stack guardrail).

**Layered resolution, all on the scanner's side:**
1. **Disjoint scheduled window (primary).** Benchmark runs 06:00 UTC, ≤180 min (done by 09:00 UTC
   worst case). The scan runs weekly, Sunday 14:00 UTC.
2. **Best-effort process check (secondary).** Before scanning, check for an active benchmark process
   on the box (e.g. `pgrep -f benchmark.py`) and exit/retry if found. Lives entirely in the new repo's
   workflow.
3. **`nice`/`ionice` the scanner process** so a residual overlap degrades gracefully instead of
   contaminating benchmark timing.
4. **Named, not applied: a true cross-repo mutex needs `benchmark.yml` to acquire/release a shared
   lock too** — a small addition only the founder can make. This is the honest residual risk of this
   topology choice, not something worked around silently.

### Runner availability

The self-hosted runner (`q-advantage-bench`) needs to be reachable by the new private repo's Actions —
either an org-level runner group covering both repos, or a second registration on the same box. This
is a GitHub org-settings action for the founder; it wasn't done as part of this ADR.

## Consequences

- Two repos now carry parts of this product: `q-advantage` holds the decision trail and (eventually,
  Phase 2) the public site rendering; `pqc-readiness-index` holds the real data and the scanner. Anyone
  picking this up needs both to understand the whole picture — this ADR and the new repo's README
  cross-link deliberately for that reason.
- The mutex is weaker than a same-repo `concurrency:` group would have given — schedule-disjoint plus
  a best-effort process check, not a hard OS-level lock both sides participate in. Acceptable for
  Phase 1's ~45 min/week footprint against a ~21-hour idle window, but worth tightening (via the
  `benchmark.yml` addition named above) before any higher-frequency or longer-running successor.
- If `pqc-readiness-index` is ever made public (post-Phase-2, deliberately), that's a distinct decision
  requiring its own review — auditing commit history and Actions logs for anything not meant to be
  public yet — not a default this ADR pre-approves.

## Update, 2026-08-08 — build complete, one methodology note worth carrying forward

Components 1–4 (target list, scanner, storage, weekly workflow) are built in the private repo.
Recording one thing here because it bears on trusting *any* future addition to this scanner, not just
this session's: the scanner shipped with mocked unit tests all green while a real bug made every probe
report failure regardless of actual outcome (a stdout string check for `"CONNECTION ESTABLISHED"`,
which only `openssl s_client -brief` prints — this code doesn't use `-brief`). It was caught only
because a real Python interpreter was installed and the CLI was smoke-tested against a live,
non-target server. **Mocked tests passing is not sufficient evidence a probe-style tool actually
works — a live smoke test against a real (non-target) server, cross-checked against an independently
captured reference, is the bar.** Worth keeping as house practice for anything in this repo that
shells out to a live network tool, not just this one.
