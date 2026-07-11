#!/usr/bin/env python3
"""
benchmark/build_manifest.py

Discovers the latest result JSON per track in benchmark/results/protocols/,
copies each to web/public/data/protocols/, and writes manifest.json.

Run from repo root:
    python3 benchmark/build_manifest.py

Tracks are discovered dynamically from filename prefixes — any file matching
<prefix>-YYYY-MM-DD-<commithash>.json is eligible. When a new track
(e.g. ssh-composed) appears, it is picked up automatically.

"Latest" is determined by the date embedded in the filename, not mtime, so
re-runs or git checkouts cannot silently select a stale file.
"""

import json
import re
import shutil
import sys
from datetime import date
from pathlib import Path

# ── paths (relative to repo root) ────────────────────────────────────────────
RESULTS_DIR = Path("benchmark/results/protocols")
OUTPUT_DIR  = Path("web/public/data/protocols")

# Filename pattern: <prefix>-YYYY-MM-DD-<hash>.json
FILENAME_RE = re.compile(
    r"^(?P<prefix>[a-z][a-z0-9\-]+?)"   # track prefix, e.g. tls-composed
    r"-(?P<date>\d{4}-\d{2}-\d{2})"     # date
    r"-(?P<hash>[0-9a-f]+)"             # short commit hash
    r"\.json$"
)


def discover_latest() -> dict[str, Path]:
    """
    Return {prefix: path} mapping the latest file per track.
    'Latest' = lexicographically largest date string in the filename.
    """
    candidates: dict[str, list[tuple[str, Path]]] = {}

    for p in sorted(RESULTS_DIR.glob("*.json")):
        m = FILENAME_RE.match(p.name)
        if not m:
            # manifest.json or any non-result file — skip
            continue
        prefix = m.group("prefix")
        date_str = m.group("date")
        candidates.setdefault(prefix, []).append((date_str, p))

    latest: dict[str, Path] = {}
    for prefix, entries in candidates.items():
        _, path = max(entries, key=lambda t: t[0])
        latest[prefix] = path

    return latest


def build_manifest(latest: dict[str, Path]) -> dict:
    """Build the manifest dict that the Next.js Server Component reads."""
    files = {}
    for prefix, src in latest.items():
        m = FILENAME_RE.match(src.name)
        files[prefix] = {
            "filename": src.name,
            "date": m.group("date"),
            "commit": m.group("hash"),
        }

    return {
        "generated_utc": date.today().isoformat(),
        "tracks": list(files.keys()),
        "files": files,
    }


def main() -> None:
    latest = discover_latest()

    if not latest:
        print(f"ERROR: no result JSONs found in {RESULTS_DIR}", file=sys.stderr)
        sys.exit(1)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    for prefix, src in latest.items():
        dest = OUTPUT_DIR / src.name
        shutil.copy2(src, dest)
        print(f"  copied  {src.name}  →  {dest}")

    manifest = build_manifest(latest)
    manifest_path = OUTPUT_DIR / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2))
    print(f"  wrote   {manifest_path}")
    print(f"\nManifest tracks: {manifest['tracks']}")


if __name__ == "__main__":
    main()
