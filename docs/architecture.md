# Architecture

How the Forge's governance layer sits on top of the existing q-advantage system. Keep this current — it's the map, not the territory.

## The two systems, side by side

**Product code:**
```
web/        Next.js 14 site — qadvantage.io — deployed on Vercel, GitHub-integrated (preview per PR, prod on main merge)
benchmark/  Python measurement + scoring (Layer A, in-process) — runs daily on a self-hosted EC2 runner
            (label: q-advantage-bench), pushes results straight to main via .github/workflows/benchmark.yml
            — NOT gated by the app CI or PR flow
layer-b/    Layer B (live sockets) — Docker, runs on any machine and in CI. No EC2, no credentials.
            Its workflow is .github/workflows/layer-b.yml and it does NOT push to main.
data/       Measured/vendor-sourced datasets (quantum_hardware.json)
schema/     P-CBOM schema, mirrors the separate Q-Advantage/p-cbom repo
```

**Factory layer:**
```
CLAUDE.md              guardrails + lifecycle, read every session
.claude/settings.json  permission model — what Claude Code can do silently vs. ask vs. never
.claude/agents/        work-order-runner (built), four stubs
work-orders/           intent documents — the founder's backlog, one file per change
docs/adr/              architecture decisions, numbered, append-only
.github/workflows/ci.yml   app CI — typecheck/lint/build/smoke on every PR into main
context/               read-only bridge to the founder's vault, as a Windows junction — see below
```

## The two measurement layers

They answer different questions and neither replaces the other.

**Layer A** calls the library in process and times it. It is how algorithms are compared, and it
runs only on the measurement host, because a timing is a property of the machine.

**Layer B** performs real handshakes over real sockets and reads the result off the wire. It answers
what Layer A structurally cannot — packets per handshake, fragmentation, what happens when two
stacks do not agree — and because those facts are properties of the protocol rather than the
machine, it runs anywhere, including in CI on a shared runner.

The split has a consequence worth stating: a Layer B result carries `publishable: false` unless it
ran on the measurement host, and `layer-b/publish-results.py` strips its timings before anything
reaches the site. Structural figures travel; durations do not.

## How a change flows

```
work-orders/NNN.md → work-order-runner plans → founder approves →
branch off main → build + test → PR → Vercel preview → founder reviews + merges →
Vercel deploys → (if bad) founder promotes previous deployment
```

The benchmark pipeline is a **separate, parallel flow** that does not go through this loop — it's already working automation, daily cron → self-hosted runner → commit straight to `main`. The main-branch ruleset added this session exempts that bot (GitHub Actions app, verified id 15368) so it keeps working unmodified; every other path to `main` goes through a PR.

## Why a ruleset instead of classic branch protection

Classic branch protection's "require PR before merging" has no fine-grained exemption mechanism — it would block the benchmark bot's direct push along with everyone else's. Repository rulesets support a `bypass_actors` list scoped to a specific GitHub App identity, which lets the daily benchmark commit through without opening a standing hole for humans. See `docs/adr/0001-forge-repo-topology.md`.

## The `context/` bridge

Implemented as a **Windows junction** pointing at the vault's `50-technical/` folder on the same
machine — not a symlink, not a submodule. See `docs/adr/0002-context-vault-bridge-deferred.md`.

Because it is a junction, nothing under `context/` is repo content: it physically lives in the
vault, it is git-ignored, and it must never be written to from this repo. It also reflects whatever
state the vault is in on disk right now, not a reviewed snapshot.

**If `context/` reads as empty or absent, the junction is broken** — the vault folder moved. That is
a signal to repair the junction, never to recreate its contents inside the repo.

## What's deliberately not here yet

- Four of five subagents — stubs only, built when a real need pulls them.
- Any change to `benchmark/` internals or the self-hosted runner — out of scope for the factory build.
- Layer B's Tier 3 extensions — interop matrix across the stacks `layer-b/crosslib/` already builds,
  Envoy and an inspection case, downgrade *detection* as opposed to downgrade behaviour, and
  certificate-chain impact on page-load. Sequenced in `work-orders/025-lms-publication-and-tier3.md`.
