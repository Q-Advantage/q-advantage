#!/usr/bin/env python3
"""
Assert a scenario's result says what that scenario is supposed to establish.

Each scenario has a DIFFERENT success condition, and getting this wrong in the
easy direction is the real risk: a mismatch run that "fails" is succeeding, and
an assertion that treated every non-negotiation as an error would quietly
delete the failure dataset spec 3a exists to produce.

Two properties are asserted for every scenario, no exceptions:

  * the negotiated group, where there is one, came from wire bytes
  * a CI timing is never marked publishable
"""

from __future__ import annotations

import glob
import json
import sys


def fail(msg: str) -> None:
    print("ASSERTION FAILED: %s" % msg)
    raise SystemExit(1)


def load(scenario: str) -> dict:
    paths = sorted(glob.glob("out/results/layer-b-%s-*.json" % scenario))
    if not paths:
        fail("no result file for scenario %r" % scenario)
    return json.load(open(paths[-1]))


def assert_universal(r: dict) -> None:
    timing = r.get("timing")
    if timing is not None and timing.get("publishable") is not False:
        fail("a CI timing was marked publishable; these are not Q-Shield figures")

    wire = r.get("wire") or {}
    group = wire.get("negotiated_group")
    if group and not str(group.get("source", "")).startswith("wire bytes"):
        fail("negotiated group did not come from wire bytes: %r" % group.get("source"))


def check_pairwise(r: dict) -> None:
    if r["outcome"]["outcome"] not in ("negotiated", "negotiated_after_retry"):
        fail("expected a successful negotiation, got %r" % r["outcome"])
    if not r["wire"]["negotiated_group"]:
        fail("no negotiated group was read from the wire")
    if r["structure"]["packets_total"] < 3:
        fail("implausibly few packets for a real handshake: %d" % r["structure"]["packets_total"])
    print("OK pairwise: %s, %d packets, %d wire bytes"
          % (r["wire"]["negotiated_group"]["name"],
             r["structure"]["packets_total"],
             r["structure"]["wire_bytes_total"]))


def check_mismatch(r: dict) -> None:
    """
    The client offered only a PQC group; the server accepts only classical.

    Both a clean rejection and a downgrade are legitimate observations -- which
    one happened is the finding. What must NOT happen is the run reporting a
    successful PQC negotiation, which would mean the scenario did not actually
    misconfigure anything.
    """
    outcome = r["outcome"]["outcome"]
    acceptable = ("no_server_hello", "downgraded_to_classical", "no_traffic_captured",
                  "server_hello_without_key_share")
    if outcome == "negotiated":
        group = (r.get("wire") or {}).get("negotiated_group") or {}
        fail("a mismatched pair negotiated %s -- the scenario failed to misconfigure anything"
             % group.get("name"))
    if outcome not in acceptable:
        fail("unexpected mismatch outcome %r" % outcome)
    print("OK mismatch: %s -- %s" % (outcome, r["outcome"]["detail"]))


def check_concurrency(r: dict) -> None:
    c = r.get("concurrency") or {}
    if not c.get("measurable"):
        fail("concurrency run produced no measurable connections: %r" % c.get("reason"))
    if c["connections"] < 2:
        fail("only %d connection(s) captured -- not a concurrency measurement"
             % c["connections"])
    # spec section 7: this number must never carry Layer A's label.
    if c.get("label") != "connections per core (live sockets)":
        fail("concurrency result lost its distinguishing label")
    print("OK concurrency: %d connections, median %.4fs, p95 %.4fs"
          % (c["connections"], c["duration_seconds"]["median"], c["duration_seconds"]["p95"]))
    sockets = (r.get("environment") or {}).get("sockets") or {}
    if sockets.get("measurable"):
        print("   sockets: peak established=%s, peak SYN_RECV=%s"
              % (sockets.get("peak_established"), sockets.get("peak_syn_recv")))


def check_rtt(r: dict) -> None:
    if r["outcome"]["outcome"] not in ("negotiated", "negotiated_after_retry"):
        fail("expected a negotiation under injected latency, got %r" % r["outcome"])
    note = (r.get("environment") or {}).get("path_note", "")
    if "netem" not in note:
        fail("an injected-latency run must record that the latency was injected")
    if "synthetic" not in note:
        fail("the path note must not let injected delay read as real geography")
    rtt = r.get("rtt") or {}
    print("OK rtt: %s, rtt_measurable=%s, round_trips~%s"
          % (r["wire"]["negotiated_group"]["name"], rtt.get("measurable"),
             (r.get("round_trips") or {}).get("approx_round_trips")))
    if rtt.get("measurable"):
        print("   observed rtt: %.4fs" % rtt["rtt_seconds"])


def check_middlebox(r: dict) -> None:
    """
    A passthrough proxy must not damage the handshake.

    A pass here is narrow on purpose: this product, this version, this config,
    this handshake. The result records the product so the claim cannot widen.
    """
    outcome = r["outcome"]["outcome"]
    note = (r.get("environment") or {}).get("path_note", "")
    if "proxy" not in note:
        fail("a middlebox run must record which product was in the path")
    if outcome not in ("negotiated", "negotiated_after_retry"):
        # A genuine finding, not a broken test -- but it must be loud.
        print("FINDING: the middlebox did NOT pass the handshake through: %s -- %s"
              % (outcome, r["outcome"]["detail"]))
        print("   path: %s" % note)
        fail("middlebox scenario did not complete a handshake (see finding above)")
    print("OK middlebox: %s survived %s" % (r["wire"]["negotiated_group"]["name"], note))


CHECKS = {
    "pairwise": check_pairwise,
    "mismatch": check_mismatch,
    "concurrency": check_concurrency,
    "rtt": check_rtt,
    "middlebox": check_middlebox,
}


def main(argv: list[str]) -> int:
    if len(argv) != 2 or argv[1] not in CHECKS:
        print("usage: assert-scenario.py <%s>" % "|".join(CHECKS))
        return 2
    scenario = argv[1]
    r = load(scenario)
    print(json.dumps(r.get("outcome"), indent=2))
    assert_universal(r)
    CHECKS[scenario](r)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
