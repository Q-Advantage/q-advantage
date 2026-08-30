# 015 — Tier 1 instrumentation, and the statistical rigour upgrade

**Status:** in progress, 2026-08-30. Source: `qshield-update-spec.md` §14 and §15 Tier 1.

## Why these two together

Both are things the harness was already *almost* doing. Tier 1 is described in the spec as capturing
"a field the harness already has access to" — no new measurement, no new infrastructure, hours not
days. §14's statistical upgrade is the same shape: the harness records mean, median, p95, p99, stdev,
min, max and n on every operation, which the spec calls "real rigor, underused."

Neither needed a decision. Both had simply never been done.

## The statistical upgrade, and why it is retroactive

`stdev_us` and a confidence interval on the mean are different quantities, and the confusion between
them runs in one direction: a reader sees a large standard deviation and concludes the measurement is
imprecise. It is not. The standard deviation says how far *individual samples* scattered — on this
host, mostly a fact about the machine. The interval says how precisely the *mean* is known, and it is
built from the standard error, which shrinks with √n. **At n=1000 it is roughly 3% of the standard
deviation.**

The important consequence: an interval is derivable from `mean_us`, `stdev_us` and `n_iterations`,
and **every run ever committed already carries all three.** So `web/lib/data/statistics.ts` computes
it for the entire historical record — 100+ days — with no new measurement at all. The harness emits
the same fields from now on so the raw files carry them too, but nothing on the site depends on that.

`separatedBeyondNoise()` is the point of the exercise. Q-Shield publishes comparisons, and on a host
with this much movement some of those differences are not distinguishable from noise. Overlapping 95%
intervals are the honest signal not to quote one as a finding. It is deliberately conservative —
non-overlap is a stricter bar than a two-sample t-test, so it errs toward calling a real difference
indistinguishable. Under-claiming is the failure mode this product can afford; over-claiming is not.
It returns `null` rather than `false` when either side cannot be judged, because a caller would
reasonably read `false` as "they overlap".

## Tier 1: the three fields

**`secret_key_bytes`** — liboqs-python exposes `length_secret_key` in the details block on every run;
it was read and discarded. §16.3 makes it **blocking for the TCM's Expansion & Retention line item**:
storage for larger private keys cannot be priced from public key sizes alone. This is not optional
breadth.

**Per-operation CPU time.** The spec asks for it *and* asks for it to be reported honestly: on a
single-core-pinned harness with nothing else scheduled it reads close to wall time by construction,
and only becomes informative once utilisation varies under contention — which this harness
deliberately does not create. That caveat ships in the output field itself, not just in a comment.

**Per-operation memory.** `ru_maxrss` is a high-water mark that never falls, so it is **not** a
per-operation footprint and is deliberately **not divided by the iteration count** — doing so would
produce a confident, meaningless number. It is published as what it is: growth in the process peak
across the timed loop. The unit is recorded too, because `ru_maxrss` is kilobytes on Linux and bytes
on macOS, and a figure without its unit is a 1024× error waiting to be quoted.

Both are sampled *around* the loop rather than inside it. Sampling per iteration would perturb the
timings the loop exists to collect.

## Schema

`protocol_result.schema.json` sets `additionalProperties: false` throughout — correctly, since a typo
in a harness field name would otherwise ship silently. That makes every new harness field a breaking
change until the schema is told about it, so `benchmark/tests/test_schema.py` checks both directions:
every recently committed suite still validates (a schema change must never invalidate published
history), and a record carrying the new fields validates too.

Also added `host.ec2_instance_type`, which work-order 013's host-era work needs and the schema
previously forbade.

One thing worth recording: the repo's `-1` sentinel is unusable in schema fixtures, because the schema
puts `minimum: 0` on every timing field — a duration cannot be negative. `9999` is the sanctioned
alternative and is equally impossible to mistake for a measurement.

## Tests

- `benchmark/tests/test_stats.py` — 20 cases. The ones that matter assert the interval is built from
  the standard error rather than the deviation, that it narrows as √n, that a single sample yields
  `null` rather than a zero-width interval reading as certainty, that peak memory is *not* divided by
  iterations, and that the CPU caveat is present in the emitted note.
- `benchmark/tests/test_schema.py` — 11 cases, both directions, plus two that assert the schema still
  *refuses* an undeclared field and a missing required block.
- `web/lib/data/statistics.test.ts` — 14 cases, including that `separatedBeyondNoise` errs toward
  "indistinguishable" and returns `null` rather than `false` when it cannot judge.

## Not in this work-order

§16's CFDIR alignment, the glossary page, classical signature baselines, and everything in Tier 2.
Those follow separately.
