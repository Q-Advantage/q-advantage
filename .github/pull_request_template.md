## What changed

<!-- One or two sentences. Link the work-order if there is one: work-orders/NNN-*.md -->

## Why

<!-- What problem this solves or what it enables. -->

## What to check on the preview

<!-- Specific URLs/flows for the founder to click through, if this touches web/. -->

## What could break

<!-- Honest risk assessment. "Nothing, it's docs-only" is a valid answer. -->

## Checklist

- [ ] Scoped to one work-order / one concern — no unrelated refactors bundled in
- [ ] `npm run type-check` / `lint` / `build` green locally
- [ ] Tests added for new behavior, or a regression test for the bug being fixed
- [ ] No benchmark result files or `data/quantum_hardware.json` touched by hand
- [ ] No secrets read, printed, or committed
- [ ] Technical claims (OIDs, security levels, reference figures) cited or flagged `#unverified`
