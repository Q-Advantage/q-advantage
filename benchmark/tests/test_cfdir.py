"""
CFDIR declarations in the result record (`qshield-update-spec.md` §16).

Three things are asserted here, and each of them is a claim that could quietly
go wrong rather than loudly break:

  * A track declares which CFDIR use case it prices. Without that declaration,
    a cost model summing several tracks has no mechanical way to avoid
    double-counting — CFDIR's own assumption 8 warns about exactly this and
    leaves it to the reader.

  * The declaration is NARROW. `tls_composed` prices 3.4 and deliberately not
    3.5, because the certificate chain is out of scope and the chain is the
    cost in 3.5. Over-claiming here is worse than not declaring at all.

  * The framework version is pinned. Their document is dated and will be
    revised; inheriting their versioning is what keeps our mapping meaningful.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "protocols"))

import common  # noqa: E402


def record(protocol: str, **kw) -> dict:
    return common.build_result(
        protocol=protocol,
        mode="composed",
        suite="fixture",
        # Sentinel timings: 9999 could never pass as a measurement, and the
        # schema forbids the repo's other sentinel (-1) on timing fields.
        timing=common.compute_stats([9_999_000, 9_999_000]),
        size=common.SizeAccounting(0, 0),
        toolchain=common.ToolchainVersions(liboqs="0", liboqs_python="0"),
        host=common.HostInfo(arch="x86_64"),
        **kw,
    )


class TestUseCaseDeclaration:
    def test_tls_declares_the_cipher_suite_use_case(self):
        assert record("tls")["identity"]["use_cases"] == ["cfdir-3.4"]

    def test_tls_does_NOT_also_claim_tls_certificates(self):
        # 3.5's cost is the certificate chain, which this measurement
        # explicitly excludes. Claiming it would be an over-declaration that a
        # cost model would then trust.
        assert "cfdir-3.5" not in record("tls")["identity"]["use_cases"]

    def test_ssh_declares_the_distributed_use_case_only(self):
        # Not 3.14, which needs a key-management dimension this track lacks.
        ids = record("ssh")["identity"]["use_cases"]
        assert ids == ["cfdir-3.13"]
        assert "cfdir-3.14" not in ids

    def test_an_undeclared_protocol_claims_nothing(self):
        # The honest default. Claiming a use case nobody has thought about
        # would be worse than claiming none.
        identity = record("ipsec")["identity"]
        assert "use_cases" not in identity
        assert "cfdir_framework" not in identity

    def test_the_declaration_is_a_copy_not_the_shared_list(self):
        # A caller mutating one record must not silently rewrite the mapping
        # for every subsequent record in the same process.
        first = record("tls")
        first["identity"]["use_cases"].append("cfdir-9.9")
        assert record("tls")["identity"]["use_cases"] == ["cfdir-3.4"]


class TestFrameworkPin:
    def test_the_version_travels_with_the_declaration(self):
        assert record("tls")["identity"]["cfdir_framework"] == common.CFDIR_FRAMEWORK_VERSION

    def test_the_pin_is_a_real_version_string(self):
        assert common.CFDIR_FRAMEWORK_VERSION.startswith("v")


class TestTlsVersionIsExplicit:
    def test_it_is_recorded_when_supplied(self):
        # The inherent/net boundary. CFDIR notes the TLS 1.2 -> 1.3 uplift is
        # independent of quantum-safe migration, so a classical arm on 1.2
        # would fold that uplift into a figure published as the PQC increment.
        assert record("tls", tls_version="1.3")["identity"]["tls_version"] == "1.3"

    def test_it_is_absent_rather_than_guessed_when_not_supplied(self):
        assert "tls_version" not in record("ssh")["identity"]


class TestTheRecordStillValidates:
    def test_declared_records_pass_the_schema(self):
        jsonschema = pytest.importorskip("jsonschema")
        import json

        schema = json.loads(
            (Path(__file__).resolve().parents[2] / "schema" / "protocol_result.schema.json")
            .read_text()
        )
        jsonschema.validate(record("tls", tls_version="1.3"), schema)
        jsonschema.validate(record("ssh"), schema)

    def test_a_malformed_use_case_id_is_rejected(self):
        jsonschema = pytest.importorskip("jsonschema")
        import json

        schema = json.loads(
            (Path(__file__).resolve().parents[2] / "schema" / "protocol_result.schema.json")
            .read_text()
        )
        rec = record("tls")
        rec["identity"]["use_cases"] = ["3.4"]  # missing the cfdir- prefix
        with pytest.raises(jsonschema.ValidationError):
            jsonschema.validate(rec, schema)
