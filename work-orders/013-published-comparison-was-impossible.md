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
