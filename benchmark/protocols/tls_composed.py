"""Layer A — TLS handshake composed crypto-cost.

Times the cryptographic operations a TLS 1.3 key exchange performs, composed
from liboqs primitives + a classical curve, fully in-process. Emits one
schema-conforming record per suite, with phase decomposition and the
delta over the classical baseline.

Run:
    python3 benchmark/protocols/tls_composed.py [--quick]
"""

from __future__ import annotations

import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
import common  # noqa: E402

# suite -> (kem_alg | None, classical | None)
TLS_SUITES: dict[str, tuple[str | None, str | None]] = {
    "X25519MLKEM768": ("ML-KEM-768", "x25519"),
    "SecP256r1MLKEM768": ("ML-KEM-768", "secp256r1"),
    "MLKEM768": ("ML-KEM-768", None),
    "X25519": (None, "x25519"),
}
BASELINE_SUITE = "X25519"


def run(iterations: int, warmup: int) -> dict:
    toolchain = common.capture_toolchain()
    host = common.capture_host()
    sampler = common.StealTimeSampler()

    # Measure every suite exactly ONCE, then compute the baseline delta from
    # these same measurements.
    #
    # This previously ran two passes: the first measured everything and kept
    # only the baseline median, the second re-measured everything and compared
    # against the first pass's baseline. On a host with run-to-run variance the
    # two passes land on different samples, so the delta compared apples to
    # oranges. On 2026-08-16 that published "-16.9%" for X25519MLKEM768 — the
    # site told readers hybrid post-quantum TLS is FASTER than classical, when
    # the same run's own medians make it ~40% slower. Across six runs the stored
    # value ranged +46.2% to -17.2% while a same-run computation gave a stable
    # +36.5% to +46.2%.
    #
    # Keep this a single pass. The delta must always be between two numbers
    # measured in the same pass, and dropping the redundant pass also halves
    # this script's runtime.
    measured: dict[str, dict] = {}
    for suite, (kem_alg, classical) in TLS_SUITES.items():
        measured[suite] = common.time_hybrid_kex(
            kem_alg=kem_alg, classical=classical, iterations=iterations, warmup=warmup
        )

    baseline_median: float | None = None
    if BASELINE_SUITE in measured:
        baseline_median = measured[BASELINE_SUITE]["composed"]["median_us"]

    records: dict[str, dict] = {}
    for suite, kex in measured.items():
        composed = kex["composed"]
        pct = None
        if baseline_median and suite != BASELINE_SUITE:
            pct = round((composed["median_us"] - baseline_median) / baseline_median * 100.0, 1)

        cv = common.reference_delta(composed["median_us"], ebacs_cycles=None, cpu_hz=host.cpu_hz_nominal)

        rec = common.build_result(
            protocol="tls",
            mode="composed",
            suite=suite,
            timing=composed,
            size=common.keyshare_size(common.TLS_KEYSHARE, suite),
            phases=kex["phases"],
            baseline_suite=None if suite == BASELINE_SUITE else BASELINE_SUITE,
            pct_over_classical=pct,
            cross_validation=cv,
            toolchain=toolchain,
            host=host,
        )
        records[suite] = rec

    steal = sampler.result_pct()
    for rec in records.values():
        rec["host"]["steal_time_pct"] = steal

    return {
        "environment": {
            "iso_timestamp": common.utc_timestamp(),
            "liboqs_version": toolchain.liboqs,
            "liboqs_python_version": toolchain.liboqs_python,
            "openssl_cli": toolchain.openssl_cli,
            "git_commit": common.git_commit(),
        },
        "suites": records,
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--quick", action="store_true")
    ap.add_argument("--output-dir", default=None)
    args = ap.parse_args()

    iterations, warmup = (50, 5) if args.quick else (1000, 50)
    results = run(iterations, warmup)

    schema = os.path.join(os.path.dirname(__file__), "..", "..", "schema", "protocol_result.schema.json")
    for rec in results["suites"].values():
        common.validate_result(rec, schema)

    out = json.dumps(results, indent=2)
    if args.output_dir:
        os.makedirs(args.output_dir, exist_ok=True)
        date = results["environment"]["iso_timestamp"][:10]
        gh = (results["environment"]["git_commit"] or "nogit")[:7]
        path = os.path.join(args.output_dir, f"tls-composed-{date}-{gh}.json")
        with open(path, "w") as fh:
            fh.write(out)
        print(f"wrote {path}")
    else:
        print(out)


if __name__ == "__main__":
    main()
