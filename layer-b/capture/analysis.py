"""
Derived measurements over a captured conversation.

Everything here is a projection of packets that were actually observed. Nothing
models, estimates, or fills a gap: a quantity that cannot be computed from the
capture returns None and says why, the same rule the Layer A data layer follows.

Two of these close gaps that Q-Shield has published as unmeasurable:

  * The initial-congestion-window "cliff". network-calculator-spec.md section 7
    carries it as a qualitative callout by explicit design, because Layer A has
    no socket and therefore no flights to observe. It is measurable here.

  * Bytes of half-open connection state, which the original Layer A disclaimer
    names directly. See half_open_state.py -- it is a kernel-accounting
    measurement rather than a capture one, so it lives beside this module.
"""

from __future__ import annotations

from dataclasses import dataclass

#: The common Linux initial congestion window: 10 segments (RFC 6928), at a
#: 1460-byte MSS. This is the DEFAULT most servers ship with, not a law -- it is
#: tunable per route, and any result quoting it must say which value was
#: assumed rather than presenting it as a property of the network.
DEFAULT_INITCWND_SEGMENTS = 10
DEFAULT_MSS_BYTES = 1460
DEFAULT_INITCWND_BYTES = DEFAULT_INITCWND_SEGMENTS * DEFAULT_MSS_BYTES  # 14600


@dataclass
class Flight:
    """One burst of data from a sender, ended by the peer acknowledging it."""

    bytes_sent: int
    packets: int
    #: Seconds from the first packet of the flight to the peer's acknowledgement.
    #: None when the capture ended before an acknowledgement was seen.
    ack_delay_seconds: float | None


def server_flights(conv) -> list[Flight]:
    """
    Split the server's output into flights, cut wherever the client acknowledged.

    A flight is what the server managed to put on the wire before it had to
    wait. That is exactly what the congestion window bounds, so the first
    flight's size is the observable proxy for whether the handshake fit inside
    the initial window or paid an extra round trip.

    Pure-ACK packets from the client (no payload) are the delimiter. Client
    packets carrying data are not treated as a delimiter on their own, because
    a client that is still sending has not necessarily acknowledged anything
    the server sent.
    """
    flights: list[Flight] = []
    current_bytes = 0
    current_packets = 0
    started_at: float | None = None

    for to_server, pkt in conv.packets:
        if not to_server:
            if pkt.payload:
                if started_at is None:
                    started_at = pkt.timestamp
                current_bytes += len(pkt.payload)
                current_packets += 1
            continue

        # Client -> server. A pure ACK closes whatever the server had in flight.
        if pkt.is_ack and not pkt.payload and current_bytes > 0:
            flights.append(
                Flight(
                    bytes_sent=current_bytes,
                    packets=current_packets,
                    ack_delay_seconds=(
                        pkt.timestamp - started_at if started_at is not None else None
                    ),
                )
            )
            current_bytes = 0
            current_packets = 0
            started_at = None

    if current_bytes > 0:
        flights.append(
            Flight(bytes_sent=current_bytes, packets=current_packets, ack_delay_seconds=None)
        )
    return flights


def initcwnd_analysis(conv, initcwnd_bytes: int = DEFAULT_INITCWND_BYTES) -> dict:
    """
    Whether the server's first flight exceeded the initial congestion window.

    This is the "cliff" the network calculator currently describes qualitatively.
    Exceeding the window does not merely make the handshake bigger -- it makes
    it wait, because the server cannot send the rest until an acknowledgement
    comes back, which costs a full round trip regardless of bandwidth.

    The assumed window is REPORTED alongside the verdict rather than baked in,
    because initcwnd is a tunable per-route default and a reader on a different
    setting needs to see which number this judgement used.
    """
    flights = server_flights(conv)
    if not flights:
        return {
            "measurable": False,
            "reason": (
                "No server-to-client data with an observed acknowledgement, so there is no "
                "flight to measure. Not an absence of a cliff -- an absence of evidence."
            ),
            "assumed_initcwnd_bytes": initcwnd_bytes,
        }

    first = flights[0]
    return {
        "measurable": True,
        "assumed_initcwnd_bytes": initcwnd_bytes,
        "assumed_initcwnd_note": (
            "%d segments x %d-byte MSS (RFC 6928 default). Tunable per route; stated so a "
            "reader on a different setting can re-judge."
            % (DEFAULT_INITCWND_SEGMENTS, DEFAULT_MSS_BYTES)
        ),
        "first_flight_bytes": first.bytes_sent,
        "first_flight_packets": first.packets,
        "first_flight_ack_delay_seconds": first.ack_delay_seconds,
        "exceeded_initcwnd": first.bytes_sent > initcwnd_bytes,
        "headroom_bytes": initcwnd_bytes - first.bytes_sent,
        "flights": len(flights),
        "flight_sizes": [f.bytes_sent for f in flights],
    }


