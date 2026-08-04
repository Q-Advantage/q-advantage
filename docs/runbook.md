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

`main` is protected by a repository ruleset (not classic branch protection) requiring a PR + passing CI status check, blocking force-push and branch deletion, with a bypass for the GitHub Actions app so the benchmark bot's direct commits keep working. Everyone else — including the founder pushing from an editor — goes through a PR.

To inspect or change it: `gh api repos/Q-Advantage/q-advantage/rulesets` (read) or the GitHub UI under repo Settings → Rules → Rulesets. Changing it is a deliberate action, not something Claude Code does as part of normal work-order execution (see `.claude/settings.json` — write access to rulesets is `ask`, not standing-allowed).

## Env vars

Configured in Vercel project settings, never in the repo: `BEEHIIV_API_KEY`, `BEEHIIV_PUB_ID`. `NEXT_PUBLIC_BOOKING_URL` has a code fallback and is optional. The build does not require any of these to succeed — see `web/README.md`.
