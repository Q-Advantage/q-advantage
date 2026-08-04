# ADR 0001: Forge root is `q-advantage/`, branch protection uses a ruleset with a bot bypass

## Status

Accepted — 2026-08-04

## Context

The Forge governance layer needed a home. The session that built it was invoked from the founder's Desktop, a general-purpose directory holding unrelated personal and business files (an ICT policy draft, LinkedIn content drafts, a second unrelated app project). `q-advantage/` already existed as a real, up-to-date clone of `github.com/Q-Advantage/q-advantage` inside that directory.

Separately, the repo needed branch protection on `main` — but `main` already has a live, working automation on it: `.github/workflows/benchmark.yml` runs daily on a self-hosted EC2 runner and pushes results directly to `main` with no PR, using the default `GITHUB_TOKEN` (attributed to `github-actions[bot]`). Any protection scheme had to not break that.

## Decision

**Topology:** the Forge governance layer (`CLAUDE.md`, `.claude/`, `docs/`, `work-orders/`) lives inside `q-advantage/` itself — the actual git working copy — not at the Desktop root. This keeps governance scoped exactly to product code and avoids mixing a production-deploy gate into an unrelated, cluttered directory that also drives a second, unrelated project (`compass-ai-site`).

**Branch protection — what was intended vs. what was actually achievable this session:**

The intent was a repository ruleset (not classic branch protection, since rulesets support a `bypass_actors` list — classic protection's "require PR before merging" has no equivalent fine-grained exemption) with the GitHub Actions app bypass-listed so the benchmark bot's direct push to `main` keeps working while every human goes through a PR.

That bypass could not be verified safely this session. `gh api apps/github-actions` confirmed the app's **global** ID (15368), but creating a ruleset with `bypass_actors: [{actor_type: "Integration", actor_id: 15368}]` was rejected by GitHub: *"Actor GitHub Actions integration must be part of the ruleset source or owner organization."* Querying `orgs/Q-Advantage/installations` to find an org-scoped installation ID for it returned only Vercel — the built-in Actions token isn't a discrete "installed app" the way a marketplace GitHub App is, so it doesn't appear to be listable as a ruleset bypass actor through this API path at all. A daily benchmark run happened to be live and mid-flight while this was being investigated, which made "just try it and see" an unacceptable way to find out — a failed push would have gone unnoticed until the next check.

**What's actually active as of this session:**
- A ruleset (`main-hard-gate`) blocking **force-push and branch deletion** on `main` — active, unconditional, no bypass needed, because the benchmark bot never does either (it only ever fast-forward pushes, with rebase-and-retry on conflict — see `benchmark.yml`).
- A second ruleset (`main-forge-gate-evaluate`) in **evaluate mode** — requires PR + the `web checks` CI status, but only *logs* what it would have blocked, blocks nothing. This exists so the next daily benchmark run (or a manual trigger) generates real evidence, via the ruleset's rule-suites / Rule Insights, of whether "require PR before merging" would actually block the bot's push — before anyone flips it to active.

**What's still open (`#todo`, needs a decision, not a default):**
1. Check the evaluate-mode ruleset's rule-suites after the next benchmark run (`gh api repos/Q-Advantage/q-advantage/rulesets/rule-suites`, or Settings → Rules → Insights) to see whether the bot's push would have been blocked.
2. If it would be blocked and there's truly no clean bypass for the built-in Actions identity: either (a) accept a `RepositoryRole`/`OrganizationAdmin` bypass that also happens to cover the founder's own pushes (weakens the "no human bypass" intent), or (b) change the benchmark workflow to authenticate with a dedicated GitHub App or fine-grained PAT installed on the repo, which *can* be bypass-listed cleanly — but that's a change to `benchmark.yml`, which is explicitly off-limits without the founder's explicit sign-off given how sacred that pipeline is.
3. Flip `main-forge-gate-evaluate` to `active` only once one of those is resolved and confirmed safe.

## Consequences

- Claude Code sessions (this one and future ones) operate inside `q-advantage/`, never the Desktop root, for anything related to this product.
- Right now: force-push and branch deletion on `main` are hard-blocked for everyone. "Require PR before merging" is **not yet enforced by GitHub** — it's only being observed in evaluate mode. Until item 3 above is resolved, a direct `git push origin main` from anywhere (including the founder's own editor) would still succeed at the GitHub level; the only thing stopping it today is `.claude/settings.json`'s deny rule (which only binds Claude Code sessions) and the founder's own discipline.
- If the founder wants to accept a broader bypass (covering his own account, not just the bot) to get "require PR" active sooner, that's a one-line addition to the ruleset's `bypass_actors` — a deliberate, visible change to make, not a default to build in now.
