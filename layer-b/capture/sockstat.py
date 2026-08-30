"""
Kernel socket accounting, sampled during a run.

WHAT THIS ANSWERS. The original Layer A disclaimer names "bytes of state per
half-open connection" as something the composed harness structurally cannot
measure. It is a kernel-accounting question, not a packet question, so it is
sampled from /proc/net/sockstat and `ss` alongside the capture rather than
derived from it.

HOW IT AVOIDS BUILDING A FLOODER, AND WHY THAT MATTERS. The obvious way to
measure half-open state is to manufacture half-open connections -- which is a
SYN flood, i.e. a denial-of-service tool, even pointed at our own container.
We do not build one. Instead the concurrency scenario opens N legitimate
connections that genuinely pass through SYN_RECV on their way to being
established, and this module observes the real accounting while that happens.
The measurement is of a system doing normal work, which is also the condition a
capacity planner actually cares about.

The consequence is stated rather than hidden: SYN_RECV depth under honest
concurrency is lower and noisier than under a flood, so the per-connection
figure is reported with its sample count and is refused outright when the
sample is too thin to mean anything.
"""

from __future__ import annotations

import csv
import io

#: Linux reports sockstat memory in pages.
PAGE_BYTES = 4096

#: Below this many observations of a state, a per-connection figure derived
#: from it is noise. Refused rather than published with a wide error bar,
#: because a number with a caveat still gets quoted without one.
MIN_SAMPLES = 5


FIELDS = (
    "tcp_inuse",
    "tcp_orphan",
    "tcp_tw",
    "tcp_alloc",
    "tcp_mem_pages",
    "syn_recv",
    "established",
)


def parse_samples(text: str) -> list[dict]:
    """
    Parse the CSV written by scripts/capture.sh, skipping incomplete rows.

    A row missing any field is DROPPED, never defaulted to zero. That looks
    pedantic and is not: zero is a meaningful value here -- a sample with zero
    established and zero SYN_RECV connections is what defines the idle
    baseline that every per-connection figure is measured against. Letting a
    truncated final row (normal when the sampler is stopped mid-write) become
    a fake idle sample would silently corrupt that baseline.
    """
    out: list[dict] = []
    for row in csv.DictReader(io.StringIO(text)):
        if any(row.get(f) in (None, "") for f in FIELDS) or not row.get("ts"):
            continue
        try:
            sample = {"ts": float(row["ts"])}
            for f in FIELDS:
                sample[f] = int(row[f])
            out.append(sample)
        except (TypeError, ValueError):
            continue
    return out


def _baseline(samples: list[dict]) -> dict | None:
    """The quietest observed sample, used as the idle reference."""
    idle = [s for s in samples if s["established"] == 0 and s["syn_recv"] == 0]
    if not idle:
        return None
    return min(idle, key=lambda s: s["tcp_mem_pages"])


def summarise(samples: list[dict]) -> dict:
    """
    What the sampled accounting supports saying, and nothing more.

    Every derived per-connection figure carries the sample count it rests on,
    and is omitted entirely when that count is below MIN_SAMPLES.
    """
    if not samples:
        return {
            "measurable": False,
            "reason": "No sockstat samples were collected during this run.",
        }

    peak_syn = max(s["syn_recv"] for s in samples)
    peak_est = max(s["established"] for s in samples)
    peak_mem = max(s["tcp_mem_pages"] for s in samples)
    base = _baseline(samples)

    result: dict = {
        "measurable": True,
        "samples": len(samples),
        "sample_interval_note": "Sampled every ~200 ms for the duration of the capture.",
        "peak_syn_recv": peak_syn,
        "peak_established": peak_est,
        "peak_tcp_mem_pages": peak_mem,
        "peak_tcp_mem_bytes": peak_mem * PAGE_BYTES,
        "idle_baseline_tcp_mem_pages": base["tcp_mem_pages"] if base else None,
        "method_note": (
            "Read from /proc/net/sockstat and ss while the run was in progress. Connections "
            "reach SYN_RECV by handshaking normally -- no synthetic half-open connections are "
            "manufactured, so these are the depths a server actually sees under load."
        ),
    }

    # Per-established-connection kernel memory. Only when there is an idle
    # baseline to subtract and enough loaded samples to be worth quoting.
    loaded = [s for s in samples if s["established"] >= 1]
    if base is not None and len(loaded) >= MIN_SAMPLES:
        deltas = [
            (s["tcp_mem_pages"] - base["tcp_mem_pages"]) * PAGE_BYTES / s["established"]
            for s in loaded
            if s["established"] > 0
        ]
        deltas.sort()
        if deltas:
            result["bytes_per_established_connection"] = {
                "median": deltas[len(deltas) // 2],
                "min": deltas[0],
                "max": deltas[-1],
                "samples": len(deltas),
                "note": (
                    "Kernel TCP memory above the idle baseline, divided by concurrently "
                    "established connections. Whole-stack accounting, not a per-socket struct "
                    "size, and it moves with socket buffer occupancy."
                ),
            }
    else:
        result["bytes_per_established_connection"] = None
        result["bytes_per_established_reason"] = (
            "No idle baseline was observed, or fewer than %d loaded samples. Refused rather "
            "than published from a thin sample." % MIN_SAMPLES
        )

    syn_samples = [s for s in samples if s["syn_recv"] > 0]
    result["syn_recv_observations"] = len(syn_samples)
    if len(syn_samples) < MIN_SAMPLES:
        result["bytes_per_half_open_connection"] = None
        result["bytes_per_half_open_reason"] = (
            "Only %d sample(s) caught a connection in SYN_RECV -- too few to divide memory by. "
            "Connections here reach that state by handshaking normally rather than being held "
            "half-open synthetically, so the state is genuinely brief. Deliberately manufacturing "
            "half-open connections would mean building a SYN flood tool, which is out of scope."
            % len(syn_samples)
        )
    elif base is not None:
        deltas = [
            (s["tcp_mem_pages"] - base["tcp_mem_pages"]) * PAGE_BYTES / s["syn_recv"]
            for s in syn_samples
        ]
        deltas.sort()
        result["bytes_per_half_open_connection"] = {
            "median": deltas[len(deltas) // 2],
            "min": deltas[0],
            "max": deltas[-1],
            "samples": len(deltas),
            "note": (
                "Observed while connections passed through SYN_RECV under normal load. Includes "
                "any established connections' memory in the same sample, so it is an upper bound "
                "rather than an isolated per-request_sock figure."
            ),
        }
    else:
        result["bytes_per_half_open_connection"] = None
        result["bytes_per_half_open_reason"] = "No idle baseline sample to subtract."

    return result
