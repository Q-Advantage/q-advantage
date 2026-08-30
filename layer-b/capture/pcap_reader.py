"""
A minimal libpcap reader and TCP reassembler.

WHY NOT scapy OR dpkt. Layer B's whole claim is that its facts come from the
wire, and METHODOLOGY.md already promises a reader can reproduce our numbers.
Both are easier to honour with a dependency-free reader of a well-specified
file format than with a large third-party parser whose version becomes another
thing to pin and explain. The format handled here is the classic libpcap file,
which is what `tcpdump -w` writes.

Scope, stated rather than discovered later: IPv4 + TCP only, no IPv6, no
reassembly of out-of-order or retransmitted segments beyond sequence-number
ordering, and no defragmentation of IP fragments -- fragments are COUNTED and
reported, because whether a PQC handshake fragments is one of Layer B's own
outputs and quietly stitching them back together would erase the finding.
"""

from __future__ import annotations

import struct
from dataclasses import dataclass, field

PCAP_MAGIC_LE = 0xA1B2C3D4
PCAP_MAGIC_BE = 0xD4C3B2A1
#: Nanosecond-resolution variants of the same format.
PCAP_MAGIC_LE_NS = 0xA1B23C4D
PCAP_MAGIC_BE_NS = 0x4D3CB2A1

LINKTYPE_ETHERNET = 1
LINKTYPE_LINUX_SLL = 113
#: What `tcpdump -i any` actually writes on a modern Linux kernel. Found the
#: hard way: the first CI run of the live testbed captured a real handshake and
#: reported "no traffic", because this linktype was unhandled and every packet
#: was silently skipped. A capture format we cannot read must never look like
#: an absence of traffic.
LINKTYPE_LINUX_SLL2 = 276
LINKTYPE_RAW = 101
LINKTYPE_NULL = 0

SUPPORTED_LINKTYPES = frozenset(
    {LINKTYPE_ETHERNET, LINKTYPE_LINUX_SLL, LINKTYPE_LINUX_SLL2, LINKTYPE_RAW, LINKTYPE_NULL}
)


@dataclass
class Packet:
    timestamp: float
    src: str
    dst: str
    sport: int
    dport: int
    payload: bytes
    seq: int
    #: Total captured length on the wire, for packets-per-handshake accounting.
    wire_bytes: int
    ip_fragmented: bool


@dataclass
class Conversation:
    """One TCP connection, split by direction."""

    client: tuple[str, int]
    server: tuple[str, int]
    client_to_server: bytes = b""
    server_to_client: bytes = b""
    packets_client_to_server: int = 0
    packets_server_to_client: int = 0
    bytes_client_to_server: int = 0
    bytes_server_to_client: int = 0
    ip_fragments: int = 0
    first_timestamp: float | None = None
    last_timestamp: float | None = None
    #: Payload lengths in capture order, so a caller can see MTU-sized bursts.
    segment_sizes: list[int] = field(default_factory=list)

    @property
    def packets_total(self) -> int:
        return self.packets_client_to_server + self.packets_server_to_client

    @property
    def wire_bytes_total(self) -> int:
        return self.bytes_client_to_server + self.bytes_server_to_client

    @property
    def duration_seconds(self) -> float | None:
        if self.first_timestamp is None or self.last_timestamp is None:
            return None
        return self.last_timestamp - self.first_timestamp


class PcapFormatError(ValueError):
    """The file is not a libpcap capture we can read."""


def _link_offset(linktype: int, data: bytes) -> int | None:
    """Bytes to skip to reach the IP header, or None if unsupported."""
    if linktype == LINKTYPE_ETHERNET:
        if len(data) < 14:
            return None
        ethertype = struct.unpack("!H", data[12:14])[0]
        if ethertype != 0x0800:  # IPv4 only, by stated scope
            return None
        return 14
    if linktype == LINKTYPE_LINUX_SLL:
        if len(data) < 16:
            return None
        if struct.unpack("!H", data[14:16])[0] != 0x0800:
            return None
        return 16
    if linktype == LINKTYPE_LINUX_SLL2:
        # Linux cooked v2: protocol type first, then a 20-byte header total
        # (reserved, ifindex, ARPHRD type, packet type, address length,
        # address). See the libpcap LINKTYPE_LINUX_SLL2 definition.
        if len(data) < 20:
            return None
        if struct.unpack("!H", data[0:2])[0] != 0x0800:
            return None
        return 20
    if linktype == LINKTYPE_RAW:
        return 0
    if linktype == LINKTYPE_NULL:
        return 4
    return None


