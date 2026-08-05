# Runbook

## Deploy

Merging a PR to `main` triggers Vercel's GitHub integration automatically — no manual deploy step. Preview deployments build automatically per PR.

## Rollback

If a production deploy misbehaves:
1. Vercel dashboard → the `q-advantage-web` project → **Deployments**.
2. Find the last known-good deployment (deployments are immutable).
3. **⋯ → Promote to Production.**

One click, no revert commit needed. Do this first if something's visibly broken; investigate the root cause after the site is stable again.

## Benchmark pipeline (self-hosted runner)

`.github/workflows/benchmark.yml` runs daily at 06:00 UTC on a self-hosted GitHub Actions runner (label `q-advantage-bench`, on AWS EC2) and pushes results straight to `main`. This is existing infrastructure, not something built or modified this session.

- **Manual trigger:** GitHub → Actions → "Daily PQC Benchmark" → Run workflow.
- **Runner status / restart:** #todo — the founder has SSH/console access to the EC2 instance and the runner service details; not something this session had access to. Fill in: how to check the runner is online (Settings → Actions → Runners), how to SSH in, how to restart the runner service if it goes offline.
- **If a benchmark run fails to push** (e.g. because of the new branch ruleset): check that the GitHub Actions app (id `15368`) is still listed as a bypass actor on the `main` ruleset — see `docs/adr/0001-forge-repo-topology.md`. If the bypass broke, the fix is to correct the ruleset, not to touch the workflow.

## Branch protection / ruleset

Two rulesets on `main`, as of this session:
- `main-hard-gate` — **active.** Blocks force-push and branch deletion, no exceptions. Doesn't affect the benchmark bot (it only ever fast-forward pushes).
- `main-forge-gate-evaluate` — **evaluate mode (not enforcing yet).** Would require a PR + the `web checks` CI status before merging. Not flipped to active because a safe bypass for the benchmark bot's direct `git push origin main` couldn't be verified this session — see `docs/adr/0001-forge-repo-topology.md` for the full story and the `#todo` on how to resolve it.

**To check whether the bot's push would have been blocked**, after the next benchmark run completes: `gh api repos/Q-Advantage/q-advantage/rulesets/rule-suites` or GitHub UI → repo Settings → Rules → Insights. That tells you, with real evidence, whether it's safe to flip `main-forge-gate-evaluate` to `active`.

To inspect or change either ruleset: `gh api repos/Q-Advantage/q-advantage/rulesets` (read) or the GitHub UI under repo Settings → Rules → Rulesets. Changing them is a deliberate action, not something Claude Code does as part of normal work-order execution (see `.claude/settings.json` — write access to rulesets is `ask`, not standing-allowed).

## Env vars

Configured in Vercel project settings, never in the repo: `BEEHIIV_API_KEY`, `BEEHIIV_PUB_ID`. The build does not require these to succeed — see `web/README.md`. The `/contact` form and the Q-Day Index feedback form both use a client-side `mailto:` link (no server-side config, no API key).
