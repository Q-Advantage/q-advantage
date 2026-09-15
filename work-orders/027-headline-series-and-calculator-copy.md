# 027 — The headline becomes a series, and the calculator stops saying "slower"

**Branch:** `work-order/027-headline-series-and-calculator-copy`
**Target files:** `web/app/calculator/page.tsx`, `web/app/q-shield/`, `web/app/page.tsx`, `METHODOLOGY.md` — plus anywhere else the ML-KEM-768-vs-X25519 delta is surfaced (search for it; this list is not guaranteed complete).
**Numbering:** 026 is reserved for a separate work-order not yet written into this repo. Leave the gap.

## What

Two corrections to published copy.

**A · The calculator's opening claim is half wrong.**

`web/app/calculator/page.tsx` (around line 73) currently reads:

> "Post-quantum TLS is slower and heavier than what you run today."

On the published t3.medium series, **"heavier" is right and "slower" is wrong** for the pure
algorithm: `MLKEM768` measured a median 63.4% *faster* than X25519 in the composed TLS 1.3 key
exchange across 85 runs. What is slower is the **hybrid**, and only because it runs two exchanges.
The site's own data contradicts the site's own headline sentence.

The replacement must distinguish the two cases. Suggested, not mandated:

> "Post-quantum TLS is heavier than what you run today, and hybrid key exchange is slower — the
> algorithm itself is not. This tells you what that costs on your traffic, in dollars, before you
> commit to it."

**B · The site presents a single day's delta as a stable fact.**

The headline percentage renders from the latest run. The underlying series spans **36.5% to 78.7%
faster across 85 runs**, so the figure a visitor sees changes materially day to day with nothing on
the page saying so — the 2026-08-26 run alone showed 53.7%.

Policy: **the series is the headline; a single day never is.** Wherever the ML-KEM-768-vs-X25519
delta is surfaced, render median, range and n, with the latest run available as a dated data point
beside it rather than in place of it.

## Why now

A reader who cites a figure from this site should find the same figure tomorrow. Today they will not.

## Done looks like

- The calculator hero no longer asserts post-quantum TLS is slower without distinguishing hybrid
  from pure.
- Every surfaced ML-KEM-768-vs-X25519 delta shows median + range + n, not a bare single-run value.
- Any single-run figure that remains on a page carries its date and commit inline.
- `METHODOLOGY.md` states the presentation policy in one paragraph, so the site's presentation is
  explained rather than merely correct.
- No number changes value in this work-order. Presentation and wording only — the measurement fix is
  `028`, and the two must not be bundled.

## Not in scope

The volatility itself (`028`), the hardware change and its METHODOLOGY write-up, and any change to
how the delta is computed. Do not touch `benchmark/protocols/`.

---

## Changed since this was written (added 2026-09-15) — verify each before relying on it

- **The daily host moved to c7i on 2026-09-14.** `.github/workflows/benchmark.yml` was switched to
  c7i x86 hardware and the separate c7i overlap workflow deleted. The figures above (85 runs, 63.4%,
  36.5–78.7%) come from the t3.medium series and are now stale. Compute median/range/n from
  `benchmark/results/protocols/tls-composed-*.json` at build/render time; do not hardcode them.
- **Never pool runs across hardware eras.** The site already derives eras from the instance-type
  field in each result file. Show the series for the current era. If the c7i era has too few runs to
  call it a series, say so honestly on the page — show n plainly, and/or show the previous era's
  series labelled with its hardware. Never silently fall back to the t3 figure as if it described
  current hardware. Pick the smallest honest presentation and justify it in the PR.
- **Preserve the existing withholding rule.** The site already withholds classical-baseline
  comparisons that are structurally impossible on affected runs; excluded runs must not enter the
  median or range.
- **`METHODOLOGY.md` is stale on the hardware.** Its Hardware section and Known limitations still say
  c7i "has not been cut over". Do not rewrite that section in this PR — list it in the PR description
  as a follow-up. This PR's `METHODOLOGY.md` change is only the one-paragraph presentation policy.

## PR description must contain

The plan; files touched; before/after of the calculator sentence; every place the delta is surfaced
and how each now renders; the stale-METHODOLOGY follow-up; anything deliberately not done and why.
