"""
Q-Advantage PQC benchmark harness.

Measures keygen / encap / decap (KEMs) and keygen / sign / verify (signatures)
for NIST-standardised post-quantum algorithms using liboqs 0.15.0.

Usage:
    python3 benchmark.py [--quick] [--ultra-quick] [--output-dir DIR]
"""

import argparse
import gc
import json
import os
import platform
import statistics
import subprocess
import sys
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import oqs
import psutil
from tabulate import tabulate

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

KEM_ALGORITHMS: list[str] = [
    "ML-KEM-512",
    "ML-KEM-768",
    "ML-KEM-1024",
]

SIG_ALGORITHMS: list[str] = [
    "ML-DSA-44",
    "ML-DSA-65",
    "ML-DSA-87",
    "SLH_DSA_PURE_SHAKE_128S",
    "SLH_DSA_PURE_SHAKE_128F",
]

TEST_MESSAGE: bytes = b"q-advantage-bench-message-v1\x00\x00\x00\x00\x00"

DEFAULT_ITERATIONS: int = 1000
DEFAULT_WARMUP: int = 50
QUICK_ITERATIONS: int = 50
QUICK_WARMUP: int = 5
ULTRA_QUICK_ITERATIONS: int = 5
ULTRA_QUICK_WARMUP: int = 1


# ---------------------------------------------------------------------------
# Environment collection
# ---------------------------------------------------------------------------

def _read_proc_cpuinfo() -> list[dict[str, str]]:
    try:
        with open("/proc/cpuinfo") as f:
            content = f.read()
    except OSError:
        return []
    records: list[dict[str, str]] = []
    current: dict[str, str] = {}
    for line in content.splitlines():
        if line.strip() == "":
            if current:
                records.append(current)
                current = {}
        elif ":" in line:
            key, _, val = line.partition(":")
            current[key.strip()] = val.strip()
    if current:
        records.append(current)
    return records


def _cpu_model(records: list[dict[str, str]]) -> str:
    for r in records:
        if "model name" in r:
            return r["model name"]
    return "unknown"


def _physical_cores(records: list[dict[str, str]]) -> int:
    seen: set[tuple[str, str]] = set()
    for r in records:
        pid = r.get("physical id")
        cid = r.get("core id")
        if pid is not None and cid is not None:
            seen.add((pid, cid))
    if seen:
        return len(seen)
    for r in records:
        if "cpu cores" in r:
            try:
                return int(r["cpu cores"])
            except ValueError:
                pass
    return os.cpu_count() or 1


def _os_release() -> str:
    try:
        with open("/etc/os-release") as f:
            for line in f:
                if line.startswith("PRETTY_NAME="):
                    return line.split("=", 1)[1].strip().strip('"')
    except OSError:
        pass
    return platform.platform()


def _ec2_instance_type() -> str:
    try:
        token_req = urllib.request.Request(
            "http://169.254.169.254/latest/api/token",
            method="PUT",
            headers={"X-aws-ec2-metadata-token-ttl-seconds": "21600"},
        )
        with urllib.request.urlopen(token_req, timeout=2) as resp:
            token = resp.read().decode()
        inst_req = urllib.request.Request(
            "http://169.254.169.254/latest/meta-data/instance-type",
            headers={"X-aws-ec2-metadata-token": token},
        )
        with urllib.request.urlopen(inst_req, timeout=2) as resp:
            return resp.read().decode()
    except Exception:  # noqa: BLE001
        return "unknown"


def _git_value(args: list[str]) -> str:
    try:
        result = subprocess.run(
            ["git"] + args,
            capture_output=True,
            text=True,
            timeout=5,
        )
        return result.stdout.strip() or "unknown"
    except Exception:  # noqa: BLE001
        return "unknown"