def round_trips(conv) -> dict:
    """
    Count the round trips the exchange actually took.

    Derived from direction changes in the capture rather than from a protocol
    model, so a HelloRetryRequest or a congestion-window stall shows up as the
    extra trip it really is instead of being assumed away.
    """
    turns = 0
    last_direction: bool | None = None
    for to_server, pkt in conv.packets:
        if not pkt.payload:
            continue
        if last_direction is not None and to_server != last_direction:
            turns += 1
        last_direction = to_server
    return {
        "direction_changes": turns,
        # Two direction changes make one full round trip.
        "approx_round_trips": (turns + 1) // 2,
        "note": (
            "Counted from observed direction changes in payload-bearing packets, not from a "
            "protocol model. A retry or a congestion stall therefore appears as a real extra trip."
        ),
    }


def concurrency_summary(convs: list) -> dict:
    """
    Aggregate a set of concurrent connections.

    Layer A's concurrency question is "how does raw crypto throughput degrade
    under CPU contention". THIS is the different question layer-b-spec.md
    section 7 insists must not share the same label: how does a full
    TCP+TLS connection behave when N of them happen at once, including socket
    setup and handshake state machine, not just N concurrent crypto calls.
    """
    completed = [c for c in convs if c.duration_seconds is not None]
    if not completed:
        return {"connections": 0, "measurable": False,
                "reason": "No conversation had both a first and last timestamp."}

    durations = sorted(c.duration_seconds for c in completed)
    n = len(durations)

    def pct(p: float) -> float:
        if n == 1:
            return durations[0]
        idx = min(n - 1, max(0, int(round((p / 100.0) * (n - 1)))))
        return durations[idx]

    starts = [c.first_timestamp for c in completed if c.first_timestamp is not None]
    ends = [c.last_timestamp for c in completed if c.last_timestamp is not None]
    wall = (max(ends) - min(starts)) if starts and ends else None

    return {
        "connections": n,
        "measurable": True,
        "label": "connections per core (live sockets)",
        "label_note": (
            "Deliberately NOT called 'concurrency' unqualified. Layer A measures cryptographic "
            "throughput under CPU contention; this measures full TCP+TLS connections including "
            "socket setup and handshake state. Two different numbers, never one name."
        ),
        "duration_seconds": {
            "min": durations[0],
            "median": pct(50),
            "p95": pct(95),
            "max": durations[-1],
        },
        "wall_clock_seconds": wall,
        "completed_per_second": (n / wall) if wall and wall > 0 else None,
        "packets_total": sum(c.packets_total for c in completed),
        "wire_bytes_total": sum(c.wire_bytes_total for c in completed),
    }


def rtt_estimate(conv) -> dict:
    """
    SYN to SYN/ACK, measured AT THE CAPTURE POINT.

    WHAT THIS IS NOT. It is tempting to call this the round-trip time. It is
    not, and the difference bit on the first real run: our capture is taken in
    the server's network namespace, so with 50 ms injected on the client's
    egress the figure came back at 40 microseconds. Nothing was broken. The
    delay happened before the SYN reached the server, and the server answered
    immediately -- so a server-side observer correctly sees no round trip at
    all.

    What a capture at one endpoint can see is the latency of the path from the
    peer to itself and back, and only when the delay is symmetric. A
    one-directional delay is invisible from the wrong end. So this reports the
    observed SYN-to-SYN/ACK interval and says where it was observed, leaving
    the caller to know whether that constitutes a round trip.

    The generalisation worth keeping: an endpoint capture measures the network
    it can see. Presenting a one-sided observation as a path property is the
    same class of error as trusting a stack's own report of what it
    negotiated -- which is the thing this whole layer exists to avoid.
    """
    syn_time: float | None = None
    for to_server, pkt in conv.packets:
        if to_server and pkt.is_syn and not pkt.is_ack:
            syn_time = pkt.timestamp
            continue
        if not to_server and pkt.is_syn and pkt.is_ack and syn_time is not None:
            return {
                "measurable": True,
                "syn_to_synack_seconds": pkt.timestamp - syn_time,
                "observed_at": "server (capture shares the server network namespace)",
                "source": "TCP SYN to SYN/ACK",
                "is_full_round_trip": False,
                "note": (
                    "Interval between the SYN arriving and the SYN/ACK leaving, as seen at the "
                    "server. This is a full round trip only when latency is symmetric: a delay "
                    "injected on the client's egress happens before the SYN arrives and is "
                    "invisible from this end."
                ),
            }
    return {
        "measurable": False,
        "reason": (
            "No SYN/SYN-ACK pair in the capture -- it began mid-connection. Estimating from a "
            "later exchange would fold server processing into a latency figure."
        ),
    }
