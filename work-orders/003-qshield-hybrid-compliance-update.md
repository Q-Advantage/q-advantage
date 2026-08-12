# 003 — Q-Shield hybrid/classical compare, amplification factor, compliance labels

**Status:** built, PR open, not merged.

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