def gather_environment(script_args: list[str]) -> dict[str, Any]:
    records = _read_proc_cpuinfo()
    return {
        "iso_timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "cpu_model": _cpu_model(records),
        "cpu_cores_logical": os.cpu_count(),
        "cpu_cores_physical": _physical_cores(records),
        "ram_total_gb": round(psutil.virtual_memory().total / 1e9, 2),
        "kernel": platform.release(),
        "os_release": _os_release(),
        "python_version": sys.version.split()[0],
        "liboqs_version": oqs.oqs_version(),
        "liboqs_python_version": oqs.oqs_python_version(),
        "ec2_instance_type": _ec2_instance_type(),
        "git_commit": _git_value(["rev-parse", "HEAD"]),
        "git_branch": _git_value(["rev-parse", "--abbrev-ref", "HEAD"]),
        "script_args": script_args,
    }


# ---------------------------------------------------------------------------
# Statistics
# ---------------------------------------------------------------------------

def compute_stats(timings_ns: list[int]) -> dict[str, Any]:
    us = [t / 1000.0 for t in timings_ns]
    mean = statistics.mean(us)
    sorted_us = sorted(us)
    n = len(sorted_us)

    def percentile(p: float) -> float:
        idx = (p / 100.0) * (n - 1)
        lo = int(idx)
        hi = min(lo + 1, n - 1)
        return sorted_us[lo] + (idx - lo) * (sorted_us[hi] - sorted_us[lo])

    return {
        "mean_us": round(mean, 3),
        "median_us": round(statistics.median(us), 3),
        "p95_us": round(percentile(95), 3),
        "p99_us": round(percentile(99), 3),
        "stdev_us": round(statistics.stdev(us) if n > 1 else 0.0, 3),
        "min_us": round(min(us), 3),
        "max_us": round(max(us), 3),
        "ops_per_sec": round(1_000_000.0 / mean, 2) if mean > 0 else 0.0,
        "n_iterations": n,
    }


# ---------------------------------------------------------------------------
# KEM benchmark
# ---------------------------------------------------------------------------

def bench_kem(name: str, n_iter: int, n_warmup: int) -> dict[str, Any]:
    if name not in oqs.get_enabled_kem_mechanisms():
        return {"status": "unavailable"}

    kem = oqs.KeyEncapsulation(name)
    details = kem.details
    sizes = {
        "pubkey_bytes": details["length_public_key"],
        "privkey_bytes": details["length_secret_key"],
        "ciphertext_bytes": details["length_ciphertext"],
    }

    # keygen
    for _ in range(n_warmup):
        kem.generate_keypair()
    gc.collect()
    gc.disable()
    keygen_ns: list[int] = []
    for _ in range(n_iter):
        t0 = time.perf_counter_ns()
        kem.generate_keypair()
        keygen_ns.append(time.perf_counter_ns() - t0)
    gc.enable()

    pub = kem.generate_keypair()

    # encap
    for _ in range(n_warmup):
        kem.encap_secret(pub)
    gc.collect()
    gc.disable()
    encap_ns: list[int] = []
    for _ in range(n_iter):
        t0 = time.perf_counter_ns()
        kem.encap_secret(pub)
        encap_ns.append(time.perf_counter_ns() - t0)
    gc.enable()

    # decap — fresh ciphertext per iter (encap not timed)
    ct_warmup, _ = kem.encap_secret(pub)
    for _ in range(n_warmup):
        kem.decap_secret(ct_warmup)
    gc.collect()
    gc.disable()
    decap_ns: list[int] = []
    for _ in range(n_iter):
        ct, _ = kem.encap_secret(pub)  # setup, not timed
        t0 = time.perf_counter_ns()
        kem.decap_secret(ct)
        decap_ns.append(time.perf_counter_ns() - t0)
    gc.enable()

    kem.free()

    return {
        "status": "ok",
        "type": "kem",
        **sizes,
        "keygen": compute_stats(keygen_ns),
        "encap": compute_stats(encap_ns),
        "decap": compute_stats(decap_ns),
    }


# ---------------------------------------------------------------------------
# Signature benchmark
# ---------------------------------------------------------------------------

