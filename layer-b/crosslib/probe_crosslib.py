"""
Cross-library diversity — `qshield-update-spec.md` §15 Tier 2.

THE GAP THIS ADDRESSES. Every post-quantum number Q-Shield publishes comes from
liboqs. That is one implementation, and one implementation cannot distinguish a
property of the ALGORITHM from a property of the LIBRARY. If liboqs's ML-KEM-768
were slow, or its ciphertext the wrong length, nothing in this repo would catch
it -- there is no second opinion anywhere in the measurement path.

WHAT THIS PROBE PUBLISHES, AND WHAT IT REFUSES TO.

  * **Availability.** For each library, at a pinned version, built with named
    flags: which post-quantum primitives does the resulting binary actually
    expose? This is genuinely hard to find out from documentation and easy to
    get wrong by reading release notes instead of binaries.
  * **NOT timings.** Deliberately, and this is the important part. These builds
    run on a shared GitHub-hosted runner: noisy, unpinned, and co-tenanted. This
    repo's entire credibility rests on published numbers coming from a
    dedicated host, and publishing a cross-library speed comparison measured
    here would undo that in a single commit. Timing belongs on the measurement
    host or nowhere.

THE CLAIM BOUNDARY, WHICH IS THE WHOLE DISCIPLINE OF THIS FILE. A negative
result here means **"this build, with these flags, did not expose this
primitive"** -- never "this library does not support it". Those are different
statements and only the first is evidence. A library may support an algorithm
behind a flag we did not pass, in a version we did not pin, or under a name we
did not recognise, and publishing the stronger claim would be an uncited
assertion about somebody else's software.

Every classification therefore carries the raw output it was derived from, so a
reader can check the inference rather than trust it.
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from datetime import datetime, timezone

TIMEOUT_S = 180

#: Names a library might use for the same primitive.
#:
#: Post-quantum naming is genuinely unsettled -- the same algorithm appears as
#: "Kyber768", "ML-KEM-768" and "MLKEM768" depending on when the code was
#: written relative to FIPS 203. Matching on one spelling would report a library
#: as lacking an algorithm it ships, which is exactly the false claim this file
#: is built to avoid.
ALIASES = {
    "ML-KEM-512": ["ml-kem-512", "mlkem512", "kyber512", "kyber-512"],
    "ML-KEM-768": ["ml-kem-768", "mlkem768", "kyber768", "kyber-768"],
    "ML-KEM-1024": ["ml-kem-1024", "mlkem1024", "kyber1024", "kyber-1024"],
    "ML-DSA-44": ["ml-dsa-44", "mldsa44", "dilithium2", "dilithium-2"],
    "ML-DSA-65": ["ml-dsa-65", "mldsa65", "dilithium3", "dilithium-3"],
    "ML-DSA-87": ["ml-dsa-87", "mldsa87", "dilithium5", "dilithium-5"],
    "X25519MLKEM768": ["x25519mlkem768", "x25519kyber768", "x25519_kyber768"],
}

#: How to ask each library what it can do.
#:
#: Each entry names the binary, the command that produces an inventory, and the
#: build flags the image asked for -- so a negative result can be read against
#: what was actually requested rather than against an assumption.
LIBRARIES = [
    {
        "name": "BoringSSL",
        "binary": "bssl-boringssl",
        "probe_cmd": ["bssl-boringssl", "speed", "-filter", "."],
        "version_cmd": ["bssl-boringssl", "version"],
        "build_flags": "default cmake Release build; no post-quantum flags are opt-in",
        "source": "https://github.com/google/boringssl",
    },
    {
        "name": "AWS-LC",
        "binary": "bssl-awslc",
        "probe_cmd": ["bssl-awslc", "speed", "-filter", "."],
        "version_cmd": ["bssl-awslc", "version"],
        "build_flags": "default cmake Release build, BUILD_TESTING=OFF",
        "source": "https://github.com/aws/aws-lc",
    },
    {
        "name": "wolfSSL",
        "binary": "wolfssl-benchmark",
        "probe_cmd": ["wolfssl-benchmark", "-pq"],
        "version_cmd": ["wolfssl-benchmark", "-?"],
        "build_flags": "--enable-kyber --enable-dilithium --enable-experimental",
        "source": "https://github.com/wolfSSL/wolfssl",
    },
]


def run(cmd: list[str]) -> tuple[int, str]:
    """Run a probe command, returning (returncode, combined output)."""
    try:
        p = subprocess.run(
            cmd, capture_output=True, text=True, timeout=TIMEOUT_S, check=False
        )
        return p.returncode, (p.stdout or "") + (p.stderr or "")
    except subprocess.TimeoutExpired:
        return -1, "timed out after %ds" % TIMEOUT_S
    except FileNotFoundError:
        return -2, "binary not present in this image"
    except Exception as exc:  # noqa: BLE001 - report, never fabricate
        return -3, "%s: %s" % (type(exc).__name__, exc)


def find_algorithms(output: str) -> dict[str, list[str]]:
    """
    Which primitives this output mentions, and under which spelling.

    Returns the matched alias as well as the canonical name, because the
    spelling is itself a finding: a library still calling it "Kyber768" is
    telling you something about how current its post-quantum support is.
    """
    low = output.lower()
    found = {}
    for canonical, aliases in ALIASES.items():
        hits = [a for a in aliases if a in low]
        if hits:
            found[canonical] = hits
    return found


def excerpt(output: str, found: dict[str, list[str]], limit: int = 12) -> list[str]:
    """
    The lines a classification was derived from.

    Published so a reader can check the inference instead of trusting it. This
    is the same discipline as citing a source for a technical claim: the
    conclusion is only as good as the evidence, and the evidence is cheap to
    carry.
    """
    if not found:
        # With nothing found, the useful evidence is what the tool DID say --
        # otherwise "we found nothing" is indistinguishable from "we ran
        # nothing".
        return [ln for ln in output.splitlines() if ln.strip()][:limit]
    wanted = {a for aliases in found.values() for a in aliases}
    return [
        ln.strip()
        for ln in output.splitlines()
        if any(w in ln.lower() for w in wanted)
    ][:limit]


def probe_library(lib: dict) -> dict:
    """One library's inventory, with its evidence attached."""
    rc_v, version_out = run(lib["version_cmd"])
    version = version_out.strip().splitlines()[0] if version_out.strip() else None

    rc, output = run(lib["probe_cmd"])

    if rc == -2:
        # The binary is not here at all. That is a fact about this IMAGE, not
        # about the library, and must never be published as the latter.
        return {
            "library": lib["name"],
            "source": lib["source"],
            "status": "not_built",
            "reason": (
                "the %s binary is not present in this image, so nothing was asked of this "
                "library. This says nothing about what it supports." % lib["binary"]
            ),
            "build_flags": lib["build_flags"],
        }

    found = find_algorithms(output)
    return {
        "library": lib["name"],
        "source": lib["source"],
        "version": version,
        "status": "probed",
        "build_flags": lib["build_flags"],
        "probe_command": " ".join(lib["probe_cmd"]),
        "probe_exit_code": rc,
        "exposed": sorted(found),
        "spellings": found,
        "not_exposed": sorted(set(ALIASES) - set(found)),
        "evidence": excerpt(output, found),
        "claim": (
            "This build, with the flags named above, exposed the primitives in `exposed`. A "
            "primitive in `not_exposed` was NOT observed in this build's output -- which is not "
            "the same as the library not supporting it. It may be behind a flag this image did "
            "not pass, in a version it did not pin, or under a name the alias table does not yet "
            "know."
        ),
    }


