"""Q-Shield stateful hash-based signature harness — LMS / XMSS (NIST SP 800-208).

Stateful, unlike every other signature this repo benchmarks (ML-DSA, SLH-DSA,
Falcon). Reusing a leaf index breaks the security guarantee completely, so
this file has exactly one safety rule, and it is load-bearing:

    **Every keypair generated here is used within this one process, for
    this one run, and then discarded. Never exported, saved, or resumed
    across runs.** A fresh keypair always has its full, unused signature
    budget available — there is no cross-run ledger to keep correct, and
    none should be added. Persisting/resuming state is a different, harder
    problem than this file solves; treat it as new design work, not an
    extension of this one, if it's ever wanted.

Small tree heights have small total signature budgets: LMS_SHA256_M32_H10
and XMSS-SHA2_10_256 both cap at 2**10 = 1024 signatures per keypair — below
the house default of 1000 timed + 50 warmup iterations. This harness reads
each keypair's real `sigs_total()` (never assumes it) and caps the run's
iteration count to that budget minus a safety margin, recording the actual
n used rather than the requested one.

Requires liboqs built with
-DOQS_HAZARDOUS_EXPERIMENTAL_ENABLE_SIG_STFL_KEY_SIG_GEN=ON (upstream's own
flag name — not this repo's). Whether the runner's current build has it is
unconfirmed as of this file's authorship. Checked at runtime via
`get_enabled_stateful_sig_mechanisms()`; a scheme that isn't enabled gets a
clear "unavailable" status, never a fabricated result.

Not independently tested against a real liboqs build with this flag enabled
(no such environment was available to this session) — review the first real
run's output for `status: "unavailable"` / `"failed"` entries before
trusting it, same discipline as any other new harness in this repo.

Run:
    python3 benchmark/protocols/lms_xmss.py [--quick]
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path

sys.path.insert(0, os.path.dirname(__file__))
import common  # noqa: E402

TEST_MESSAGE: bytes = b"q-advantage-bench-message-v1\x00\x00\x00\x00\x00"

# XMSSMT (multi-tree) has a far larger budget (2**20) than the single-tree
# schemes below, so only the single-tree ones are actually at risk of
# exceeding the house default iteration count in one run — the capacity
# check below applies uniformly regardless, rather than special-casing.
# liboqs mechanism names.
#
# These were previously "LMS_SHA256_M32_H10" and "LMS_SHA256_M32_H15", which
# are RFC 8554 LM parameter-set names, not liboqs mechanism names. liboqs names
# LMS mechanisms with an explicit Winternitz parameter (LMS_SHA256_H10_W8), so
# the old names could never have matched however the library was built —
# `get_enabled_stateful_sig_mechanisms()` would have reported them unavailable
# forever, and for the wrong reason. Verified against the mechanism list in
# liboqs 0.15.0 tests/KATs/sig_stfl/kats.json.
STATEFUL_SCHEMES: list[str] = [
    "LMS_SHA256_H10_W8",
    "LMS_SHA256_H15_W8",
    "XMSS-SHA2_10_256",
    "XMSSMT-SHA2_20/2_256",
]

# Where fetch_kat_vectors.py puts checksum-verified upstream test vectors.
VECTORS_DIR = Path(__file__).resolve().parent / "vectors"

# Persistent, visible caveat carried into every "ok" record — per
# qshield-update-spec.md §3, these are not TLS drop-ins the way ML-DSA is,
# and every table/chart row showing them must say so, not hide it in a
# tooltip.
USE_CASE_NOTE = (
    "stateful — firmware/code-signing use case, not general TLS. Reusing a "
    "signing index breaks the security guarantee; see NIST SP 800-208."
)

# Keygen is timed on separate, disposable keypairs (see bench_scheme) — this
# many samples, not the full iteration count, since each sample builds a
# real Merkle tree and that's real wall-clock cost per sample.
KEYGEN_SAMPLES = 50

# Never let a run get within this many signatures of a keypair's measured
# total budget — belt-and-suspenders on top of the hard n_iterations cap.
CAPACITY_SAFETY_MARGIN = 10


def _unavailable(name: str, reason: str) -> dict:
    return {"scheme": name, "status": "unavailable", "reason": reason}


def _load_kat(name: str) -> dict | None:
    """
    Read one checksum-verified KAT triple, or None if absent.

    The .rsp format is NIST's: `msg`, `sm` and `pk` as hex, one per line. For
    these mechanisms `sm` is the signature itself — confirmed against
    LMS_SHA256_H5_W8, whose 1296-byte `sm` matches the RFC 8554 §5.4 signature
    length for n=32, p=34, h=5 plus the 4-byte HSS level prefix, and whose
    60-byte `pk` matches the LMS public key plus the same prefix.

    Only the first record in the file is used. One triple is enough to time
    verification, and taking one keeps the comparison across schemes honest.
    """
    path = VECTORS_DIR / (name.replace("/", "_") + ".rsp")
    if not path.exists():
        return None

    fields: dict[str, str] = {}
    with path.open("r", encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if " = " not in line:
                continue
            key, value = line.split(" = ", 1)
            fields.setdefault(key.strip(), value.strip())

    try:
        return {
            "message": bytes.fromhex(fields["msg"]),
            "signature": bytes.fromhex(fields["sm"]),
            "public_key": bytes.fromhex(fields["pk"]),
        }
    except (KeyError, ValueError):
        return None


def bench_verify_only(name: str, iterations: int, warmup: int) -> dict:
    """
    Time verification against an upstream known-answer test vector.

    This is the path that works on a liboqs build WITHOUT
    OQS_HAZARDOUS_EXPERIMENTAL_ENABLE_SIG_STFL_KEY_SIG_GEN — the flag whose own
    documentation says upstream "explicitly discourages enabling this variable".
    Verification is also the operation that matters most for the firmware and
    code-signing use case these schemes exist for: a signature is produced once
    and checked many times.

    The vector is verified before it is timed. If it does not verify, this
    returns a failure with the reason and no timing at all — a number produced
    by timing a signature we could not authenticate would look exactly like a
    real one.
    """
    import oqs

    kat = _load_kat(name)
    if kat is None:
        return _unavailable(
            name,
            "no checksum-verified KAT vector present — run "
            "benchmark/protocols/fetch_kat_vectors.py on this host first.",
        )

    try:
        with oqs.StatefulSignature(name) as verifier:
            ok = verifier.verify(kat["message"], kat["signature"], kat["public_key"])
            if not ok:
                return {
                    "scheme": name,
                    "status": "failed",
                    "error": (
                        "upstream KAT vector did not verify against this liboqs build. Not timed. "
                        "Either the build is inconsistent with the vector's parameter set or the "
                        "vector was misparsed — investigate before trusting anything here."
                    ),
                    "error_type": "kat_verification_failed",
                }

            verify_ns = common._time_loop(
                lambda: verifier.verify(kat["message"], kat["signature"], kat["public_key"]),
                iterations,
                warmup,
            )

    except Exception as exc:  # noqa: BLE001 — report, never fabricate
        return {
            "scheme": name,
            "status": "failed",
            "error": f"{type(exc).__name__}: {exc}",
            "error_type": "verify_only_exception",
        }

    return {
        "scheme": name,
        "status": "ok",
        "mode": "verify_only",
        "mode_note": (
            "Verification only. This build cannot generate keys or signatures, so no keygen or "
            "signing figures are reported — they are absent, not zero. The verified signature and "
            "public key come from liboqs's own KAT corpus, checksum-verified against upstream's "
            "kats.json; see benchmark/protocols/vectors/manifest.json for provenance."
        ),
        "use_case_note": USE_CASE_NOTE,
        "signature_bytes": len(kat["signature"]),
        "public_key_bytes": len(kat["public_key"]),
        "message_bytes": len(kat["message"]),
        "verify": common.compute_stats(verify_ns),
        "n_iterations_actual": len(verify_ns),
        "n_iterations_requested": iterations,
    }


def bench_scheme(name: str, iterations: int, warmup: int) -> dict:
    import oqs

    enabled_fn = getattr(oqs, "get_enabled_stateful_sig_mechanisms", None)
    if enabled_fn is None:
        return _unavailable(
            name,
            "oqs.get_enabled_stateful_sig_mechanisms() not present in this liboqs-python "
            "build — StatefulSignature support likely absent entirely.",
        )
    if name not in enabled_fn():
        return _unavailable(
            name,
            "not in get_enabled_stateful_sig_mechanisms() — this liboqs build likely "
            "lacks -DOQS_HAZARDOUS_EXPERIMENTAL_ENABLE_SIG_STFL_KEY_SIG_GEN.",
        )

    try:
        # Keygen timing: a fresh StatefulSignature + fresh keypair per
        # sample, each freed immediately after. Never reuse an instance
        # across generate_keypair() calls, and never touch the dedicated
        # sign/verify keypair below for keygen sampling.
        keygen_ns: list[int] = []
        for _ in range(min(iterations, KEYGEN_SAMPLES)):
            with oqs.StatefulSignature(name) as kg:
                t0 = time.perf_counter_ns()
                kg.generate_keypair()
                keygen_ns.append(time.perf_counter_ns() - t0)

        # Sign/verify timing: one dedicated keypair, generated once, used
        # only within this run, discarded at the end via the context
        # manager. Its signing budget is measured, not assumed.
        with oqs.StatefulSignature(name) as sig:
            pub = sig.generate_keypair()
            total = sig.sigs_total()
            budget = max(0, total - CAPACITY_SAFETY_MARGIN)
            run_iterations = min(iterations, max(0, budget - warmup))
            if run_iterations < 10:
                return _unavailable(
                    name, f"sigs_total()={total} too small for a meaningful timed run at warmup={warmup}"
                )

            try:
                sign_ns = common._time_loop(lambda: sig.sign(TEST_MESSAGE), run_iterations, warmup)
            except NotImplementedError as exc:
                return _unavailable(name, f"sign() not implemented for this scheme in this binding: {exc}")

            # Verify needs a real signature; reuse one already produced by
            # the sign loop rather than spending more of the budget.
            verify_sample = sig.sign(TEST_MESSAGE)
            n_verify = min(run_iterations, 200)
            verify_ns = common._time_loop(
                lambda: sig.verify(TEST_MESSAGE, verify_sample, pub), n_verify, min(warmup, 10)
            )

            return {
                "scheme": name,
                "status": "ok",
                "use_case_note": USE_CASE_NOTE,
                "sigs_total": total,
                "n_iterations_actual": run_iterations,
                "n_iterations_requested": iterations,
                "keygen": common.compute_stats(keygen_ns) if keygen_ns else None,
                "sign": common.compute_stats(sign_ns),
                "verify": common.compute_stats(verify_ns),
                "signature_bytes": len(verify_sample),
                "public_key_bytes": len(pub),
            }
    except NotImplementedError as exc:
        return _unavailable(name, f"not implemented in this binding: {exc}")
    except Exception as exc:  # noqa: BLE001 — record and continue, never crash the whole run
        return {"scheme": name, "status": "failed", "error": str(exc), "error_type": type(exc).__name__}


def run(iterations: int, warmup: int) -> dict:
    toolchain = common.capture_toolchain()
    host = common.capture_host()
    sampler = common.StealTimeSampler()

    schemes: dict[str, dict] = {}
    for name in STATEFUL_SCHEMES:
        # Prefer the full keygen/sign/verify measurement. If this build cannot
        # generate keys or signatures — the default, since upstream discourages
        # the flag that enables it — fall back to timing verification against a
        # checksum-verified upstream KAT vector. Verification is the operation
        # that matters most for the firmware and code-signing use case anyway.
        result = bench_scheme(name, iterations, warmup)
        if result.get("status") != "ok":
            fallback = bench_verify_only(name, iterations, warmup)
            if fallback.get("status") == "ok":
                # Keep why the full path was unavailable; it is the reason the
                # keygen and signing columns are empty and the site says so.
                fallback["full_mode_unavailable_reason"] = result.get("reason") or result.get("error")
                result = fallback
            elif result.get("status") == "unavailable" and fallback.get("status") == "failed":
                # A KAT that will not verify is a louder signal than a missing
                # build flag — surface it rather than the quieter reason.
                result = fallback
        schemes[name] = result

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
        path = os.path.join(args.output_dir, f"lms-xmss-{date}-{gh}.json")
        with open(path, "w") as fh:
            fh.write(out)
        print(f"wrote {path}")
    else:
        print(out)

    n_ok = sum(1 for s in results["schemes"].values() if s.get("status") == "ok")
    n_total = len(results["schemes"])
    print(f"[lms_xmss] {n_ok}/{n_total} schemes produced real results", file=sys.stderr)


if __name__ == "__main__":
    main()
