"""
Certificate-chain sizing (`qshield-update-spec.md` §15 Tier 2, CFDIR 3.5).

Runs without OpenSSL or oqs-provider: the sizing logic is exercised against DER
files written by the test, because what is under test is the accounting — which
certificates count as "sent", how the comparison is framed, and where the claim
stops — rather than OpenSSL's ability to mint a certificate.

The assertions that matter are about restraint. This module publishes byte
counts that bear directly on an active standards debate, and the line between
"here is what a chain costs" and "here is what a proposal would save" is the
one worth guarding.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "certs"))

import measure_chains  # noqa: E402


def make_chain(root: Path, alg: str, leaf: int, intermediate: int, ca: int) -> Path:
    d = root / alg
    d.mkdir(parents=True)
    (d / "leaf.der").write_bytes(b"\x00" * leaf)
    (d / "intermediate.der").write_bytes(b"\x00" * intermediate)
    (d / "root.der").write_bytes(b"\x00" * ca)
    return d


@pytest.fixture()
def certs(tmp_path: Path) -> Path:
    root = tmp_path / "certs"
    # Shapes chosen to be obviously synthetic while keeping the classical arm
    # smaller than the post-quantum one, which is the relationship under test.
    make_chain(root, "ecdsa-p256", leaf=500, intermediate=520, ca=480)
    make_chain(root, "mldsa44", leaf=4000, intermediate=4100, ca=4050)
    return root


class TestWhatCountsAsSent:
    def test_only_leaf_and_intermediate_are_counted_as_sent(self, certs):
        # In the common WebPKI deployment the root is already in the client's
        # trust store. Counting it would overstate every handshake.
        c = measure_chains.measure_chain(certs / "ecdsa-p256")
        assert c["sent_in_handshake"]["der_bytes"] == 1020
        assert c["sent_in_handshake"]["certificates"] == ["leaf", "intermediate"]

    def test_the_full_chain_is_published_as_well(self, certs):
        # Which figure applies depends on the deployment; quoting only one
        # would be a choice made on the reader's behalf.
        c = measure_chains.measure_chain(certs / "ecdsa-p256")
        assert c["full_chain_der_bytes"] == 1500

    def test_tls_framing_is_added_to_the_message_size(self, certs):
        # RFC 8446 §4.4.2: a 3-byte length prefix and a 2-byte extensions
        # length per certificate. The bare DER sum is not what the wire carries.
        c = measure_chains.measure_chain(certs / "ecdsa-p256")
        assert c["sent_in_handshake"]["tls_message_bytes"] == 1020 + 2 * 5

    def test_a_missing_certificate_is_reported_not_guessed(self, tmp_path):
        d = tmp_path / "broken"
        d.mkdir()
        (d / "leaf.der").write_bytes(b"\x00" * 100)
        c = measure_chains.measure_chain(d)
        assert c["measured"] is False
        assert "intermediate" in c["reason"]
        assert "sent_in_handshake" not in c


class TestTheComparison:
    def test_post_quantum_chains_are_measured_against_a_classical_one(self, certs):
        chains = [measure_chains.measure_chain(d) for d in sorted(certs.iterdir())]
        cmp = measure_chains.compare(chains, "ecdsa-p256")
        assert cmp["measurable"] is True
        row = next(r for r in cmp["rows"] if r["algorithm"] == "mldsa44")
        assert row["sent_der_bytes"] == 8100
        assert row["delta_bytes"] == 8100 - 1020
        assert row["multiple_of_baseline"] == pytest.approx(7.94, abs=0.01)

    def test_the_baseline_is_not_listed_as_its_own_comparison(self, certs):
        chains = [measure_chains.measure_chain(d) for d in sorted(certs.iterdir())]
        cmp = measure_chains.compare(chains, "ecdsa-p256")
        assert all(r["algorithm"] != "ecdsa-p256" for r in cmp["rows"])

    def test_a_missing_baseline_is_refused_rather_than_substituted(self, certs):
        # An absolute chain size prices nothing. Silently picking another
        # baseline would change what every row means without saying so.
        chains = [measure_chains.measure_chain(d) for d in sorted(certs.iterdir())]
        cmp = measure_chains.compare(chains, "rsa-2048")
        assert cmp["measurable"] is False
        assert "prices nothing" in cmp["reason"]

    def test_it_compares_on_what_is_sent_not_the_full_chain(self, certs):
        chains = [measure_chains.measure_chain(d) for d in sorted(certs.iterdir())]
        cmp = measure_chains.compare(chains, "ecdsa-p256")
        assert cmp["baseline_sent_der_bytes"] == 1020  # not 1500
        assert "per-connection cost multiplies" in cmp["note"]


class TestTheClaimBoundary:
    """The line between measuring a cost and endorsing a proposal."""

    def test_component_arithmetic_prices_omitting_the_intermediate(self, certs):
        chains = [measure_chains.measure_chain(d) for d in sorted(certs.iterdir())]
        comp = measure_chains.component_arithmetic(chains)
        row = next(r for r in comp["rows"] if r["algorithm"] == "mldsa44")
        assert row["saved_if_intermediate_omitted"] == 4100
        assert row["remaining_if_intermediate_omitted"] == 4000
        assert row["intermediate_share_pct"] == pytest.approx(50.6, abs=0.1)

    def test_it_states_that_it_specifies_no_proposal(self, certs):
        # The numbers bear on an active standards debate. Publishing arithmetic
        # is defensible; describing a draft we have not cited is not.
        chains = [measure_chains.measure_chain(d) for d in sorted(certs.iterdir())]
        comp = measure_chains.component_arithmetic(chains)
        assert "does not describe, endorse or specify" in comp["claim_boundary"]

    def test_no_draft_or_mechanism_is_named_anywhere_in_the_output(self, certs):
        # An uncited identity claim is the same failure mode as a fabricated
        # benchmark. If a named mechanism ever appears here it must arrive with
        # its citation, and this test is where that decision gets made.
        result = measure_chains.build(certs, "ecdsa-p256")
        serialised = json.dumps(result)
        for name in ("Merkle", "MTC", "draft-", "RFC 9162"):
            assert name not in serialised, name


class TestScopeIsPublishedWithTheNumbers:
    def test_it_says_the_figures_are_a_floor(self, certs):
        # Short names, one SAN, no CT extensions. A real chain is larger, so
        # the post-quantum penalty on a real chain is larger too.
        scope = measure_chains.build(certs, "ecdsa-p256")["scope"]
        assert "FLOOR" in scope["floor_not_typical"]
        assert "larger, not smaller" in scope["floor_not_typical"]

    def test_it_says_why_the_sizes_are_measured_rather_than_summed(self, certs):
        scope = measure_chains.build(certs, "ecdsa-p256")["scope"]
        assert "confidently wrong" in scope["why_measured"]

    def test_it_names_what_is_still_not_measured(self, certs):
        # Chain sizing does not price issuance or rotation -- that is CFDIR 3.3,
        # a different use case entirely.
        scope = measure_chains.build(certs, "ecdsa-p256")["scope"]
        assert "3.3" in scope["not_measured"]

    def test_an_empty_directory_produces_a_result_rather_than_a_crash(self, tmp_path):
        result = measure_chains.build(tmp_path / "nothing", "ecdsa-p256")
        assert result["chains"] == []
        assert result["comparison"]["measurable"] is False


class TestTheCongestionInteraction:
    """
    The finding that reverses an earlier one, and the care it needs.

    Layer B measured a real first flight at 1,762 bytes and this repo published
    that the congestion-window cliff was not binding. That measurement is
    correct; the conclusion drawn from it was too broad, because Layer B's
    testbed serves a classical certificate by design. Put a post-quantum chain
    in the same flight and the answer changes.
    """

    def _chains(self):
        # The real measured figures from CI run 33319905023.
        def chain(alg, leaf, inter, root):
            sent = leaf + inter
            return {
                "algorithm": alg,
                "measured": True,
                "certificates_der_bytes": {"leaf": leaf, "intermediate": inter, "root": root},
                "sent_in_handshake": {"der_bytes": sent, "tls_message_bytes": sent + 10},
            }

        return [
            chain("ecdsa-p256", 466, 431, 386),
            chain("mldsa44", 4059, 4020, 3976),
            chain("mldsa65", 5588, 5549, 5505),
            chain("mldsa87", 7546, 7507, 7463),
        ]

    def test_a_classical_chain_fits_comfortably(self):
        rows = {r["certificate_algorithm"]: r for r in
                measure_chains.congestion_interaction(self._chains())["rows"]}
        assert rows["ecdsa-p256"]["exceeds_initcwnd"] is False
        assert rows["ecdsa-p256"]["headroom_bytes"] > 10_000

    def test_the_smallest_post_quantum_chain_still_fits(self):
        # Worth pinning: the finding is not "post-quantum breaks it", it is
        # "post-quantum breaks it above a specific parameter set".
        rows = {r["certificate_algorithm"]: r for r in
                measure_chains.congestion_interaction(self._chains())["rows"]}
        assert rows["mldsa44"]["exceeds_initcwnd"] is False

    def test_the_larger_post_quantum_chains_do_not(self):
        rows = {r["certificate_algorithm"]: r for r in
                measure_chains.congestion_interaction(self._chains())["rows"]}
        assert rows["mldsa65"]["exceeds_initcwnd"] is True
        assert rows["mldsa87"]["exceeds_initcwnd"] is True
        assert rows["mldsa87"]["headroom_bytes"] < 0

    def test_the_assumed_window_travels_with_the_verdict(self):
        # initcwnd is a tunable default. A verdict without its assumption is
        # not reproducible.
        c = measure_chains.congestion_interaction(self._chains())
        assert c["assumed_initcwnd_bytes"] == 14600
        assert "RFC 6928" in c["assumed_initcwnd_note"]

    def test_a_different_window_changes_the_verdict(self):
        c = measure_chains.congestion_interaction(self._chains(), initcwnd_bytes=64_000)
        assert all(not r["exceeds_initcwnd"] for r in c["rows"])

    def test_it_declares_itself_a_composition_not_a_capture(self):
        # Every term is measured; the flight's structure is assumed. Presenting
        # that as a captured measurement would be the overreach.
        c = measure_chains.congestion_interaction(self._chains())
        assert "COMPOSITION" in c["claim_type"]
        assert "not a captured flight" in c["claim_type"]
        assert "no OCSP stapling" in c["claim_type"]

    def test_it_says_why_layer_b_could_not_see_this(self):
        # Without this, the two findings look like a contradiction rather than
        # two correct answers to different questions.
        c = measure_chains.congestion_interaction(self._chains())
        assert "1,762" in c["why_layer_b_did_not_see_this"]
        assert "classical" in c["why_layer_b_did_not_see_this"] or \
               "ECDSA" in c["why_layer_b_did_not_see_this"]

    def test_the_composition_errs_upward_not_downward(self):
        # A real deployment carries more than the assumed flight, so the
        # published total understates rather than overstates.
        c = measure_chains.congestion_interaction(self._chains())
        assert "pushes the total up, not down" in c["claim_type"]

    def test_an_algorithm_with_no_known_signature_size_is_skipped(self):
        # Rather than composed with a guessed signature length.
        extra = self._chains() + [{
            "algorithm": "unknown-alg", "measured": True,
            "certificates_der_bytes": {"leaf": 1, "intermediate": 1, "root": 1},
            "sent_in_handshake": {"der_bytes": 2, "tls_message_bytes": 12},
        }]
        rows = measure_chains.congestion_interaction(extra)["rows"]
        assert all(r["certificate_algorithm"] != "unknown-alg" for r in rows)
