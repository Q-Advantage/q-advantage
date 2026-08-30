"""
Wire-parsing tests, built from synthetic TLS bytes.

These need no Docker, no network and no liboqs: the input is a handshake
assembled byte by byte in the test, which means the assertions are about the
parser and nothing else. That is the point -- the claim this module makes is
"we read the negotiated group from the wire", and a test that stood up a real
stack would be testing the stack.

The builders below construct genuine RFC 8446 record and message framing. They
are fixtures, not measurements: no timing, no throughput, nothing that could be
mistaken for a Q-Shield figure.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "capture"))

from tls_wire import (  # noqa: E402
    EXT_KEY_SHARE,
    EXT_SUPPORTED_GROUPS,
    HELLO_RETRY_REQUEST_RANDOM,
    HandshakeFacts,
    classify_outcome,
    group_is_verified,
    group_name,
    parse_handshake,
)

X25519 = 0x001D
SECP256R1 = 0x0017
X25519MLKEM768 = 0x11EC
UNKNOWN_GROUP = 0x9A9A


def u16(v: int) -> bytes:
    return bytes([(v >> 8) & 0xFF, v & 0xFF])


def ext(etype: int, body: bytes) -> bytes:
    return u16(etype) + u16(len(body)) + body


def supported_groups_ext(groups: list[int]) -> bytes:
    payload = b"".join(u16(g) for g in groups)
    return ext(EXT_SUPPORTED_GROUPS, u16(len(payload)) + payload)


def client_key_share_ext(shares: list[tuple[int, int]]) -> bytes:
    """shares: list of (group, key_length). Key material is filler."""
    payload = b""
    for group, klen in shares:
        payload += u16(group) + u16(klen) + (b"\xAB" * klen)
    return ext(EXT_KEY_SHARE, u16(len(payload)) + payload)


def server_key_share_ext(group: int, klen: int = 32) -> bytes:
    return ext(EXT_KEY_SHARE, u16(group) + u16(klen) + (b"\xCD" * klen))


def handshake_msg(hs_type: int, body: bytes) -> bytes:
    n = len(body)
    return bytes([hs_type, (n >> 16) & 0xFF, (n >> 8) & 0xFF, n & 0xFF]) + body


def record(body: bytes, ctype: int = 0x16) -> bytes:
    return bytes([ctype, 0x03, 0x03]) + u16(len(body)) + body


def client_hello(groups: list[int], shares: list[tuple[int, int]] | None = None) -> bytes:
    exts = supported_groups_ext(groups)
    if shares:
        exts += client_key_share_ext(shares)
    body = (
        b"\x03\x03"
        + (b"\x11" * 32)  # random
        + b"\x00"  # session id length
        + u16(2)
        + b"\x13\x01"  # one cipher suite
        + b"\x01\x00"  # compression methods
        + u16(len(exts))
        + exts
    )
    return record(handshake_msg(0x01, body))


def server_hello(group: int | None, *, retry: bool = False) -> bytes:
    exts = server_key_share_ext(group) if group is not None else b""
    if retry and group is not None:
        # HelloRetryRequest carries only the selected group, no share.
        exts = ext(EXT_KEY_SHARE, u16(group))
    random = HELLO_RETRY_REQUEST_RANDOM if retry else (b"\x22" * 32)
    body = (
        b"\x03\x03"
        + random
        + b"\x00"  # session id length
        + b"\x13\x01"  # cipher suite
        + b"\x00"  # compression method
        + u16(len(exts))
        + exts
    )
    return record(handshake_msg(0x02, body))


class TestNegotiatedGroupComesFromTheWire:
    def test_reads_the_group_the_server_actually_chose(self):
        facts = parse_handshake(
            client_hello([X25519MLKEM768, X25519], [(X25519MLKEM768, 1216)]),
            server_hello(X25519MLKEM768),
        )
        assert facts.server_hello_seen
        assert facts.negotiated_group == X25519MLKEM768
        d = facts.as_dict()
        assert d["negotiated_group"]["name"] == "X25519MLKEM768"
        # The provenance of this fact is itself published, so no consumer has
        # to take on trust that it did not come from a log line.
        assert d["negotiated_group"]["source"] == "wire bytes (ServerHello key_share extension)"

    def test_reports_what_the_client_offered_in_order(self):
        facts = parse_handshake(
            client_hello([X25519MLKEM768, X25519, SECP256R1]),
            server_hello(X25519),
        )
        assert facts.client_supported_groups == [X25519MLKEM768, X25519, SECP256R1]

    def test_reads_multiple_client_key_shares(self):
        facts = parse_handshake(
            client_hello([X25519MLKEM768, X25519], [(X25519MLKEM768, 1216), (X25519, 32)]),
            server_hello(X25519),
        )
        assert facts.client_key_share_groups == [X25519MLKEM768, X25519]

    def test_a_server_choosing_a_group_the_client_never_offered_is_still_reported(self):
        # We report the wire, not what we expected the wire to say.
        facts = parse_handshake(client_hello([X25519]), server_hello(SECP256R1))
        assert facts.negotiated_group == SECP256R1


class TestUnknownCodePointsAreNeverGuessed:
    def test_unknown_group_renders_as_hex(self):
        assert group_name(UNKNOWN_GROUP) == "0x9a9a"

    def test_unknown_group_is_not_marked_verified(self):
        assert group_is_verified(UNKNOWN_GROUP) is False

    def test_pqc_code_points_are_named_but_flagged_unverified(self):
        # The identity of the hybrid code points is #unverified pending a
        # primary-source check. Naming them while claiming they are confirmed
        # would be exactly the uncited-identity failure CLAUDE.md forbids.
        assert group_name(X25519MLKEM768) == "X25519MLKEM768"
        assert group_is_verified(X25519MLKEM768) is False
        assert group_is_verified(X25519) is True

    def test_every_reported_group_carries_its_verification_state(self):
        facts = parse_handshake(
            client_hello([X25519MLKEM768, X25519]), server_hello(X25519MLKEM768)
        )
        d = facts.as_dict()
        for entry in d["client_supported_groups"]:
            assert "identity_verified" in entry
        assert d["negotiated_group"]["identity_verified"] is False


class TestDowngradeIsALabelledOutcome:
    def test_pqc_offered_but_classical_chosen_is_named_a_downgrade(self):
        # Osborne's third finding: a silent downgrade is invisible when it is
        # inferred from the absence of a signal. It must be a positive result.
        facts = parse_handshake(
            client_hello([X25519MLKEM768, X25519], [(X25519MLKEM768, 1216)]),
            server_hello(X25519),
        )
        out = classify_outcome(facts)
        assert out["outcome"] == "downgraded_to_classical"
        assert "x25519" in out["detail"]

    def test_a_clean_rejection_is_distinguished_from_a_downgrade(self):
        facts = parse_handshake(client_hello([X25519MLKEM768]), b"")
        out = classify_outcome(facts)
        assert out["outcome"] == "no_server_hello"
        assert "not a silent downgrade" in out["detail"]

    def test_successful_pqc_negotiation_is_not_flagged(self):
        facts = parse_handshake(
            client_hello([X25519MLKEM768], [(X25519MLKEM768, 1216)]),
            server_hello(X25519MLKEM768),
        )
        assert classify_outcome(facts)["outcome"] == "negotiated"

    def test_a_classical_only_client_is_not_a_downgrade(self):
        # The client never asked for PQC, so choosing x25519 is just the answer.
        facts = parse_handshake(client_hello([X25519], [(X25519, 32)]), server_hello(X25519))
        assert classify_outcome(facts)["outcome"] == "negotiated"

    def test_hello_retry_request_is_its_own_outcome(self):
        facts = parse_handshake(
            client_hello([X25519MLKEM768], [(X25519MLKEM768, 1216)]),
            server_hello(X25519MLKEM768, retry=True),
        )
        assert facts.hello_retry_request is True
        assert classify_outcome(facts)["outcome"] == "negotiated_after_retry"

    def test_no_client_hello_at_all_is_named(self):
        assert classify_outcome(parse_handshake(b"", b""))["outcome"] == "no_client_hello"

    def test_server_hello_without_a_key_share_is_reported_not_assumed(self):
        facts = parse_handshake(client_hello([X25519]), server_hello(None))
        assert classify_outcome(facts)["outcome"] == "server_hello_without_key_share"


class TestStructuralObservations:
    def test_records_after_the_serverhello_are_counted_not_parsed(self):
        # Everything past the ServerHello is encrypted. Counting it is honest;
        # claiming to have read it would not be.
        stream = server_hello(X25519) + record(b"\xDE\xAD\xBE\xEF") + record(b"\xCA\xFE")
        facts = parse_handshake(client_hello([X25519]), stream)
        assert facts.unparsed_after_serverhello == 2

    def test_a_fragmented_handshake_message_is_reported(self):
        # A ClientHello claiming more bytes than its record carries. Larger PQC
        # key shares make this a real case, and fragmentation is one of
        # Layer B's own outputs -- so it is named, not silently reassembled.
        truncated = record(handshake_msg(0x01, b"\x00" * 40)[:20])
        facts = parse_handshake(truncated, b"")
        assert "ClientHello" in facts.fragmented_messages
        assert facts.client_hello_seen is False

    def test_message_sizes_are_reported_for_both_directions(self):
        facts = parse_handshake(
            client_hello([X25519MLKEM768], [(X25519MLKEM768, 1216)]),
            server_hello(X25519MLKEM768),
        )
        assert facts.client_hello_bytes > 1216
        assert facts.server_hello_bytes > 0

    def test_non_handshake_records_are_ignored(self):
        # An alert record (content type 21) is not a handshake message.
        stream = record(b"\x02\x28", ctype=0x15) + server_hello(X25519)
        facts = parse_handshake(client_hello([X25519]), stream)
        assert facts.negotiated_group == X25519


class TestMalformedInputNeverCrashes:
    """A capture is untrusted input. The parser reports less; it never raises."""

    @pytest.mark.parametrize(
        "blob",
        [
            b"",
            b"\x16",
            b"\x16\x03\x03",
            b"\x16\x03\x03\xff\xff",  # record claims more than it carries
            b"\x16\x03\x03\x00\x02\x01\x00",  # handshake header truncated
            bytes(range(256)),
        ],
    )
    def test_does_not_raise(self, blob):
        facts = parse_handshake(blob, blob)
        assert isinstance(facts, HandshakeFacts)
        assert isinstance(classify_outcome(facts), dict)

    def test_truncated_extension_block_stops_cleanly(self):
        exts = supported_groups_ext([X25519])[:-1]  # cut one byte
        body = (
            b"\x03\x03" + (b"\x11" * 32) + b"\x00" + u16(2) + b"\x13\x01" + b"\x01\x00"
            + u16(len(exts) + 1) + exts
        )
        facts = parse_handshake(record(handshake_msg(0x01, body)), b"")
        assert facts.client_supported_groups == []
