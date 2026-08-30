"""
IKEv2 composed track (`qshield-update-spec.md` §15 Tier 2, CFDIR use case 3.12).

The claims worth pinning here are mostly about not overstating. This track's
crypto multiplicity is genuinely the same as TLS's, its wire sizes are not, and
it covers half of what CFDIR's 3.12 names. Each of those is a thing a future
edit could quietly get wrong in the flattering direction.

Runs without liboqs: the KEM suites report unavailable and the classical arms
still measure, which is the degradation path worth exercising anyway.
"""

from __future__ import annotations

import sys
import types
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "protocols"))

import common  # noqa: E402


@pytest.fixture()
def no_liboqs(monkeypatch):
    """A liboqs with no KEMs enabled — the classical arms must still run."""
    stub = types.ModuleType("oqs")
    stub.get_enabled_kem_mechanisms = lambda: []
    monkeypatch.setitem(sys.modules, "oqs", stub)
    import ipsec_composed

    return ipsec_composed


class TestWireSizesAreNotCopiedFromTLS:
    def test_ikev2_ecp_points_are_one_byte_shorter_than_tls(self):
        # IKEv2 sends a raw x||y concatenation (RFC 5903 §7); TLS sends a SEC1
        # uncompressed point with a leading 0x04. Copying the TLS numbers across
        # would have published a wrong size in both directions.
        ike_up, ike_down = common.IKEV2_KEX["ecp256+mlkem768"]
        tls_up, tls_down = common.TLS_KEYSHARE["SecP256r1MLKEM768"]
        assert tls_up - ike_up == 1
        assert tls_down - ike_down == 1

    def test_bare_ecp256_is_sixty_four_bytes(self):
        assert common.IKEV2_KEX["ecp256"] == (64, 64)

    def test_curve25519_matches_the_other_tracks(self):
        # Curve25519 has no point-format byte anywhere, so this one genuinely
        # is the same number in every protocol.
        assert common.IKEV2_KEX["curve25519"] == common.TLS_KEYSHARE["X25519"]

    def test_a_hybrid_row_is_the_sum_of_its_parts(self):
        for classical, hybrid in (("curve25519", "curve25519+mlkem768"), ("ecp256", "ecp256+mlkem768")):
            c_up, c_down = common.IKEV2_KEX[classical]
            k_up, k_down = common.IKEV2_KEX["mlkem768"]
            h_up, h_down = common.IKEV2_KEX[hybrid]
            assert h_up == c_up + k_up, hybrid
            assert h_down == c_down + k_down, hybrid


class TestTheTrackRuns:
    def test_classical_arms_measure_without_liboqs(self, no_liboqs):
        r = no_liboqs.run(iterations=5, warmup=1)
        assert set(r["suites"]) == {"curve25519", "ecp256"}
        for rec in r["suites"].values():
            assert rec["timing"]["median_us"] > 0

    def test_kem_suites_are_reported_unavailable_not_dropped(self, no_liboqs):
        # A mechanism the build lacks is a gap to report. Silently omitting the
        # rows would make an incomplete run look like a complete one.
        r = no_liboqs.run(iterations=5, warmup=1)
        assert set(r["unavailable"]) == {"mlkem768", "curve25519+mlkem768", "ecp256+mlkem768"}
        assert all(msg for msg in r["unavailable"].values())

    def test_the_delta_is_same_run(self, no_liboqs):
        # The 2026-08-16 sign-flip came from comparing across passes. Every
        # suite here is measured in one pass and compared within it.
        r = no_liboqs.run(iterations=5, warmup=1)
        assert r["suites"]["curve25519"]["baseline"]["baseline_suite"] is None
        assert r["suites"]["ecp256"]["baseline"]["baseline_suite"] == "curve25519"
        assert r["suites"]["ecp256"]["baseline"]["pct_over_classical"] is not None

    def test_it_declares_the_network_use_case(self, no_liboqs):
        r = no_liboqs.run(iterations=5, warmup=1)
        identity = r["suites"]["ecp256"]["identity"]
        assert identity["protocol"] == "ipsec"
        assert identity["use_cases"] == ["cfdir-3.12"]

    def test_it_does_not_claim_a_tls_version(self, no_liboqs):
        # IKEv2 has no TLS version. The field exists for the TLS track's
        # inherent/net boundary and must not leak into a protocol without one.
        r = no_liboqs.run(iterations=5, warmup=1)
        assert "tls_version" not in r["suites"]["ecp256"]["identity"]


