"""
Classical signature baselines: RSA-PSS and ECDSA.

WHY THESE EXIST. `qshield-update-spec.md` §2 names classical signature
baselines as unbuilt primitive-layer work, and §16.3 makes the consequence
concrete: CFDIR's **T** line item wants "the classical-vs-PQC delta per use
case", and without a classical arm there is no delta — only an absolute figure.
The signature track has published ML-DSA and SLH-DSA numbers since June with
nothing to read them against.

WHY THEY LIVE BESIDE THE PQC SCHEMES RATHER THAN IN THEIR OWN TRACK. On
2026-08-16 the composed-TLS harness measured its baseline in one pass and every
suite in a second pass, then compared across the two. On a host with this much
run-to-run movement the two passes land in different modes, and the published
delta flipped sign. The fix was to compare within a single run. Putting the
classical signature arms in a *separate file* would reintroduce exactly that
bug in a new place, so they are benchmarked in the same run, in the same file,
by the same loop.

WHAT THIS MODULE DELIBERATELY DOES NOT DO. It does not pair a classical scheme
with a post-quantum one. "RSA-2048 is the classical equivalent of ML-DSA-44" is
a security-level claim, not a measurement, and it needs its own justification —
so each scheme carries its documented security level and the pairing is left to
whoever is making the argument.
"""

from __future__ import annotations

import os
import sys
from typing import Any, Callable

sys.path.insert(0, os.path.dirname(__file__))
import common  # noqa: E402


class ClassicalScheme:
    """One classical signature scheme, described well enough to be published."""

    def __init__(
        self,
        name: str,
        family: str,
        *,
        security_bits: int,
        security_source: str,
        keygen_iterations: int | None = None,
        note: str = "",
    ) -> None:
        self.name = name
        self.family = family
        self.security_bits = security_bits
        self.security_source = security_source
        #: RSA key generation is orders of magnitude slower than everything
        #: else here and hugely variable — it searches for primes. Running it
        #: at the same iteration count as a lattice keygen would take the daily
        #: workflow past its timeout. The count actually used is published in
        #: the stats block, so a reader can see the sample it rests on.
        self.keygen_iterations = keygen_iterations
        self.note = note


#: The schemes, with their security levels cited rather than asserted.
#:
#: Strength figures are the estimates in NIST SP 800-57 Part 1 Rev. 5, Table 2
#: ("Comparable security strengths"). They are estimates of *classical*
#: security, which is the only kind these schemes have — a cryptanalytically
#: relevant quantum computer breaks all of them, which is the entire premise of
#: the migration and is why these are a baseline rather than an option.
CLASSICAL_SCHEMES: list[ClassicalScheme] = [
    ClassicalScheme(
        "RSA-2048-PSS",
        "RSA-PSS",
        security_bits=112,
        security_source="NIST SP 800-57 Part 1 Rev. 5, Table 2",
        keygen_iterations=20,
        note="RSA key generation searches for primes, so its timing is both slow and unusually "
             "variable. It is sampled far fewer times than sign or verify; n_iterations records "
             "how many.",
    ),
    ClassicalScheme(
        "RSA-3072-PSS",
        "RSA-PSS",
        security_bits=128,
        security_source="NIST SP 800-57 Part 1 Rev. 5, Table 2",
        keygen_iterations=10,
        note="Same caveat as RSA-2048, more so: 3072-bit key generation is slow enough that a "
             "large sample would not fit the daily run's budget.",
    ),
    ClassicalScheme(
        "ECDSA-P256",
        "ECDSA",
        security_bits=128,
        security_source="NIST SP 800-57 Part 1 Rev. 5, Table 2",
        note="Signature length varies between runs. ECDSA signatures are DER-encoded and the "
             "encoding is one or two bytes shorter when a component has a leading zero, so the "
             "size published here is measured, not the theoretical maximum.",
    ),
    ClassicalScheme(
        "ECDSA-P384",
        "ECDSA",
        security_bits=192,
        security_source="NIST SP 800-57 Part 1 Rev. 5, Table 2",
        note="Same DER length variability as P-256.",
    ),
]


def _unavailable(scheme: ClassicalScheme, reason: str) -> dict:
    return {
        "scheme": scheme.name,
        "family": scheme.family,
        "kind": "classical",
        "status": "unavailable",
        "reason": reason,
    }


