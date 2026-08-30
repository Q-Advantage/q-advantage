"""Q-Shield protocol-benchmark shared harness.

Reconciled to the house conventions in benchmark/benchmark.py:
  * stats are MICROSECONDS via compute_stats(), fields
    mean_us/median_us/p95_us/p99_us/stdev_us/min_us/max_us/ops_per_sec/n_iterations
  * timed loops run under gc.collect()+gc.disable(), restored after
  * setup (peer keys, ciphertexts) is built OUTSIDE the timed region
  * sizes pulled from liboqs `.details` where possible

Stdlib + cryptography + oqs. No dependency on benchmark.py (one-way import).

Layer A is composed crypto-cost: the unit ops a handshake performs, plus a
weighted composed total reflecting handshake multiplicity (two endpoints each
do a classical keygen + derive; the KEM does one keygen/encaps/decaps).
"""

from __future__ import annotations

import gc
import math
import json
import os
import platform
import re
import statistics
import subprocess
import time
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any, Callable

# ----------------------------------------------------------------------------
# Reference wire sizes. KEM/sig sizes are pulled live from liboqs .details at
# run time; these are fallbacks + the protocol-framing (key_share) constants
# that liboqs does not know about.
# ----------------------------------------------------------------------------

TLS_KEYSHARE = {                       # bytes on the wire, per draft-ietf-tls-ecdhe-mlkem
    "X25519MLKEM768":   (1216, 1120),  # 1184+32 up, 1088+32 down
    "SecP256r1MLKEM768": (1249, 1153), # 1184+65 up, 1088+65 down (uncompressed P-256 point)
    "MLKEM768":         (1184, 1088),  # pure, non-hybrid
    "X25519":           (32, 32),      # classical baseline
}

SSH_KEX = {                            # KEX public values; host key + sig belong to the auth track
    "mlkem768x25519-sha256": (1216, 1120),
    "curve25519-sha256":     (32, 32),
}

# Handshake multiplicity for the composed total (ephemeral KEX, server-auth):
#   client KEM keygen, server encaps, client decaps  -> 1 each
#   client + server ephemeral classical keygen        -> 2
#   both sides derive the shared secret               -> 2
HANDSHAKE_WEIGHTS = {
    "kem_keygen": 1, "kem_encaps": 1, "kem_decaps": 1,
    "classical_keygen": 2, "classical_derive": 2,
}


# ----------------------------------------------------------------------------
# Stats — mirrors benchmark.py compute_stats exactly (microseconds).
# ----------------------------------------------------------------------------

def compute_stats(timings_ns: list[int]) -> dict[str, Any]:
    us = [t / 1000.0 for t in timings_ns]
    mean = statistics.mean(us)
    s = sorted(us)
    n = len(s)

    def pct(p: float) -> float:
        idx = (p / 100.0) * (n - 1)
        lo = int(idx)
        hi = min(lo + 1, n - 1)
        return s[lo] + (idx - lo) * (s[hi] - s[lo])

    stdev = statistics.stdev(us) if n > 1 else 0.0

    out = {
        "mean_us": round(mean, 3),
        "median_us": round(statistics.median(us), 3),
        "p95_us": round(pct(95), 3),
        "p99_us": round(pct(99), 3),
        "stdev_us": round(stdev, 3),
        "min_us": round(min(us), 3),
        "max_us": round(max(us), 3),
        "ops_per_sec": round(1_000_000.0 / mean, 2) if mean > 0 else 0.0,
        "n_iterations": n,
    }
    out.update(confidence_interval(mean, stdev, n))
    return out


#: 1.96 sigma. Normal approximation, which is sound here because n is 1000 by
#: default and the central limit theorem applies to the MEAN regardless of how
#: skewed the underlying timings are -- and they are skewed, heavily, on a
#: shared host.
Z_95 = 1.959964


