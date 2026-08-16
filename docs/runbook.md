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

### Enabling LMS / XMSS stateful signatures

**Status: harness ready (verify-only, Option A below). One rebuild on the runner is outstanding.**

`benchmark/protocols/lms_xmss.py` has run daily since 2026-08-14 and every scheme reports
`status: "unavailable"` — the runner's liboqs 0.15.0 build does not have stateful signatures
compiled in. The harness reports this correctly rather than fabricating; `/q-shield/compare` shows
a "queued — no measurements yet" notice quoting the reason.

Verified against liboqs 0.15.0 `CONFIGURE.md` (primary source, read 2026-08-16), three options are
involved, **all defaulting to `OFF`**:

| Option | Effect |
|---|---|
| `OQS_ENABLE_SIG_STFL_LMS` | compiles LMS |
| `OQS_ENABLE_SIG_STFL_XMSS` | compiles XMSS |
| `OQS_HAZARDOUS_EXPERIMENTAL_ENABLE_SIG_STFL_KEY_SIG_GEN` | enables **key generation and signing** |

Without the third, only **verification** is available.

**Read this before enabling the third one.** Upstream's own documentation says the OQS team
"explicitly discourages enabling this variable and reserves the right to remove this feature in
future releases if its use causes actual harm", notes that NIST recommends key and signature
generation be done only in hardware to enforce one-time use of secret keys, and warns that keys
stored in a file system are "extremely susceptible to simultaneous use". The build emits a warning
when it is set.

None of that makes it wrong to enable on a disposable benchmark box that signs throwaway keys and
publishes only timings. It does mean two things:

1. It is the founder's call, not a maintenance task.
2. If enabled, the published LMS/XMSS keygen and signing numbers were produced under a
   configuration upstream discourages, and the methodology page must say so. Publishing them
   without that disclosure would be the same class of omission this repo exists to avoid.

**Option A — verification only (no hazardous flag). This is the route taken; the harness now
supports it.** Rebuild with `OQS_ENABLE_SIG_STFL_LMS=ON` and `OQS_ENABLE_SIG_STFL_XMSS=ON` only.
`lms_xmss.py` tries the full keygen/sign/verify path first, and when the build cannot generate keys
it falls back to timing verification against a known-answer test vector, recording *why* the full
path was unavailable alongside the result.

The vectors are committed at `benchmark/protocols/vectors/`, fetched from liboqs's own KAT corpus
at tag 0.15.0 and checksum-verified against the SHA-256 upstream publishes in its own `kats.json`.
Nothing was transcribed or generated locally. `fetch_kat_vectors.py` re-fetches and re-verifies
them; you do not need to run it for a normal rebuild.

Verification is also the operation that matters most here: a firmware signature is produced once
and checked on every boot.

**Option B — full keygen/sign/verify.** All three options `ON`. Carries the disclosure obligation
above, and note liboqs's own test suite comments that stateful keygen "can take hours to complete"
for large trees — `benchmark.yml` has a 180-minute timeout, so this may not fit.

Either way the rebuild happens on the EC2 box, against the venv the workflow already sources
(`~/q-advantage/venv`), and **`benchmark.yml` is not edited** — it is off-limits per CLAUDE.md
guardrail 3, and it needs no change for this. Sketch, to be confirmed against however liboqs was
originally installed on that host:

```bash
# on the runner, with the venv deactivated
cd ~/src/liboqs && git fetch --tags && git checkout 0.15.0
cmake -S . -B build -GNinja \
  -DCMAKE_INSTALL_PREFIX="$HOME/.local" \
  -DOQS_ENABLE_SIG_STFL_LMS=ON \
  -DOQS_ENABLE_SIG_STFL_XMSS=ON \
  -DOQS_HAZARDOUS_EXPERIMENTAL_ENABLE_SIG_STFL_KEY_SIG_GEN=ON   # option B only
cmake --build build --parallel && cmake --install build
# rebuild the python binding against the new library
source ~/q-advantage/venv/bin/activate
pip install --force-reinstall --no-binary :all: liboqs-python==0.15.0
```

**Verify before trusting a run**, on the runner:

```bash
source ~/q-advantage/venv/bin/activate
python3 -c "import oqs; print(oqs.get_enabled_stateful_sig_mechanisms())"
```

An empty list means the rebuild did not take. Then trigger the workflow manually and check the
newest `benchmark/results/protocols/lms-xmss-*.json`. Under Option A each scheme should read
`status: "ok"` with `"mode": "verify_only"`, a `verify` timing block, and no keygen or sign block —
those are absent because this build cannot produce them, not zero. Any scheme still
`"unavailable"` is telling you the truth — do not work around it.

If a scheme reports `"status": "failed"` with `error_type: "kat_verification_failed"`, the vector
did not verify against the build and **no timing was recorded**. Investigate before trusting
anything else in that file.

Do not hand-edit a result file to make this look done. See guardrail 1.

## Branch protection / ruleset

Two rulesets on `main`, as of this session:
- `main-hard-gate` — **active.** Blocks force-push and branch deletion, no exceptions. Doesn't affect the benchmark bot (it only ever fast-forward pushes).
- `main-forge-gate-evaluate` — **evaluate mode (not enforcing yet).** Would require a PR + the `web checks` CI status before merging. Not flipped to active because a safe bypass for the benchmark bot's direct `git push origin main` couldn't be verified this session — see `docs/adr/0001-forge-repo-topology.md` for the full story and the `#todo` on how to resolve it.

**To check whether the bot's push would have been blocked**, after the next benchmark run completes: `gh api repos/Q-Advantage/q-advantage/rulesets/rule-suites` or GitHub UI → repo Settings → Rules → Insights. That tells you, with real evidence, whether it's safe to flip `main-forge-gate-evaluate` to `active`.

To inspect or change either ruleset: `gh api repos/Q-Advantage/q-advantage/rulesets` (read) or the GitHub UI under repo Settings → Rules → Rulesets. Changing them is a deliberate action, not something Claude Code does as part of normal work-order execution (see `.claude/settings.json` — write access to rulesets is `ask`, not standing-allowed).

## Env vars

Configured in Vercel project settings, never in the repo: `BEEHIIV_API_KEY`, `BEEHIIV_PUB_ID`. The build does not require these to succeed — see `web/README.md`. The `/contact` form and the Q-Day Index feedback form both use a client-side `mailto:` link (no server-side config, no API key).
