"""
pcap reading and TCP reassembly, tested against captures built in the test.

Every capture below is assembled byte by byte from the libpcap and IPv4/TCP
header formats, so these assertions are about the reader and nothing else. No
network, no Docker, no tcpdump.
"""

from __future__ import annotations

import struct
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "capture"))

from pcap_reader import (  # noqa: E402
    LINKTYPE_LINUX_SLL2,
    PcapFormatError,
    iter_packets,
    reassemble,
)

SERVER_PORT = 4433
CLIENT_IP, SERVER_IP = "10.0.0.2", "10.0.0.3"
CLIENT_PORT = 51000


def ip_bytes(dotted: str) -> bytes:
    return bytes(int(p) for p in dotted.split("."))


def tcp_packet(
    src: str,
    dst: str,
    sport: int,
    dport: int,
    payload: bytes,
    seq: int = 1,
    *,
    more_fragments: bool = False,
    fragment_offset: int = 0,
) -> bytes:
    tcp = (
        struct.pack("!HH", sport, dport)
        + struct.pack("!I", seq)
        + struct.pack("!I", 0)
        + bytes([5 << 4, 0x18])
        + struct.pack("!HHH", 65535, 0, 0)
        + payload
    )
    flags_frag = fragment_offset & 0x1FFF
    if more_fragments:
        flags_frag |= 0x2000
    total_len = 20 + len(tcp)
    ip = (
        bytes([0x45, 0x00])
        + struct.pack("!H", total_len)
        + struct.pack("!H", 0)
        + struct.pack("!H", flags_frag)
        + bytes([64, 6])
        + struct.pack("!H", 0)
        + ip_bytes(src)
        + ip_bytes(dst)
        + tcp
    )
    ethernet = b"\x00" * 12 + b"\x08\x00"
    return ethernet + ip


def pcap(frames: list[bytes], *, linktype: int = 1, big_endian: bool = False) -> bytes:
    endian = ">" if big_endian else "<"
    # A big-endian capture writes the SAME logical magic, byte-swapped on disk.
    # The reader detects endianness by reading those four bytes little-endian
    # and seeing 0xD4C3B2A1 -- so the fixture must pack 0xA1B2C3D4 either way.
    out = struct.pack(endian + "IHHiIII", 0xA1B2C3D4, 2, 4, 0, 0, 65535, linktype)
    for n, f in enumerate(frames):
        out += struct.pack(endian + "IIII", 1700000000 + n, 500000, len(f), len(f))
        out += f
    return out


def sll2_frame(inner_ip_frame: bytes) -> bytes:
    """Wrap an IPv4 packet in a Linux cooked v2 header.

    `inner_ip_frame` is an Ethernet frame from tcp_packet(); its 14-byte
    Ethernet header is stripped and replaced with the 20-byte SLL2 header.
    """
    ip = inner_ip_frame[14:]
    return (
        struct.pack("!H", 0x0800)  # protocol type
        + bytes(2)  # reserved
        + struct.pack("!I", 1)  # interface index
        + struct.pack("!H", 1)  # ARPHRD type
        + bytes([0])  # packet type
        + bytes([6])  # link-layer address length
        + bytes(8)  # link-layer address
        + ip
    )


def to_server(payload: bytes, seq: int = 1, **kw) -> bytes:
    return tcp_packet(CLIENT_IP, SERVER_IP, CLIENT_PORT, SERVER_PORT, payload, seq, **kw)


def to_client(payload: bytes, seq: int = 1, **kw) -> bytes:
    return tcp_packet(SERVER_IP, CLIENT_IP, SERVER_PORT, CLIENT_PORT, payload, seq, **kw)


