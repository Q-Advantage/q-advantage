"""
Layer A — cryptographic throughput under load.

THE LABEL IS THE POINT. `layer-b-spec.md` §7 exists to stop two different
numbers sharing one casual name, and this module is one of the two:

  * THIS number: how raw cryptographic throughput degrades when N crypto
    operations run concurrently under CPU contention. No sockets, no kernel
    connection state, no accept queue. Software only.

  * Layer B's number: how a full TCP+TLS connection behaves when N of them
    happen at once — real accept()/connect(), real socket buffers, real
    handshake state machine.

They answer different questions and the spec is explicit that neither may be
called "concurrency" or "connections per core" unqualified. So the label
travels in the payload, not just in prose, and a test asserts it.

WHY MULTIPROCESSING RATHER THAN THREADS. Python threads do not parallelise
CPU-bound work past the GIL, so a threaded version of this would measure the
GIL and report it as cryptographic scaling. Each worker is a separate process
with its own liboqs objects.

WHY A FIXED DURATION RATHER THAN A FIXED ITERATION COUNT. Throughput is
operations per unit time. With a fixed count, workers finish at different
moments and the aggregate is taken over a window that was partly idle, which
flatters the result. Each worker instead runs for a set duration and reports
what it completed.

THE HONEST LIMIT, STATED BEFORE ANY NUMBER. The measurement host has two vCPUs.
Beyond two workers this is not measuring parallel scaling — it is measuring the
scheduler under oversubscription. That is a real operational question and worth
publishing, but it is a different one, so every point records whether it was
oversubscribed and the summary refuses to describe an oversubscribed point as
scaling. `qshield-update-spec.md` §15 Tier 2 anticipates this: meaningful
per-core results need more cores than the daily box has.

Run:
    python3 benchmark/protocols/concurrency.py [--quick]
"""

from __future__ import annotations

import argparse
import json
import multiprocessing as mp
import os
import statistics
import sys
import time
from typing import Callable

sys.path.insert(0, os.path.dirname(__file__))
import common  # noqa: E402

#: Seconds each worker runs at each point. Short on purpose: this track is
#: additive to a daily run that already takes the best part of an hour.
DEFAULT_DURATION_S = 3.0
QUICK_DURATION_S = 0.4

#: Worker counts to sweep. 1 is the reference every other point is read
#: against; the rest deliberately include counts above the box's core count,
#: because oversubscription is what a loaded server actually experiences.
DEFAULT_WORKERS = (1, 2, 4, 8)
QUICK_WORKERS = (1, 2)

#: The label. Repeated in every payload rather than left to a page to add.
LABEL = "cryptographic throughput under load"
LABEL_NOTE = (
    "NOT connections per core, and not 'concurrency' unqualified. This measures N concurrent "
    "cryptographic OPERATIONS contending for CPU, with no sockets, no accept queue and no kernel "
    "connection state. Layer B measures the other thing -- full TCP+TLS connections including "
    "socket setup -- and the two must never share a name."
)


# ---------------------------------------------------------------------------
# Operations under test.
#
# Resolved by string key inside the worker process rather than passed as a
# callable, because multiprocessing's spawn start method (the default on
# macOS and Windows, and what CI uses) pickles what it sends to a worker, and
# a liboqs object is not picklable. Each worker builds its own.
# ---------------------------------------------------------------------------

def _op_mlkem_encap() -> Callable[[], object]:
    import oqs

    kem = oqs.KeyEncapsulation("ML-KEM-768")
    pub = kem.generate_keypair()
    return lambda: kem.encap_secret(pub)


def _op_mlkem_decap() -> Callable[[], object]:
    import oqs

    kem = oqs.KeyEncapsulation("ML-KEM-768")
    pub = kem.generate_keypair()
    ct, _ = kem.encap_secret(pub)
    return lambda: kem.decap_secret(ct)


def _op_mldsa_verify() -> Callable[[], object]:
    import oqs

    sig = oqs.Signature("ML-DSA-65")
    pub = sig.generate_keypair()
    message = b"q-advantage-bench-message-v1"
    signature = sig.sign(message)
    return lambda: sig.verify(message, signature, pub)