def confidence_interval(mean: float, stdev: float, n: int) -> dict[str, Any]:
    """
    A 95% confidence interval on the mean, and the standard error behind it.

    WHY THIS EXISTS. qshield-update-spec.md section 14 names it: the harness
    already records mean/median/p95/p99/stdev/min/max per operation, which is
    real rigour, underused. Publishing a raw stdev next to a mean invites the
    reader to do the wrong arithmetic -- stdev describes the SPREAD OF SAMPLES,
    which on this host is large and mostly tells you about the machine. What a
    reader comparing two algorithms actually needs is how precisely the MEAN
    itself is pinned down, which is the standard error, and that shrinks with
    sqrt(n).

    Stated plainly in the output so the distinction cannot be lost: the
    interval is about the mean, not about where the next sample will land.

    Returns an empty interval rather than a fake one when n < 2. A single
    measurement has no interval, and inventing one would be worse than
    admitting it.
    """
    if n < 2 or mean <= 0:
        return {
            "ci95_low_us": None,
            "ci95_high_us": None,
            "std_error_us": None,
            "ci_note": "A confidence interval needs at least two samples.",
        }
    stderr = stdev / math.sqrt(n)
    return {
        "ci95_low_us": round(mean - Z_95 * stderr, 3),
        "ci95_high_us": round(mean + Z_95 * stderr, 3),
        "std_error_us": round(stderr, 4),
        "ci_note": (
            "95% interval on the MEAN (normal approximation, z=1.96), not a prediction interval "
            "for a single operation. stdev_us describes how much individual samples scatter on "
            "this host; this describes how precisely the mean is known."
        ),
    }



# ----------------------------------------------------------------------------
# Per-operation resource accounting (qshield-update-spec.md section 15, Tier 1)
# ----------------------------------------------------------------------------
#
# Two fields the spec names as missing, both readable from state the process
# already has rather than from any new measurement:
#
#   * CPU time per operation. The spec is explicit that this must be reported
#     honestly: on a single-core-pinned harness with nothing else scheduled it
#     reads close to the wall time by construction, and only becomes
#     interesting once utilisation varies under contention. Saying so in the
#     output is part of shipping it.
#
#   * Peak resident memory across the loop. This is a HIGH-WATER MARK for the
#     whole process, not a per-operation footprint -- ru_maxrss never goes
#     down. Dividing it by the iteration count would produce a confident,
#     meaningless number, so it is published as what it is: the growth in peak
#     RSS observed across the timed loop.
#
# Sampled AROUND the loop rather than inside it. Sampling per iteration would
# perturb the very timings the loop exists to collect.

try:  # pragma: no cover - platform dependent
    import resource as _resource
except ImportError:  # Windows: developers run tests here, the harness does not
    _resource = None  # type: ignore[assignment]


def _rusage() -> tuple[float, int] | None:
    """(cpu_seconds, max_rss_bytes) for this process, or None where unsupported."""
    if _resource is None:
        return None
    ru = _resource.getrusage(_resource.RUSAGE_SELF)
    # ru_maxrss is kilobytes on Linux, bytes on macOS. The harness runs on
    # Linux; the unit is recorded in the output so a reader is not left to
    # guess which platform produced it.
    return (ru.ru_utime + ru.ru_stime, ru.ru_maxrss * 1024)


def resource_delta(before: tuple[float, int] | None,
                   after: tuple[float, int] | None,
                   n_iter: int) -> dict[str, Any]:
    """What the process consumed across a timed loop."""
    if before is None or after is None or n_iter <= 0:
        return {
            "measured": False,
            "reason": (
                "Per-operation resource accounting needs the POSIX resource module, which is "
                "absent on this platform. The measurement host is Linux; this path is only "
                "reached in local development."
            ),
        }
    cpu_seconds = after[0] - before[0]
    return {
        "measured": True,
        "cpu_us_per_op": round((cpu_seconds * 1_000_000.0) / n_iter, 3),
        "cpu_seconds_total": round(cpu_seconds, 6),
        "cpu_note": (
            "User+system CPU across the timed loop, divided by iterations. On this harness the "
            "process is pinned to one core with nothing else scheduled, so this reads close to "
            "wall time by construction. It becomes informative only when utilisation varies "
            "under contention, which this harness deliberately does not create."
        ),
        "max_rss_delta_bytes": max(0, after[1] - before[1]),
        "max_rss_bytes": after[1],
        "rss_note": (
            "Growth in the process high-water mark across the loop. ru_maxrss is a peak that "
            "never falls, so this is NOT a per-operation footprint and is not divided by the "
            "iteration count -- doing so would produce a confident, meaningless number."
        ),
        "rss_unit_note": "ru_maxrss read as kilobytes (Linux convention) and converted to bytes.",
    }

