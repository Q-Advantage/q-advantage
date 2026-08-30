"""
Derived measurements, tested against captures built in the test.

The two that matter most are the ones Q-Shield currently publishes as
unmeasurable: the initial-congestion-window cliff, and connections per core
over live sockets.
"""

from __future__ import annotations

import struct
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "capture"))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from analysis import (  # noqa: E402
    DEFAULT_INITCWND_BYTES,
    concurrency_summary,
    initcwnd_analysis,
    rtt_estimate,
    round_trips,
    server_flights,
)
from pcap_reader import reassemble  # noqa: E402
from test_pcap_reader import (  # noqa: E402
    CLIENT_IP,
    CLIENT_PORT,
    SERVER_IP,
    SERVER_PORT,
    ip_bytes,
    pcap,
)

SYN = 0x02
ACK = 0x10
PSH = 0x08


def packet(
    src: str,
    dst: str,
    sport: int,
    dport: int,
    payload: bytes = b"",
    seq: int = 1,
    ack: int = 1,
    flags: int = ACK,
) -> bytes:
    tcp = (
        struct.pack("!HH", sport, dport)
        + struct.pack("!I", seq)
        + struct.pack("!I", ack)
        + bytes([5 << 4, flags])
        + struct.pack("!HHH", 65535, 0, 0)
        + payload
    )
    total_len = 20 + len(tcp)
    ip = (
        bytes([0x45, 0x00])
        + struct.pack("!H", total_len)
        + struct.pack("!H", 0)
        + struct.pack("!H", 0)
        + bytes([64, 6])
        + struct.pack("!H", 0)
        + ip_bytes(src)
        + ip_bytes(dst)
        + tcp
    )
    return bytes(12) + b"\x08\x00" + ip


def up(payload: bytes = b"", seq: int = 1, flags: int = ACK, port: int = CLIENT_PORT) -> bytes:
    return packet(CLIENT_IP, SERVER_IP, port, SERVER_PORT, payload, seq, flags=flags)


def down(payload: bytes = b"", seq: int = 1, flags: int = ACK, port: int = CLIENT_PORT) -> bytes:
    return packet(SERVER_IP, CLIENT_IP, SERVER_PORT, port, payload, seq, flags=flags)


def conv_of(frames: list[bytes]):
    return reassemble(pcap(frames), SERVER_PORT)[0]


class TestServerFlights:
    def test_a_flight_ends_where_the_client_acknowledges(self):
        c = conv_of([
            down(b"A" * 1000, seq=1),
            down(b"B" * 1000, seq=1001),
            up(b"", flags=ACK),          # pure ACK closes the flight
            down(b"C" * 500, seq=2001),
        ])
        flights = server_flights(c)
        assert [f.bytes_sent for f in flights] == [2000, 500]
        assert flights[0].packets == 2

    def test_a_client_packet_carrying_data_does_not_close_a_flight(self):
        # Still sending is not the same as having acknowledged.
        c = conv_of([
            down(b"A" * 1000, seq=1),
            up(b"request", seq=1),
            down(b"B" * 1000, seq=1001),
        ])
        assert [f.bytes_sent for f in server_flights(c)] == [2000]

    def test_an_unacknowledged_tail_is_still_reported(self):
        c = conv_of([down(b"A" * 700, seq=1)])
        flights = server_flights(c)
        assert flights[0].bytes_sent == 700
        assert flights[0].ack_delay_seconds is None


