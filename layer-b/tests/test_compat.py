"""
Application compatibility (`qshield-update-spec.md` §15 Tier 2, work-order 023).

Runs without Docker, nginx, HAProxy or Node: what is under test is the probe's
JUDGEMENT -- how it labels an outcome, what it refuses to infer, and where it
stops -- rather than any product's behaviour. The products are exercised in CI;
what is exercised here is whether the probe would report them honestly.

The assertions that matter are about not manufacturing a finding. This probe
publishes statements of the form "product X, on its defaults, silently dropped
your request", which is a serious thing to say about somebody else's software.
Every path that could say it without evidence is pinned shut.
"""

from __future__ import annotations

import socket
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "compat"))

import probe_headers  # noqa: E402
import probe_parsers  # noqa: E402
import run_compat  # noqa: E402


class TestTheRequestIsARealRequest:
    def test_the_token_is_exactly_the_requested_length(self):
        # Every published finding is indexed by a token size. If the request
        # did not carry that many bytes, the size in the result is a fiction.
        req = probe_headers.build_request("example", 4730)
        header = next(
            line for line in req.split(b"\r\n") if line.startswith(b"Authorization:")
        )
        assert len(header) - len(b"Authorization: Bearer ") == 4730

    def test_it_is_a_well_formed_http_request(self):
        req = probe_headers.build_request("example", 100)
        assert req.startswith(b"GET / HTTP/1.1\r\n")
        assert b"\r\nHost: example\r\n" in req
        assert req.endswith(b"\r\n\r\n")

    def test_the_token_sizes_are_the_measured_ones(self):
        # Carried from the JOSE track rather than invented. If these drift from
        # what that track measures, the probe is testing sizes nobody deploys.
        assert probe_headers.TOKEN_SIZES["ML-DSA-65"] == 4730
        assert probe_headers.TOKEN_SIZES["ML-DSA-87"] == 6488
        # And a classical arm, so a rejection at every size is diagnosable as a
        # broken probe rather than published as a post-quantum finding.
        assert probe_headers.TOKEN_SIZES["ES256 (ECDSA-P256)"] < 1000


class TestOutcomesAreLabelledNeverInferred:
    def test_a_2xx_is_accepted(self, monkeypatch):
        _fake_response(monkeypatch, b"HTTP/1.1 200 OK\r\n\r\nok")
        r = probe_headers.probe("h", 1, 100)
        assert r["outcome"] == "accepted"
        assert r["status"] == 200

    def test_a_431_is_a_rejection_that_names_the_problem(self, monkeypatch):
        _fake_response(monkeypatch, b"HTTP/1.1 431 Request Header Fields Too Large\r\n\r\n")
        r = probe_headers.probe("h", 1, 9000)
        assert r["outcome"] == "rejected"
        assert r["names_the_problem"] is True

    def test_a_bare_400_is_a_rejection_that_does_not(self, monkeypatch):
        # The distinction the probe exists for. Both are "it broke"; only one
        # tells an engineer what to change, and the difference is a week.
        _fake_response(monkeypatch, b"HTTP/1.1 400 Bad Request\r\n\r\n")
        r = probe_headers.probe("h", 1, 9000)
        assert r["outcome"] == "rejected"
        assert r["names_the_problem"] is False

    def test_a_closed_connection_is_its_own_outcome_not_a_success(self, monkeypatch):
        # The most dangerous path in the whole probe. A connection that closes
        # with no status line must never fall through to "accepted".
        _fake_response(monkeypatch, b"")
        r = probe_headers.probe("h", 1, 9000)
        assert r["outcome"] == "connection_closed_without_response"
        assert r["status"] is None
        assert r["names_the_problem"] is False

    def test_a_reset_is_distinguished_from_a_clean_close(self, monkeypatch):
        # Different diagnoses: one is the peer refusing, the other is the peer
        # answering nothing. Collapsing them would lose which it was.
        _fake_response(monkeypatch, ConnectionResetError())
        assert probe_headers.probe("h", 1, 9000)["outcome"] == "connection_reset"

    def test_a_timeout_is_not_reported_as_a_rejection(self, monkeypatch):
        _fake_response(monkeypatch, socket.timeout())
        assert probe_headers.probe("h", 1, 9000)["outcome"] == "timeout"

    def test_a_failure_to_connect_is_not_a_compatibility_finding(self, monkeypatch):
        # If the container never came up, that is a broken probe. Publishing it
        # as "the product dropped your request" would be a false accusation.
        _fake_response(monkeypatch, OSError("connection refused"))
        r = probe_headers.probe("h", 1, 100)
        assert r["outcome"] == "connect_failed"
        assert r["outcome"] not in ("rejected", "connection_reset")


