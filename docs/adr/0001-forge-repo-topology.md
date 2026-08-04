# ADR 0001: Forge root is `q-advantage/`, branch protection uses a ruleset with a bot bypass

## Status

Accepted — 2026-08-04

## Context

The Forge governance layer needed a home. The session that built it was invoked from the founder's Desktop, a general-purpose directory holding unrelated personal and business files (an ICT policy draft, LinkedIn content drafts, a second unrelated app project). `q-advantage/` already existed as a real, up-to-date clone of `github.com/Q-Advantage/q-advantage` inside that directory.

Separately, the repo needed branch protection on `main` — but `main` already has a live, working automation on it: `.github/workflows/benchmark.yml` runs daily on a self-hosted EC2 runner and pushes results directly to `main` with no PR, using the default `GITHUB_TOKEN` (attributed to `github-actions[bot]`). Any protection scheme had to not break that.

## Decision

**Topology:** the Forge governance layer (`CLAUDE.md`, `.claude/`, `docs/`, `work-orders/`) lives inside `q-advantage/` itself — the actual git working copy — not at the Desktop root. This keeps governance scoped exactly to product code and avoids mixing a production-deploy gate into an unrelated, cluttered directory that also drives a second, unrelated project (`compass-ai-site`).

**Branch protection:** `main` is protected by a **repository ruleset**, not classic branch protection, because rulesets support a `bypass_actors` list scoped to a specific actor — classic protection's "require PR before merging" has no equivalent fine-grained exemption and would block the benchmark bot along with everyone else.

The ruleset:
- Requires a pull request before merging into `main`.
- Requires the app CI status check to pass.
- Blocks force-pushes and branch deletion.
- Bypass: `actor_type: "Integration"`, `actor_id: 15368` (the GitHub Actions app), `bypass_mode: "always"`. This ID was **verified empirically** via `gh api apps/github-actions` in this session, not assumed from memory.
- No bypass for the founder's own account or for repository-admin role. Direct pushes to `main` are closed for every human, including edits made outside Claude Code (e.g. from VS Code) — a decision the founder was asked about and did not override, so the more restrictive default stands.

## Consequences

- Claude Code sessions (this one and future ones) operate inside `q-advantage/`, never the Desktop root, for anything related to this product.
- The founder cannot `git push origin main` directly anymore, from any tool — everything goes through a PR, same as Claude Code. This is enforced at the GitHub level, independent of `.claude/settings.json`.
- If the GitHub Actions app's bypass is ever removed or misconfigured, the daily benchmark commit will fail outright (not silently) — see `docs/runbook.md` for the recovery step.
- If the founder wants his own bypass back later, it's a one-line addition to the ruleset's `bypass_actors` — a deliberate, visible change to make, not a default to build in now.
