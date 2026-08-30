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

#: A full `bssl speed` run works through every primitive in the library and
#: takes many minutes. The first run capped it at 180s, the command was killed
#: mid-inventory, and the control correctly refused to publish the resulting
#: silence as seven negatives -- which is the control working, but it means
#: BoringSSL and AWS-LC contributed no opinion at all.
#:
#: Generous rather than tight: the cost of being too short is a lost second
#: opinion, and the cost of being too long is a slower CI job.
TIMEOUT_S = 900

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

#: Primitives every one of these libraries certainly implements.
#:
#: THE CONTROL, and the reason it exists. The first CI run reported BoringSSL
#: and AWS-LC as exposing nothing at all -- which is false: BoringSSL ships
#: X25519MLKEM768 in production Chrome. The probe command had simply produced no
#: output, and the probe turned that silence into a list of seven negatives
#: about somebody else's software.
#:
#: So: if none of these appear in a build's output, the probe did not
#: successfully ask the question, and it publishes `inconclusive` instead of any
#: negative at all. This is the same rule the header probe has (a rejected
#: classical baseline points at the instrument) and the parser probe has (a
#: classical certificate must parse fully). It should have been here first.
CONTROL_MARKERS = ["rsa", "aes", "sha", "ecdsa", "p-256", "x25519", "curve25519"]

#: How to ask each library what it can do.
#:
#: Each entry names the binary, the command that produces an inventory, and the
#: build flags the image asked for -- so a negative result can be read against
#: what was actually requested rather than against an assumption.
LIBRARIES = {
    "BoringSSL": {
        "binary": "bssl",
        "probe_cmd": ["bssl", "speed"],
        # `bssl` has no version subcommand -- asking for one prints usage text,
        # which the first run published as a version string. The pinned source
        # tag is the honest identifier and it travels in build_flags.
        "version_cmd": None,
        "build_flags": "cmake Release build at pinned tag; BoringSSL has no post-quantum opt-in flag",
        "source": "https://github.com/google/boringssl",
    },
    "AWS-LC": {
        "binary": "bssl",
        "probe_cmd": ["bssl", "speed"],
        "version_cmd": ["bssl", "version"],
        "build_flags": "cmake Release build at pinned tag, BUILD_TESTING=OFF",
        "source": "https://github.com/aws/aws-lc",
    },
    "wolfSSL": {
        "binary": "wolfssl-benchmark",
        # `-pq` restricts the run to post-quantum algorithms, which means the
        # control markers never appear. The full run is slower and is what makes
        # the control possible at all.
        "probe_cmd": ["wolfssl-benchmark"],
        "version_cmd": None,
        "build_flags": "--enable-kyber --enable-dilithium",
        "source": "https://github.com/wolfSSL/wolfssl",
    },
}


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