class TestTheSummaryCannotOverstate:
    def test_it_says_so_plainly_when_nothing_broke(self):
        s = probe_headers.summarise("nginx", accepted=["a", "b"], rejected=[], silent=[])
        assert "accepted every token size" in s

    def test_a_probe_that_rejected_everything_points_at_itself(self):
        # Including the classical baseline failing means the probe or the
        # deployment is broken. Publishing that as a post-quantum finding would
        # be the worst error this file could make.
        s = probe_headers.summarise("nginx", accepted=[], rejected=["a", "b"], silent=[])
        assert "points at the probe or the deployment" in s

    def test_silent_rejections_are_called_out_separately(self):
        s = probe_headers.summarise("nginx", accepted=["a"], rejected=["b"], silent=["b"])
        assert "without naming size as the reason" in s

    def test_a_mixed_result_reports_both_counts(self):
        s = probe_headers.summarise("nginx", accepted=["a", "b"], rejected=["c"], silent=[])
        assert "accepted 2 of 3" in s


class TestTheParserProbeSeparatesThreeOutcomes:
    """Refused, structurally readable, and fully readable are not the same gap."""

    def test_a_fully_readable_certificate_is_labelled_that_way(self):
        fields = {"subject": "CN=x", "not_after": "2027", "serial": "0x1"}
        assert probe_parsers.classify(fields, key_readable=True, refused=False) == "parsed_fully"

    def test_a_readable_certificate_with_an_opaque_key_is_not_a_refusal(self):
        # This is the common case and the reassuring one: an inventory built on
        # it is complete, and the unknown algorithm is a labelling problem.
        fields = {"subject": "CN=x", "not_after": "2027", "serial": "0x1"}
        assert (
            probe_parsers.classify(fields, key_readable=False, refused=False)
            == "parsed_structure_key_opaque"
        )

    def test_a_refusal_wins_over_every_other_reading(self):
        # Ordered so the worst case can never be reported as a better one.
        fields = {"subject": "CN=x", "not_after": "2027", "serial": "0x1"}
        assert (
            probe_parsers.classify(fields, key_readable=True, refused=True) == "refused_the_file"
        )

    def test_missing_structural_fields_are_not_rounded_up(self):
        fields = {"subject": "CN=x", "not_after": None, "serial": None}
        assert probe_parsers.classify(fields, key_readable=False, refused=False) == "parsed_partially"

    def test_a_missing_certificate_is_reported_not_skipped(self, tmp_path):
        d = tmp_path / "mldsa65"
        d.mkdir()
        r = probe_parsers.probe_algorithm(d, tmp_path)
        assert r["measured"] is False
        assert "no leaf.der" in r["reason"]

    def test_two_independent_parsers_are_used(self, tmp_path):
        # One implementation cannot tell "this certificate is malformed" from
        # "this tool cannot read this algorithm".
        d = tmp_path / "ecdsa-p256"
        d.mkdir()
        (d / "leaf.der").write_bytes(b"\x30\x00")  # deliberately not a certificate
        tools = [t["tool"] for t in probe_algorithm_tools(d, tmp_path)]
        assert len(tools) == 2
        assert any("openssl" in t for t in tools)
        assert any("cryptography" in t for t in tools)

    def test_a_malformed_file_is_refused_rather_than_half_reported(self, tmp_path):
        d = tmp_path / "mldsa65"
        d.mkdir()
        (d / "leaf.der").write_bytes(b"not a certificate at all")
        r = probe_parsers.probe_algorithm(d, tmp_path)
        assert r["measured"] is True
        for tool in r["tools"]:
            if tool["outcome"] != "not_installed":
                assert tool["outcome"] == "refused_the_file"
                assert tool["errors"]