def cross_validate(rows: list[dict], liboqs_exposes: list[str]) -> dict:
    """
    Where the second opinions agree with liboqs, and where they do not.

    Agreement is worth publishing precisely because it is boring: it is the
    evidence that a Q-Shield figure is a property of the algorithm rather than
    of one library's implementation of it. Disagreement is worth publishing
    because it is the only signal this repo has ever had that liboqs might be
    the odd one out.
    """
    probed = [r for r in rows if r["status"] == "probed"]
    if not probed:
        return {
            "measurable": False,
            "reason": (
                "no library was successfully probed, so there is no second opinion to compare "
                "against. This is a broken build rather than a finding about liboqs."
            ),
        }

    corroborated, unique_to_liboqs = [], []
    for alg in sorted(ALIASES):
        others = [r["library"] for r in probed if alg in r["exposed"]]
        if alg in liboqs_exposes:
            (corroborated if others else unique_to_liboqs).append(
                {"algorithm": alg, "also_exposed_by": others}
            )

    return {
        "measurable": True,
        "libraries_probed": [r["library"] for r in probed],
        "corroborated": corroborated,
        "exposed_only_by_liboqs_here": unique_to_liboqs,
        "note": (
            "Corroboration means a second implementation exposes the same primitive, which is "
            "evidence that a published figure describes the algorithm rather than liboqs. It is "
            "NOT a check that the two produce identical output -- that needs shared test vectors "
            "and is a separate build."
        ),
    }


