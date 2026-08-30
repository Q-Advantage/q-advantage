"""
Combine the per-library probe results into one cross-validation view.

WHY MERGING IS A SEPARATE STEP. Each library is built and probed in its own
image and its own CI job, so that a build quirk in one product cannot hide
another's result. That means the cross-check -- which is the whole point of the
track -- can only happen after all of them have finished, and it has to cope
with some of them having failed.

THE RULE THAT MATTERS HERE. A missing library is a missing OPINION, not a
negative result. If BoringSSL's build failed, that says nothing about BoringSSL
and nothing about liboqs, and the merged output must not let those be confused.
Corroboration is counted only over libraries that actually reported.
"""

from __future__ import annotations

import argparse
import glob
import json
import os
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from probe_crosslib import ALIASES, LIBOQS_EXPOSES, LIBRARIES, SCOPE  # noqa: E402


def cross_validate(rows: list[dict]) -> dict:
    """
    Where the second opinions agree with liboqs, and where they do not.

    Agreement is worth publishing precisely because it is boring: it is the
    evidence that a Q-Shield figure describes the algorithm rather than one
    library's implementation of it. Disagreement is worth publishing because it
    is the only signal this repo has ever had that liboqs might be the odd one
    out.
    """
    probed = [r for r in rows if r.get("status") == "probed"]
    if not probed:
        return {
            "measurable": False,
            "reason": (
                "no library reported, so there is no second opinion to compare against. This is "
                "a broken build rather than a finding about liboqs."
            ),
        }

    corroborated, uncorroborated = [], []
    for alg in sorted(ALIASES):
        if alg not in LIBOQS_EXPOSES:
            continue
        others = [r["library"] for r in probed if alg in r.get("exposed", [])]
        entry = {"algorithm": alg, "also_exposed_by": others}
        (corroborated if others else uncorroborated).append(entry)

    return {
        "measurable": True,
        "libraries_that_reported": [r["library"] for r in probed],
        "libraries_that_did_not": sorted(
            set(LIBRARIES) - {r["library"] for r in probed}
        ),
        "corroborated": corroborated,
        "not_corroborated_here": uncorroborated,
        "note": (
            "A library that did not report is a missing OPINION, not a negative result. An "
            "algorithm under not_corroborated_here was not observed in any build that reported; "
            "with fewer builds reporting, more algorithms land there for reasons that have "
            "nothing to do with the algorithms."
        ),
    }


def load(results_dir: str) -> list[dict]:
    rows = []
    for path in sorted(glob.glob(os.path.join(results_dir, "crosslib-*.json"))):
        # The merged file is written into the same directory on a re-run; it is
        # not a per-library result and must not be read back in as one.
        if os.path.basename(path).startswith("crosslib-merged"):
            continue
        with open(path) as fh:
            doc = json.load(fh)
        if "library" in doc:
            rows.append(doc["library"])
    return rows


def build(results_dir: str) -> dict:
    rows = load(results_dir)
    return {
        "schema": "crosslib-merged/1",
        "track": "crosslib",
        "label": "cross-library diversity",
        "environment": {
            "iso_timestamp": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        },
        "scope": SCOPE,
        "libraries": rows,
        "cross_validation": cross_validate(rows),
        "liboqs_exposes": LIBOQS_EXPOSES,
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--results-dir", default="out/results")
    ap.add_argument("--output-dir", default=None)
    args = ap.parse_args()

    result = build(args.results_dir)
    out = json.dumps(result, indent=2)

    if args.output_dir:
        os.makedirs(args.output_dir, exist_ok=True)
        date = result["environment"]["iso_timestamp"][:10]
        path = os.path.join(args.output_dir, "crosslib-merged-%s.json" % date)
        with open(path, "w") as fh:
            fh.write(out)
        print("wrote %s" % path)
    else:
        print(out)

    cv = result["cross_validation"]
    if cv["measurable"]:
        print(
            "reported: %s | did not: %s"
            % (
                ", ".join(cv["libraries_that_reported"]) or "none",
                ", ".join(cv["libraries_that_did_not"]) or "none",
            ),
            file=sys.stderr,
        )
    else:
        print(cv["reason"], file=sys.stderr)


if __name__ == "__main__":
    main()
