"""
What happens when a post-quantum-sized token meets a front door's default limits.

WHY THIS EXISTS. `qshield-update-spec.md` §15 Tier 2's application-compatibility
item asks what breaks when real software meets oversized post-quantum artifacts.
The JOSE track established that an ML-DSA-65 token is roughly 4.7 KB and an
ML-DSA-87 token roughly 6.5 KB. This asks the next question, which no size
measurement can answer: does the software in front of an application accept
that, reject it, or drop the connection -- and if it rejects it, does it say
why?

WHY "DOES IT SAY WHY" IS THE FINDING. A rejection with `431 Request Header
Fields Too Large` costs an engineer about four seconds. A silent connection
reset, or a bare `400 Bad Request`, costs a day, and it is the kind of thing
that shows up in a failed migration rather than in a benchmark chart. Both are
"it broke". Only one of them is survivable, and the difference is invisible
unless somebody actually sends the request.

WHAT IS UNDER TEST. Not the algorithms -- they do not appear here at all. The
token is a byte string of a MEASURED length, and what is being measured is the
receiving software's behaviour at that length. That means these results stay
true regardless of which post-quantum scheme wins, and it means the probe needs
no crypto library.

WHAT THIS DOES NOT CLAIM. Every limit exercised is a configurable default. A
rejection here is not a statement that the product is unsuitable; it is a
statement about what happens to somebody who deploys it without changing
anything, which is what most people do.
"""

from __future__ import annotations

import socket
import time

#: Real JOSE token sizes, in bytes, from the composed JOSE track.
#:
#: Carried as data rather than recomputed so this probe needs no crypto library
#: and no liboqs. Each is the measured size of a real signed token; the source
#: track is named in the result so a reader can trace it.
TOKEN_SIZES = {
    "ES256 (ECDSA-P256)": 414,
    "PS256 (RSA-2048)": 660,
    "ML-DSA-44": 3545,
    "ML-DSA-65": 4730,
    "ML-DSA-87": 6488,
}

#: Status codes that name the actual problem.
#:
#: 431 is the specific one (RFC 6585). 413 is close enough to be actionable.
#: Everything else -- 400 especially -- tells an engineer that something is
#: wrong without telling them what, which is the failure mode worth measuring.
SPECIFIC_STATUSES = {413, 431}

CONNECT_TIMEOUT_S = 5.0
READ_TIMEOUT_S = 10.0


def build_request(host: str, token_bytes: int, path: str = "/") -> bytes:
    """
    An HTTP/1.1 request carrying a bearer token of exactly `token_bytes`.

    The token is filler of the right length rather than a real signed token:
    what is under test is the receiving software's size handling, and a real
    signature would make the probe depend on a crypto library for no gain. The
    LENGTH is real and traceable; the bytes are not pretending to be a
    signature.
    """
    token = "A" * token_bytes
    return (
        "GET %s HTTP/1.1\r\n"
        "Host: %s\r\n"
        "Authorization: Bearer %s\r\n"
        "Connection: close\r\n"
        "\r\n" % (path, host, token)
    ).encode()


def parse_status(raw: bytes) -> int | None:
    """The status code from a response, or None if there is not one to read."""
    if not raw.startswith(b"HTTP/"):
        return None
    try:
        return int(raw.split(b" ", 2)[1])
    except (IndexError, ValueError):
        return None


def probe(host: str, port: int, token_bytes: int) -> dict:
    """
    Send one request and report exactly what came back.

    Every outcome is a LABELLED outcome. In particular there is no branch that
    reports success because nothing bad was observed: a connection that closes
    with no response is `connection_closed_without_response`, which is a finding
    rather than an absence of one.
    """
    started = time.monotonic()
    raw = b""
    try:
        with socket.create_connection((host, port), timeout=CONNECT_TIMEOUT_S) as sock:
            sock.settimeout(READ_TIMEOUT_S)
            sock.sendall(build_request(host, token_bytes))
            while True:
                chunk = sock.recv(4096)
                if not chunk:
                    break
                raw += chunk
                # The status line is all that is needed and some servers hold
                # the connection open for the body.
                if len(raw) > 2048:
                    break
    except socket.timeout:
        return {
            "outcome": "timeout",
            "status": None,
            "detail": "no response within %.0fs" % READ_TIMEOUT_S,
            "names_the_problem": False,
            "elapsed_s": round(time.monotonic() - started, 3),
        }
    except (ConnectionResetError, BrokenPipeError) as exc:
        # The worst case for a migration: the request vanishes and the client
        # is told nothing at all about why.
        return {
            "outcome": "connection_reset",
            "status": None,
            "detail": type(exc).__name__,
            "names_the_problem": False,
            "elapsed_s": round(time.monotonic() - started, 3),
        }
    except OSError as exc:
        return {
            "outcome": "connect_failed",
            "status": None,
            "detail": "%s: %s" % (type(exc).__name__, exc),
            "names_the_problem": False,
            "elapsed_s": round(time.monotonic() - started, 3),
        }

    elapsed = round(time.monotonic() - started, 3)
    status = parse_status(raw)

    if status is None:
        return {
            "outcome": "connection_closed_without_response",
            "status": None,
            "detail": "the connection closed with no HTTP status line",
            "names_the_problem": False,
            "elapsed_s": elapsed,
        }

    first_line = raw.split(b"\r\n", 1)[0].decode("latin-1")
    if 200 <= status < 400:
        return {
            "outcome": "accepted",
            "status": status,
            "detail": first_line,
            "names_the_problem": True,
            "elapsed_s": elapsed,
        }

    return {
        "outcome": "rejected",
        "status": status,
        "detail": first_line,
        # The distinction the whole probe exists for.
        "names_the_problem": status in SPECIFIC_STATUSES,
        "elapsed_s": elapsed,
    }


def probe_target(name: str, host: str, port: int, product: str, default_note: str) -> dict:
    """Every token size against one target, with the target's own defaults named."""
    results = {}
    for label, size in TOKEN_SIZES.items():
        results[label] = {"token_bytes": size, **probe(host, port, size)}

    accepted = [k for k, v in results.items() if v["outcome"] == "accepted"]
    rejected = [k for k, v in results.items() if v["outcome"] != "accepted"]
    silent = [
        k
        for k, v in results.items()
        if v["outcome"] != "accepted" and not v["names_the_problem"]
    ]

    return {
        "target": name,
        "product": product,
        "defaults": default_note,
        "by_token": results,
        "accepted": accepted,
        "rejected": rejected,
        # Named separately because it is the actionable half of the finding.
        "rejected_without_naming_the_problem": silent,
        "summary": summarise(name, accepted, rejected, silent),
    }


def summarise(name: str, accepted: list, rejected: list, silent: list) -> str:
    """One sentence a reader can act on, built from the outcomes rather than typed."""
    if not rejected:
        return "%s accepted every token size tested, on its default configuration." % name
    if not accepted:
        return (
            "%s rejected every token size tested, including the classical baseline -- which "
            "points at the probe or the deployment rather than at token size." % name
        )
    worst = "; %d of them without naming size as the reason" % len(silent) if silent else ""
    return "%s accepted %d of %d token sizes and rejected %d%s." % (
        name,
        len(accepted),
        len(accepted) + len(rejected),
        len(rejected),
        worst,
    )