def _time_loop(fn: Callable[[], object], n_iter: int, n_warmup: int) -> list[int]:
    for _ in range(n_warmup):
        fn()
    gc.collect()
    gc.disable()
    out: list[int] = []
    for _ in range(n_iter):
        t0 = time.perf_counter_ns()
        fn()
        out.append(time.perf_counter_ns() - t0)
    gc.enable()
    return out


def _time_loop_with_setup(
    setup: Callable[[], Any], timed: Callable[[Any], object], n_iter: int, n_warmup: int
) -> list[int]:
    """Per-iteration setup (untimed) then time `timed(setup_result)`.

    Mirrors bench_kem's decap: a fresh ciphertext each iteration, only the
    decapsulation timed.
    """
    for _ in range(n_warmup):
        timed(setup())
    gc.collect()
    gc.disable()
    out: list[int] = []
    for _ in range(n_iter):
        x = setup()
        t0 = time.perf_counter_ns()
        timed(x)
        out.append(time.perf_counter_ns() - t0)
    gc.enable()
    return out


# ----------------------------------------------------------------------------
# Classical KEX handlers (cryptography).
# ----------------------------------------------------------------------------

@dataclass
class ClassicalKex:
    name: str
    keygen: Callable[[], Any]
    public_of: Callable[[Any], Any]
    derive: Callable[[Any, Any], bytes]


def _classical_registry() -> dict[str, ClassicalKex]:
    from cryptography.hazmat.primitives.asymmetric import ec
    from cryptography.hazmat.primitives.asymmetric.x25519 import X25519PrivateKey
    return {
        "x25519": ClassicalKex(
            "x25519",
            X25519PrivateKey.generate,
            lambda pk: pk.public_key(),
            lambda pk, peer: pk.exchange(peer),
        ),
        "secp256r1": ClassicalKex(
            "secp256r1",
            lambda: ec.generate_private_key(ec.SECP256R1()),
            lambda pk: pk.public_key(),
            lambda pk, peer: pk.exchange(ec.ECDH(), peer),
        ),
    }


# ----------------------------------------------------------------------------
# The shared Layer-A engine. Both tls_composed and ssh_composed call this.
# ----------------------------------------------------------------------------

