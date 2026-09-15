# 028 — Compute the classical-baseline delta paired, not as a ratio of two noisy means

**Branch:** `work-order/028-paired-baseline-delta`
**Target files:** `benchmark/protocols/tls_composed.py`, `benchmark/protocols/common.py`, `benchmark/protocols/ssh_composed.py`, `benchmark/protocols/ipsec_composed.py`, `benchmark/protocols/jose_composed.py`, the protocol result schema, `METHODOLOGY.md`
**Numbering:** 026 is reserved for a separate work-order not yet written into this repo. Leave the gap.

> **Investigation first. The fix depends on what the investigation finds, and the founder reviews the
> evidence before any published number changes.**

## The observation

`baseline.pct_over_classical` is unstable across days to a degree that is hard to attribute to the
machine (t3.medium series, as of 2026-09-06):

| Suite | n | median | range |
|---|---|---|---|
| `MLKEM768` (pure) | 85 | 63.4% faster | 36.5 – 78.7% faster |
| `X25519MLKEM768` (hybrid) | 85 | 37.5% slower | 20.5% *faster* – 137.1% slower |

The hybrid crossing zero — some days measuring the hybrid as faster than the classical baseline it
contains — is not a physically sensible result and is the clearest signal that something mechanical
is wrong.

## Two host-based explanations, ruled out (2026-09-06)

1. **Not the hardware.** Four c7i.large overlap days read **28.3 / 28.3 / 12.9 / 62.1** for the
   hybrid — the same order of spread as t3. The effect substantially survives a change of machine.
2. **Not steal time.** Across the 84 days carrying both `runtime_metrics.cpu_steal_seconds` and a
   delta, steal ranges 0.13% to 13.83% (median 0.86%) and correlates with the delta at **r = −0.08**.

   | | n | median % faster |
   |---|---|---|
   | low steal (<1%) | 44 | **63.5** |
   | high steal (≥5%) | 36 | **63.4** |

   Steal time is published for good reasons and is not the explanation here.

That leaves the measurement itself rather than the machine.

## The hypothesis to test first

The delta is currently derived from two independently measured means — the suite's and the
baseline's — each carrying its own run-to-run noise, which the ratio compounds rather than cancels.
A paired comparison, where suite and baseline are measured in the same loop and the delta is taken
per iteration before aggregation, cancels the correlated component of that noise. The 2026-08-16
two-pass bug fixed in `tls_composed.py` was the same family of error caught one level up; this may be
the residue.

**This is a hypothesis, not a diagnosis.** The first deliverable is the check, not the change.

## Done looks like

1. **Investigation, before any fix.** Establish whether a paired per-iteration delta materially
   narrows the spread, on real data, on the measurement host. If it does not, stop and report — the
   cause is elsewhere and the harness should not be changed on a guess.
2. **If confirmed:** compute the delta paired, in the same loop, and publish the paired figure with
   its own confidence interval alongside the existing per-run means.
3. **A discontinuity note** if published values shift, on the same principle as the hardware-era
   marker: a number changing because the method improved must be visibly distinguishable from a
   number changing because the algorithm did.
4. **Apply to every composed track** that emits `pct_over_classical` — TLS, SSH, IPsec, JOSE — not
   TLS alone, or the tracks stop being comparable to each other.
5. **`METHODOLOGY.md` updated**, replacing the `#unverified` attribution with what the investigation
   actually found. If it stays unexplained, say that — an honest open question beats a tidy wrong
   answer.

## Sequencing

`027` first — presentation only, changes no value. `028` may change values and therefore needs the
discontinuity discipline. **Do not bundle them.** Do not touch `web/`.

## Not in scope

The hardware decision.

---

## Changed since this was written (added 2026-09-15) — verify each before relying on it

- **c7i became the daily host on 2026-09-14.** `.github/workflows/benchmark.yml` was switched to c7i
  x86 hardware and the overlap workflow deleted. Keep hardware eras separate in every analysis (the
  instance type is recorded in each result file). Never pool t3 and c7i runs.
- **`METHODOLOGY.md` still says c7i "has not been cut over".** Stale. Don't rewrite the hardware
  section under this work-order — flag it as a follow-up.

## How to run the investigation (added 2026-09-15)

Work through these in order and stop at the first one that answers the question.

**A · Can the existing data answer it?** Read the five `*_composed.py` files and `common.py`, and the
result JSON under `benchmark/results/protocols/`. Establish exactly how `pct_over_classical` is
computed today: are suite and baseline timed in the same loop or separate loops, interleaved or
back-to-back, and do result files keep per-iteration samples or only aggregates? If per-iteration
samples for both exist within a run, compute paired vs unpaired spread on the real series, per era,
and answer the hypothesis with data.

**B · If only aggregates are stored,** test the *mechanism* on whatever machine you are on: run the
composed TLS measurement repeatedly and compare paired and unpaired delta spread across repeats.
Label every such number as **local evidence, not measurement-host evidence**.

