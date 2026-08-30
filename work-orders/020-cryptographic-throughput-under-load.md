# 020 — Cryptographic throughput under load

**Status:** in progress, 2026-08-30. Source: `qshield-update-spec.md` §15 Tier 2, `layer-b-spec.md`
§7, CFDIR's **MIA** line item.

## The naming is the whole design

`layer-b-spec.md` §7 exists because two different numbers were about to share one casual name. It
resolves the collision explicitly and this work-order is the second half of that resolution:

- **This number** — how raw cryptographic throughput degrades when N crypto operations contend for
  CPU. No sockets, no accept queue, no kernel connection state.
- **Layer B's number** (work-order 014) — how a full TCP+TLS connection behaves when N of them happen
  at once, including socket setup and the handshake state machine.

The spec's instruction: *"ship Tier 2's number first, label it explicitly as 'cryptographic
throughput under load' rather than 'connections per core' unqualified, and let Layer B's fuller
number supersede it once built rather than conflating the two under one label."* Layer B arrived
first, so both now exist — which makes the label discipline more load-bearing, not less.

**The label travels in every payload**, not in prose a page might forget to add. Four tests assert
the wording rather than the arithmetic, because a later edit shortening it to "concurrency" would
undo the entire point.

## Three method decisions, each recorded in the output

**Processes, not threads.** Python threads do not parallelise CPU-bound work past the GIL, so a
threaded version of this would measure the GIL and publish it as cryptographic scaling. Each worker
is its own process with its own liboqs objects.

**Fixed duration, not fixed iteration count.** Throughput is operations per unit time. With a fixed
count, workers finish at different moments and the aggregate gets averaged over a partly-idle window,
which flatters the result. Each worker runs for a set duration and reports what it completed; the
aggregate divides by the *longest* worker's window, not the shortest.

**Workers released on a shared wall-clock instant.** Without it, the first-spawned worker runs alone
for as long as the last one takes to start, and its throughput is inflated by exactly the contention
the measurement exists to capture.

## The honest limit, stated before any number

**The measurement host has two vCPUs.** Beyond two workers this is not parallel scaling — it is the
scheduler under oversubscription. That is a real operational question (a loaded server *is*
oversubscribed) and worth publishing, but it is a *different* question.

So the sweep deliberately includes counts above the core count, every point records
`oversubscribed: true|false`, and each carries its own `efficiency_note` saying which it is. The
caveat is attached **per point** rather than once in a summary, because a single summary sentence is
exactly what gets quoted without its qualifier.

`qshield-update-spec.md` §15 Tier 2 anticipates this: *"meaningful 'per core' results may need a
temporarily larger instance for this track specifically, not a change to the daily-run box."* That
remains true and is not solved here.

## Operations measured

`ML-KEM-768/encap`, `ML-KEM-768/decap`, `ML-DSA-65/verify` — the per-handshake server-side costs.
Sweep of 1, 2, 4, 8 workers at 3 seconds each: roughly 90 seconds added to a daily run that already
takes the best part of an hour.

## Testing something that needs liboqs, without liboqs

The scheduling, synchronisation and aggregation are the risky parts and they need testing on a
machine that has no liboqs. A synthetic CPU-bound operation exercises them — but a synthetic
operation must never reach a published result, so it lives in a **separate registry behind a reserved
`__synthetic__/` prefix**, and `run()` iterates the real registry alone. Three tests assert it cannot
leak.

This shape is forced by `multiprocessing`'s spawn start method: a worker re-imports the module rather
than inheriting parent state, so monkeypatching a registry in the parent would not reach the child.
Both registries are therefore module-level.

## CFDIR's MIA is now derived

Same pattern as T in work-order 018. The harness measures this as of now, but the record only carries
it from the next daily run — so `hasCryptoThroughputUnderLoad()` reads the data and `lineItemsFor()`
rewrites MIA's blocker once a run lands. Nobody edits a string.

It checks for *this* number specifically rather than for "concurrency data", because Layer B's
number is also concurrency data and would otherwise satisfy a check that MIA needs both halves for.

## Tests

19 harness cases and 5 more on the derived MIA status. The load-bearing ones assert wording, not
arithmetic: the label is not the word "concurrency", the note names what this is not, an
oversubscribed point says so in its own note, and the method block states why processes rather than
threads. The measurement assertions are deliberately weak — "more workers complete more work in the
same window" — because anything stronger would be asserting a property of whatever machine the test
happens to run on.

## Still needed to make it run — founder action

`benchmark.yml` is off-limits under guardrail 3. One step, alongside the others:

```yaml
      - name: Run benchmark — cryptographic throughput under load
        run: |
          source ~/q-advantage/venv/bin/activate
          python3 benchmark/protocols/concurrency.py \
            --output-dir benchmark/results/protocols
```

`build_manifest.py` discovers tracks by filename prefix, so `concurrency-*` is picked up
automatically. Until a file lands, CFDIR's MIA correctly still reads as blocked.

## Not in this work-order

The remaining Tier 2 items: JWT/JOSE composition, certificate-chain sizing, application
compatibility, and cross-library diversity.
