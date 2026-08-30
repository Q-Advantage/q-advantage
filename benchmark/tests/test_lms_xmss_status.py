"""
Status classification for the stateful-signature harness.

The regression under test landed on 2026-08-17 and was live for 13 days: a
liboqs build without the LMS/XMSS flags raises MechanismNotEnabledError, the
broad `except Exception` in bench_verify_only() caught it, and every scheme
began reporting status "failed" with error_type "verify_only_exception".

Two consequences, both real:

  * /q-shield/compare rendered the raw string
    "MechanismNotEnabledError: LMS_SHA256_H10_W8" to readers as the explanation
    for why there is no hash-based signature data, having lost the informative
    reason the "unavailable" path supplied.
  * "failed" is the louder signal, reserved for a KAT that will not verify or a
    genuine fault. Classifying an expected, documented build gap as a failure
    buries the real ones.

These tests need no liboqs: they exercise the classification, not the crypto.
"""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "protocols"))


class MechanismNotEnabledError(Exception):
    """Shape-compatible stand-in for liboqs's own exception type.

    The harness classifies on the exception's class NAME, precisely so this
    works without a liboqs build present.
    """


@pytest.fixture()
def oqs_stub(monkeypatch):
    """Stand in for the `oqs` module.

    lms_xmss imports oqs *inside* its functions, so the stub has to be in
    sys.modules at call time rather than patched onto the harness module.
    """
    import types

    stub = types.ModuleType("oqs")
    stub.MechanismNotEnabledError = MechanismNotEnabledError
    monkeypatch.setitem(sys.modules, "oqs", stub)
    return stub


@pytest.fixture()
def lms_xmss(oqs_stub):
    import lms_xmss

    return lms_xmss


def test_unavailable_records_a_reason_not_an_error(lms_xmss):
    r = lms_xmss._unavailable("LMS_SHA256_H10_W8", "build lacks the flag")
    assert r["status"] == "unavailable"
    assert r["reason"] == "build lacks the flag"
    assert "error" not in r, "an expected build gap must not be reported as an error"


def test_mechanism_not_enabled_is_unavailable_not_failed(lms_xmss, oqs_stub, monkeypatch):
    """The 2026-08-17 regression, stated as a test."""

    def boom(_name):
        raise MechanismNotEnabledError("LMS_SHA256_H10_W8")

    monkeypatch.setattr(lms_xmss, "_load_kat", lambda name: {
        "message": b"\x00", "signature": b"\x00", "public_key": b"\x00",
    })
    oqs_stub.StatefulSignature = boom

    r = lms_xmss.bench_verify_only("LMS_SHA256_H10_W8", iterations=1, warmup=0)

    assert r["status"] == "unavailable", (
        "A build without the mechanism compiled in is the unavailable case. "
        "Reporting it as 'failed' publishes a raw exception string to readers "
        "and drowns out genuine KAT failures."
    )
    assert "MechanismNotEnabledError" not in r.get("reason", ""), (
        "The reader-facing reason must explain the gap, not echo the exception class."
    )
    assert "OQS_ENABLE_SIG_STFL_LMS" in r["reason"], (
        "The reason should name the flags that fix it — the runbook procedure."
    )
    assert "error_type" not in r


def test_a_genuine_fault_is_still_failed(lms_xmss, oqs_stub, monkeypatch):
    """The louder signal must survive: only the not-enabled case is reclassified."""

    def boom(_name):
        raise RuntimeError("something actually went wrong")

    monkeypatch.setattr(lms_xmss, "_load_kat", lambda name: {
        "message": b"\x00", "signature": b"\x00", "public_key": b"\x00",
    })
    oqs_stub.StatefulSignature = boom

    r = lms_xmss.bench_verify_only("LMS_SHA256_H10_W8", iterations=1, warmup=0)
    assert r["status"] == "failed"
    assert r["error_type"] == "verify_only_exception"
    assert "RuntimeError" in r["error"]


def test_missing_kat_vector_is_unavailable(lms_xmss, monkeypatch):
    monkeypatch.setattr(lms_xmss, "_load_kat", lambda name: None)
    r = lms_xmss.bench_verify_only("LMS_SHA256_H10_W8", iterations=1, warmup=0)
    assert r["status"] == "unavailable"
    assert "KAT" in r["reason"] or "vector" in r["reason"]
