"""
Application compatibility — `qshield-update-spec.md` §15 Tier 2.

Two probes, one question: what happens when real software, on its default
configuration, meets post-quantum-sized artifacts?

  * `probe_headers` sends tokens of measured JOSE sizes at HTTP front doors and
    records whether each is accepted, rejected, or dropped -- and whether a
    rejection names size as the reason.
  * `probe_parsers` hands real ML-DSA certificates to tooling that does not know
    the algorithm and records whether the certificate is fully readable,
    structurally readable, or invisible.

WHY THE TWO SIT TOGETHER. They are the same finding at two layers. A migration
does not fail because a signature is slow; it fails because something in the
path was written when signatures were small, and it fails in a way nobody can
diagnose. Both probes are built to distinguish "broke loudly" from "broke
quietly", because only the second one costs a week.

WHAT THIS RESULT IS NOT. Not a product comparison and not a recommendation.
Every limit exercised is a configurable default and every tool is a stock build,
named and versioned. The claim is about what happens to somebody who deploys
without changing anything -- which is what most people do -- and nothing more.
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import probe_headers  # noqa: E402
import probe_parsers  # noqa: E402

#: The HTTP front doors probed, with the default each is being held to.
#:
#: Three products with three different defaults, which is the point: "does a
#: post-quantum token fit in a header" has no single answer, and a reader needs
#: to know which of these is in their own path.
TARGETS = [
    {
        "name": "nginx",
        "host": os.environ.get("NGINX_HOST", "compat-nginx"),
        "port": int(os.environ.get("NGINX_PORT", "8080")),
        "product": "nginx (official image, default configuration)",
        "defaults": (
            "large_client_header_buffers defaults to 4 buffers of 8k; a single header line must "
            "fit within one buffer."
        ),
    },
    {
        "name": "haproxy",
        "host": os.environ.get("HAPROXY_HOST", "compat-haproxy"),
        "port": int(os.environ.get("HAPROXY_PORT", "8080")),
        "product": "HAProxy (official image, default configuration)",
        "defaults": "tune.bufsize defaults to 16384 bytes, covering the whole request head.",
    },
    {
        "name": "node",
        "host": os.environ.get("NODE_HOST", "compat-node"),
        "port": int(os.environ.get("NODE_PORT", "8080")),
        "product": "Node.js http server (default configuration)",
        "defaults": "--max-http-header-size defaults to 16384 bytes across the whole header block.",
    },
]


def git_commit() -> str | None:
    try:
        out = subprocess.run(
            ["git", "rev-parse", "HEAD"], capture_output=True, text=True, timeout=10, check=False
        )
        return out.stdout.strip() or None
    except Exception:  # noqa: BLE001
        return None


def run_header_probes(only: str | None = None) -> list[dict]:
    results = []
    for t in TARGETS:
        if only and t["name"] != only:
            continue
        results.append(
            probe_headers.probe_target(
                t["name"], t["host"], t["port"], t["product"], t["defaults"]
            )
        )
    return results


def run_parser_probes(certs_dir: Path) -> list[dict]:
    if not certs_dir.exists():
        return []
    with tempfile.TemporaryDirectory() as tmp:
        tmpdir = Path(tmp)
        return [
            probe_parsers.probe_algorithm(d, tmpdir)
            for d in sorted(certs_dir.iterdir())
            if d.is_dir()
        ]


def headline(header_rows: list[dict], parser_rows: list[dict]) -> dict:
    """
    The two sentences worth leading with, derived rather than typed.

    Both are counts over the outcomes, so a run where nothing broke says so and
    a run where the probe itself failed cannot be mistaken for a clean result.
    """
    silent = [
        (r["target"], tok)
        for r in header_rows
        for tok in r["rejected_without_naming_the_problem"]
    ]
    invisible = [
        (r["algorithm"], tool)
        for r in parser_rows
        if r.get("measured")
        for tool in r.get("invisible_to", [])
    ]
    return {
        "targets_probed": len(header_rows),
        "algorithms_probed": len([r for r in parser_rows if r.get("measured")]),
        "silent_rejections": len(silent),
        "silent_rejection_detail": ["%s / %s" % (a, b) for a, b in silent],
        "certificates_invisible_to_a_parser": len(invisible),
        "invisible_detail": ["%s / %s" % (a, b) for a, b in invisible],
        "note": (
            "A count of zero means the probes ran and found nothing, which is a result. It does "
            "not mean the probes did not run -- targets_probed and algorithms_probed say that."
        ),
    }


def build(certs_dir: Path, only: str | None = None) -> dict:
    header_rows = run_header_probes(only)
    parser_rows = run_parser_probes(certs_dir)
    return {
        "schema": "app-compat/1",
        "track": "app-compat",
        "label": "application compatibility",
        "environment": {
            "iso_timestamp": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "git_commit": git_commit(),
        },
        "scope": {
            "what_is_under_test": (
                "The receiving software's behaviour at a measured artifact size. No algorithm is "
                "exercised: header tokens are filler of a real measured LENGTH, so these results "
                "hold regardless of which post-quantum scheme is eventually deployed."
            ),
            "defaults_not_limits": (
                "Every limit exercised is a configurable default. A rejection is a statement "
                "about what happens to somebody who deploys without changing anything, not a "
                "statement that the product is unsuitable."
            ),
            "not_a_product_comparison": (
                "Stock builds on default configuration, named and versioned. No claim is made "
                "about any product's roadmap, intent, or suitability relative to another."
            ),
            "token_sizes_source": (
                "Measured by the composed JOSE track (work-order 022), carried here as lengths so "
                "this probe needs no crypto library."
            ),
        },
        "http_front_doors": header_rows,
        "certificate_parsers": parser_rows,
        "headline": headline(header_rows, parser_rows),
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--certs-dir", default="/out/certs")
    ap.add_argument("--only", default=None, help="probe a single HTTP target by name")
    ap.add_argument("--output-dir", default=None)
    args = ap.parse_args()

    result = build(Path(args.certs_dir), args.only)
    out = json.dumps(result, indent=2)

    if args.output_dir:
        os.makedirs(args.output_dir, exist_ok=True)
        date = result["environment"]["iso_timestamp"][:10]
        gh = (result["environment"]["git_commit"] or "nogit")[:7]
        path = os.path.join(args.output_dir, "app-compat-%s-%s.json" % (date, gh))
        with open(path, "w") as fh:
            fh.write(out)
        print("wrote %s" % path)
    else:
        print(out)

    h = result["headline"]
    print(
        "\n%d front door(s), %d algorithm(s): %d silent rejection(s), "
        "%d certificate/parser pair(s) where the certificate was invisible."
        % (
            h["targets_probed"],
            h["algorithms_probed"],
            h["silent_rejections"],
            h["certificates_invisible_to_a_parser"],
        ),
        file=sys.stderr,
    )


if __name__ == "__main__":
    main()
