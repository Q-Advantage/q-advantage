"""
TLS 1.3 handshake facts, read from wire bytes.

THE RULE THIS MODULE ENFORCES. layer-b-spec.md section 4 makes Osborne's first
finding a binding requirement rather than a note: a stack's own report of what
it negotiated is ambiguous, and an instrument that trusts it reproduces the
exact telemetry gap it exists to expose. So nothing here reads a log line, an
s_client banner, or a language-level API accessor. Every fact is parsed from
the bytes that crossed the wire.

Scope, deliberately narrow: TLS 1.3 over TCP, unencrypted handshake records
only (ClientHello and ServerHello, which precede the key change). Everything
after the ServerHello is encrypted and is not parsed. That is a structural
limit of observing a real handshake, not an omission, and the count of
unparsed records is reported rather than passed over in silence.

No third party's traffic is ever an input here: both endpoints are containers
we control (spec section 3a).
"""

from __future__ import annotations

from dataclasses import dataclass, field

# TLS record layer
CONTENT_TYPE_HANDSHAKE = 0x16

# Handshake message types
HS_CLIENT_HELLO = 0x01
HS_SERVER_HELLO = 0x02

# Extension identifiers (RFC 8446 section 4.2)
EXT_SUPPORTED_GROUPS = 0x000A
EXT_KEY_SHARE = 0x0033

# A HelloRetryRequest is a ServerHello carrying this exact random value
# (RFC 8446 section 4.1.3).
HELLO_RETRY_REQUEST_RANDOM = bytes.fromhex(
    "CF21AD74E59A6111BE1D8C021E65B891C2A211167ABB8C5E079E09E2C8A8339C"
)

# Named groups. The classical values are IANA-registered and cited in
# RFC 8446 Appendix B.3.1.4.
#
# The PQC and hybrid code points are the ones our stacks actually negotiate,
# and they are exactly the values this instrument must not get wrong. They are
# NOT yet confirmed against a primary source, so they are excluded from
# VERIFIED_GROUPS below and every parse result carries an identity_verified
# flag. A code point we cannot name is reported as its hex value, never
# guessed. See CLAUDE.md's sourcing standard.
NAMED_GROUPS: dict[int, str] = {
    0x0017: "secp256r1",
    0x0018: "secp384r1",
    0x0019: "secp521r1",
    0x001D: "x25519",
    0x001E: "x448",
    # PQC and hybrid: #unverified pending a primary-source check against the
    # IANA TLS Supported Groups registry and the pinned oqs-provider release.
    0x11EC: "X25519MLKEM768",
    0x11EB: "SecP256r1MLKEM768",
    0x11ED: "SecP384r1MLKEM1024",
}

#: Code points whose identity is confirmed against a primary source.
VERIFIED_GROUPS = frozenset({0x0017, 0x0018, 0x0019, 0x001D, 0x001E})


def group_name(code: int) -> str:
    """Name for a group code point, or its hex value when we cannot name it.

    Never guesses. An unknown code point renders as 0x1234, which is a true
    statement about the wire, where inventing a plausible name would not be.
    """
    return NAMED_GROUPS.get(code, "0x%04x" % code)


def group_is_verified(code: int) -> bool:
    """Whether this code point's identity is confirmed against a primary source."""
    return code in VERIFIED_GROUPS


def _describe(code: int) -> dict:
    return {
        "code": code,
        "name": group_name(code),
        "identity_verified": group_is_verified(code),
    }


