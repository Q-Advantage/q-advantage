"""
JWT/JOSE composed signing (`qshield-update-spec.md` §15 Tier 2, CFDIR 3.7).

Runs without liboqs: what is under test is the COMPOSITION -- how a token is
assembled, where its bytes are accounted, and where the claim stops -- not
whether a signature algorithm works. Signatures are stand-in byte strings of the
real published lengths, so the size arithmetic is exercised against the real
shape without needing the library.

The assertions that matter are about restraint. This track publishes numbers
that bear on an unfinished standardisation effort, and the line between "here is
what a token costs" and "here is the identifier it will use" is the one worth
guarding.
"""

from __future__ import annotations

import base64
import json
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "protocols"))

import jose_composed as jose  # noqa: E402

# Real published signature lengths, so the size arithmetic is exercised against
# the shape it will actually meet.
SIG_BYTES = {
    "ES256": 72,
    "PS256": 256,
    "ML-DSA-44": 2420,
    "ML-DSA-65": 3309,
    "ML-DSA-87": 4627,
}


def token_for(alg: str) -> tuple[bytes, bytes, bytes]:
    signing_bytes, header = jose.signing_input(alg)
    signature = b"\x00" * SIG_BYTES[alg]
    return jose.compose(signing_bytes, signature), header, signature


class TestTheTokenIsARealJoseToken:
    def test_it_has_three_base64url_parts(self):
        token, _, _ = token_for("ES256")
        parts = token.split(b".")
        assert len(parts) == 3

    def test_no_part_carries_base64_padding(self):
        # RFC 7515 section 2: base64url in JOSE is unpadded. A token with "="
        # in it is not a token, and a size measured off one would be wrong by
        # up to two bytes per part in a direction nobody would notice.
        token, _, _ = token_for("ML-DSA-65")
        assert b"=" not in token

    def test_the_header_round_trips_to_the_algorithm_it_names(self):
        _, header, _ = token_for("ML-DSA-87")
        pad = b"=" * (-len(header) % 4)
        assert json.loads(base64.urlsafe_b64decode(header + pad))["alg"] == "ML-DSA-87"

    def test_the_payload_round_trips_to_the_published_claims(self):
        # The claims are an input to every size on this page, so they are
        # published -- and this pins that what is published is what was signed.
        token, header, _ = token_for("ES256")
        payload = token.split(b".")[1]
        pad = b"=" * (-len(payload) % 4)
        assert json.loads(base64.urlsafe_b64decode(payload + pad)) == jose.CLAIMS


class TestSizeAccounting:
    def test_the_parts_sum_to_the_whole(self):
        # If they did not, some bytes would be unaccounted for and the
        # signature's share would be wrong in a way no reader could catch.
        token, header, signature = token_for("ML-DSA-65")
        acc = jose.size_accounting(token, header, signature)
        assert (
            acc["header_bytes"] + acc["payload_bytes"] + acc["signature_encoded_bytes"] + 2
            == acc["token_bytes"]
        )

    def test_the_encoding_overhead_is_measured_not_multiplied(self):
        # The published overhead comes from encoding the real signature, never
        # from multiplying its length by 4/3 -- which would be off by up to
        # three bytes and would silently stop tracking reality if the
        # serialization ever changed.
        _, _, signature = token_for("ML-DSA-65")
        token, header, _ = token_for("ML-DSA-65")
        acc = jose.size_accounting(token, header, signature)
        assert acc["signature_encoded_bytes"] == len(jose.b64u(signature))
        assert acc["encoding_overhead_bytes"] == acc["signature_encoded_bytes"] - 3309

    def test_the_signature_dominates_a_post_quantum_token(self):
        # The finding: for a post-quantum token the application's own payload
        # is a rounding error, so shrinking the claims buys almost nothing.
        token, header, signature = token_for("ML-DSA-87")
        assert jose.size_accounting(token, header, signature)["signature_share_pct"] > 90

    def test_the_signature_does_not_dominate_a_classical_one(self):
        token, header, signature = token_for("ES256")
        assert jose.size_accounting(token, header, signature)["signature_share_pct"] < 40


class TestLimitsArePublishedNotJudged:
    def test_every_limit_carries_its_source(self):
        # A limit without a source is an assertion. Each of these is a
        # configurable default and a reader has to be able to check it.
        for row in jose.against_limits(1000):
            assert row["source"]
            assert row["limit_bytes"] > 0

    def test_a_classical_token_is_within_every_default(self):
        token, _, _ = token_for("ES256")
        assert all(r["within_default"] for r in jose.against_limits(len(token)))

    def test_the_smallest_post_quantum_token_still_fits_a_cookie(self):
        # Worth pinning for the same reason as the certificate-chain finding:
        # this is not "post-quantum breaks it", it is "post-quantum breaks it
        # above a specific parameter set".
        token, _, _ = token_for("ML-DSA-44")
        cookie = jose.against_limits(len(token))[0]
        assert cookie["limit_bytes"] == 4096
        assert cookie["within_default"] is True

    def test_the_larger_post_quantum_tokens_do_not(self):
        for alg in ("ML-DSA-65", "ML-DSA-87"):
            token, _, _ = token_for(alg)
            cookie = jose.against_limits(len(token))[0]
            assert cookie["within_default"] is False
            assert cookie["headroom_bytes"] < 0

    def test_headroom_is_signed_so_the_direction_survives(self):
        # A magnitude with no sign reads as headroom in both directions.
        token, _, _ = token_for("ML-DSA-87")
        assert jose.against_limits(len(token))[0]["headroom_bytes"] < 0
        assert jose.against_limits(100)[0]["headroom_bytes"] > 0


