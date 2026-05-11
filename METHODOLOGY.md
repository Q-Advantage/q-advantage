# Q-Advantage Methodology

This document describes how Q-Advantage produces its benchmarks. The goal is reproducibility: anyone with the repo and an equivalent EC2 instance should be able to verify our numbers within statistical noise.

> **Status:** v1.0 published Week 1. This file is the canonical version. The original draft lives in the methodology folder and on GitHub under tag `methodology-v1.0`.

## Hardware

All Q-Shield benchmarks run on a single dedicated AWS EC2 instance.

- **Instance type:** *(filled in by benchmark.py at run time)*
- **vCPU model:** *(filled in by benchmark.py at run time)*
- **Region:** us-east-1
- **OS:** Ubuntu 24.04 LTS
- **Process affinity:** pinned to a single core for the duration of measurement

## Software stack

- `liboqs` — built from source, current `main`, AVX2 optimizations enabled
- `liboqs-python` — current `main`
- Python 3.12 (Ubuntu 24.04 default)

## Measurement protocol

For each algorithm and each operation (keygen, encap/decap, sign/verify):

1. **Warm-up:** 50 untimed iterations
2. **Measurement:** 1,000 timed iterations using `time.perf_counter_ns()`
3. **Recorded statistics:** mean, median, p95, p99, stdev, min, max, ops/sec
4. **Sizes:** public key, private key, ciphertext or signature in bytes

## Algorithms covered (Q-Shield v1)

- KEMs: ML-KEM-512, ML-KEM-768, ML-KEM-1024
- Signatures: ML-DSA-44, ML-DSA-65, ML-DSA-87, SLH-DSA-SHAKE-128s, SLH-DSA-SHAKE-128f

## Q-Day Index

Methodology for the Q-Day Index lives in `docs/q-day-methodology.md` (Week 3 deliverable).

## Known limitations

- t3.medium (Week 2 starter) is a burstable instance. Migration to fixed-performance c7i.large planned before week-over-week comparisons are published.
- Single-machine benchmark. Cross-architecture comparison (Graviton, AMD EPYC) is a future deliverable.
- `liboqs` is a prototyping library, not a production cryptographic implementation. Performance numbers are representative but not authoritative for production deployments.

## How to challenge a result

Open an issue or PR. Every weekly run logs `git_commit`, `cpu_model`, and full environment in its `results-YYYY-MM-DD.json`. If you can reproduce a discrepancy of more than 2 standard deviations on equivalent hardware, we want to hear about it.