def time_hybrid_kex(
    *,
    kem_alg: str | None,
    classical: str | None,
    iterations: int = 1000,
    warmup: int = 50,
) -> dict[str, Any]:
    """Time the unit crypto ops of a (possibly hybrid) key exchange and return
    per-phase stats + a weighted composed-handshake total. House-style stats."""
    import oqs

    phases_ns: dict[str, list[int]] = {}
    sizes: dict[str, int] = {}
    resources: dict[str, Any] = {}

    if kem_alg:
        if kem_alg not in oqs.get_enabled_kem_mechanisms():
            raise RuntimeError(f"{kem_alg} not enabled in this liboqs build")
        kem = oqs.KeyEncapsulation(kem_alg)
        d = kem.details
        sizes["kem_pubkey_bytes"] = d["length_public_key"]
        sizes["kem_ciphertext_bytes"] = d["length_ciphertext"]
        # Secret key size: exposed by the binding on every run and never
        # recorded until now. qshield-update-spec.md section 16.3 makes it
        # blocking for the TCM's ER line item -- storage for larger keys cannot
        # be priced from public key sizes alone.
        if "length_secret_key" in d:
            sizes["kem_secret_key_bytes"] = d["length_secret_key"]
        kem_pub = kem.generate_keypair()  # static peer for encaps/decaps timing

        _res_before = _rusage()
        phases_ns["kem_keygen"] = _time_loop(kem.generate_keypair, iterations, warmup)
        phases_ns["kem_encaps"] = _time_loop(lambda: kem.encap_secret(kem_pub), iterations, warmup)
        phases_ns["kem_decaps"] = _time_loop_with_setup(
            lambda: kem.encap_secret(kem_pub)[0],  # fresh ciphertext per iter, not timed
            kem.decap_secret,
            iterations, warmup,
        )
        resources["kem"] = resource_delta(_res_before, _rusage(), iterations * 3)
        kem.free()

    if classical:
        c = _classical_registry()[classical]
        peer_priv = c.keygen()
        peer_pub = c.public_of(peer_priv)
        local_priv = c.keygen()
        sizes["classical"] = classical

        _res_before_c = _rusage()
        phases_ns["classical_keygen"] = _time_loop(c.keygen, iterations, warmup)
        phases_ns["classical_derive"] = _time_loop(lambda: c.derive(local_priv, peer_pub), iterations, warmup)
        resources["classical"] = resource_delta(_res_before_c, _rusage(), iterations * 2)

    phase_stats = {label: compute_stats(ns) for label, ns in phases_ns.items()}

    # Weighted composed total: per-iteration index-aligned combination.
    m = min((len(v) for v in phases_ns.values()), default=0)
    composed_per_iter = [
        sum(HANDSHAKE_WEIGHTS[label] * phases_ns[label][i] for label in phases_ns)
        for i in range(m)
    ]
    composed = compute_stats(composed_per_iter) if composed_per_iter else None

    return {"phases": phase_stats, "composed": composed, "sizes": sizes, "resources": resources}


# ----------------------------------------------------------------------------
# Size accounting
# ----------------------------------------------------------------------------

@dataclass
class SizeAccounting:
    bytes_client_to_server: int
    bytes_server_to_client: int
    bytes_total: int = 0

    def __post_init__(self) -> None:
        if not self.bytes_total:
            self.bytes_total = self.bytes_client_to_server + self.bytes_server_to_client


def keyshare_size(table: dict[str, tuple[int, int]], suite: str) -> SizeAccounting:
    if suite not in table:
        raise KeyError(f"unknown suite {suite!r}; known: {sorted(table)}")
    c2s, s2c = table[suite]
    return SizeAccounting(c2s, s2c)


# ----------------------------------------------------------------------------
# Cross-validation plumbing (eBACS / liboqs speed)
# ----------------------------------------------------------------------------

@dataclass
class CrossValidation:
    ebacs_reference_cycles: float | None = None
    liboqs_speed_number: float | None = None
    measured_vs_reference_pct: float | None = None
    reference_notes: str | None = None


def reference_delta(measured_us: float, ebacs_cycles: float | None, cpu_hz: float | None) -> CrossValidation:
    cv = CrossValidation(ebacs_reference_cycles=ebacs_cycles)
    if cpu_hz and ebacs_cycles:
        est_cycles = measured_us * 1e-6 * cpu_hz
        cv.measured_vs_reference_pct = round((est_cycles - ebacs_cycles) / ebacs_cycles * 100.0, 2)
        cv.reference_notes = ("us->cycle via nominal CPU Hz; turbo/scaling/steal make this "
                              "approximate. Trust ratios and ordering, not the absolute cycle figure.")
    else:
        cv.reference_notes = "no reference value curated for this primitive yet"
    return cv


# ----------------------------------------------------------------------------
# Environment / version capture (protocol-mode extras on top of the existing env)
# ----------------------------------------------------------------------------

def _run(cmd: list[str]) -> str | None:
    try:
        out = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
        if out.returncode != 0:
            return None
        return (out.stdout + out.stderr).strip() or None
    except (OSError, subprocess.SubprocessError):
        return None


@dataclass
class ToolchainVersions:
    liboqs: str | None = None
    liboqs_python: str | None = None
    openssl_runtime: str | None = None
    openssl_cli: str | None = None
    oqs_provider: str | None = None
    openssh: str | None = None