#: Operation key -> factory. A factory returns the zero-argument callable that
#: gets timed; all setup happens before the clock starts.
OPERATIONS: dict[str, Callable[[], Callable[[], object]]] = {
    "ML-KEM-768/encap": _op_mlkem_encap,
    "ML-KEM-768/decap": _op_mlkem_decap,
    "ML-DSA-65/verify": _op_mldsa_verify,
}


#: Reserved prefix for operations that exist only to exercise this module's own
#: machinery. The scheduling, synchronisation and aggregation here are the risky
#: part and need testing on a machine with no liboqs — but a synthetic operation
#: must never reach a published result, so it lives in its own registry and
#: `run()` iterates OPERATIONS alone.
#:
#: A worker resolves the key after re-importing this module (spawn does not
#: inherit parent state), so both registries have to be module-level.
TEST_OP_PREFIX = "__synthetic__/"


def _op_synthetic_spin() -> Callable[[], object]:
    """A cheap, CPU-bound operation with no dependencies. Not a measurement."""
    def spin() -> int:
        total = 0
        for i in range(2000):
            total += i * i
        return total

    return spin


_TEST_OPERATIONS: dict[str, Callable[[], Callable[[], object]]] = {
    TEST_OP_PREFIX + "spin": _op_synthetic_spin,
}


def _resolve_op(op_key: str) -> Callable[[], Callable[[], object]]:
    if op_key.startswith(TEST_OP_PREFIX):
        return _TEST_OPERATIONS[op_key]
    return OPERATIONS[op_key]


def _worker(op_key: str, duration_s: float, start_at: float, out) -> None:
    """Run one operation as fast as possible for `duration_s`, then report."""
    try:
        op = _resolve_op(op_key)()
    except Exception as exc:  # noqa: BLE001 - report, never fabricate
        out.put({"error": "%s: %s" % (type(exc).__name__, exc)})
        return

    # A few untimed reps so the first timed operation is not paying for cold
    # caches while its peers are already warm.
    for _ in range(5):
        op()

    # Every worker starts on the same wall-clock instant. Without this the
    # first-spawned worker runs alone for the duration of the last one's
    # startup, and its throughput is inflated by exactly the contention the
    # measurement is trying to capture.
    now = time.time()
    if start_at > now:
        time.sleep(start_at - now)

    completed = 0
    t0 = time.perf_counter()
    deadline = t0 + duration_s
    while time.perf_counter() < deadline:
        op()
        completed += 1
    elapsed = time.perf_counter() - t0

    out.put({"completed": completed, "elapsed_s": elapsed})


def measure_point(op_key: str, n_workers: int, duration_s: float) -> dict:
    """One (operation, worker-count) point."""
    ctx = mp.get_context("spawn")
    out = ctx.Queue()
    # Enough lead time for every process to import and build its own objects.
    start_at = time.time() + 1.5 + 0.15 * n_workers

    procs = [
        ctx.Process(target=_worker, args=(op_key, duration_s, start_at, out))
        for _ in range(n_workers)
    ]
    for p in procs:
        p.start()

    results = []
    for _ in procs:
        try:
            results.append(out.get(timeout=duration_s + 60))
        except Exception:  # noqa: BLE001
            results.append({"error": "worker did not report within the timeout"})
    for p in procs:
        p.join(timeout=10)
        if p.is_alive():
            p.terminate()

    errors = [r["error"] for r in results if "error" in r]
    ok = [r for r in results if "completed" in r]
    if errors or not ok:
        return {
            "n_workers": n_workers,
            "measured": False,
            "reason": errors[0] if errors else "no worker reported a result",
        }

    rates = sorted(r["completed"] / r["elapsed_s"] for r in ok)
    total_ops = sum(r["completed"] for r in ok)
    window = max(r["elapsed_s"] for r in ok)

    return {
        "n_workers": n_workers,
        "measured": True,
        "workers_reporting": len(ok),
        "duration_s": round(duration_s, 3),
        "ops_completed_total": total_ops,
        # Divided by the longest worker's window, not the shortest: the
        # aggregate rate must cover the whole period the load was applied.
        "aggregate_ops_per_sec": round(total_ops / window, 2),
        "per_worker_ops_per_sec": {
            "min": round(rates[0], 2),
            "median": round(statistics.median(rates), 2),
            "max": round(rates[-1], 2),
        },
    }