class TestTheClaimBoundary:
    """The line between measuring a token and naming an identifier for it."""

    def test_a_post_quantum_arm_declares_its_alg_unregistered(self):
        rec = jose.bench_arm("ML-DSA-65", "post-quantum", iterations=1, warmup=0)
        # Either it ran or liboqs lacks the scheme; both are fine here. What is
        # not fine is a record claiming a registered identifier.
        if rec["status"] == "ok":
            assert rec["alg_is_registered"] is False
            assert "NON-STANDARD" in rec["alg_note"]

    def test_a_classical_arm_uses_a_genuinely_registered_identifier(self):
        # PS256 and ES256 are registered in RFC 7518 section 3.1. The contrast
        # is part of the finding, so it must be real on both sides.
        rec = jose.bench_arm("ECDSA-P256", "classical", iterations=1, warmup=0)
        if rec["status"] == "ok":
            assert rec["alg"] in ("ES256", "ES384")
            assert rec["alg_is_registered"] is True
            assert rec["alg_note"] is None

    def test_no_standardisation_draft_is_named_anywhere_in_the_output(self):
        # An uncited identity claim is the same failure mode as a fabricated
        # benchmark. If a draft identifier ever appears here it must arrive with
        # its citation, and this test is where that decision gets made.
        serialised = json.dumps(jose.run(iterations=1, warmup=0))
        for name in ("draft-", "ietf-cose", "COSE", "provisional", "will be registered"):
            assert name not in serialised, name

    def test_the_alg_note_travels_on_the_run_as_well_as_each_arm(self):
        # A consumer reading only the top-level document must not have to infer
        # it from the per-arm records.
        assert "NON-STANDARD" in jose.run(iterations=1, warmup=0)["alg_note"]


class TestTheComparison:
    def _arms(self) -> dict:
        arms = {}
        for alg, scheme, kind in (
            ("ES256", "ECDSA-P256", "classical"),
            ("PS256", "RSA-2048", "classical"),
            ("ML-DSA-65", "ML-DSA-65", "post-quantum"),
        ):
            token, header, signature = token_for(alg)
            arms[scheme] = {
                "scheme": scheme,
                "kind": kind,
                "status": "ok",
                "sign": {"mean_us": 100.0},
                "size": jose.size_accounting(token, header, signature),
            }
        arms["ML-DSA-65"]["sign"]["mean_us"] = 60.0
        return arms

    def test_post_quantum_tokens_are_measured_against_a_classical_baseline(self):
        cmp = jose.compare(self._arms())
        assert cmp["measurable"] is True
        assert cmp["baseline"] == "ECDSA-P256"
        row = next(r for r in cmp["rows"] if r["scheme"] == "ML-DSA-65")
        assert row["token_multiple_of_baseline"] > 5

    def test_the_baseline_is_not_listed_as_its_own_comparison(self):
        cmp = jose.compare(self._arms())
        assert all(r["scheme"] != "ECDSA-P256" for r in cmp["rows"])

    def test_a_missing_baseline_is_refused_rather_than_substituted(self):
        arms = self._arms()
        del arms["ECDSA-P256"]
        cmp = jose.compare(arms)
        assert cmp["measurable"] is False
        assert "prices nothing" in cmp["reason"]

    def test_an_unavailable_arm_is_skipped_rather_than_counted_as_zero(self):
        arms = self._arms()
        arms["Falcon-512"] = {"scheme": "Falcon-512", "status": "unavailable", "reason": "off"}
        assert all(r["scheme"] != "Falcon-512" for r in jose.compare(arms)["rows"])

    def test_size_and_speed_are_reported_separately(self):
        # The whole point: on this fixture ML-DSA-65 signs FASTER than the
        # baseline while producing a token that no longer fits a cookie. A
        # blended figure would erase exactly that, so the two must stay apart.
        cmp = jose.compare(self._arms())
        row = next(r for r in cmp["rows"] if r["scheme"] == "ML-DSA-65")
        assert row["sign_delta_pct"] < 0
        assert row["token_delta_bytes"] > 0
        assert "never blended" in cmp["note"]


class TestFailuresAreReportedNotFabricated:
    def test_an_unknown_classical_scheme_raises_rather_than_guessing(self):
        with pytest.raises(ValueError):
            jose._classical_signer("DSA-1024")

    def test_a_scheme_liboqs_lacks_reads_as_unavailable_not_failed(self):
        # `unavailable` and `failed` mean different things downstream, and
        # conflating them is the exact bug that put a raw exception string on
        # the public compare page for thirteen days.
        rec = jose.bench_arm("ML-DSA-9999", "post-quantum", iterations=1, warmup=0)
        assert rec["status"] == "unavailable"
        # Two legitimate ways to be unavailable, and the record must say which:
        # liboqs is present but was not built with the scheme (the CI and
        # runner case), or liboqs is not installed at all (this machine).
        assert "not enabled" in rec["reason"] or "not installed" in rec["reason"]
        assert "error" not in rec

    def test_the_run_completes_even_when_an_arm_cannot_be_measured(self):
        result = jose.run(iterations=1, warmup=0)
        assert result["track"] == "jose-composed"
        assert set(result["arms"]) == {s for s, _ in jose.ARMS}
