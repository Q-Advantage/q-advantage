"""Layer A — SSH key-exchange composed crypto-cost.

Same engine as tls_composed (common.time_hybrid_kex); differs only in the
suite list, the SSH key-exchange size accounting, and protocol identity.
Host-key signatures belong to the auth track and are not included here.

Run:
    python3 benchmark/protocols/ssh_composed.py [--quick]
"""

from __future__ import annotations

import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
import common  # noqa: E402

# suite -> (kem_alg | None, classical | None)
SSH_SUITES: dict[str, tuple[str | None, str | None]] = {
    "mlkem768x25519-sha256": ("ML-KEM-768", "x25519"),
    "curve25519-sha256": (None, "x25519"),
}
BASELINE_SUITE = "curve25519-sha256"


def run(iterations: int, warmup: int) -> dict:
    toolchain = common.capture_toolchain()
    host = common.capture_host()
    sampler = common.StealTimeSampler()

    # Single pass — the baseline delta must come from measurements taken in the
    # same pass as the suite it describes. See the note in tls_composed.py: the
    # previous two-pass shape compared across passes and published a sign-
    # flipped delta on 2026-08-16.
    measured: dict[str, dict] = {}
    for suite, (kem_alg, classical) in SSH_SUITES.items():
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
        records[suite] = common.build_result(
            protocol="ssh",
            mode="composed",
            suite=suite,
            timing=composed,
            size=common.keyshare_size(common.SSH_KEX, suite),
            phases=kex["phases"],
            baseline_suite=None if suite == BASELINE_SUITE else BASELINE_SUITE,
            pct_over_classical=pct,
            cross_validation=cv,
            toolchain=toolchain,
            host=host,
            # These come from the measurement, not from a size table: the KEM's
            # secret key length is read off the liboqs binding during the run,
            # and the resource accounting is sampled around the timed loop.
            # Both were declared in the schema before this and never reached a
            # record -- the seam was the missing piece, not the measurement.
            secret_key_bytes=kex["sizes"].get("kem_secret_key_bytes"),
            resources=kex.get("resources") or None,
        )

    steal = sampler.result_pct()
    for rec in records.values():
        rec["host"]["steal_time_pct"] = steal

    return {
        "environment": {
            "iso_timestamp": common.utc_timestamp(),
            "liboqs_version": toolchain.liboqs,
            "openssh": toolchain.openssh,
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
        path = os.path.join(args.output_dir, f"ssh-composed-{date}-{gh}.json")
        with open(path, "w") as fh:
            fh.write(out)
        print(f"wrote {path}")
    else:
        print(out)


if __name__ == "__main__":
    main()