@dataclass
class HandshakeFacts:
    """What the wire says about one TLS handshake attempt."""

    client_hello_seen: bool = False
    server_hello_seen: bool = False

    #: Groups the client offered, in offer order, as code points.
    client_supported_groups: list[int] = field(default_factory=list)
    #: Groups the client sent an actual key share for.
    client_key_share_groups: list[int] = field(default_factory=list)
    #: The group the server selected. None when no ServerHello was parsed.
    negotiated_group: int | None = None

    #: True when the server asked the client to retry with a different group.
    #: A real outcome (the client's first choice was not acceptable), not an
    #: error, and invisible to anything that only reads the final result.
    hello_retry_request: bool = False

    client_hello_bytes: int = 0
    server_hello_bytes: int = 0

    #: Handshake messages that spanned more than one TLS record.
    fragmented_messages: list[str] = field(default_factory=list)
    #: Records after the ServerHello, which are encrypted and not parsed.
    unparsed_after_serverhello: int = 0

    def as_dict(self) -> dict:
        code = self.negotiated_group
        negotiated = None
        if code is not None:
            negotiated = dict(_describe(code))
            # Stated explicitly so no consumer has to take it on trust.
            negotiated["source"] = "wire bytes (ServerHello key_share extension)"
        return {
            "client_hello_seen": self.client_hello_seen,
            "server_hello_seen": self.server_hello_seen,
            "client_supported_groups": [_describe(c) for c in self.client_supported_groups],
            "client_key_share_groups": [_describe(c) for c in self.client_key_share_groups],
            "negotiated_group": negotiated,
            "hello_retry_request": self.hello_retry_request,
            "client_hello_bytes": self.client_hello_bytes,
            "server_hello_bytes": self.server_hello_bytes,
            "fragmented_messages": list(self.fragmented_messages),
            "unparsed_after_serverhello": self.unparsed_after_serverhello,
        }


def _u16(b: bytes, i: int) -> int:
    return (b[i] << 8) | b[i + 1]


def _parse_extensions(ext: bytes) -> dict[int, bytes]:
    """Split an extensions block into {type: body}. Tolerant of truncation."""
    out: dict[int, bytes] = {}
    i = 0
    while i + 4 <= len(ext):
        etype = _u16(ext, i)
        elen = _u16(ext, i + 2)
        body = ext[i + 4 : i + 4 + elen]
        if len(body) < elen:
            # Truncated capture. Report what we have; invent nothing.
            break
        out[etype] = body
        i += 4 + elen
    return out


def _client_hello_extensions(msg: bytes) -> dict[int, bytes]:
    """Extensions from a ClientHello body (after the 4-byte handshake header)."""
    i = 2 + 32  # legacy_version + random
    if i >= len(msg):
        return {}
    sid_len = msg[i]
    i += 1 + sid_len
    if i + 2 > len(msg):
        return {}
    cs_len = _u16(msg, i)
    i += 2 + cs_len
    if i >= len(msg):
        return {}
    comp_len = msg[i]
    i += 1 + comp_len
    if i + 2 > len(msg):
        return {}
    ext_len = _u16(msg, i)
    i += 2
    return _parse_extensions(msg[i : i + ext_len])


def _server_hello_extensions(msg: bytes) -> tuple[dict[int, bytes], bytes]:
    """Extensions and the 32-byte random from a ServerHello body."""
    i = 2  # legacy_version
    random = msg[i : i + 32]
    i += 32
    if i >= len(msg):
        return {}, random
    sid_len = msg[i]
    i += 1 + sid_len
    i += 2  # cipher_suite
    i += 1  # legacy_compression_method
    if i + 2 > len(msg):
        return {}, random
    ext_len = _u16(msg, i)
    i += 2
    return _parse_extensions(msg[i : i + ext_len]), random


def _groups_from_supported_groups(body: bytes) -> list[int]:
    if len(body) < 2:
        return []
    listed = _u16(body, 0)
    usable = min(listed, len(body) - 2)
    return [_u16(body, 2 + k) for k in range(0, usable - (usable % 2), 2)]


def _groups_from_client_key_share(body: bytes) -> list[int]:
    if len(body) < 2:
        return []
    total = _u16(body, 0)
    out: list[int] = []
    i = 2
    end = min(2 + total, len(body))
    while i + 4 <= end:
        out.append(_u16(body, i))
        share_len = _u16(body, i + 2)
        i += 4 + share_len
    return out