def probe_library(name: str) -> dict:
    """One library's inventory, with its evidence attached."""
    lib = dict(LIBRARIES[name], name=name)
    version = None
    if lib["version_cmd"]:
        rc_v, version_out = run(lib["version_cmd"])
        # A tool that prints usage text on an unknown subcommand would otherwise
        # have that usage text published as its version.
        if rc_v == 0 and version_out.strip():
            first = version_out.strip().splitlines()[0]
            version = first if "usage" not in first.lower() else None

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

    # The control, checked BEFORE any negative is assembled.
    controls = [m for m in CONTROL_MARKERS if m in output.lower()]
    if not controls:
        return {
            "library": lib["name"],
            "source": lib["source"],
            "version": version,
            "status": "inconclusive",
            "build_flags": lib["build_flags"],
            "probe_command": " ".join(lib["probe_cmd"]),
            "probe_exit_code": rc,
            "reason": (
                "the probe command produced no output naming any primitive this library "
                "certainly implements, so it did not successfully ask the question. NO negative "
                "result is published from this run: reporting seven absences on the strength of "
                "a command that returned nothing would be a false claim about somebody else's "
                "software, not a measurement."
            ),
            # Kept so the next person can see what the command actually did.
            "raw_output_head": [ln for ln in output.splitlines() if ln.strip()][:12],
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
        # Published so a reader can see the probe reached the library at all.
        "control_markers_seen": controls,
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


SCOPE = {
    "no_timings": (
        "This track publishes NO timings, deliberately. These builds run on a shared, unpinned, "
        "co-tenanted CI runner. Every number this product publishes comes from a dedicated "
        "measurement host, and a cross-library speed comparison measured here would undo that. "
        "Timing belongs on the measurement host or nowhere."
    ),
    "what_a_negative_means": (
        "A primitive listed under not_exposed was not observed in THIS build's output. That is "
        "not a claim that the library lacks it: it may be behind a flag this image did not pass, "
        "in a version it did not pin, or under a name the alias table does not yet know."
    ),
    "evidence_is_published": (
        "Every classification carries the raw output lines it was derived from, so the inference "
        "can be checked rather than trusted."
    ),
    "naming_is_unsettled": (
        "The same algorithm appears as Kyber768, ML-KEM-768 and MLKEM768 depending on when the "
        "code was written relative to FIPS 203. The alias table is matched case-insensitively and "
        "the matched spelling is published, because the spelling is itself informative."
    ),
    "what_a_speed_inventory_can_see": (
        "These probes read a library's own SPEED INVENTORY, which lists primitives. A TLS group "
        "such as X25519MLKEM768 is a negotiation construct rather than a primitive, so it does "
        "not appear in one even in a library that ships it -- BoringSSL negotiates that group in "
        "production Chrome and it is absent here. Read every hybrid-group row as 'not visible "
        "from this vantage point', never as absent from the library. Settling it needs a "
        "handshake, which is Layer B's job rather than this track's."
    ),
    "signature_schemes_are_a_known_blind_spot": (
        "No ML-DSA row was observed in any of the three inventories, including a wolfSSL build "
        "configured with --enable-dilithium. That is unresolved and is published as such: it may "
        "be that these speed tools cover KEMs and not signature schemes, or that a flag did not "
        "take. It is NOT evidence that these libraries lack ML-DSA. #unverified."
    ),
    "availability_not_equivalence": (
        "Corroboration here means a second implementation EXPOSES the same primitive. It is not a "
        "check that two implementations produce identical output -- that needs shared test "
        "vectors at the API level, and is the natural next slice of this track."
    ),
}


def build(name: str) -> dict:
    """
    This image probes exactly ONE library.

    One image per library rather than one carrying all three: a build quirk in
    one product must not be able to hide another's result, and a multi-stage
    image containing all three fails as a unit. The per-library results are
    merged by `merge_crosslib.py` after each has succeeded or failed on its own.
    """
    row = probe_library(name)
    return {
        "schema": "crosslib/1",
        "track": "crosslib",
        "label": "cross-library diversity",
        "environment": {
            "iso_timestamp": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        },
        "scope": SCOPE,
        "library": row,
        "liboqs_exposes": LIBOQS_EXPOSES,
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--library", default=os.environ.get("CROSSLIB_LIBRARY"))
    ap.add_argument("--output-dir", default=None)
    args = ap.parse_args()

    if args.library not in LIBRARIES:
        sys.exit(
            "which library this image carries must be stated explicitly, via --library or "
            "CROSSLIB_LIBRARY. Guessing from what happens to be on PATH would let a result be "
            "attributed to the wrong project. Known: %s" % ", ".join(LIBRARIES)
        )

    result = build(args.library)
    out = json.dumps(result, indent=2)

    if args.output_dir:
        os.makedirs(args.output_dir, exist_ok=True)
        date = result["environment"]["iso_timestamp"][:10]
        slug = args.library.lower().replace(" ", "-")
        path = os.path.join(args.output_dir, "crosslib-%s-%s.json" % (slug, date))
        with open(path, "w") as fh:
            fh.write(out)
        print("wrote %s" % path)
    else:
        print(out)

    row = result["library"]
    print(
        "\n%s: %s"
        % (
            args.library,
            ", ".join(row.get("exposed", [])) or "nothing from the alias table was observed",
        ),
        file=sys.stderr,
    )


if __name__ == "__main__":
    main()