def _build_signer(scheme: ClassicalScheme):
    """Return (keygen, sign, verify, sizes_of) for a scheme, or raise."""
    from cryptography.hazmat.primitives import hashes
    from cryptography.hazmat.primitives.asymmetric import ec, padding, rsa, utils  # noqa: F401
    from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat

    message = b"q-advantage-bench-message-v1\x00\x00\x00\x00\x00"

    if scheme.family == "RSA-PSS":
        bits = int(scheme.name.split("-")[1])

        def keygen():
            return rsa.generate_private_key(public_exponent=65537, key_size=bits)

        # PSS with the salt length matching the digest, which is the
        # conventional choice and the one a reader will assume unless told
        # otherwise. Recorded in the output so they do not have to assume.
        pss = padding.PSS(mgf=padding.MGF1(hashes.SHA256()), salt_length=hashes.SHA256.digest_size)

        def sign(key):
            return key.sign(message, pss, hashes.SHA256())

        def verify(key, signature):
            key.public_key().verify(signature, message, pss, hashes.SHA256())

        params = {"hash": "SHA-256", "padding": "PSS", "salt_length": "digest length (32 B)"}

    elif scheme.family == "ECDSA":
        curve = ec.SECP256R1() if "P256" in scheme.name else ec.SECP384R1()
        digest = hashes.SHA256() if "P256" in scheme.name else hashes.SHA384()

        def keygen():
            return ec.generate_private_key(curve)

        def sign(key):
            return key.sign(message, ec.ECDSA(digest))

        def verify(key, signature):
            key.public_key().verify(signature, message, ec.ECDSA(digest))

        params = {"hash": digest.name.upper(), "encoding": "DER"}

    else:  # pragma: no cover - guarded by the scheme table
        raise ValueError("unknown family %r" % scheme.family)

    def sizes_of(key, signature) -> dict:
        pub = key.public_key().public_bytes(Encoding.DER, PublicFormat.SubjectPublicKeyInfo)
        return {"signature_bytes": len(signature), "public_key_bytes": len(pub)}

    return keygen, sign, verify, sizes_of, params, message


def bench_classical(scheme: ClassicalScheme, iterations: int, warmup: int) -> dict:
    """
    Time one classical scheme, in the same style as the post-quantum ones.

    Returns an `unavailable` record rather than raising when `cryptography` is
    missing: a baseline we could not measure is a gap to report, not a reason
    the whole signature track fails.
    """
    try:
        keygen, sign, verify, sizes_of, params, _ = _build_signer(scheme)
    except ImportError:
        return _unavailable(
            scheme,
            "the `cryptography` package is not installed on this host, so classical signature "
            "baselines could not be measured.",
        )
    except Exception as exc:  # noqa: BLE001 - report, never fabricate
        return _unavailable(scheme, "%s: %s" % (type(exc).__name__, exc))

    try:
        key = keygen()

        keygen_n = scheme.keygen_iterations or iterations
        keygen_warmup = min(warmup, max(1, keygen_n // 10))

        res_before = common._rusage()
        keygen_ns = common._time_loop(keygen, keygen_n, keygen_warmup)
        sign_ns = common._time_loop(lambda: sign(key), iterations, warmup)
        verify_ns = common._time_loop_with_setup(
            lambda: sign(key),  # fresh signature per iteration, not timed
            lambda s: verify(key, s),
            iterations,
            warmup,
        )
        resources = common.resource_delta(
            res_before, common._rusage(), keygen_n + iterations * 2
        )
        sizes = sizes_of(key, sign(key))
    except Exception as exc:  # noqa: BLE001
        return {
            "scheme": scheme.name,
            "family": scheme.family,
            "kind": "classical",
            "status": "failed",
            "error": "%s: %s" % (type(exc).__name__, exc),
        }

    return {
        "scheme": scheme.name,
        "family": scheme.family,
        # The field that stops a reader mistaking these for post-quantum
        # numbers. Every classical row is a BASELINE: a cryptanalytically
        # relevant quantum computer breaks all of them, which is why they are
        # here to be measured against rather than chosen between.
        "kind": "classical",
        "status": "ok",
        "keygen": common.compute_stats(keygen_ns),
        "sign": common.compute_stats(sign_ns),
        "verify": common.compute_stats(verify_ns),
        "signature_bytes": sizes["signature_bytes"],
        "public_key_bytes": sizes["public_key_bytes"],
        "parameters": params,
        "classical_security_bits": scheme.security_bits,
        "security_source": scheme.security_source,
        # Deliberately not paired with a post-quantum scheme here. "RSA-2048 is
        # the classical equivalent of ML-DSA-44" is a security-level argument,
        # not a measurement, and it needs to be made explicitly by whoever is
        # making it.
        "pairing_note": (
            "No post-quantum counterpart is asserted. Pairing a classical scheme with a "
            "post-quantum one is a security-level claim rather than a measurement; the documented "
            "strength is published so the pairing can be argued rather than assumed."
        ),
        "resources": resources,
        "note": scheme.note,
    }


def bench_all(iterations: int, warmup: int) -> dict[str, dict]:
    """Every classical baseline, keyed by scheme name."""
    return {s.name: bench_classical(s, iterations, warmup) for s in CLASSICAL_SCHEMES}