def bench_signature(name: str, n_iter: int, n_warmup: int) -> dict[str, Any]:
    if name not in oqs.get_enabled_sig_mechanisms():
        return {"status": "unavailable"}

    sig = oqs.Signature(name)
    details = sig.details
    sizes = {
        "pubkey_bytes": details["length_public_key"],
        "privkey_bytes": details["length_secret_key"],
        "signature_bytes": details["length_signature"],
    }

    # keygen
    for _ in range(n_warmup):
        sig.generate_keypair()
    gc.collect()
    gc.disable()
    keygen_ns: list[int] = []
    for _ in range(n_iter):
        t0 = time.perf_counter_ns()
        sig.generate_keypair()
        keygen_ns.append(time.perf_counter_ns() - t0)
    gc.enable()

    pub = sig.generate_keypair()

    # sign
    for _ in range(n_warmup):
        sig.sign(TEST_MESSAGE)
    gc.collect()
    gc.disable()
    sign_ns: list[int] = []
    for _ in range(n_iter):
        t0 = time.perf_counter_ns()
        sig.sign(TEST_MESSAGE)
        sign_ns.append(time.perf_counter_ns() - t0)
    gc.enable()

    # verify — fresh signature per iter (sign not timed)
    fresh_sig_warmup = sig.sign(TEST_MESSAGE)
    for _ in range(n_warmup):
        sig.verify(TEST_MESSAGE, fresh_sig_warmup, pub)
    gc.collect()
    gc.disable()
    verify_ns: list[int] = []
    for _ in range(n_iter):
        fresh_sig_iter = sig.sign(TEST_MESSAGE)  # setup, not timed
        t0 = time.perf_counter_ns()
        sig.verify(TEST_MESSAGE, fresh_sig_iter, pub)
        verify_ns.append(time.perf_counter_ns() - t0)
    gc.enable()

    sig.free()

    return {
        "status": "ok",
        "type": "sig",
        **sizes,
        "keygen": compute_stats(keygen_ns),
        "sign": compute_stats(sign_ns),
        "verify": compute_stats(verify_ns),
    }


# ---------------------------------------------------------------------------
# Markdown rendering
# ---------------------------------------------------------------------------

def _fmt_us(val: float) -> str:
    if val >= 1000:
        return f"{val:,.0f}"
    return f"{val:.1f}"


def _fmt_ops(val: float) -> str:
    if val >= 1000:
        return f"{val:,.0f}"
    return f"{val:.1f}"