def capture_toolchain() -> ToolchainVersions:
    tv = ToolchainVersions()
    try:
        import oqs
        tv.liboqs = oqs.oqs_version()
        tv.liboqs_python = oqs.oqs_python_version()
    except Exception:
        pass
    try:
        import ssl
        tv.openssl_runtime = ssl.OPENSSL_VERSION
    except Exception:
        pass
    tv.openssl_cli = _run(["openssl", "version"])
    providers = _run(["openssl", "list", "-providers"])
    if providers and "oqsprovider" in providers.lower():
        mm = re.search(r"oqsprovider.*?version[:\s]+([0-9][\w.\-]*)", providers, re.IGNORECASE | re.DOTALL)
        tv.oqs_provider = mm.group(1) if mm else "present"
    tv.openssh = _run(["ssh", "-V"])
    return tv


@dataclass
class HostInfo:
    cpu_model: str | None = None
    arch: str = field(default_factory=platform.machine)
    build_path: str | None = None
    cpu_flags: list[str] = field(default_factory=list)
    cpu_hz_nominal: float | None = None
    steal_time_pct: float | None = None


_SIMD = ("avx512vl", "avx512f", "avx2", "sse4_2", "neon", "asimd")


def _cpuinfo() -> dict[str, str]:
    try:
        with open("/proc/cpuinfo") as fh:
            text = fh.read()
    except OSError:
        return {}
    info: dict[str, str] = {}
    for line in text.splitlines():
        if ":" in line:
            k, _, v = line.partition(":")
            info.setdefault(k.strip(), v.strip())
    return info


def capture_host() -> HostInfo:
    h = HostInfo()
    ci = _cpuinfo()
    h.cpu_model = ci.get("model name") or ci.get("Model") or platform.processor() or None
    flags = (ci.get("flags") or ci.get("Features") or "").split()
    h.cpu_flags = [f for f in _SIMD if f in flags]
    # Build path — liboqs 0.15.0 OQS_DIST_BUILD (runtime CPUID dispatch).
    # Confirmed from oqsconfig.h on each host:
    #   x86 Cascade Lake: kyber768/falcon dispatch to AVX2; SHA3/Keccak to
    #     AVX512VL (OQS_USE_SHA3_AVX512VL=1), so SLH-DSA tracks eBACS tightly.
    #   ARM Graviton: NEON paths compiled; verify per-host via oqsconfig.h.
    # OQS_USE_*_INSTRUCTIONS macros are undef under OQS_DIST_BUILD by design
    # (those govern CPU-pinned target builds); dispatch is always runtime here.
    if "avx2" in h.cpu_flags or "avx512f" in h.cpu_flags:
        sha3 = "SHA3 AVX512VL" if "avx512vl" in h.cpu_flags else "SHA3 AVX2"
        h.build_path = f"OQS_DIST_BUILD dispatch · kyber768/falcon AVX2 · {sha3}"
    elif "neon" in h.cpu_flags or "asimd" in h.cpu_flags:
        h.build_path = "OQS_DIST_BUILD dispatch · NEON confirmed · ARM64v8 Graviton3"
    else:
        h.build_path = "OQS_DIST_BUILD dispatch · reference (no AVX2/NEON detected)"
    mhz = ci.get("cpu MHz")
    if mhz:
        try:
            h.cpu_hz_nominal = float(mhz) * 1e6
        except ValueError:
            pass
    return h


class StealTimeSampler:
    def __init__(self) -> None:
        self._start = self._read()

    @staticmethod
    def _read() -> tuple[int, int] | None:
        try:
            with open("/proc/stat") as fh:
                first = fh.readline()
        except OSError:
            return None
        p = first.split()
        if not p or p[0] != "cpu":
            return None
        vals = [int(x) for x in p[1:]]
        if len(vals) < 8:
            return None
        return vals[7], sum(vals)

    def result_pct(self) -> float | None:
        end = self._read()
        if self._start is None or end is None:
            return None
        steal_d = end[0] - self._start[0]
        total_d = end[1] - self._start[1]
        return 0.0 if total_d <= 0 else round(steal_d / total_d * 100.0, 4)


def git_commit() -> str | None:
    return _run(["git", "rev-parse", "HEAD"])