def probe_algorithm_tools(d: Path, tmp: Path) -> list[dict]:
    return probe_parsers.probe_algorithm(d, tmp)["tools"]


class TestTheHeadlineIsDerived:
    def test_zero_findings_is_distinguishable_from_zero_probes(self):
        # "Nothing broke" and "nothing ran" must not render identically. A page
        # showing 0 silent rejections against 0 targets would read as clean.
        h = run_compat.headline([], [])
        assert h["targets_probed"] == 0
        assert h["silent_rejections"] == 0
        assert "does not mean the probes did not run" in h["note"]

    def test_it_counts_silent_rejections_across_targets(self):
        rows = [
            {
                "target": "nginx",
                "rejected_without_naming_the_problem": ["ML-DSA-87"],
            },
            {
                "target": "haproxy",
                "rejected_without_naming_the_problem": ["ML-DSA-65", "ML-DSA-87"],
            },
        ]
        h = run_compat.headline(rows, [])
        assert h["silent_rejections"] == 3
        assert "nginx / ML-DSA-87" in h["silent_rejection_detail"]

    def test_it_counts_certificates_invisible_to_a_parser(self):
        rows = [
            {"algorithm": "mldsa65", "measured": True, "invisible_to": ["openssl (default)"]},
            {"algorithm": "ecdsa-p256", "measured": True, "invisible_to": []},
        ]
        h = run_compat.headline([], rows)
        assert h["certificates_invisible_to_a_parser"] == 1
        assert h["algorithms_probed"] == 2

    def test_an_unmeasured_algorithm_is_not_counted_as_probed(self):
        rows = [{"algorithm": "falcon512", "measured": False, "reason": "not generated"}]
        assert run_compat.headline([], rows)["algorithms_probed"] == 0


class TestScopeTravelsWithTheResult:
    def test_it_says_the_limits_are_defaults(self, tmp_path):
        scope = run_compat.build(tmp_path, only="__none__")["scope"]
        assert "configurable default" in scope["defaults_not_limits"]

    def test_it_refuses_to_be_read_as_a_product_comparison(self, tmp_path):
        # Naming products and reporting that they dropped requests is a serious
        # claim. The boundary is published with it, not left to the reader.
        scope = run_compat.build(tmp_path, only="__none__")["scope"]
        assert "not_a_product_comparison" in scope
        assert "roadmap" in scope["not_a_product_comparison"]

    def test_it_says_no_algorithm_is_exercised_by_the_header_probe(self, tmp_path):
        # The tokens are filler of a measured LENGTH. Claiming otherwise would
        # be presenting a synthetic byte string as a signature.
        scope = run_compat.build(tmp_path, only="__none__")["scope"]
        assert "No algorithm is exercised" in scope["what_is_under_test"]

    def test_it_names_where_the_token_sizes_came_from(self, tmp_path):
        scope = run_compat.build(tmp_path, only="__none__")["scope"]
        assert "022" in scope["token_sizes_source"]

    def test_a_run_with_no_certificates_still_produces_a_result(self, tmp_path):
        r = run_compat.build(tmp_path / "nothing", only="__none__")
        assert r["certificate_parsers"] == []
        assert r["headline"]["algorithms_probed"] == 0


def _fake_response(monkeypatch: pytest.MonkeyPatch, payload):
    """Stand in for the network with a fixed response, or an exception to raise."""

    class FakeSock:
        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

        def settimeout(self, _):
            pass

        def sendall(self, _):
            if isinstance(payload, Exception):
                raise payload

        def recv(self, _):
            if isinstance(payload, Exception):
                raise payload
            data, self._sent = (payload, True) if not getattr(self, "_sent", False) else (b"", True)
            return data

    def fake_connect(*_a, **_kw):
        if isinstance(payload, OSError) and not isinstance(payload, socket.timeout):
            if type(payload) is OSError:
                raise payload
        return FakeSock()

    monkeypatch.setattr(probe_headers.socket, "create_connection", fake_connect)