#: What Q-Shield's own harness exposes, as of the tracks in this repo.
#:
#: Listed rather than imported because this probe runs in an image with no
#: liboqs in it -- importing would make the cross-check depend on the very
#: library it is checking.
LIBOQS_EXPOSES = [
    "ML-KEM-512", "ML-KEM-768", "ML-KEM-1024",
    "ML-DSA-44", "ML-DSA-65", "ML-DSA-87",
    "X25519MLKEM768",
]


def build() -> dict:
    rows = [probe_library(lib) for lib in LIBRARIES]
    versions = None
    if os.path.exists("/crosslib/versions.txt"):
        with open("/crosslib/versions.txt") as fh:
            versions = fh.read().strip()

    return {
        "schema": "crosslib/1",
        "track": "crosslib",
        "label": "cross-library diversity",
        "environment": {
            "iso_timestamp": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "built_versions": versions,
        },
        "scope": {
            "no_timings": (
                "This track publishes NO timings, deliberately. These builds run on a shared, "
                "unpinned, co-tenanted CI runner. Every number this product publishes comes from "
                "a dedicated measurement host, and a cross-library speed comparison measured here "
                "would undo that. Timing belongs on the measurement host or nowhere."
            ),
            "what_a_negative_means": (
                "A primitive listed under not_exposed was not observed in THIS build's output. "
                "That is not a claim that the library lacks it."
            ),
            "evidence_is_published": (
                "Every classification carries the raw output lines it was derived from, so the "
                "inference can be checked rather than trusted."
            ),
            "naming_is_unsettled": (
                "The same algorithm appears as Kyber768, ML-KEM-768 and MLKEM768 depending on "
                "when the code was written relative to FIPS 203. The alias table is matched "
                "case-insensitively and the matched spelling is published, because the spelling "
                "is itself informative."
            ),
        },
        "libraries": rows,
        "cross_validation": cross_validate(rows, LIBOQS_EXPOSES),
        "liboqs_exposes": LIBOQS_EXPOSES,
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--output-dir", default=None)
    args = ap.parse_args()

    result = build()
    out = json.dumps(result, indent=2)

    if args.output_dir:
        os.makedirs(args.output_dir, exist_ok=True)
        date = result["environment"]["iso_timestamp"][:10]
        path = os.path.join(args.output_dir, "crosslib-%s.json" % date)
        with open(path, "w") as fh:
            fh.write(out)
        print("wrote %s" % path)
    else:
        print(out)

    built = [r["library"] for r in result["libraries"] if r["status"] == "probed"]
    missing = [r["library"] for r in result["libraries"] if r["status"] == "not_built"]
    print(
        "\nprobed: %s%s"
        % (", ".join(built) or "none", ("; not built: " + ", ".join(missing)) if missing else ""),
        file=sys.stderr,
    )


if __name__ == "__main__":
    main()