**C · The smallest safe change** (only if A could not settle it): make the harness *additionally*
emit a paired per-iteration delta with its confidence interval, as a **new** field alongside the
existing `pct_over_classical`, across every composed track that emits one. Update the schema so the
new field validates, keep the existing field identical in meaning, add tests, change nothing on the
site. The daily c7i run then collects the evidence.

Under this first pass, **change no published value** and do not do items 2, 3 and 5 of "Done looks
like" — describe in the PR what each would look like once the evidence is in. If the pairing
hypothesis turns out wrong, stop and report; don't go looking for a different fix.

## Write-up

Append a `## Findings (YYYY-MM-DD)` section to this file on the branch: how the delta is computed
today (with file:line), what data exists, what was measured and where (real series vs local), the
result with numbers and n, and an explicit verdict — **confirmed / refuted / not yet testable** —
with the reason.

---

## Findings (2026-09-15)

### How the delta is computed today

- **One loop per phase.** `common.time_hybrid_kex` (`benchmark/protocols/common.py:307-370`) times
  every phase in its own 1,000-iteration loop via `_time_loop` / `_time_loop_with_setup`
  (`common.py:236-269`): the KEM's keygen, encaps and decaps loops, then the classical keygen and
  derive loops (`common.py:337-358`). The per-iteration composed total is an index-aligned weighted
  sum across those separately timed loops (`common.py:362-368`). Iteration *i* of one phase and
  iteration *i* of another were never timed together.
- **One call per suite, in sequence.** TLS measures `X25519MLKEM768`, `SecP256r1MLKEM768`,
  `MLKEM768`, then the `X25519` baseline (`tls_composed.py:23-28`, `:53-57`). SSH measures the hybrid,
  then the baseline (`ssh_composed.py:22-25`, `:38-42`). IPsec measures the **baseline first**
  (`curve25519`), then `ecp256`, `mlkem768` and both hybrids (`ipsec_composed.py:47-53`, `:114-119`).
- **The delta is a ratio of two composed medians** from those separate calls:
  `(suite median − baseline median) / baseline median × 100` (`tls_composed.py:67-68`,
  `ssh_composed.py:52-53`, `ipsec_composed.py:139-140`). The site recomputes the same ratio from the
  same file's medians (`web/lib/protocols/metrics.ts:57-73`).
- **So: separate loops, back to back, not interleaved.** Result files store aggregates only — per-phase
  and composed statistics. No per-iteration samples exist for any run.
- **JOSE does not emit `pct_over_classical`.** `jose_composed.py` publishes a signing delta
  (`comparison.rows[].sign_delta_pct`) instead. See "Not done" below.

### What data exists

Composed files, keyed by full path. The c7i overlap files in `benchmark/results-c7i/protocols/` share
filenames with same-day t3 files, so they must never be merged by name. Host from
`host.ec2_instance_type`; files before 2026-08-30 lack it and were joined to the primitives
`results-*.json` of the same date and commit, which carries it.

| Track | Path | Host | Runs |
|---|---|---|---|
| TLS | `results/protocols` | t3.medium | 95 (81 joined, 14 recorded) |
| TLS | `results/protocols` | c7i.large | 2 (both 2026-09-14) |
| TLS | `results-c7i/protocols` | c7i.large | 17 (15 recorded, 2 joined) |
| SSH | `results/protocols` | t3.medium | 95 (81 joined, 14 recorded) |
| SSH | `results-c7i/protocols` | c7i.large | 17 |
| IPsec | `results/protocols` | t3.medium | 14 |
| IPsec | `results/protocols` | c7i.large | 2 |

Plus one x86 TLS/SSH file with no host identifiable (2026-06-10) and one aarch64 run (2026-07-11),
both excluded from host-level figures.

### What was measured, and where

**Real series only — step A. Nothing here is local evidence and nothing was run on any host.** Step B
was not possible (no liboqs on the machine this ran on) and was not needed to establish the mechanism.

The test uses something the record already contains. Within one run, some operations are timed in
more than one suite's loops: the X25519 keygen and derive appear in the hybrid's loops *and* in the
baseline's; the ML-KEM-768 operations appear in every KEM suite's. Same operation, same machine,
same process, seconds apart. If loops measured consistently, those medians would agree.

Two measures, both from committed aggregates:

- **Loop agreement:** the ratio of the weighted phase medians for the same X25519 operations in the
  two loops that timed them. 1.00 means the loops agree.
- **How much of the delta that explains:** across runs, the correlation between a hybrid's published
  delta and the ratio of its own X25519 legs to the baseline suite's X25519 legs.

### Result