def run(quick: bool = False) -> dict:
    host = common.capture_host()
    toolchain = common.capture_toolchain()
    sampler = common.StealTimeSampler()

    logical = os.cpu_count() or 1
    duration = QUICK_DURATION_S if quick else DEFAULT_DURATION_S
    worker_counts = QUICK_WORKERS if quick else DEFAULT_WORKERS

    operations: dict[str, dict] = {}
    for op_key in OPERATIONS:
        points = [measure_point(op_key, n, duration) for n in worker_counts]

        baseline = next(
            (p["aggregate_ops_per_sec"] for p in points if p.get("n_workers") == 1 and p.get("measured")),
            None,
        )
        for p in points:
            if not p.get("measured"):
                continue
            p["oversubscribed"] = p["n_workers"] > logical
            if baseline and baseline > 0:
                ideal = baseline * p["n_workers"]
                p["scaling_efficiency"] = round(p["aggregate_ops_per_sec"] / ideal, 4)
                # Said per point, because a single summary sentence is the
                # thing that gets quoted without its qualifier.
                p["efficiency_note"] = (
                    "Aggregate throughput against a perfect-scaling ideal of %d x the "
                    "single-worker rate. %s"
                    % (
                        p["n_workers"],
                        (
                            "This point is oversubscribed on a %d-core host, so it measures the "
                            "scheduler under contention rather than parallel scaling."
                            % logical
                            if p["oversubscribed"]
                            else "This point fits within the host's core count."
                        ),
                    )
                )
            else:
                p["scaling_efficiency"] = None

        operations[op_key] = {
            "label": LABEL,
            "label_note": LABEL_NOTE,
            "single_worker_ops_per_sec": baseline,
            "points": points,
        }

    steal = sampler.result_pct()
    return {
        "environment": {
            "iso_timestamp": common.utc_timestamp(),
            "liboqs_version": toolchain.liboqs,
            "liboqs_python_version": toolchain.liboqs_python,
            "git_commit": common.git_commit(),
            "cpu_model": host.cpu_model,
            "arch": host.arch,
            "cpu_cores_logical": logical,
            "steal_time_pct": steal,
        },
        "method": {
            "label": LABEL,
            "label_note": LABEL_NOTE,
            "parallelism": (
                "Separate processes, not threads. Python threads do not parallelise CPU-bound work "
                "past the GIL, so a threaded version would measure the GIL and report it as "
                "cryptographic scaling."
            ),
            "timing": (
                "Each worker runs for a fixed duration and reports operations completed. A fixed "
                "iteration count would let workers finish at different moments and average the "
                "aggregate over a partly-idle window, flattering the result."
            ),
            "synchronisation": (
                "Workers are released on a shared wall-clock instant so no worker runs alone while "
                "its peers are still starting."
            ),
            "core_count_caveat": (
                "This host reports %d logical cores. Points above that count are oversubscribed: "
                "they measure the scheduler under contention, which is a real operational question "
                "but not parallel scaling. Every point records which it is."
            ) % logical,
            "relationship_to_single_op_track": (
                "Additive to the isolated single-operation benchmarks, never a replacement. The "
                "isolated number is what makes cross-run comparison clean; this one describes "
                "behaviour under contention."
            ),
        },
        "operations": operations,
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--quick", action="store_true")
    ap.add_argument("--output-dir", default=None)
    args = ap.parse_args()

    results = run(quick=args.quick)
    out = json.dumps(results, indent=2)

    if args.output_dir:
        os.makedirs(args.output_dir, exist_ok=True)
        date = results["environment"]["iso_timestamp"][:10]
        gh = (results["environment"]["git_commit"] or "nogit")[:7]
        path = os.path.join(args.output_dir, f"concurrency-{date}-{gh}.json")
        with open(path, "w") as fh:
            fh.write(out)
        print(f"wrote {path}")
    else:
        print(out)


if __name__ == "__main__":
    main()
