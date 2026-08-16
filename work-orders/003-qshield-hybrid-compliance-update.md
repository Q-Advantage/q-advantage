# 003 — Q-Shield hybrid/classical compare, amplification factor, compliance labels

**Status:** merged 2026-08-12 (`35374ab`, PR #11). Companion `003a` merged as `fec023a` (PR #10) and
wired into the daily run on 2026-08-14 (`6bfe2d7`). Two items remain open — see "Open after merge".

## What

Pulled from `qshield-update-spec.md` (vault `10-strategy/`, 2026-08-09) plus direct founder requests
in-session: expose the hybrid-vs-classical protocol data Q-Shield already measures but never surfaced
on `/q-shield/compare`; add two derived metrics that fall out of that same data (amplification factor,
honestly-labeled bytes-on-wire); add CNSA 2.0 / BSI / ANSSI approval-status labels to the algorithm
families already benchmarked; add CSV export, a GitHub-history link, and InferenceX-inspired chart
views (radar, table/chart toggle, share button) per the spec's §5. Companion PR (`work-order/003a`)
adds AES-GCM baseline + LMS/XMSS stateful-signature harness code.

## Why this scope, not the full spec verbatim

The spec assumed hybrid/classical comparison needed new benchmark runs (1–2 day estimate) — it didn't;
the data (`benchmark/results/protocols/{tls,ssh}-composed-*.json`) already existed, committed daily
since June. The actual gap was `web/lib/data/` never loading it. Packet-level "companion metrics"
(packets/handshake, initcwnd, connections/core, per-connection state) that came up in-session are
genuinely not measurable from this data — Layer A doesn't do packet capture — and are named explicitly
in the methodology page rather than silently absent. Full detail on both corrections lives in the PR
descriptions, not repeated here.

## Not in this work-order

Layer B (live handshakes, packet-level capture) — queued to M4, untouched. Actual EC2 runner
redundancy/failover — guardrail-blocked (`benchmark.yml` off-limits) and explicitly skipped by the
founder this session. Database migration (Supabase) — not triggered per spec §7's own criteria. The
PQC glossary page — pure content work, lowest-priority item from spec §5, deferred as a fast-follow.

See PRs for the full file list and verification steps.

## Open after merge (status as of 2026-08-16)

**1. LMS/XMSS produces no measurements — the flagged risk landed.** `003a` shipped the harness with
an explicit caveat that the runner's liboqs 0.15.0 build probably lacked
`-DOQS_HAZARDOUS_EXPERIMENTAL_ENABLE_SIG_STFL_KEY_SIG_GEN`, unverifiable from that session. It did.
Every scheme in every `lms-xmss-*.json` since the first run (2026-08-14) carries
`status: "unavailable"` with that exact reason. The harness is behaving correctly — it reports
unavailability rather than fabricating, which is the whole point — but there is still no hash-based
signature data on the site, and there won't be until the runner's liboqs is rebuilt with that flag.
That's a runner-config change, which is guardrail-3 territory (`benchmark.yml` and the runner are
off-limits to Claude); it needs the founder. **AES-GCM, by contrast, works** — real data daily since
2026-08-14, rendering in the AES-GCM tab.

**2. The `/compare` "no data yet" notice silently disappeared — fixed.** `compare/page.tsx` gated
the hash-based-sigs notice on `!primaryBucket?.lmsXmss`, i.e. on the *file* being absent. The moment
the first all-unavailable file landed on 2026-08-14, the notice vanished from the live page while
the data it was apologising for still didn't exist — the site got quieter about a gap instead of
louder. Fixed on `fix/003a-hash-sig-status`: gating now runs through
`hasLiveStatefulSigs()` in `lib/protocols/derive.ts` (any scheme `status === "ok"`), the notice
quotes the harness's own recorded reason instead of a stale "first run pending" line, and
`scripts/smoke-protocols.ts` asserts that a file full of `"unavailable"` never reads as live data.

Still deliberately deferred, unchanged from the "Not in this work-order" list above: the three-way
Table/Chart/Radar split (`CompareViewTabs` is a two-way toggle; needs `CompareView` decomposed), the
PQC glossary page, Layer B packet capture, runner redundancy, Supabase. One item of standing debt not
noted at merge: 8 entries in `lib/data/compliance.ts` still carry `verification: "search-corroborated"`
rather than `"confirmed"` — they need a primary-source read before they can be upgraded.