class TestItStatesWhatItDoesNotMeasure:
    def test_the_modp_gap_explains_why_rather_than_just_noting_it(self, no_liboqs):
        # Measuring group 14 with a mistranscribed prime would still compute a
        # shared secret and still produce a plausible timing while measuring
        # something that is not group 14.
        scope = no_liboqs.run(iterations=5, warmup=1)["scope"]
        assert "MODP" in scope["modp_gap"]
        assert "RFC 3526" in scope["modp_gap"]
        assert "unmeasured rather than measured wrongly" in scope["modp_gap"]

    def test_macsec_is_named_as_the_other_half_of_the_use_case(self, no_liboqs):
        scope = no_liboqs.run(iterations=5, warmup=1)["scope"]
        assert "MACsec" in scope["macsec_gap"]
        assert "3.12" in scope["macsec_gap"]

    def test_the_shared_weighting_is_explained_not_hidden(self, no_liboqs):
        # An honest finding: the crypto multiplicity really is the same as TLS.
        # The risk is a future edit inventing a different weighting to make the
        # track look more distinct than it is.
        scope = no_liboqs.run(iterations=5, warmup=1)["scope"]
        assert "same phase weights" in scope["weights_note"]
        assert "was not invented" in scope["weights_note"]

    def test_the_rekey_multiplier_is_disclaimed(self, no_liboqs):
        # What actually makes an IPsec tunnel cost different from a TLS
        # connection, and why this track does not price it.
        scope = no_liboqs.run(iterations=5, warmup=1)["scope"]
        assert "rekey" in scope["rekey_note"].lower()
        assert "one key establishment" in scope["rekey_note"]

    def test_the_baseline_choice_is_justified(self, no_liboqs):
        # curve25519 is chosen for cross-track consistency, not because it is
        # the most representative IPsec baseline -- and that is said.
        scope = no_liboqs.run(iterations=5, warmup=1)["scope"]
        assert "ecp256" in scope["baseline_note"]
        assert "representative" in scope["baseline_note"]


class TestSchemaConformance:
    def test_every_record_validates(self, no_liboqs):
        jsonschema = pytest.importorskip("jsonschema")
        import json

        schema = json.loads(
            (Path(__file__).resolve().parents[2] / "schema" / "protocol_result.schema.json")
            .read_text()
        )
        r = no_liboqs.run(iterations=5, warmup=1)
        for name, rec in r["suites"].items():
            jsonschema.validate(rec, schema)

    def test_the_protocol_enum_accepts_ipsec_and_still_refuses_typos(self):
        jsonschema = pytest.importorskip("jsonschema")
        import json

        schema = json.loads(
            (Path(__file__).resolve().parents[2] / "schema" / "protocol_result.schema.json")
            .read_text()
        )
        assert set(schema["properties"]["identity"]["properties"]["protocol"]["enum"]) == {
            "tls",
            "ssh",
            "ipsec",
        }

        rec = common.build_result(
            protocol="ipsek",  # deliberate typo
            mode="composed",
            suite="fixture",
            timing=common.compute_stats([9_999_000, 9_999_000]),
            size=common.SizeAccounting(0, 0),
            toolchain=common.ToolchainVersions(liboqs="0", liboqs_python="0"),
            host=common.HostInfo(arch="x86_64"),
        )
        with pytest.raises(jsonschema.ValidationError):
            jsonschema.validate(rec, schema)
