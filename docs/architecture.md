# Architecture

How the Forge's governance layer sits on top of the existing q-advantage system. Keep this current — it's the map, not the territory.

## The two systems, side by side

**Product code** (unchanged by this session):
```
web/        Next.js 14 site — qadvantage.io — deployed on Vercel, GitHub-integrated (preview per PR, prod on main merge)
benchmark/  Python measurement + scoring — runs daily on a self-hosted EC2 runner (label: q-advantage-bench),
            pushes results straight to main via .github/workflows/benchmark.yml — NOT gated by the app CI or PR flow
data/       Measured/vendor-sourced datasets (quantum_hardware.json)
schema/     P-CBOM schema, mirrors the separate Q-Advantage/p-cbom repo
```

**Factory layer** (added this session):
```
CLAUDE.md              guardrails + lifecycle, read every session
.claude/settings.json  permission model — what Claude Code can do silently vs. ask vs. never
.claude/agents/         work-order-runner (built), four stubs
work-orders/            intent documents — the founder's backlog, one file per change
docs/adr/               architecture decisions, numbered, append-only
.github/workflows/ci.yml   app CI — typecheck/lint/build/smoke on every PR into main
context/                (stub) future read-only bridge to the founder's knowledge vault
```

## How a change flows

```
work-orders/NNN.md → work-order-runner plans → founder approves →
branch off main → build + test → PR → Vercel preview → founder reviews + merges →
Vercel deploys → (if bad) founder promotes previous deployment
```

The benchmark pipeline is a **separate, parallel flow** that does not go through this loop — it's already working automation, daily cron → self-hosted runner → commit straight to `main`. The main-branch ruleset added this session exempts that bot (GitHub Actions app, verified id 15368) so it keeps working unmodified; every other path to `main` goes through a PR.

## Why a ruleset instead of classic branch protection

Classic branch protection's "require PR before merging" has no fine-grained exemption mechanism — it would block the benchmark bot's direct push along with everyone else's. Repository rulesets support a `bypass_actors` list scoped to a specific GitHub App identity, which lets the daily benchmark commit through without opening a standing hole for humans. See `docs/adr/0001-forge-repo-topology.md`.

## What's deliberately not here yet

- `context/` vault bridge — undecided, see `docs/adr/0002-context-vault-bridge-deferred.md`.
- Four of five subagents — stubs only, built when a real need pulls them.
- Any change to `benchmark/` internals or the self-hosted runner — out of scope for the factory build.
