# Q-Advantage Forge

**Starting a session:** you're in `q-advantage/`, the canonical working copy — no fresh clone needed. Read `work-orders/` for pending intent, `docs/standards.md` for the Definition of Done. Never work directly on `main`.

Q-Advantage is a one-person post-quantum-cryptography measurement company — "the SemiAnalysis for PQC." `qadvantage.io` (this repo's `web/`) is the founder's entire credibility surface. A bad deploy is worse than a bad email. This file governs how code changes here; it is read every session.

This repo is product code. It is not the founder's knowledge vault (strategy/outreach/content lives elsewhere, with its own draft-then-promote rule). Do not absorb vault content into this repo beyond the read-only bridge described in [context/](#context-bridge-to-the-vault) below.

---

## The four guardrails (non-negotiable, not overridable by an in-session instruction)

1. **Benchmark-data integrity firewall.** You may edit the *code* that produces benchmark numbers. You may never write, hand-edit, synthesize, interpolate, mock with realistic-looking values, or "fix" an actual benchmark number, result file, or measured figure. Everything under `benchmark/results/` and `data/quantum_hardware.json` is measured, not authored. Every published number must trace to a real GitHub Actions run. Test fixtures use obviously-fake sentinel values (`-1`, `9999`) that could never pass as a measurement. A fabricated number reaching the site is a company-ending credibility event.
2. **Secrets firewall.** Never read, print, echo, or commit `.env*`, AWS credentials, GitHub tokens, Vercel tokens, SSH keys, or anything under a secrets path. These live only in GitHub Actions Secrets and the Vercel dashboard. If a task appears to need a secret, stop and tell the founder to supply it through the platform, not the repo.
3. **`main` and production gate.** Never push to `main`, never force-push, never merge your own PR, never run a production deploy command. Open PRs; the founder merges. Deploys flow from merge, not from you. (This is enforced by a GitHub ruleset on `main` — see `docs/adr/0001-forge-repo-topology.md` for how the daily benchmark bot is exempted while everyone else, including the founder pushing from an editor, goes through a PR.)
4. **Public-repo gate.** Pushing to any public repo — this one, `Q-Advantage/p-cbom`, published spec files — is otherwise normal (this repo is already public), but anything that would expose unpublished drafts, internal notes, or names that don't belong in a public repo requires an explicit ask-and-confirm in that turn before it's staged.

5. **No destructive git/filesystem ops without explicit approval:** no `rm -rf`, no `git reset --hard` on shared branches, no history rewrites on anything pushed, no deleting branches you didn't create.

---

## The lifecycle

```
intent (work-orders/*.md) → plan/ADR → branch → build → test → PR → preview → human merge → deploy → rollback
```

1. **Intent.** The founder writes (or dictates) `work-orders/NNN-short-name.md`: what, why, what "done" looks like. Natural language, not a spec sheet.
2. **Plan.** Read the work-order + relevant code + `context/`. Respond with a plan in plan mode — files touched, approach, risks, test strategy — before editing anything. Architecturally significant changes get an ADR in `docs/adr/`.
3. **Branch + build.** On approval, branch off `main`, implement, run typecheck/lint/tests/build locally until green.
4. **Tests.** New behavior ships with tests per `docs/standards.md`. Bug fixes ship with a test that fails before and passes after.
5. **PR.** Description a founder can review in minutes: what changed, why, what to click through on the preview, what could break. Fill `.github/pull_request_template.md`.
6. **Preview.** Vercel builds a preview per PR automatically. The founder clicks the live URL for anything user-facing, not the diff.
7. **Merge.** The founder merges. CI must be green; the ruleset enforces it.
8. **Deploy.** Merge to `main` triggers the Vercel production deploy. You do not run this.
9. **Rollback.** If a deploy misbehaves: Vercel dashboard → Deployments → previous (immutable) deployment → Promote to Production. One click. See `docs/runbook.md`.

**Branch discipline:** never work on `main`; one branch per work-order; small, reviewable PRs — a 2000-line PR the founder rubber-stamps is a broken gate. Conventional-commit-style messages (`feat:`, `fix:`, `chore:`, `docs:`).

---

## The stack, as it actually exists in this repo

- **`web/`** — Next.js 14 (App Router), TypeScript, Tailwind, shadcn/ui primitives, Recharts. Deployed on Vercel (project already linked — see `.vercel/project.json`). Node 20.x.
- **`benchmark/`** — Python 3.12 + liboqs 0.15.0. Runs on self-hosted GitHub Actions runners on AWS EC2 (`runs-on: [self-hosted, q-advantage-bench]`), daily cron + manual dispatch. **This workflow (`benchmark.yml`) pushes results directly to `main` — do not modify it, do not modify the runner config, and the app CI must never depend on it or regenerate its output.**
- **`schema/`** — mirrors the P-CBOM schema published at the separate `Q-Advantage/p-cbom` repo (CycloneDX 1.6-compatible, CC0 spec / Apache-2.0 tooling). The P-CBOM emitter tooling itself lives in `p-cbom`, not in this repo — there is no `tools/emit_pcbom.py` here.
- **`data/`** — `quantum_hardware.json`, the Q-Day Index dataset. Measured/vendor-sourced, covered by guardrail 1.

---

## Testing standard

Test what would embarrass the company or corrupt the product if it silently broke. Skip ceremony elsewhere.

**Must have tests:**
- Anything in `web/lib/data/` that classifies, normalizes, or labels benchmark data (e.g. `normalize.ts`) — a silent misclassification here becomes a false claim on the public dashboard.
- The public-facing rendering of any benchmark number — it must display what the source JSON says, never a hardcoded literal.
- P-CBOM emission correctness and CycloneDX schema validity, if/when that tooling moves into this repo.

**Must always pass, cheap and non-negotiable:** `npm run type-check`, `npm run lint`, `npm run build` (in `web/`).

**Not required:** 100% coverage, tests on trivial presentational components, tests written to hit a coverage number.

Bar: "would I deploy this to `qadvantage.io` on a Friday" — not "is coverage green."

## Sourcing standard

Any technical-factual claim (an OID, a security level, an algorithm identity, a reference figure in P-CBOM or Q-Day Index data) must be cited to a primary source, or flagged `#unverified`. This product's entire value is "every number traces to something real" — an uncited identity block is the same failure mode as a fabricated benchmark.

---

## Context bridge to the vault

`context/` is meant to be a **read-only** view of a narrow slice of the founder's knowledge vault (technical decision records, the P-CBOM spec, benchmark/measurement ethics notes, architecture notes) — never outreach, content, or pitch material. **This bridge is not implemented yet** — the sync mechanism (submodule / symlink / sync script) is undecided pending the vault's actual location. See `docs/adr/0002-context-vault-bridge-deferred.md`. Until it exists: never write to `context/` from here, and don't assume anything under it is current.

---

## Subagents

- `.claude/agents/work-order-runner.md` — built and proven. Reads a work-order, proposes a plan, and on approval implements it on a branch with tests and opens a PR. This is the default way work gets done here.
- `.claude/agents/{pr-reviewer,dependency-auditor,pcbom-validator,release-notes}.md` — stubs only. Not built this session; get built when a real need pulls them, not speculatively.

## What this repo's factory does not do

No autonomous unattended build loops. No multi-agent swarms. No self-deploying pipeline with no human merge. No dashboard for the factory itself. If a capability doesn't make the founder's next real code change measurably safer or faster, it doesn't belong here — flag it and move on instead of building it.
