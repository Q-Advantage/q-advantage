#!/usr/bin/env python3
"""
Copy Layer B results into the web build, with a gate on what may travel.

WHY THIS IS NOT A PLAIN COPY. A Layer B result carries two kinds of field.
Structural facts -- packets, wire bytes, the negotiated group, fragmentation,
the congestion verdict -- are properties of the protocol exchange and hold
wherever the capture was taken. Timings are properties of the machine.

A run that did not happen on the measurement host has `timing.publishable`
false, and this script REMOVES its duration rather than shipping a number the
site is then trusted to hide. The web layer refuses it too
(lib/layer-b/derive.ts), but a value that never reaches the bundle cannot be
rendered by a component that forgets to ask.

Nothing here edits a measurement. Dropping a field that must not be published
is not the same as changing one, and no structural figure is touched.
"""

from __future__ import annotations

import argparse
import json
import shutil
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SRC = REPO_ROOT / "layer-b" / "results"
DEFAULT_DEST = REPO_ROOT / "web" / "public" / "data" / "layer-b"

REQUIRED_TOP_LEVEL = ("schema", "identity", "outcome")

#: Result files that are inputs to a merge rather than publishable on their own.
#: The per-library crosslib probes are combined by merge_crosslib.py into the
#: cross_validation view; publishing the parts as well would put three files on
#: the site saying less than the one that reconciles them.
INPUT_ONLY_SCHEMAS = ("crosslib/",)

#: A track that promises no timings must ship none. This is the promise, checked
#: rather than trusted -- crosslib's own scope says a speed comparison measured
#: on a shared CI runner "would undo" the dedicated-host discipline the rest of
#: the product depends on.
TIMING_KEYS = ("mean_us", "median_us", "p95_us", "ops_per_sec", "duration_seconds")


def kind_of(result: dict) -> str:
    """Which family a result belongs to, from its own schema string."""
    schema = str(result.get("schema", ""))
    if schema.startswith("app-compat/"):
        return "app-compat"
    if schema.startswith("crosslib-merged/"):
        return "crosslib-merged"
    if schema.startswith("crosslib/"):
        return "crosslib-part"
    return "layer-b-scenario"


def _contains_timing(node: object) -> str | None:
    """First timing-shaped key found anywhere in the structure, or None."""
    if isinstance(node, dict):
        for k, v in node.items():
            if k in TIMING_KEYS and v is not None:
                return k
            found = _contains_timing(v)
            if found:
                return found
    elif isinstance(node, list):
        for item in node:
            found = _contains_timing(item)
            if found:
                return found
    return None


def sanitise(result: dict) -> tuple[dict, list[str]]:
    """Return the publishable form of a result, plus what was stripped."""
    stripped: list[str] = []
    timing = result.get("timing")
    if isinstance(timing, dict) and not timing.get("publishable"):
        if timing.get("duration_seconds") is not None:
            timing["duration_seconds"] = None
            stripped.append("timing.duration_seconds")

    conc = result.get("concurrency")
    if isinstance(conc, dict) and isinstance(timing, dict) and not timing.get("publishable"):
        # Per-connection durations from a shared runner are the same category of
        # claim. The spread between them is still informative as a relative
        # comparison inside one capture, so it is kept -- but the wall clock,
        # which reads as an absolute throughput figure, is not.
        if conc.get("wall_clock_seconds") is not None:
            conc["wall_clock_seconds"] = None
            stripped.append("concurrency.wall_clock_seconds")
        if conc.get("completed_per_second") is not None:
            conc["completed_per_second"] = None
            stripped.append("concurrency.completed_per_second")

    return result, stripped


def validate(result: dict, path: Path) -> list[str]:
    kind = kind_of(result)

    if kind == "app-compat":
        # No identity/outcome block: this track probes receiving software at a
        # measured size rather than negotiating anything.
        missing = [
            k
            for k in ("schema", "track", "scope", "http_front_doors", "certificate_parsers")
            if k not in result
        ]
        problems = ["%s: missing required field %r" % (path.name, k) for k in missing]
        if not (result.get("scope") or {}).get("defaults_not_limits"):
            # Without it a reader can read a rejection as "this product is
            # unsuitable" rather than "this is what an unchanged default does".
            problems.append("%s: scope.defaults_not_limits is required" % path.name)
        return problems

    if kind == "crosslib-merged":
        missing = [
            k for k in ("schema", "track", "scope", "libraries", "cross_validation") if k not in result
        ]
        problems = ["%s: missing required field %r" % (path.name, k) for k in missing]
        leaked = _contains_timing(result)
        if leaked:
            problems.append(
                "%s: publishes no timings by design, but %r is present -- these builds "
                "run on a shared CI runner and a speed figure from here would undo the "
                "dedicated-measurement-host claim" % (path.name, leaked)
            )
        if not (result.get("scope") or {}).get("what_a_negative_means"):
            # A "not exposed" row without this reads as a claim about the
            # library rather than about what this probe could see.
            problems.append("%s: scope.what_a_negative_means is required" % path.name)
        return problems

    problems = []
    for key in REQUIRED_TOP_LEVEL:
        if key not in result:
            problems.append("%s: missing required field %r" % (path.name, key))
    label = (result.get("identity") or {}).get("label")
    if not label:
        problems.append("%s: identity.label is required to key the scenario" % path.name)
    wire = result.get("wire") or {}
    group = wire.get("negotiated_group")
    if group and not str(group.get("source", "")).startswith("wire bytes"):
        # The one claim Layer B exists to make. A result that cannot say its
        # negotiated group came from the wire must not be published as one.
        problems.append(
            "%s: negotiated group has no wire-bytes provenance (%r)"
            % (path.name, group.get("source"))
        )
    return problems


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--src", type=Path, default=DEFAULT_SRC)
    ap.add_argument("--dest", type=Path, default=DEFAULT_DEST)
    ap.add_argument("--clean", action="store_true", help="empty the destination first")
    args = ap.parse_args(argv)

    if not args.src.exists():
        print("no results at %s -- nothing to publish" % args.src)
        return 0

    files = sorted(args.src.glob("*.json"))
    if not files:
        print("no result files in %s -- nothing to publish" % args.src)
        return 0

    if args.clean and args.dest.exists():
        shutil.rmtree(args.dest)
    args.dest.mkdir(parents=True, exist_ok=True)

    problems: list[str] = []
    published = 0
    for path in files:
        try:
            result = json.loads(path.read_text())
        except json.JSONDecodeError as exc:
            problems.append("%s: not valid JSON (%s)" % (path.name, exc))
            continue

        if kind_of(result) == "crosslib-part":
            print("skipped   %-14s <- %s (merge input, not published alone)" % ("crosslib", path.name))
            continue

        problems.extend(validate(result, path))
        clean, stripped = sanitise(result)
        (args.dest / path.name).write_text(json.dumps(clean, indent=2))
        published += 1
        label = (result.get("identity") or {}).get("label") or result.get("label") or "?"
        note = (" stripped: %s" % ", ".join(stripped)) if stripped else ""
        print("published %-14s <- %s%s" % (label, path.name, note))

    if problems:
        print("\nREFUSED -- results did not pass validation:", file=sys.stderr)
        for p in problems:
            print("  " + p, file=sys.stderr)
        return 1

    print("\n%d result(s) published to %s" % (published, args.dest))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
