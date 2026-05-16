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

## Hardware transparency

Q-Advantage benchmarks currently run on an AWS EC2 t3.medium instance
(Intel Xeon Platinum 8259CL @ 2.5GHz, AVX2 available, 2 vCPU, 3.7 GiB RAM,
us-east-1). This is a *burstable* instance class: CPU performance is
guaranteed at a baseline level and can burst above baseline when CPU credits
are available. Under sustained load with depleted credits, the instance
throttles to baseline, which would silently slow timed iterations.

Every result file therefore includes a `runtime_metrics` block alongside the
existing `environment` block:

- `cpu_steal_jiffies` / `cpu_steal_seconds`: delta of Linux kernel steal-time
  across the timed loop. Steal-time counts CPU cycles taken from the guest
  by the hypervisor. On a burstable instance, sustained non-zero steal-time
  indicates throttling. Healthy runs show steal-time near zero. Seconds are
  derived assuming `USER_HZ=100`, the default on stock Ubuntu kernels.
- `loadavg_start` / `loadavg_end`: 1/5/15-minute load averages captured at
  the start and end of the timed loop. Used to detect noisy-neighbour or
  concurrent-process effects.
- `wall_clock_seconds`: total elapsed time of the timed loop.
- `instance_type`: the EC2 instance class in use.
- `burstable`: whether the instance class is burstable.

When this project graduates to a fixed-performance instance class, this
document will be updated and historical runs from the burstable period will
remain available in the repository for reproducibility. The hardware change
will be explicitly dated; results will not be silently migrated.

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
