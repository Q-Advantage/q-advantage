# 001 — Don't fabricate a classification for unrecognized algorithms

## What's wrong

In `web/lib/data/normalize.ts`, `parseAlgorithmKey()` recognizes ML-KEM, ML-DSA, and SLH-DSA keys from liboqs. For anything it doesn't recognize, the fallback branch does this:

```ts
const id = liboqs_key.toLowerCase().replace(/_/g, "-");
return {
  id,
  display_name: liboqs_key,
  family: "ML-KEM",
  parameter_set: liboqs_key,
  nist_level: 1,
};
```

`display_name` and `id` degrade gracefully (they just echo the raw key). But `family: "ML-KEM"` and `nist_level: 1` aren't "unknown" markers — they're a specific, false claim. If liboqs ever adds a new parameter set or renames one before this code catches up, the dashboard would silently render it as an ML-KEM algorithm at NIST security level 1, with nothing distinguishing it from a real ML-KEM-512 entry.

## Why it matters

This product's entire pitch is "every number traces to something real, nothing is fabricated." A benchmark *value* here would never be faked — but a *classification* silently defaulting to a real, specific, wrong answer is the same failure mode applied to metadata instead of a measurement. It's exactly the kind of thing `CLAUDE.md`'s sourcing standard exists to catch, just not one it currently reaches (that standard covers cited claims, not code-level fallback behavior).

## What "done" looks like

- An unrecognized liboqs algorithm key can never silently present as a specific real family/NIST level it isn't.
- Whatever the fix is — failing loudly at build time, or a distinct "unknown" classification that's visibly different in the UI — should fit how the rest of this data-integrity-obsessed codebase handles this kind of situation (worth checking: does anything already log a warning, or fail the build, for unexpected liboqs output elsewhere in `benchmark/` or `web/lib/data/`? Match that pattern if one already exists rather than inventing a new one.)
- A test covers the fallback path with a made-up, obviously-fake key (not a real algorithm name) and asserts the output is honestly "unknown," not a specific wrong answer.
- `npm run type-check`, `npm run lint`, `npm run build`, `npm run smoke` stay green.

Not in scope: touching real benchmark data, adding a UI treatment for unknown algorithms beyond what's minimally needed to not lie, or handling any liboqs key that already parses correctly today.
