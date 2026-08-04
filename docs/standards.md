# Engineering standards

## Testing standard

Test what would embarrass the company or corrupt the product if it silently broke. Skip ceremony elsewhere.

**Must have tests:**
- Anything in `web/lib/data/` that classifies, normalizes, or labels benchmark data — a silent misclassification becomes a false claim on the public dashboard.
- The public-facing rendering of any benchmark number — must display what the source JSON says, never a hardcoded literal.
- P-CBOM emission correctness and CycloneDX schema validity, if/when that tooling moves into this repo.

**Must always pass, cheap and non-negotiable:** `npm run type-check`, `npm run lint`, `npm run build` (in `web/`).

**Not required:** 100% coverage, tests on trivial presentational components, tests written to hit a coverage number.

Bar: "would I deploy this to `qadvantage.io` on a Friday" — not "is coverage green."

## Definition of Done

A change is done when:
1. It does exactly what its work-order or the founder's request asked — no unrelated refactors bundled in.
2. `npm run type-check`, `npm run lint`, `npm run build` are green locally and in CI.
3. New behavior has a test; a bug fix has a test that fails before the fix and passes after.
4. No guardrail from `CLAUDE.md` was crossed (benchmark data, secrets, `main`/prod, public-repo).
5. Any non-obvious technical claim added (an OID, a security level, a reference figure) is cited or flagged `#unverified`.
6. The PR description lets the founder review in minutes: what changed, why, what to click through on the preview, what could break.

## PR checklist

Mirrors `.github/pull_request_template.md`:
- [ ] Scoped to one work-order / one concern
- [ ] `type-check` / `lint` / `build` green
- [ ] Tests added for new behavior or the bug being fixed
- [ ] No benchmark result files or `data/quantum_hardware.json` touched by hand
- [ ] No secrets read, printed, or committed
- [ ] Preview URL checked for anything user-facing
- [ ] Technical claims cited or flagged `#unverified`

## Commit / branch discipline

- One branch per work-order: `work-order/NNN-short-slug`.
- Conventional-commit-style messages: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`.
- Small, reviewable PRs. A 2000-line PR the founder rubber-stamps is a broken gate, not a fast one.
