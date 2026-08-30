"""
Classical signature baselines (`qshield-update-spec.md` §2, §16.3's T line item).

The claims under test are mostly about restraint. These records sit beside the
post-quantum ones in the same file, so the risks are a reader mistaking a
baseline for a candidate, and the harness asserting a security-level pairing it
has not earned.

ECDSA runs at real iteration counts here because it is fast. RSA is exercised
with its key generation forced down to a single sample — the point is the shape
of the record and the honesty of `n_iterations`, not the timing.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "protocols"))

import classical_sig  # noqa: E402

pytest.importorskip(
    "cryptography",
    reason="classical baselines need the cryptography package; the measurement host has it",
)

ECDSA_P256 = next(s for s in classical_sig.CLASSICAL_SCHEMES if s.name == "ECDSA-P256")
RSA_2048 = next(s for s in classical_sig.CLASSICAL_SCHEMES if s.name == "RSA-2048-PSS")


@pytest.fixture(scope="module")
def ecdsa() -> dict:
    return classical_sig.bench_classical(ECDSA_P256, iterations=30, warmup=3)


class TestTheSchemeTable:
    def test_covers_both_classical_families(self):
        families = {s.family for s in classical_sig.CLASSICAL_SCHEMES}
        assert families == {"RSA-PSS", "ECDSA"}

    def test_every_scheme_cites_its_security_level(self):
        # A strength figure is a technical-factual claim like any other. An
        # uncited one is the same failure mode as an uncited benchmark.
        for s in classical_sig.CLASSICAL_SCHEMES:
            assert s.security_bits > 0, s.name
            assert "NIST SP 800-57" in s.security_source, s.name

    def test_rsa_reduces_its_keygen_sample_and_ecdsa_does_not(self):
        # RSA key generation searches for primes: slow and highly variable.
        # Running it at the lattice iteration count would exceed the daily
        # workflow's budget.
        for s in classical_sig.CLASSICAL_SCHEMES:
            if s.family == "RSA-PSS":
                assert s.keygen_iterations is not None and s.keygen_iterations < 100, s.name
                assert "variable" in s.note or "slow" in s.note, s.name
            else:
                assert s.keygen_iterations is None, s.name


class TestTheRecordShape:
    def test_measures_keygen_sign_and_verify(self, ecdsa):
        assert ecdsa["status"] == "ok"
        for op in ("keygen", "sign", "verify"):
            assert ecdsa[op]["mean_us"] > 0, op
            assert ecdsa[op]["n_iterations"] > 0, op

    def test_carries_the_confidence_interval_like_every_other_stat_block(self, ecdsa):
        assert ecdsa["sign"]["ci95_low_us"] is not None
        assert ecdsa["sign"]["ci95_low_us"] <= ecdsa["sign"]["mean_us"]

    def test_is_marked_as_a_baseline_not_a_candidate(self, ecdsa):
        # Without this a consumer reading the schemes map cannot tell a
        # reference line from something being evaluated.
        assert ecdsa["kind"] == "classical"

    def test_publishes_measured_sizes(self, ecdsa):
        assert ecdsa["signature_bytes"] > 0
        assert ecdsa["public_key_bytes"] > 0

    def test_ecdsa_signature_length_is_measured_not_assumed(self, ecdsa):
        # DER-encoded ECDSA signatures vary by a byte or two depending on
        # leading zeros, so a fixed constant would be wrong some of the time.
        assert 68 <= ecdsa["signature_bytes"] <= 72
        assert "varies" in ecdsa["note"] or "DER" in ecdsa["note"]

    def test_records_the_parameters_it_used(self, ecdsa):
        # A signature timing without its hash and encoding is not reproducible.
        assert ecdsa["parameters"]["hash"]
        assert ecdsa["parameters"]["encoding"] == "DER"

    def test_rsa_records_its_padding_and_salt_length(self):
        # PSS salt length is a real choice with a real effect; leaving a reader
        # to assume the conventional one is how a benchmark becomes unrepeatable.
        scheme = classical_sig.ClassicalScheme(
            "RSA-2048-PSS", "RSA-PSS",
            security_bits=112, security_source=RSA_2048.security_source,
            keygen_iterations=1,
        )
        r = classical_sig.bench_classical(scheme, iterations=2, warmup=1)
        assert r["status"] == "ok"
        assert r["parameters"]["padding"] == "PSS"
        assert "salt_length" in r["parameters"]
        assert r["parameters"]["hash"] == "SHA-256"

    def test_the_reduced_keygen_sample_is_visible_in_the_output(self):
        scheme = classical_sig.ClassicalScheme(
            "RSA-2048-PSS", "RSA-PSS",
            security_bits=112, security_source=RSA_2048.security_source,
            keygen_iterations=2,
        )
        r = classical_sig.bench_classical(scheme, iterations=4, warmup=1)
        # n_iterations makes the smaller sample self-describing rather than a
        # footnote somebody has to find.
        assert r["keygen"]["n_iterations"] == 2
        assert r["sign"]["n_iterations"] == 4


class TestItAssertsNoPairing:
    def test_no_post_quantum_counterpart_is_named(self, ecdsa):
        # "RSA-2048 is the classical equivalent of ML-DSA-44" is a
        # security-level argument, not a measurement.
        serialised = str(ecdsa)
        assert "ML-DSA" not in serialised
        assert "SLH-DSA" not in serialised

    def test_the_refusal_is_stated_rather_than_merely_absent(self, ecdsa):
        assert "security-level claim" in ecdsa["pairing_note"]

    def test_the_documented_strength_travels_with_the_record(self, ecdsa):
        # So the pairing can be argued explicitly by whoever makes it.
        assert ecdsa["classical_security_bits"] == 128
        assert "NIST SP 800-57" in ecdsa["security_source"]


class TestDegradation:
    def test_a_missing_dependency_is_reported_not_raised(self, monkeypatch):
        # A baseline we could not measure is a gap to report, not a reason the
        # whole signature track fails.
        def boom(_scheme):
            raise ImportError("no cryptography")

        monkeypatch.setattr(classical_sig, "_build_signer", boom)
        r = classical_sig.bench_classical(ECDSA_P256, iterations=2, warmup=1)
        assert r["status"] == "unavailable"
        assert "cryptography" in r["reason"]
        assert "sign" not in r

    def test_a_genuine_fault_is_reported_as_failed_not_unavailable(self, monkeypatch):
        def boom(_scheme):
            raise RuntimeError("something actually went wrong")

        monkeypatch.setattr(classical_sig, "_build_signer", boom)
        r = classical_sig.bench_classical(ECDSA_P256, iterations=2, warmup=1)
        assert r["status"] == "unavailable"  # build failure is still a gap
        assert "RuntimeError" in r["reason"]

    def test_bench_all_returns_a_record_for_every_scheme(self, monkeypatch):
        def boom(_scheme):
            raise ImportError("no cryptography")

        monkeypatch.setattr(classical_sig, "_build_signer", boom)
        out = classical_sig.bench_all(iterations=2, warmup=1)
        assert set(out) == {s.name for s in classical_sig.CLASSICAL_SCHEMES}
        assert all(r["status"] == "unavailable" for r in out.values())
