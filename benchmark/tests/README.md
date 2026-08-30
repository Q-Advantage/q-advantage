# Harness tests

`pytest benchmark/` — runs in CI on `ubuntu-latest`, which has **no liboqs build**.

## What is covered here

Pure logic that needs no cryptography: status classification, statistics
helpers, and result shaping.

## What is deliberately not covered here, and why

`benchmark.py` imports `oqs`, `psutil` and `tabulate` at module level, so it
cannot be imported in CI at all. The protocol scripts under
`benchmark/protocols/` import `oqs` lazily, so their non-crypto logic is
testable and is tested.

Nothing that produces a **measurement** is asserted here. A number this suite
could check would be a number generated on a shared GitHub runner, which is not
publication-grade and must never be confused with a Q-Shield figure. The real
verification of a harness change is the next daily run on the measurement host —
see `docs/runbook.md`.

This is a stated limit, not an oversight. Coverage that pretends otherwise
would be worse than none.