def render_markdown(results: dict[str, Any]) -> str:
    env = results["environment"]
    run_date = env["iso_timestamp"][:10]
    git_short = env["git_commit"][:7] if env["git_commit"] != "unknown" else "unknown"

    lines: list[str] = [
        f"# Q-Advantage Benchmark — {run_date}",
        "",
        "## Environment",
        "",
        f"- **Instance type:** {env['ec2_instance_type']}",
        f"- **CPU:** {env['cpu_model']}",
        f"- **Kernel:** {env['kernel']}",
        f"- **liboqs version:** {env['liboqs_version']}",
        f"- **Git commit:** {git_short}",
        "",
    ]

    col_headers = [
        "Algorithm", "Operation", "Mean (µs)", "p95 (µs)",
        "Ops/sec", "Pubkey (B)", "Privkey (B)", "CT/Sig (B)",
    ]

    # KEM table
    kem_rows: list[list[Any]] = []
    for alg_name in KEM_ALGORITHMS:
        data = results["algorithms"].get(alg_name, {})
        if data.get("status") != "ok":
            for op in ("keygen", "encap", "decap"):
                kem_rows.append([alg_name, op, "N/A", "N/A", "N/A", "N/A", "N/A", "N/A"])
            continue
        pub_b = data["pubkey_bytes"]
        priv_b = data["privkey_bytes"]
        ct_b = data["ciphertext_bytes"]
        for op in ("keygen", "encap", "decap"):
            s = data[op]
            kem_rows.append([
                alg_name, op,
                _fmt_us(s["mean_us"]),
                _fmt_us(s["p95_us"]),
                _fmt_ops(s["ops_per_sec"]),
                pub_b, priv_b, ct_b,
            ])

    lines.append("## KEM Performance")
    lines.append("")
    lines.append(tabulate(kem_rows, headers=col_headers, tablefmt="github", disable_numparse=True))
    lines.append("")

    # Signature table
    sig_rows: list[list[Any]] = []
    for alg_name in SIG_ALGORITHMS:
        data = results["algorithms"].get(alg_name, {})
        if data.get("status") != "ok":
            for op in ("keygen", "sign", "verify"):
                sig_rows.append([alg_name, op, "N/A", "N/A", "N/A", "N/A", "N/A", "N/A"])
            continue
        pub_b = data["pubkey_bytes"]
        priv_b = data["privkey_bytes"]
        sig_b = data["signature_bytes"]
        for op in ("keygen", "sign", "verify"):
            s = data[op]
            sig_rows.append([
                alg_name, op,
                _fmt_us(s["mean_us"]),
                _fmt_us(s["p95_us"]),
                _fmt_ops(s["ops_per_sec"]),
                pub_b, priv_b, sig_b,
            ])

    lines.append("## Signature Performance")
    lines.append("")
    lines.append(tabulate(sig_rows, headers=col_headers, tablefmt="github", disable_numparse=True))
    lines.append("")
    lines.append(
        "---\n"
        "Generated by Q-Advantage benchmark.py — methodology: "
        "https://github.com/Q-Advantage/q-advantage/blob/main/METHODOLOGY.md"
    )

    return "\n".join(lines) + "\n"


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(description="Q-Advantage PQC benchmark harness")
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--quick", action="store_true", help="50 timed iterations (5 warmup)")
    mode.add_argument(
        "--ultra-quick", action="store_true",
        help="5 timed iterations (1 warmup) — smoke test",
    )
    parser.add_argument(
        "--output-dir",
        default=str(Path(__file__).parent / "results"),
        help="Directory for output files (default: benchmark/results/)",
    )
    args = parser.parse_args()

    if args.ultra_quick:
        n_iter, n_warmup = ULTRA_QUICK_ITERATIONS, ULTRA_QUICK_WARMUP
    elif args.quick:
        n_iter, n_warmup = QUICK_ITERATIONS, QUICK_WARMUP
    else:
        n_iter, n_warmup = DEFAULT_ITERATIONS, DEFAULT_WARMUP

    try:
        os.sched_setaffinity(0, {0})
    except (AttributeError, OSError):
        pass
    try:
        os.nice(-5)
    except (AttributeError, OSError):
        pass

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    print("[benchmark] Gathering environment...", file=sys.stderr)
    env = gather_environment(sys.argv[1:])

    all_algorithms: list[str] = KEM_ALGORITHMS + SIG_ALGORITHMS
    total = len(all_algorithms)
    algorithm_results: dict[str, Any] = {}

    for idx, alg in enumerate(all_algorithms, 1):
        t_start = time.perf_counter()
        print(f"[{idx}/{total}] {alg} ...", end="", file=sys.stderr, flush=True)
        try:
            if alg in KEM_ALGORITHMS:
                result = bench_kem(alg, n_iter, n_warmup)
            else:
                result = bench_signature(alg, n_iter, n_warmup)
        except Exception as exc:  # noqa: BLE001
            print(f" FAILED: {exc}", file=sys.stderr)
            result = {
                "status": "failed",
                "error": str(exc),
                "error_type": type(exc).__name__,
            }
        elapsed = time.perf_counter() - t_start
        status = result.get("status", "unknown")
        if status == "failed":
            pass  # already printed inline above
        else:
            print(f" {status} ({elapsed:.1f}s)", file=sys.stderr)
        algorithm_results[alg] = result

    full_results: dict[str, Any] = {
        "environment": env,
        "algorithms": algorithm_results,
    }

    run_date = env["iso_timestamp"][:10]
    json_path = output_dir / f"results-{run_date}.json"
    md_path = output_dir / "RESULTS.md"

    with open(json_path, "w") as f:
        json.dump(full_results, f, indent=2)
    print(f"[benchmark] JSON written to {json_path}", file=sys.stderr)

    md_content = render_markdown(full_results)
    with open(md_path, "w") as f:
        f.write(md_content)
    print(f"[benchmark] Markdown written to {md_path}", file=sys.stderr)

    n_failed = sum(1 for v in algorithm_results.values() if v.get("status") == "failed")
    if n_failed == total:
        print("[benchmark] All algorithms failed!", file=sys.stderr)
        sys.exit(1)

    print(md_content)


if __name__ == "__main__":
    main()