def utc_timestamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")



# ----------------------------------------------------------------------------
# CFDIR alignment (qshield-update-spec.md section 16)
# ----------------------------------------------------------------------------
#
# CFDIR's framework is USE-CASE shaped -- fourteen named use cases, applied per
# use case rather than system-wide -- while our output is ALGORITHM shaped. A
# cost model cannot consume the second directly.
#
# The composed-protocol tracks are already the use-case layer, so the join is
# a declaration rather than a re-architecture: each track says which use
# case(s) it prices.
#
# Why declare it in the record instead of in a table somewhere: CFDIR's own
# assumption 8 warns that "redundant costs may be accounted for in different
# line items" and leaves it to the reader to avoid. Once anything sums several
# tracks, double-counting is a live arithmetic risk -- their own worked example
# is TLS cipher suites and TLS certificates riding the same server upgrade. A
# per-track declaration makes the de-duplication rule mechanical rather than
# editorial.

#: Pinned like a library version. Their document is dated and states it will be
#: reviewed annually, so a revision is a methodology event, not a silent change
#: in what our mapping means.
CFDIR_FRAMEWORK_VERSION = "v.01"

#: Which CFDIR use case each track prices. A track absent from this map emits
#: no declaration at all, which is the honest default -- claiming a use case we
#: have not thought about would be worse than claiming none.
CFDIR_USE_CASES: dict[str, list[str]] = {
    # 3.4 TLS cipher suites. Deliberately NOT also 3.5 (TLS certificates):
    # the certificate chain is explicitly out of scope for this measurement,
    # and the chain is the cost in 3.5.
    "tls": ["cfdir-3.4"],
    # 3.13 SSH/SFTP distributed. Not 3.14, which needs a key-management
    # dimension this track does not have.
    "ssh": ["cfdir-3.13"],
}

# ----------------------------------------------------------------------------
# Result-record builder (conforms to schema/protocol_result.schema.json)
# ----------------------------------------------------------------------------

def build_result(
    *,
    protocol: str,
    mode: str,
    suite: str,
    timing: dict,
    size: SizeAccounting,
    phases: dict[str, dict] | None = None,
    baseline_suite: str | None = None,
    pct_over_classical: float | None = None,
    cross_validation: CrossValidation | None = None,
    auth: dict | None = None,
    toolchain: ToolchainVersions | None = None,
    host: HostInfo | None = None,
    tls_version: str | None = None,
) -> dict:
    identity: dict[str, Any] = {"protocol": protocol, "mode": mode, "suite": suite}

    use_cases = CFDIR_USE_CASES.get(protocol)
    if use_cases:
        identity["use_cases"] = list(use_cases)
        identity["cfdir_framework"] = CFDIR_FRAMEWORK_VERSION

    # The inherent/net boundary, drawn through the measurement itself. CFDIR
    # notes that PQC migration may also require moving from TLS 1.2 to 1.3, and
    # that this uplift is INDEPENDENT of quantum-safe migration. If our
    # classical arm were 1.2, every delta we publish would silently bundle that
    # uplift into a figure presented as the PQC increment -- inflating it by
    # exactly the amount their document warns about. Both arms are 1.3. Recorded
    # so the choice is defensible rather than incidental.
    if tls_version:
        identity["tls_version"] = tls_version

    rec = {
        "identity": identity,
        "timing": timing,
        "size": asdict(size),
        "baseline": {"baseline_suite": baseline_suite, "pct_over_classical": pct_over_classical},
        "cross_validation": asdict(cross_validation) if cross_validation else asdict(CrossValidation()),
        "auth": auth,
        "toolchain": asdict(toolchain or capture_toolchain()),
        "host": asdict(host or capture_host()),
        "audit": {"git_commit": git_commit(), "timestamp_utc": utc_timestamp()},
    }
    if phases:
        rec["phases"] = phases
    return rec


def validate_result(record: dict, schema_path: str) -> None:
    try:
        import jsonschema
    except ImportError:
        return
    with open(schema_path) as fh:
        jsonschema.validate(record, json.load(fh))
