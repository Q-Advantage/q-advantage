"""
Turn one captured scenario into one Layer B result file.

THE LINE THIS MODULE HOLDS. Layer B produces two kinds of output and they are
NOT equally portable:

  * Structural facts -- packets per handshake, bytes on the wire, the
    negotiated group, fragmentation, the initcwnd flight, the downgrade
    outcome. These are properties of the protocol exchange. They are the same
    on a laptop, in CI, and on the measurement host, so they are publishable
    from wherever the capture was taken.

  * Timings -- how long the exchange took. These are a property of the machine.
    A handshake timed inside a shared CI runner is not a Q-Shield figure and
    must never be presented as one.

So the emitted result separates them, and the timing block carries an explicit
`publishable` flag that is false unless the caller states it ran on the
measurement host. Nothing downstream has to remember the distinction.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from analysis import concurrency_summary, initcwnd_analysis, round_trips, rtt_estimate  # noqa: E402
from pcap_reader import Conversation, reassemble  # noqa: E402
from sockstat import parse_samples, summarise as summarise_sockstat  # noqa: E402
from tls_wire import classify_outcome, parse_handshake  # noqa: E402

SCHEMA_VERSION = "layer-b/0.2.0"

#: Scenarios this tooling knows how to label. An unrecognised label is allowed
#: through -- refusing would be worse than recording an unfamiliar name -- but
#: the known set is what the CI matrix and the site expect.
KNOWN_SCENARIOS = ("pairwise", "mismatch", "concurrency", "rtt", "middlebox")


def _git_commit() -> str | None:
    try:
        out = subprocess.run(
            ["git", "rev-parse", "HEAD"], capture_output=True, text=True, timeout=10
        )
        return out.stdout.strip() or None
    except Exception:
        return None


def _audit() -> dict:
    return {
        "git_commit": _git_commit(),
        "timestamp_utc": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    }


def _timing_block(duration: float | None, measurement_host: bool) -> dict:
    return {
        "duration_seconds": duration,
        "publishable": bool(measurement_host),
        "note": (
            "Measured on the Q-Shield measurement host."
            if measurement_host
            else (
                "NOT a published figure. This ran on whatever machine took the capture -- a "
                "developer laptop or a shared CI runner -- which is not publication-grade. Only "
                "the structural fields are portable."
            )
        ),
    }


def build_result(
    conv: Conversation,
    *,
    label: str,
    client_groups: str,
    server_groups: str,
    toolchain: dict | None = None,
    host: dict | None = None,
    measurement_host: bool = False,
    environment: dict | None = None,
) -> dict:
    facts = parse_handshake(conv.client_to_server, conv.server_to_client)
    outcome = classify_outcome(facts)

    return {
        "schema": SCHEMA_VERSION,
        "identity": {
            "layer": "B",
            "protocol": "tls",
            "mode": "live_handshake",
            "label": label,
            "client_groups_offered": client_groups,
            "server_groups_accepted": server_groups,
        },
        "outcome": outcome,
        "wire": facts.as_dict(),
        "structure": {
            "packets_total": conv.packets_total,
            "packets_client_to_server": conv.packets_client_to_server,
            "packets_server_to_client": conv.packets_server_to_client,
            "wire_bytes_total": conv.wire_bytes_total,
            "wire_bytes_client_to_server": conv.bytes_client_to_server,
            "wire_bytes_server_to_client": conv.bytes_server_to_client,
            "ip_fragments": conv.ip_fragments,
            "segment_sizes": conv.segment_sizes,
            "largest_segment_bytes": max(conv.segment_sizes) if conv.segment_sizes else 0,
            "note": (
                "Counted from the capture. Properties of the protocol exchange, not of the "
                "machine that ran it."
            ),
        },
        # The initcwnd "cliff": network-calculator-spec.md carries this as a
        # qualitative callout because Layer A has no socket and therefore no
        # flights to observe. Here it is measured.
        "congestion": initcwnd_analysis(conv),
        "round_trips": round_trips(conv),
        "rtt": rtt_estimate(conv),
        "timing": _timing_block(conv.duration_seconds, measurement_host),
        "environment": environment or {},
        "toolchain": toolchain or {},
        "host": host or {},
        "audit": _audit(),
    }


def build_concurrency_result(
    convs: list[Conversation],
    *,
    label: str,
    client_groups: str,
    server_groups: str,
    measurement_host: bool = False,
    environment: dict | None = None,
) -> dict:
    """
    Aggregate many simultaneous connections into one result.

    Deliberately a different shape from a single handshake: reporting a swarm
    as though it were one connection would invite exactly the conflation
    layer-b-spec.md section 7 warns about.
    """
    negotiated: dict[str, int] = {}
    outcomes: dict[str, int] = {}
    for c in convs:
        facts = parse_handshake(c.client_to_server, c.server_to_client)
        o = classify_outcome(facts)["outcome"]
        outcomes[o] = outcomes.get(o, 0) + 1
        g = facts.as_dict()["negotiated_group"]
        if g:
            negotiated[g["name"]] = negotiated.get(g["name"], 0) + 1

    durations = [c.duration_seconds for c in convs if c.duration_seconds is not None]
    return {
        "schema": SCHEMA_VERSION,
        "identity": {
            "layer": "B",
            "protocol": "tls",
            "mode": "live_handshake",
            "label": label,
            "client_groups_offered": client_groups,
            "server_groups_accepted": server_groups,
        },
        "outcome": {
            "outcome": "negotiated" if outcomes.get("negotiated") else "no_traffic_captured",
            "detail": "Outcomes across %d captured connections: %s"
            % (len(convs), ", ".join("%s=%d" % kv for kv in sorted(outcomes.items())) or "none"),
        },
        "concurrency": concurrency_summary(convs),
        "outcomes_by_kind": outcomes,
        "negotiated_groups": negotiated,
        "timing": _timing_block(max(durations) if durations else None, measurement_host),
        "environment": environment or {},
        "audit": _audit(),
    }


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Parse a Layer B capture into a result file.")
    ap.add_argument("pcap", type=Path, help="capture written by tcpdump -w")
    ap.add_argument("--server-port", type=int, default=4433)
    ap.add_argument("--label", default="pairwise")
    ap.add_argument("--client-groups", default="")
    ap.add_argument("--server-groups", default="")
    ap.add_argument("--output-dir", type=Path, default=None)
    ap.add_argument(
        "--sockstat",
        type=Path,
        default=None,
        help="CSV of kernel socket accounting sampled during the run.",
    )
    ap.add_argument(
        "--env-note",
        default="",
        help="What was in the network path, e.g. an injected delay or a proxy product.",
    )
    ap.add_argument(
        "--measurement-host",
        action="store_true",
        help=(
            "Assert this ran on the Q-Shield measurement host, making the timing block "
            "publishable. Off by default -- a timing is not a published figure unless someone "
            "states where it came from."
        ),
    )
    args = ap.parse_args(argv)

    environment: dict = {}
    if args.env_note:
        environment["path_note"] = args.env_note
    if args.sockstat and args.sockstat.exists():
        environment["sockets"] = summarise_sockstat(
            parse_samples(args.sockstat.read_text(errors="replace"))
        )

    blob = args.pcap.read_bytes()
    convs = reassemble(blob, args.server_port)

    if not convs:
        # An empty capture is a real outcome (the client never connected), not
        # a crash. Emit it as one rather than failing silently.
        payload = {
            "schema": SCHEMA_VERSION,
            "identity": {
                "layer": "B", "protocol": "tls", "mode": "live_handshake", "label": args.label,
                "client_groups_offered": args.client_groups,
                "server_groups_accepted": args.server_groups,
            },
            "outcome": {
                "outcome": "no_traffic_captured",
                "detail": "No TCP conversation on port %d appears in this capture."
                % args.server_port,
            },
            "environment": environment,
            "audit": _audit(),
        }
    elif args.label.startswith("concurrency") or len(convs) > 3:
        payload = build_concurrency_result(
            convs,
            label=args.label,
            client_groups=args.client_groups,
            server_groups=args.server_groups,
            measurement_host=args.measurement_host,
            environment=environment,
        )
    else:
        # The longest conversation is the handshake under test; anything else
        # on the port is noise from a health check or a probe.
        conv = max(convs, key=lambda c: c.wire_bytes_total)
        payload = build_result(
            conv,
            label=args.label,
            client_groups=args.client_groups,
            server_groups=args.server_groups,
            measurement_host=args.measurement_host,
            environment=environment,
        )

    text = json.dumps(payload, indent=2)
    if args.output_dir is None:
        print(text)
    else:
        args.output_dir.mkdir(parents=True, exist_ok=True)
        date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        path = args.output_dir / ("layer-b-%s-%s.json" % (args.label, date))
        path.write_text(text)
        print("wrote %s" % path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