| Track · host | n | Same X25519 ops, two loops: ratio range | Runs where the loops disagree by >10% | r (hybrid delta, leg ratio) | r² |
|---|---|---|---|---|---|
| TLS · t3.medium, to 2026-08-29 | 81 | 0.56 – 1.76 | 27 | +0.91 | 0.84 |
| TLS · t3.medium, 2026-08-30 – 09-13 | 14 | 0.57 – 1.74 | 8 | +0.93 | 0.86 |
| TLS · c7i.large overlap | 15 | 0.76 – 1.47 | 9 | +0.97 | 0.94 |
| SSH · t3.medium, to 2026-08-29 | 81 | 0.59 – 1.69 | 21 | +0.92 | 0.85 |
| SSH · c7i.large overlap | 15 | 0.68 – 1.47 | 14 | +0.99 | 0.97 |
| IPsec · t3.medium | 14 | 0.60 – 1.71 | 11 | +0.98 | 0.96 |

(For TLS and SSH the ratio is hybrid loop ÷ baseline loop; IPsec measures its baseline first, so its
column is baseline loop ÷ hybrid loop. The correlation is computed the same way on every track. The
two c7i.large runs on the daily path are too few for a correlation.)

What that says:

1. **The same operation, timed in two loops of one run, routinely reads far apart** — by up to 76% on
   t3.medium and 47% on c7i.large — **and that disagreement explains 84–97% of the variance in the
   hybrid delta across runs**, on every track and on both hosts.
2. **It is not sampling precision.** Where recorded, each composed mean's standard error is 0.1–1.8%
   of the mean. The swings are one to two orders of magnitude larger. The ratios cluster at discrete
   levels on t3.medium (about 1.0, 1.3, 1.4 and 1.7): a whole 1,000-iteration loop lands on a level
   and stays there. This refines the hypothesis as written. The problem is not two noisy means
   compounding sample noise. It is whole loops landing at different levels.
3. **It survives the hardware change** (r² 0.94 and 0.97 on c7i.large), consistent with the
   2026-09-06 overlap observation.
4. **It is not a fixed order bias.** Ratios fall on both sides of 1.0 on every track and host. The
   first-measured loop is slower more often than faster.
5. **The pure ML-KEM-768 delta is steadier than its headline range suggests.** On TLS, t3.medium to
   2026-08-29 (n=81), its interquartile range is −63.2% to −62.4%. The full range of −78.5% to
   −36.5% comes from a handful of runs. `MLKEM768` and `X25519` are measured consecutively; the
   hybrid is measured two suites earlier. This is suggestive, not established.
6. **This is not the 2026-08-17 X25519 floor change.** Loop-level disagreement is present from June
   (leg ratio 1.73 on 2026-06-19), weeks before the floor went bimodal. The floor change stays
   `#unverified`; nothing here explains it.

### Verdict: **not yet testable** — the premise is confirmed, the fix's effect cannot be shown from committed data

- **Confirmed on the real series, on both hosts:** the delta's run-to-run movement is dominated by
  loop-level shifts that hit identical operations in different loops of the same run. The 2026-09-06
  checks ruled out steal and the hardware; the recorded standard errors rule out sampling precision.
  What remains is the measurement design: suite and baseline are timed in separate loops.
- **Not testable from committed data:** whether a paired, per-iteration delta actually narrows the
  spread. Only aggregates are stored, and a paired figure cannot be reconstructed from them. Pairing
  cancels a shift only if the shift lasts longer than one pair (under a millisecond). Shifts that hold
  for a whole loop do; faster ones would not. Only a paired measurement can say which dominates.
- **So, step C:** this branch adds `baseline.paired` — the delta taken per interleaved iteration, with
  a distribution-free 95% interval on its median — beside the unchanged `pct_over_classical` on TLS,
  SSH and IPsec. The daily c7i.large run collects the evidence. No published value changes.

### What items 2, 3 and 5 look like once the evidence is in

- **Deciding it.** After at least 14 daily c7i.large runs carrying `baseline.paired`, compare the two
  fields per suite over the same runs: interquartile range and range of `paired.pct_over_classical`
  against `pct_over_classical`. Proposed bar, for the founder to set before looking: confirmed if the
  hybrid's paired IQR is at most half the unpaired one and no hybrid run reads below zero. Otherwise
  refuted, and the harness stays as it is.
- **Item 2 — publish.** The site's series (work-order 027) reads `baseline.paired.pct_over_classical`
  with its interval for runs that carry it. `pct_over_classical` stays in every file and every export.
- **Item 3 — discontinuity.** A method era, built the same way as the hardware era: a series never
  pools paired and unpaired runs, and the first paired run is dated on the page as a change of method,
  not of performance.
- **Item 5 — `METHODOLOGY.md`.** Replace the `#unverified` run-to-run attribution with the finding
  above and describe the paired method. The stale c7i hardware text is a separate follow-up.

### Not done, and why

- **JOSE.** `jose_composed.py` emits no `pct_over_classical`; its `sign_delta_pct` compares separately
  timed signing means and plausibly has the same weakness. It is left alone because it is a different
  field on a different operation. Worth the same treatment if the key-exchange evidence confirms.
- **No change to `pct_over_classical`,** to the existing loops, or to their order. The paired loops
  run after every existing loop, and `steal_time_pct` is still read over exactly the existing loops.
- **Nothing on the site** (`web/` untouched), per the sequencing rule.