def parse_handshake(client_to_server: bytes, server_to_client: bytes) -> HandshakeFacts:
    """
    Read handshake facts from the two directions of one TCP conversation.

    Both arguments are the reassembled TCP payload for that direction. Records
    are walked in order; anything after the ServerHello is encrypted and only
    counted.
    """
    facts = HandshakeFacts()

    for direction, data in (("client", client_to_server), ("server", server_to_client)):
        i = 0
        seen_server_hello = False
        while i + 5 <= len(data):
            ctype = data[i]
            rec_len = _u16(data, i + 3)
            body = data[i + 5 : i + 5 + rec_len]
            i += 5 + rec_len

            if ctype != CONTENT_TYPE_HANDSHAKE:
                continue
            if seen_server_hello:
                facts.unparsed_after_serverhello += 1
                continue
            if len(body) < 4:
                continue

            hs_type = body[0]
            hs_len = (body[1] << 16) | (body[2] << 8) | body[3]
            msg = body[4 : 4 + hs_len]

            # A handshake message longer than the record that carried it was
            # split across records. Reported rather than silently reassembled,
            # because fragmentation is itself one of Layer B's outputs.
            if len(msg) < hs_len:
                name = {
                    HS_CLIENT_HELLO: "ClientHello",
                    HS_SERVER_HELLO: "ServerHello",
                }.get(hs_type, "handshake_type_%d" % hs_type)
                if name not in facts.fragmented_messages:
                    facts.fragmented_messages.append(name)
                continue

            if hs_type == HS_CLIENT_HELLO and direction == "client":
                facts.client_hello_seen = True
                facts.client_hello_bytes = hs_len + 4
                ext = _client_hello_extensions(msg)
                if EXT_SUPPORTED_GROUPS in ext:
                    facts.client_supported_groups = _groups_from_supported_groups(
                        ext[EXT_SUPPORTED_GROUPS]
                    )
                if EXT_KEY_SHARE in ext:
                    facts.client_key_share_groups = _groups_from_client_key_share(
                        ext[EXT_KEY_SHARE]
                    )

            elif hs_type == HS_SERVER_HELLO and direction == "server":
                facts.server_hello_seen = True
                facts.server_hello_bytes = hs_len + 4
                ext, random = _server_hello_extensions(msg)
                if random == HELLO_RETRY_REQUEST_RANDOM:
                    facts.hello_retry_request = True
                if EXT_KEY_SHARE in ext:
                    body_ks = ext[EXT_KEY_SHARE]
                    if len(body_ks) >= 2:
                        # In a HelloRetryRequest the key_share carries only the
                        # selected group; in a real ServerHello it carries the
                        # group followed by the server's share. Both begin with
                        # the group, which is the fact we want.
                        facts.negotiated_group = _u16(body_ks, 0)
                seen_server_hello = True

    return facts


def classify_outcome(facts: HandshakeFacts) -> dict:
    """
    Turn parsed facts into a labelled outcome.

    Downgrade and failure are FIRST-CLASS RESULTS here, not errors. spec
    section 3a's deliberate-misconfiguration mode exists to produce exactly
    this dataset, and Osborne's third finding is that a silent downgrade is
    invisible when it is inferred from the absence of a signal. So every case
    below is named, including the one where nothing was negotiated at all.
    """
    if not facts.client_hello_seen:
        return {
            "outcome": "no_client_hello",
            "detail": "No ClientHello was captured. The client never reached the server.",
        }
    if not facts.server_hello_seen:
        return {
            "outcome": "no_server_hello",
            "detail": (
                "The client offered groups but no ServerHello was captured. The server "
                "rejected the handshake rather than negotiating a weaker option -- a clean "
                "failure, not a silent downgrade."
            ),
        }

    offered = facts.client_key_share_groups or facts.client_supported_groups
    chosen = facts.negotiated_group

    if chosen is None:
        return {
            "outcome": "server_hello_without_key_share",
            "detail": (
                "A ServerHello was captured with no key_share extension, so no group can be "
                "read from the wire. Reported rather than assumed."
            ),
        }

    pqc_offered = [g for g in offered if g not in VERIFIED_GROUPS]
    chosen_is_classical = chosen in VERIFIED_GROUPS

    if pqc_offered and chosen_is_classical:
        return {
            "outcome": "downgraded_to_classical",
            "detail": (
                "The client offered %d post-quantum or hybrid group(s) and the server chose "
                "%s, a classical group. Read from the ServerHello key_share on the wire, not "
                "from either side's own report."
            )
            % (len(pqc_offered), group_name(chosen)),
        }

    if facts.hello_retry_request:
        return {
            "outcome": "negotiated_after_retry",
            "detail": (
                "The server issued a HelloRetryRequest before settling on %s. The handshake "
                "succeeded, but it cost an extra round trip."
            )
            % group_name(chosen),
        }

    return {
        "outcome": "negotiated",
        "detail": "Negotiated %s." % group_name(chosen),
    }
