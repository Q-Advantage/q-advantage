"""
End-to-end: a synthetic capture in, one Layer B result file out.

This exercises the whole pipeline -- pcap framing, TCP reassembly, TLS record
and extension parsing, outcome classification and result shaping -- without
Docker, a network, or liboqs. The capture is built from the same header
builders the pcap tests use, carrying a genuine RFC 8446 handshake.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "capture"))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from parse_capture import build_result, main  # noqa: E402
from pcap_reader import reassemble  # noqa: E402
from test_pcap_reader import SERVER_PORT, pcap, to_client, to_server  # noqa: E402
from test_tls_wire import X25519, X25519MLKEM768, client_hello, server_hello  # noqa: E402


def capture_of(ch: bytes, sh: bytes) -> bytes:
    """A capture carrying one handshake, split across realistic segments."""
    frames = []
    # Split the ClientHello across two segments: a hybrid key share is larger
    # than a classical one and does not always fit in a single packet.
    half = len(ch) // 2
    frames.append(to_server(ch[:half], seq=1))
    frames.append(to_server(ch[half:], seq=1 + half))
    frames.append(to_client(sh, seq=1))
    return pcap(frames)


def result_for(client_groups: list[int], chosen: int | None, **kw) -> dict:
    shares = [(client_groups[0], 1216)] if client_groups else []
    blob = capture_of(client_hello(client_groups, shares), server_hello(chosen))
    conv = reassemble(blob, SERVER_PORT)[0]
    return build_result(
        conv,
        label=kw.pop("label", "pairwise"),
        client_groups=":".join(str(g) for g in client_groups),
        server_groups="",
        **kw,
    )


class TestStructuralFactsSurviveTheWholePipeline:
    def test_negotiated_group_comes_through_from_the_wire(self):
        r = result_for([X25519MLKEM768, X25519], X25519MLKEM768)
        assert r["wire"]["negotiated_group"]["name"] == "X25519MLKEM768"
        assert r["wire"]["negotiated_group"]["source"].startswith("wire bytes")
        assert r["outcome"]["outcome"] == "negotiated"

    def test_a_clienthello_split_across_segments_is_reassembled(self):
        # The reason this case matters: a hybrid key share is large enough that
        # the ClientHello routinely spans more than one segment, and a reader
        # that only looked at the first packet would see no key_share at all.
        r = result_for([X25519MLKEM768, X25519], X25519MLKEM768)
        assert r["wire"]["client_hello_seen"] is True
        assert r["wire"]["client_key_share_groups"][0]["name"] == "X25519MLKEM768"

    def test_packet_and_byte_counts_are_reported(self):
        r = result_for([X25519MLKEM768], X25519MLKEM768)
        s = r["structure"]
        assert s["packets_total"] == 3
        assert s["packets_client_to_server"] == 2
        assert s["packets_server_to_client"] == 1
        assert s["wire_bytes_total"] > 0
        assert s["largest_segment_bytes"] > 0

    def test_a_downgrade_is_carried_into_the_result_as_an_outcome(self):
        r = result_for([X25519MLKEM768, X25519], X25519)
        assert r["outcome"]["outcome"] == "downgraded_to_classical"

    def test_the_configuration_under_test_is_recorded_in_the_result(self):
        r = result_for([X25519MLKEM768], X25519MLKEM768, label="mismatch-mode")
        assert r["identity"]["label"] == "mismatch-mode"
        assert r["identity"]["client_groups_offered"]


class TestTimingIsNeverPublishableByAccident:
    """The line between a portable structural fact and a machine-dependent one."""

    def test_timing_is_not_publishable_by_default(self):
        r = result_for([X25519MLKEM768], X25519MLKEM768)
        assert r["timing"]["publishable"] is False
        assert "not publication-grade" in r["timing"]["note"].lower() or \
               "NOT a published figure" in r["timing"]["note"]

    def test_timing_becomes_publishable_only_when_explicitly_asserted(self):
        r = result_for([X25519MLKEM768], X25519MLKEM768, measurement_host=True)
        assert r["timing"]["publishable"] is True

    def test_structural_facts_carry_no_such_caveat(self):
        # They are properties of the exchange, not of the machine, so they are
        # portable and must not be gated behind the measurement-host flag.
        r = result_for([X25519MLKEM768], X25519MLKEM768)
        assert r["structure"]["packets_total"] > 0
        assert "publishable" not in r["structure"]


class TestEmptyAndBrokenCapturesAreOutcomes:
    def test_a_capture_with_no_traffic_is_reported_not_crashed(self, tmp_path, capsys):
        empty = tmp_path / "empty.pcap"
        empty.write_bytes(pcap([]))
        rc = main([str(empty), "--server-port", str(SERVER_PORT)])
        assert rc == 0
        payload = json.loads(capsys.readouterr().out)
        assert payload["outcome"]["outcome"] == "no_traffic_captured"

    def test_a_handshake_the_server_never_answered_is_a_clean_rejection(self):
        blob = pcap([to_server(client_hello([X25519MLKEM768]), seq=1)])
        conv = reassemble(blob, SERVER_PORT)[0]
        r = build_result(conv, label="mismatch", client_groups="", server_groups="")
        assert r["outcome"]["outcome"] == "no_server_hello"
        assert "not a silent downgrade" in r["outcome"]["detail"]


class TestResultFileShape:
    def test_writes_one_file_and_names_it_by_label_and_date(self, tmp_path):
        blob = capture_of(
            client_hello([X25519MLKEM768], [(X25519MLKEM768, 1216)]),
            server_hello(X25519MLKEM768),
        )
        cap = tmp_path / "h.pcap"
        cap.write_bytes(blob)
        out = tmp_path / "results"
        assert main([str(cap), "--server-port", str(SERVER_PORT),
                     "--label", "pairwise", "--output-dir", str(out)]) == 0
        files = list(out.glob("layer-b-pairwise-*.json"))
        assert len(files) == 1
        payload = json.loads(files[0].read_text())
        assert payload["schema"].startswith("layer-b/")
        for key in ("identity", "outcome", "wire", "structure", "timing", "audit"):
            assert key in payload

    def test_result_carries_facts_not_raw_wire_bytes(self):
        # A result publishes what was derived from the capture, never the
        # capture itself: the pcap can contain anything that crossed the link.
        r = result_for([X25519MLKEM768], X25519MLKEM768)
        serialised = json.dumps(r)  # must not raise
        assert "client_to_server" not in r["wire"]
        assert "server_to_client" not in r["wire"]
        assert len(serialised) < 20000, "a result should be facts, not a payload dump"
