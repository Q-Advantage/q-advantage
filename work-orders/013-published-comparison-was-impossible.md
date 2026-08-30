# 013 — A published comparison was structurally impossible

**Status:** in progress, 2026-08-30.

## What was wrong

`qadvantage.io` was publishing, from the 2026-08-29 committed run:

```
SecP256r1MLKEM768   pct_over_classical = -19.4
```

Rendered in the good/green style, that told readers a **P-256 + ML-KEM-768 hybrid handshake is 19.4%
faster than a classical key exchange alone.** A hybrid suite performs a classical exchange *and* a KEM
exchange. That is not a surprising measurement; it is an impossible one.

## Why the existing guard did not stop it

Two guards already existed and both did their job. Neither could have caught this.

1. `vsBaselinePct` (`lib/protocols/metrics.ts`, PR #32) recomputes the delta from the baseline **in the
   same file**, which fixed the 2026-08-16 cross-pass bug where the harness compared a suite measured
   in one pass against a baseline measured in another. That fix is sound and still holds.
2. `scripts/smoke-protocols.ts` asserted that no hybrid suite reads faster than its classical baseline,
   and **it fired correctly** — `npm run smoke` has been red on `main`.

The gap is that benchmark commits carry `[skip ci]` and push straight to `main`
(`.github/workflows/benchmark.yml:92`), so `ci.yml` — which only triggers on `pull_request` — has never
run against newly landed benchmark data. The guard was correct and nobody was listening to it.

## The actual root cause: the baseline, not the comparison

Same-run recomputation cannot rescue a comparison whose *denominator* was measured in a degraded mode.
Tracing `X25519`'s own floor across all 82 committed `tls-composed` files:

| Period | `min_us` for X25519 | Behaviour |
|---|---|---|
| 2026-06-10 → 2026-08-16 (68 runs) | **160.2 – 160.8 µs**, every run | stable |
| 2026-08-17 → 2026-08-29 | alternates **~161 µs** and **~186–193 µs** | bimodal |

Seven of 82 runs violate the invariant, all after 2026-08-17.

**Steal time does not explain it.** The affected runs report 0.0–0.5% steal; several unaffected runs
report 3–4%. So the site's current published explanation — that burstable CPU steal inflates the
classical baseline — does not fit this data, even though it fitted the 2026-08-15 incident it was
written for.

Two facts worth holding together: the LMS/XMSS status regression (`unavailable` → `failed`) landed on
**the same date**, 2026-08-17, and the toolchain fields are byte-identical across the break (OpenSSL
3.0.13, same `build_path`, same `cpu_hz_nominal`). Something about the host's execution changed that
day, not the software. **Not diagnosed here** — flagged as `#unverified` and left for the c7i overlap
data to settle, which is the honest position.

The c7i overlap run does not show the pattern: X25519 `min` 109.3 µs, CV 7.6%, steal 0.008%, and
`SecP256r1MLKEM768` reads **+68.8%** — the sign it should have.

## What this work-order changes

**It does not correct the number.** No result file is touched (guardrail 1). It stops the site
publishing a figure that cannot be true.

- `web/lib/protocols/anomaly.ts` — `detectSuiteAnomaly` flags a hybrid suite whose same-run comparison
  is structurally impossible. Hybrid is detected from the measured `phases` block (both `kem_*` and
  `classical_*` present), never from the suite name, so pure-PQC suites — which are *legitimately*
  faster, one of this product's headline findings — can never trip it.
- `publishableVsBaselinePct` is what every rendering surface now calls: `home-metrics.ts` (homepage +
  `/q-shield`), `q-shield/protocols/page.tsx`, `HybridVsClassical.tsx` (including its CSV export),
  and `calculator/model.ts`. `vsBaselinePct` stays as the raw projection for analysis.
- `/q-shield/protocols` renders a **"One comparison is withheld from this run"** caveat naming the
  suite, both figures, and the reason. The suite's own timings are unchanged and still shown — only
  the percentage is withheld. We publish the gap, not a number that cannot be true.
- `scripts/smoke-protocols.ts` no longer halts the build on host noise the harness cannot promise away.
  It reports every withheld suite and hard-fails on the invariant that actually protects a reader:
  a violating suite must never yield a publishable number, and a *sound* comparison must never be
  suppressed.

## Tests

- `web/lib/protocols/anomaly.test.ts` — 13 cases (vitest). The real 2026-08-29 shape is the primary
  case; explicit negative cases assert ML-KEM-768's genuine −63% is never suppressed, that an
  exactly-equal hybrid is still anomalous, and that a missing/zero baseline returns null rather than
  throwing or dividing.
- Fixtures follow the repo's sentinel discipline: degenerate distributions, `stdev_us: 0`,
  `n_iterations: 1`, `mode: "fixture"`.

## Not in this work-order

Diagnosing the 2026-08-17 host change; the c7i cutover; the host-era data layer. Those are the
remaining WO 013 capabilities and follow separately.

---

# 013b — The hardware transition, implemented rather than promised

**Status:** in progress, 2026-08-30. Stacked on the anomaly gate above.

## What was wrong

`/methodology` has promised this in prose since before the c7i migration was scheduled:

> "when it does, this document will be updated, historical runs from the burstable period will remain
> available, and the hardware change will be explicitly dated. **Results will not be silently
> migrated.**"

**No code implemented any part of it.** The loader read one flat directory and sorted by timestamp;
`buildTrends` plotted every run as one continuous line. On the day `benchmark.yml` is repointed at the
c7i runner, a ~2× step change would have rendered as a performance trend, under a caveat still naming
t3.medium's burstable throttling as the cause — and the `burstable` pill in `AuditStrip`, the only
visual cue that anything had changed, would have **silently cleared itself**, because `benchmark.py`
derives it from a `t3.` prefix test.

## What changed

**`web/lib/data/hosts.ts`** — the measurement host as a first-class dimension. An era is a maximal run
of consecutive runs sharing one `ec2_instance_type`. **Boundaries are derived from the committed files,
never authored**: there is no cutover date literal anywhere, so the partition cannot drift from the
data and there is nothing for guardrail 1 to catch. The only authored content is a display label and
note per instance type, describing hardware rather than asserting any measurement.

- `NormalizedRun` gains `host_era_id`, tagged in `loadAllRuns()` once the whole record is visible.
- `getLatestRun()` now means *newest run of the current era*, not newest file. These differ during a
  transition: the c7i overlap runs started at 05:51Z against the t3 workflow's 06:00Z, so a plain
  newest-by-timestamp read could have made an older-era run the site's headline figure.
- `buildTrends` tags every point with its era and returns `breaks`. `TrendsChart` gives each series one
  Recharts data key **per era**, so two hosts never share a key and no segment can be drawn between
  them — the same "a hole stays a hole" rule the missing-run case already followed, applied to a change
  of machine. A dashed `ReferenceLine` marks the transition.
- The public API's history endpoint carries `era_id` and `instance_type` per point, so the client path
  that refetches from `/api/v1` derives the same breaks the server does.

**A range bug two hosts expose.** `trends.ts` sliced the window by **run count**, not calendar days.
Identical while one host committed once a day; during the c7i overlap two runs land per date and
"30 days" silently becomes 15. Now sliced by date, measured back from the newest run in the record
rather than from today, so a stalled record does not render as empty.

**Copy that was false or about to be.** `/q-shield/trends` hardcoded the literal `"0.13% to 10.51%"`
inside a live component whose neighbouring figures were computed — now derived per era.
`/methodology` gains a **derived era table** and states the promise as implemented. `README.md:24`
claimed the x86 host was already `c7i.large` while every result file said `t3.medium` — corrected.
`METHODOLOGY.md` corrected in both the hardware section and known limitations. `AuditStrip`'s
"Instance" field is relabelled **"Measured on"** so the hardware is always named, burstable or not.

**Where all three documents previously agreed and were wrong:** each attributed the x86 baseline's
movement to burstable CPU steal. Since 2026-08-17 that explanation does not fit — see the root-cause
trace in 013 above. All three now say so and flag the cause `#unverified` rather than repeating an
explanation the data contradicts.

## The LMS/XMSS status regression

`lms_xmss.py` caught `MechanismNotEnabledError` in a broad `except Exception` and reported
`status: "failed"` / `error_type: "verify_only_exception"`. Semantically that is the `unavailable`
case — the build simply lacks the mechanism. It landed 2026-08-17 (files from 08-14 to 08-16 are 4/4
`unavailable`; every file since is 4/4 `failed`) and was live for 13 days.

Two consequences, both real. `/q-shield/compare` rendered the raw string
`MechanismNotEnabledError: LMS_SHA256_H10_W8` to readers as the explanation for missing hash-based
signature data, having lost the informative reason. And `"failed"` is the louder signal, reserved for a
KAT that will not verify — classifying an expected, documented build gap as a failure buries the real
ones. **This is also what turned CI red on 2026-08-23**, alongside the anomaly in 013.

Fixed on both sides: the harness classifies it as `unavailable` with a reason naming the flags that fix
it, and `statefulSigsUnavailableReason` translates the raw string already committed in 13 days of
historical files rather than waiting for the record to age out. An undiagnosed error is still passed
through verbatim — inventing an explanation for something we have not diagnosed would be worse.

**The rebuild itself is still outstanding and is the founder's**: `OQS_ENABLE_SIG_STFL_LMS=ON` and
`OQS_ENABLE_SIG_STFL_XMSS=ON` on the measurement host, per `docs/runbook.md`. The c7i box shows the
same error, so it did not happen there either.

## Tests

42 vitest cases and 4 pytest cases. The ones that matter:

- a two-host fixture produces a series that **breaks** at the boundary, with points either side
  carrying different era ids, and nothing interpolated across it
- `deriveHostEras` handles newest-first input (the order `loadAllRuns` actually returns), a rollback to
  earlier hardware as a third era rather than a merge, and an absent instance type as `unknown`
- `getLatestRun` returns the newest era's run even when an older-era file has a later timestamp
- `"30 days"` means 30 calendar days on a two-host record, measured back from the newest run
- `transitionNote` asserts no magnitude — claiming one without the calibration measurement would be
  authoring a number
- pytest: `MechanismNotEnabledError` classifies as `unavailable`; a genuine fault stays `failed`.
  Verified to fail before the fix and pass after.

## Not in this work-order

The calibration report and `/q-shield/calibration` (needs ≥7 clean overlap days — the c7i box was
offline and has produced one run). Diagnosing the 2026-08-17 host change. The liboqs rebuild. The
cutover itself.
