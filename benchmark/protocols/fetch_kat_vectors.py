"""Fetch upstream known-answer test vectors for stateful hash-based signatures.

Run once on the benchmark host, before the first verify-only LMS/XMSS run:

    python3 benchmark/protocols/fetch_kat_vectors.py

Why this exists
---------------
`lms_xmss.py` benchmarks LMS/XMSS *verification* without needing a liboqs build
that can generate keys or signatures. Verification needs a (public key, message,
signature) triple from somewhere, and that somewhere must not be us: a test
vector this repo authored would be indistinguishable from a fabricated one.

So the vectors come from liboqs's own KAT corpus at a pinned tag, and each file
is checked against the SHA-256 that upstream publishes for it in its own
`kats.json`. Nothing here is transcribed by hand and nothing is generated
locally. If a checksum does not match, the file is discarded and the scheme
stays unmeasured — see guardrail 1 in CLAUDE.md.

The fetched vectors and a provenance manifest land in
`benchmark/protocols/vectors/`. `lms_xmss.py` reads them from there and reports
`status: "unavailable"` if they are absent, exactly as it does when the liboqs
build lacks the mechanism.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

# Pinned so a re-run cannot silently pick up different vectors. Bump
# deliberately, and expect the checksums to change when you do.
LIBOQS_TAG = "0.15.0"
RAW_BASE = f"https://raw.githubusercontent.com/open-quantum-safe/liboqs/{LIBOQS_TAG}/tests/KATs/sig_stfl"
KATS_MANIFEST = f"{RAW_BASE}/kats.json"

# liboqs mechanism names. NOT the RFC 8554 parameter-set names — see the note in
# lms_xmss.py about the two being different.
SCHEMES = [
    "LMS_SHA256_H10_W8",
    "LMS_SHA256_H15_W8",
    "XMSS-SHA2_10_256",
    "XMSSMT-SHA2_20/2_256",
]

# The corpus is laid out by family; resolve rather than assume.
CANDIDATE_DIRS = ["lms", "xmss", "xmssmt", ""]

VECTORS_DIR = Path(__file__).resolve().parent / "vectors"


def _get(url: str) -> bytes:
    with urllib.request.urlopen(url, timeout=60) as response:  # noqa: S310 (pinned host)
        return response.read()


def _safe_filename(scheme: str) -> str:
    """Local filename. XMSSMT names contain '/', which is not a filename."""
    return scheme.replace("/", "_") + ".rsp"


def _remote_filename(scheme: str) -> str:
    """
    Upstream's filename for a mechanism.

    Confirmed against the 0.15.0 tree: the '/' in multi-tree names becomes '-',
    so mechanism `XMSSMT-SHA2_20/2_256` is stored as `XMSSMT-SHA2_20-2_256.rsp`,
    and all XMSS and XMSSMT vectors live under `xmss/`.
    """
    return scheme.replace("/", "-") + ".rsp"


def fetch(dry_run: bool = False) -> int:
    print(f"[kat] liboqs tag {LIBOQS_TAG}")

    try:
        expected = json.loads(_get(KATS_MANIFEST))
    except urllib.error.URLError as exc:
        print(f"[kat] FATAL: could not read upstream kats.json: {exc}", file=sys.stderr)
        return 1

    print(f"[kat] upstream manifest lists {len(expected)} mechanisms")

    records = []
    failures = 0

    for scheme in SCHEMES:
        if scheme not in expected:
            print(f"[kat] SKIP {scheme}: not in upstream kats.json — check the mechanism name")
            failures += 1
            continue

        want_sha = expected[scheme]
        blob = None
        source_url = None

        for subdir in CANDIDATE_DIRS:
            leaf = _remote_filename(scheme)
            url = f"{RAW_BASE}/{subdir}/{leaf}" if subdir else f"{RAW_BASE}/{leaf}"
            try:
                blob = _get(url)
                source_url = url
                break
            except urllib.error.HTTPError:
                continue

        if blob is None:
            print(f"[kat] SKIP {scheme}: no .rsp found under {CANDIDATE_DIRS}")
            failures += 1
            continue

        got_sha = hashlib.sha256(blob).hexdigest()
        if got_sha != want_sha:
            # Do not keep it. A vector we cannot authenticate is worse than no
            # vector, because the timing it produces would look real.
            print(
                f"[kat] REJECT {scheme}: sha256 {got_sha[:16]}… != upstream {want_sha[:16]}…",
                file=sys.stderr,
            )
            failures += 1
            continue

        if not dry_run:
            VECTORS_DIR.mkdir(parents=True, exist_ok=True)
            (VECTORS_DIR / _safe_filename(scheme)).write_bytes(blob)

        records.append(
            {
                "scheme": scheme,
                "file": _safe_filename(scheme),
                "source_url": source_url,
                "sha256": got_sha,
                "sha256_source": "liboqs tests/KATs/sig_stfl/kats.json",
                "bytes": len(blob),
            }
        )
        print(f"[kat] OK   {scheme}  {len(blob)} B  sha256 verified")

    if not dry_run and records:
        manifest = {
            "_generated_by": "benchmark/protocols/fetch_kat_vectors.py",
            "_do_not_edit": "Vectors are upstream artefacts, checksum-verified. Never hand-edit.",
            "liboqs_tag": LIBOQS_TAG,
            "retrieved_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "vectors": records,
        }
        (VECTORS_DIR / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
        print(f"[kat] wrote {VECTORS_DIR / 'manifest.json'}")

    print(f"[kat] {len(records)} verified, {failures} unavailable")
    # Missing vectors are a real state, not a crash: the harness reports the
    # affected schemes as unavailable and the site says so.
    return 0 if records else 1


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="verify checksums without writing")
    args = parser.parse_args()
    sys.exit(fetch(dry_run=args.dry_run))