def iter_packets(blob: bytes):
    """Yield Packet for every IPv4/TCP frame in a libpcap blob."""
    if len(blob) < 24:
        raise PcapFormatError("capture is shorter than a pcap file header")

    magic = struct.unpack("<I", blob[:4])[0]
    if magic in (PCAP_MAGIC_LE, PCAP_MAGIC_LE_NS):
        endian = "<"
    elif magic in (PCAP_MAGIC_BE, PCAP_MAGIC_BE_NS):
        endian = ">"
    else:
        raise PcapFormatError("unrecognised pcap magic 0x%08x" % magic)
    nanos = magic in (PCAP_MAGIC_LE_NS, PCAP_MAGIC_BE_NS)

    linktype = struct.unpack(endian + "I", blob[20:24])[0]
    if linktype not in SUPPORTED_LINKTYPES:
        # Refusing loudly matters more than it looks. An unreadable capture
        # that yields zero packets is indistinguishable from a handshake that
        # never happened, and "no traffic" is a real Layer B outcome -- so a
        # format we cannot parse must raise rather than quietly become one.
        raise PcapFormatError(
            "unsupported pcap linktype %d. Supported: %s"
            % (linktype, sorted(SUPPORTED_LINKTYPES))
        )
    i = 24

    while i + 16 <= len(blob):
        ts_sec, ts_frac, incl_len, orig_len = struct.unpack(endian + "IIII", blob[i : i + 16])
        i += 16
        frame = blob[i : i + incl_len]
        if len(frame) < incl_len:
            break  # truncated file; report what we have
        i += incl_len

        timestamp = ts_sec + (ts_frac / 1e9 if nanos else ts_frac / 1e6)

        off = _link_offset(linktype, frame)
        if off is None or len(frame) < off + 20:
            continue

        ip = frame[off:]
        version_ihl = ip[0]
        if (version_ihl >> 4) != 4:
            continue
        ihl = (version_ihl & 0x0F) * 4
        if len(ip) < ihl + 20:
            continue
        protocol = ip[9]
        if protocol != 6:  # TCP
            continue

        flags_frag = struct.unpack("!H", ip[6:8])[0]
        more_fragments = bool(flags_frag & 0x2000)
        fragment_offset = flags_frag & 0x1FFF
        ip_fragmented = more_fragments or fragment_offset != 0

        src = ".".join(str(b) for b in ip[12:16])
        dst = ".".join(str(b) for b in ip[16:20])

        tcp = ip[ihl:]
        sport, dport = struct.unpack("!HH", tcp[0:4])
        seq = struct.unpack("!I", tcp[4:8])[0]
        data_offset = (tcp[12] >> 4) * 4
        if data_offset < 20 or len(tcp) < data_offset:
            continue
        payload = tcp[data_offset:]

        yield Packet(
            timestamp=timestamp,
            src=src,
            dst=dst,
            sport=sport,
            dport=dport,
            payload=payload,
            seq=seq,
            wire_bytes=orig_len,
            ip_fragmented=ip_fragmented,
        )


def reassemble(blob: bytes, server_port: int) -> list[Conversation]:
    """
    Group packets into TCP conversations, oriented by the server's port.

    Payload is ordered by sequence number and duplicate sequence numbers are
    dropped, so a retransmission does not double-count bytes into the parsed
    stream. Retransmitted PACKETS still count toward packets-per-handshake,
    because that is a real property of the exchange.
    """
    convs: dict[tuple, Conversation] = {}
    segments: dict[tuple, dict[int, bytes]] = {}

    for pkt in iter_packets(blob):
        if pkt.dport == server_port:
            client, server, to_server = (pkt.src, pkt.sport), (pkt.dst, pkt.dport), True
        elif pkt.sport == server_port:
            client, server, to_server = (pkt.dst, pkt.dport), (pkt.src, pkt.sport), False
        else:
            continue

        key = (client, server)
        conv = convs.get(key)
        if conv is None:
            conv = Conversation(client=client, server=server)
            convs[key] = conv
            segments[(key, True)] = {}
            segments[(key, False)] = {}

        if conv.first_timestamp is None:
            conv.first_timestamp = pkt.timestamp
        conv.last_timestamp = pkt.timestamp

        if pkt.ip_fragmented:
            conv.ip_fragments += 1

        if to_server:
            conv.packets_client_to_server += 1
            conv.bytes_client_to_server += pkt.wire_bytes
        else:
            conv.packets_server_to_client += 1
            conv.bytes_server_to_client += pkt.wire_bytes

        if pkt.payload:
            conv.segment_sizes.append(len(pkt.payload))
            segments[(key, to_server)].setdefault(pkt.seq, pkt.payload)

    for key, conv in convs.items():
        conv.client_to_server = b"".join(
            segments[(key, True)][s] for s in sorted(segments[(key, True)])
        )
        conv.server_to_client = b"".join(
            segments[(key, False)][s] for s in sorted(segments[(key, False)])
        )

    return list(convs.values())
