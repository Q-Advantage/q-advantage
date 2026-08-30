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


class TestCongestionAndRoundTripsReachTheResult:
    """The initcwnd cliff, which Layer A carries as a qualitative callout."""

    def test_a_pairwise_result_carries_a_congestion_block(self):
        r = result_for([X25519MLKEM768], X25519MLKEM768)
        assert "congestion" in r
        assert "assumed_initcwnd_bytes" in r["congestion"]

    def test_round_trips_and_rtt_are_reported_or_explained(self):
        r = result_for([X25519MLKEM768], X25519MLKEM768)
        assert "approx_round_trips" in r["round_trips"]
        # The fixture capture has no SYN, so RTT must say so rather than guess.
        assert r["rtt"]["measurable"] is False
        assert "rtt_seconds" not in r["rtt"]


class TestConcurrencyResultsAreADifferentShape:
    def test_a_swarm_is_aggregated_not_reported_as_one_handshake(self):
        from parse_capture import build_concurrency_result

        frames = []
        for i in range(4):
            port = 51000 + i
            ch = client_hello([X25519MLKEM768], [(X25519MLKEM768, 1216)])
            sh = server_hello(X25519MLKEM768)
            frames.append(to_server(ch, seq=1))
            frames.append(to_client(sh, seq=1))
            # Re-key the conversation by rewriting the client port.
            frames[-2] = frames[-2][:34] + bytes([port >> 8, port & 0xFF]) + frames[-2][36:]
            frames[-1] = frames[-1][:36] + bytes([port >> 8, port & 0xFF]) + frames[-1][38:]
        convs = reassemble(pcap(frames), SERVER_PORT)
        r = build_concurrency_result(
            convs, label="concurrency", client_groups="", server_groups=""
        )
        assert r["identity"]["label"] == "concurrency"
        assert "concurrency" in r
        assert r["concurrency"]["connections"] == len(convs)
        # Reporting a swarm as one handshake is the conflation spec 7 forbids.
        assert "wire" not in r
        assert "structure" not in r

    def test_the_concurrency_label_is_carried_into_the_payload(self):
        from analysis import concurrency_summary
        from parse_capture import build_concurrency_result

        convs = reassemble(pcap([to_server(b"a", seq=1), to_client(b"b", seq=1)]), SERVER_PORT)
        r = build_concurrency_result(convs, label="concurrency", client_groups="", server_groups="")
        assert r["concurrency"]["label"] == "connections per core (live sockets)"


class TestEnvironmentProvenance:
    def test_a_path_note_records_what_was_in_the_way(self, tmp_path):
        # An injected delay or a proxy must be recorded, or the result is not
        # interpretable -- and worse, an injected latency could be read as real.
        blob = capture_of(
            client_hello([X25519MLKEM768], [(X25519MLKEM768, 1216)]),
            server_hello(X25519MLKEM768),
        )
        cap = tmp_path / "h.pcap"
        cap.write_bytes(blob)
        out = tmp_path / "r"
        main([str(cap), "--server-port", str(SERVER_PORT), "--label", "rtt",
              "--env-note", "netem 50ms injected on the client egress",
              "--output-dir", str(out)])
        payload = json.loads(next(out.glob("*.json")).read_text())
        assert "netem" in payload["environment"]["path_note"]

    def test_sockstat_samples_are_folded_in_when_supplied(self, tmp_path):
        blob = capture_of(
            client_hello([X25519MLKEM768], [(X25519MLKEM768, 1216)]),
            server_hello(X25519MLKEM768),
        )
        cap = tmp_path / "h.pcap"
        cap.write_bytes(blob)
        sock = tmp_path / "s.csv"
        sock.write_text(
            "ts,tcp_inuse,tcp_orphan,tcp_tw,tcp_alloc,tcp_mem_pages,syn_recv,established\n"
            "1700000000.0,10,0,0,10,100,0,0\n"
            "1700000001.0,10,0,0,10,200,0,10\n"
        )
        out = tmp_path / "r"
        main([str(cap), "--server-port", str(SERVER_PORT), "--label", "pairwise",
              "--sockstat", str(sock), "--output-dir", str(out)])
        payload = json.loads(next(out.glob("*.json")).read_text())
        assert payload["environment"]["sockets"]["measurable"] is True
        assert payload["environment"]["sockets"]["peak_established"] == 10