class TestPacketIteration:
    def test_reads_ipv4_tcp_frames(self):
        pkts = list(iter_packets(pcap([to_server(b"hello"), to_client(b"world")])))
        assert len(pkts) == 2
        assert pkts[0].payload == b"hello"
        assert pkts[0].sport == CLIENT_PORT
        assert pkts[1].src == SERVER_IP

    def test_reads_big_endian_captures(self):
        pkts = list(iter_packets(pcap([to_server(b"hello")], big_endian=True)))
        assert len(pkts) == 1
        assert pkts[0].payload == b"hello"

    def test_rejects_a_file_that_is_not_a_pcap(self):
        with pytest.raises(PcapFormatError):
            list(iter_packets(b"not a pcap file at all, really"))

    def test_rejects_an_empty_file(self):
        with pytest.raises(PcapFormatError):
            list(iter_packets(b""))

    def test_skips_non_tcp_traffic_without_failing(self):
        udp = bytes(12) + b"\x08\x00" + bytes([0x45, 0, 0, 28, 0, 0, 0, 0, 64, 17, 0, 0]) + \
            ip_bytes(CLIENT_IP) + ip_bytes(SERVER_IP) + bytes(8)
        pkts = list(iter_packets(pcap([udp, to_server(b"x")])))
        assert len(pkts) == 1

    def test_reads_linux_cooked_v2_captures(self):
        # This is what `tcpdump -i any` writes on a modern kernel, and it is
        # what the live testbed produced on its first CI run. Before this was
        # handled, every packet was skipped and a real captured handshake
        # reported as "no traffic captured".
        blob = pcap(
            [sll2_frame(to_server(b"hello")), sll2_frame(to_client(b"world"))],
            linktype=LINKTYPE_LINUX_SLL2,
        )
        pkts = list(iter_packets(blob))
        assert len(pkts) == 2
        assert pkts[0].payload == b"hello"
        assert pkts[0].dport == SERVER_PORT

    def test_sll2_conversations_reassemble_normally(self):
        blob = pcap(
            [sll2_frame(to_server(b"AAA")), sll2_frame(to_client(b"BBB"))],
            linktype=LINKTYPE_LINUX_SLL2,
        )
        conv = reassemble(blob, SERVER_PORT)[0]
        assert conv.client_to_server == b"AAA"
        assert conv.server_to_client == b"BBB"

    def test_an_unsupported_linktype_raises_rather_than_reporting_no_traffic(self):
        # The failure mode this prevents: "no traffic captured" is a REAL
        # Layer B outcome (the client never connected). A capture we simply
        # cannot read must never be mistaken for one.
        blob = pcap([to_server(b"hello")], linktype=999)
        with pytest.raises(PcapFormatError, match="unsupported pcap linktype"):
            list(iter_packets(blob))

    def test_truncated_trailing_record_does_not_raise(self):
        blob = pcap([to_server(b"hello")])[:-3]
        assert isinstance(list(iter_packets(blob)), list)


class TestReassembly:
    def test_splits_a_conversation_by_direction(self):
        blob = pcap([to_server(b"AAA"), to_client(b"BBB"), to_server(b"CCC", seq=4)])
        convs = reassemble(blob, SERVER_PORT)
        assert len(convs) == 1
        c = convs[0]
        assert c.client_to_server == b"AAACCC"
        assert c.server_to_client == b"BBB"
        assert c.packets_client_to_server == 2
        assert c.packets_server_to_client == 1
        assert c.packets_total == 3

    def test_orders_payload_by_sequence_number_not_capture_order(self):
        blob = pcap([to_server(b"SECOND", seq=10), to_server(b"FIRST", seq=1)])
        assert reassemble(blob, SERVER_PORT)[0].client_to_server == b"FIRSTSECOND"

    def test_a_retransmission_does_not_duplicate_parsed_bytes(self):
        # But it still counts as a packet -- packets-per-handshake is a real
        # property of the exchange, and hiding a retransmit would understate it.
        blob = pcap([to_server(b"AAA", seq=1), to_server(b"AAA", seq=1)])
        c = reassemble(blob, SERVER_PORT)[0]
        assert c.client_to_server == b"AAA"
        assert c.packets_client_to_server == 2

    def test_counts_ip_fragments_rather_than_stitching_them(self):
        # Whether a PQC handshake fragments is one of Layer B's own outputs.
        # Silently defragmenting would erase the finding.
        blob = pcap([to_server(b"AAA", more_fragments=True), to_server(b"BBB", seq=4)])
        c = reassemble(blob, SERVER_PORT)[0]
        assert c.ip_fragments == 1

    def test_separates_two_client_connections(self):
        other = tcp_packet(CLIENT_IP, SERVER_IP, 52000, SERVER_PORT, b"ZZZ")
        blob = pcap([to_server(b"AAA"), other])
        assert len(reassemble(blob, SERVER_PORT)) == 2

    def test_ignores_traffic_on_other_ports(self):
        noise = tcp_packet(CLIENT_IP, SERVER_IP, 40000, 9999, b"noise")
        blob = pcap([noise, to_server(b"AAA")])
        convs = reassemble(blob, SERVER_PORT)
        assert len(convs) == 1
        assert convs[0].client_to_server == b"AAA"

    def test_records_wire_bytes_and_duration(self):
        blob = pcap([to_server(b"AAA"), to_client(b"BBBB")])
        c = reassemble(blob, SERVER_PORT)[0]
        assert c.wire_bytes_total > 0
        assert c.bytes_client_to_server > 0
        assert c.bytes_server_to_client > 0
        assert c.duration_seconds is not None and c.duration_seconds >= 0

    def test_segment_sizes_are_recorded_in_capture_order(self):
        blob = pcap([to_server(b"A" * 1400), to_server(b"B" * 200, seq=1401)])
        assert reassemble(blob, SERVER_PORT)[0].segment_sizes == [1400, 200]

    def test_an_empty_capture_yields_no_conversations(self):
        assert reassemble(pcap([]), SERVER_PORT) == []
