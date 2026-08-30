"""
Turn one captured handshake into one Layer B result file.

THE LINE THIS MODULE HOLDS. Layer B produces two kinds of output and they are
NOT equally portable:

  * Structural facts -- packets per handshake, bytes on the wire, the
    negotiated group, fragmentation, the downgrade outcome. These are
    properties of the protocol exchange. They are the same on a laptop, in CI,
    and on the measurement host, so they are publishable from wherever the
    capture was taken.

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

from pcap_reader import Conversation, reassemble  # noqa: E402
from tls_wire import classify_outcome, parse_handshake  # noqa: E402

SCHEMA_VERSION = "layer-b/0.1.0"


def _git_commit() -> str | None:
    try:
        out = subprocess.run(
            ["git", "rev-parse", "HEAD"], capture_output=True, text=True, timeout=10
        )
        return out.stdout.strip() or None
    except Exception:
        return None


def build_result(
    conv: Conversation,
    *,
    label: str,
    client_groups: str,
    server_groups: str,
    toolchain: dict | None = None,
    host: dict | None = None,
    measurement_host: bool = False,
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
            # The configuration under test is recorded so a run is
            # self-describing -- including the deliberately-mismatched case.
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
                "Counted from the capture. These are properties of the protocol exchange and do "
                "not depend on the machine that ran it."
            ),
        },
        "timing": {
            "duration_seconds": conv.duration_seconds,
            "publishable": bool(measurement_host),
            "note": (
                "Measured on the Q-Shield measurement host."
                if measurement_host
                else (
                    "NOT a published figure. This handshake was timed on whatever machine ran the "
                    "capture -- a developer laptop or a shared CI runner -- which is not "
                    "publication-grade. Only the structural fields above are portable."
                )
            ),
        },
        "toolchain": toolchain or {},
        "host": host or {},
        "audit": {
            "git_commit": _git_commit(),
            "timestamp_utc": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        },
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
        "--measurement-host",
        action="store_true",
        help=(
            "Assert this ran on the Q-Shield measurement host, making the timing block "
            "publishable. Off by default -- a timing is not a published figure unless someone "
            "states where it came from."
        ),
    )
    args = ap.parse_args(argv)

    blob = args.pcap.read_bytes()
    convs = reassemble(blob, args.server_port)
    if not convs:
        # An empty capture is a real outcome (the client never connected), not
        # a crash. Emit it as one rather than failing silently.
        result = {
            "schema": SCHEMA_VERSION,
            "identity": {"layer": "B", "protocol": "tls", "mode": "live_handshake",
                         "label": args.label},
            "outcome": {
                "outcome": "no_traffic_captured",
                "detail": "No TCP conversation on port %d appears in this capture."
                % args.server_port,
            },
        }
        results = [result]
    else:
        # The longest conversation is the handshake under test; anything else
        # on the port is noise from a health check or a probe.
        conv = max(convs, key=lambda c: c.wire_bytes_total)
        results = [
            build_result(
                conv,
                label=args.label,
                client_groups=args.client_groups,
                server_groups=args.server_groups,
                measurement_host=args.measurement_host,
            )
        ]

    payload = results[0]
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