class TestInitcwndCliff:
    """The measurement network-calculator-spec.md carries as qualitative."""

    def test_a_small_flight_does_not_cross_the_window(self):
        c = conv_of([down(b"A" * 4000, seq=1), up(b"", flags=ACK)])
        a = initcwnd_analysis(c)
        assert a["measurable"] is True
        assert a["exceeded_initcwnd"] is False
        assert a["first_flight_bytes"] == 4000
        assert a["headroom_bytes"] == DEFAULT_INITCWND_BYTES - 4000

    def test_a_large_flight_crosses_it(self):
        c = conv_of([down(b"A" * 9000, seq=1), down(b"B" * 9000, seq=9001), up(b"", flags=ACK)])
        a = initcwnd_analysis(c)
        assert a["exceeded_initcwnd"] is True
        assert a["first_flight_bytes"] == 18000
        assert a["headroom_bytes"] < 0

    def test_the_assumed_window_is_always_reported_with_the_verdict(self):
        # initcwnd is a tunable default, not a property of the network. A
        # verdict without its assumption is not reproducible.
        a = initcwnd_analysis(conv_of([down(b"A" * 100, seq=1), up(b"", flags=ACK)]))
        assert a["assumed_initcwnd_bytes"] == DEFAULT_INITCWND_BYTES
        assert "RFC 6928" in a["assumed_initcwnd_note"]

    def test_a_custom_window_changes_the_verdict_and_is_recorded(self):
        c = conv_of([down(b"A" * 5000, seq=1), up(b"", flags=ACK)])
        a = initcwnd_analysis(c, initcwnd_bytes=4000)
        assert a["exceeded_initcwnd"] is True
        assert a["assumed_initcwnd_bytes"] == 4000

    def test_no_server_data_is_not_measurable_rather_than_no_cliff(self):
        # Absence of evidence must not render as evidence of absence.
        a = initcwnd_analysis(conv_of([up(b"hello", seq=1)]))
        assert a["measurable"] is False
        assert "absence of evidence" in a["reason"]
        assert "exceeded_initcwnd" not in a


class TestRoundTrips:
    def test_counts_direction_changes_not_a_protocol_model(self):
        c = conv_of([up(b"a", seq=1), down(b"b", seq=1), up(b"c", seq=2), down(b"d", seq=2)])
        r = round_trips(c)
        assert r["direction_changes"] == 3
        assert r["approx_round_trips"] == 2

    def test_a_one_way_exchange_has_no_direction_change(self):
        assert round_trips(conv_of([up(b"a", seq=1)]))["direction_changes"] == 0

    def test_pure_acks_do_not_count_as_a_turn(self):
        c = conv_of([down(b"b", seq=1), up(b"", flags=ACK), down(b"c", seq=2)])
        assert round_trips(c)["direction_changes"] == 0


class TestRttEstimate:
    def test_measures_syn_to_synack_and_says_where_it_looked(self):
        c = conv_of([up(b"", flags=SYN), down(b"", flags=SYN | ACK)])
        r = rtt_estimate(c)
        assert r["measurable"] is True
        assert r["syn_to_synack_seconds"] >= 0
        assert r["source"] == "TCP SYN to SYN/ACK"
        # The correction the first real run forced: this is NOT a round trip.
        # With 50 ms injected on the client egress it read 40 microseconds,
        # because the delay happened before the SYN reached the server.
        assert r["is_full_round_trip"] is False
        assert "server" in r["observed_at"]
        assert "invisible from this end" in r["note"]

    def test_it_never_calls_a_one_sided_observation_a_round_trip(self):
        r = rtt_estimate(conv_of([up(b"", flags=SYN), down(b"", flags=SYN | ACK)]))
        assert "rtt_seconds" not in r

    def test_a_capture_that_began_mid_connection_says_so(self):
        # Estimating from a later exchange would fold server think time into a
        # latency number.
        r = rtt_estimate(conv_of([up(b"data", seq=1), down(b"reply", seq=1)]))
        assert r["measurable"] is False
        assert "mid-connection" in r["reason"]
        assert "rtt_seconds" not in r


class TestConcurrencySummary:
    def test_aggregates_many_connections(self):
        frames = []
        for i in range(5):
            port = 51000 + i
            frames.append(up(b"", flags=SYN, port=port))
            frames.append(down(b"", flags=SYN | ACK, port=port))
            frames.append(up(b"hello", seq=1, port=port))
            frames.append(down(b"world", seq=1, port=port))
        convs = reassemble(pcap(frames), SERVER_PORT)
        s = concurrency_summary(convs)
        assert s["connections"] == 5
        assert s["measurable"] is True
        assert s["duration_seconds"]["median"] >= 0
        assert s["packets_total"] == 20

    def test_the_label_refuses_to_be_confused_with_layer_a(self):
        # layer-b-spec.md section 7: two different numbers must never share one
        # casual name. This is enforced in the payload, not just in prose.
        convs = reassemble(pcap([up(b"a", seq=1), down(b"b", seq=1)]), SERVER_PORT)
        s = concurrency_summary(convs)
        assert s["label"] == "connections per core (live sockets)"
        assert "cryptographic throughput" in s["label_note"]

    def test_no_connections_is_reported_not_zeroed(self):
        s = concurrency_summary([])
        assert s["measurable"] is False
        assert s["connections"] == 0
