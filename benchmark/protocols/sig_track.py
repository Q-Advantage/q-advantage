"""Job 2 — signature / authentication track.

Carries both post-quantum and classical signature schemes, measured in the same
run so a classical-vs-PQC delta is always a same-run comparison. `qshield-update-spec.md`
§16.3 makes that delta what CFDIR's Testing line item needs: without a classical
arm there is no delta, only an absolute figure.

Emits the protocol `auth` block per signature scheme: keygen/sign/verify timing
(house compute_stats) plus signature_bytes + public_key_bytes. This is the data
that serves both PQ-certificate handshakes (later) and the blockchain framing
now (on-chain signature size + per-node verify speed).

Mirrors benchmark.py bench_signature conventions: fresh signature per iter for
verify (setup not timed), gc-disciplined loops, sizes from `.details`.

Run:
    python3 benchmark/protocols/sig_track.py [--quick]
"""

from __future__ import annotations

import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
import classical_sig  # noqa: E402
import common  # noqa: E402

TEST_MESSAGE: bytes = b"q-advantage-bench-message-v1\x00\x00\x00\x00\x00"

# Probed against get_enabled_sig_mechanisms(); unavailable ones are skipped.
# On full liboqs 0.15.0 the SLH-DSA + Falcon rows populate too.
SIG_SCHEMES: list[str] = [
    "ML-DSA-44", "ML-DSA-65", "ML-DSA-87",
    "Falcon-512", "Falcon-1024",
    "SLH_DSA_PURE_SHAKE_128S", "SLH_DSA_PURE_SHAKE_128F",
]


def bench_scheme(name: str, iterations: int, warmup: int) -> dict | None:
    import oqs
    if name not in oqs.get_enabled_sig_mechanisms():
        return None

    sig = oqs.Signature(name)
    d = sig.details
    pub = sig.generate_keypair()

    keygen_ns = common._time_loop(sig.generate_keypair, iterations, warmup)
    sign_ns = common._time_loop(lambda: sig.sign(TEST_MESSAGE), iterations, warmup)
    verify_ns = common._time_loop_with_setup(
        lambda: sig.sign(TEST_MESSAGE),                       # fresh sig per iter, not timed
        lambda s: sig.verify(TEST_MESSAGE, s, pub),
        iterations, warmup,
    )
    sig.free()

    record = {
        "scheme": name,
        # Distinguishes these from the classical baselines measured in the same
        # run. Without it a consumer reading the schemes map has no way to tell
        # a candidate from a reference line.
        "kind": "post-quantum",
        "status": "ok",
        "keygen": common.compute_stats(keygen_ns),
        "sign": common.compute_stats(sign_ns),
        "verify": common.compute_stats(verify_ns),
        "signature_bytes": d["length_signature"],
        "public_key_bytes": d["length_public_key"],
    }
    # Secret key size: exposed by the binding on every run and never recorded
    # until now. Blocking for the TCM's Expansion & Retention line item --
    # storage for larger private keys cannot be priced from public key sizes.
    if "length_secret_key" in d:
        record["secret_key_bytes"] = d["length_secret_key"]
    return record


def run(iterations: int, warmup: int) -> dict:
    toolchain = common.capture_toolchain()
    host = common.capture_host()
    sampler = common.StealTimeSampler()

    schemes: dict[str, dict] = {}
    for name in SIG_SCHEMES:
        rec = bench_scheme(name, iterations, warmup)
        if rec is not None:
            schemes[name] = rec

    # Classical baselines, measured in THIS run and written to THIS file.
    #
    # Not a stylistic choice. On 2026-08-16 the composed-TLS harness measured
    # its baseline in one pass and its suites in another, then compared across
    # them; on a host with this much run-to-run movement the two passes landed
    # in different modes and the published delta flipped sign. Putting the
    # classical signature arms in a separate track would reintroduce that bug
    # somewhere new, so a classical-vs-PQC signature delta is always a
    # same-run comparison.
    schemes.update(classical_sig.bench_all(iterations, warmup))

    steal = sampler.result_pct()
    return {
        "environment": {
            "iso_timestamp": common.utc_timestamp(),
            "liboqs_version": toolchain.liboqs,
            "liboqs_python_version": toolchain.liboqs_python,
            "git_commit": common.git_commit(),
            "cpu_model": host.cpu_model,
            "arch": host.arch,
            "build_path": host.build_path,
            "steal_time_pct": steal,
        },
        "families": {
            "post-quantum": [s for s, r in schemes.items() if r.get("kind") == "post-quantum"],
            "classical": [s for s, r in schemes.items() if r.get("kind") == "classical"],
        },
        "comparison_note": (
            "Classical and post-quantum schemes in this file were measured in the same run on the "
            "same host, so a delta between any two of them is a same-run comparison. No pairing "
            "between a classical scheme and a post-quantum one is asserted: that is a "
            "security-level argument rather than a measurement, and each classical record "
            "publishes its documented strength so the argument can be made explicitly."
        ),
        "schemes": schemes,
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--quick", action="store_true")
    ap.add_argument("--output-dir", default=None)
    args = ap.parse_args()

    iterations, warmup = (50, 5) if args.quick else (1000, 50)
    results = run(iterations, warmup)
    out = json.dumps(results, indent=2)

    if args.output_dir:
        os.makedirs(args.output_dir, exist_ok=True)
        date = results["environment"]["iso_timestamp"][:10]
        gh = (results["environment"]["git_commit"] or "nogit")[:7]
        path = os.path.join(args.output_dir, f"sig-track-{date}-{gh}.json")
        with open(path, "w") as fh:
            fh.write(out)
        print(f"wrote {path}")
    else:
        print(out)


if __name__ == "__main__":
    main()
