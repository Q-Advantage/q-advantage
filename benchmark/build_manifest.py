#!/usr/bin/env python3
"""
benchmark/build_manifest.py — arch-aware.
Discovers latest result JSON per (track, arch), copies to web/public/data/protocols/,
writes manifest.json keyed as "{track}::{arch}".
"""
import json, re, shutil, sys
from datetime import date
from pathlib import Path

RESULTS_DIR = Path("benchmark/results/protocols")
OUTPUT_DIR = Path("web/public/data/protocols")
FILENAME_RE = re.compile(
    r"^(?P<prefix>[a-z][a-z0-9\-]+?)-(?P<date>\d{4}-\d{2}-\d{2})-(?P<hash>[0-9a-f]+)\.json$"
)

def read_arch(path: Path) -> str:
    try:
        data = json.loads(path.read_text())
    except Exception:
        return "unknown"
    env = data.get("environment") or {}
    if env.get("arch"):
        return env["arch"]
    for suite in (data.get("suites") or {}).values():
        host = (suite or {}).get("host") or {}
        if host.get("arch"):
            return host["arch"]
    return "unknown"

def discover_latest() -> dict[tuple[str, str], Path]:
    candidates: dict[tuple[str, str], list[tuple[str, Path]]] = {}
    for p in sorted(RESULTS_DIR.glob("*.json")):
        m = FILENAME_RE.match(p.name)
        if not m:
            continue
        key = (m.group("prefix"), read_arch(p))
        candidates.setdefault(key, []).append((m.group("date"), p))
    return {k: max(v, key=lambda t: t[0])[1] for k, v in candidates.items()}

def build_manifest(latest: dict[tuple[str, str], Path]) -> dict:
    files = {}
    tracks, arches = set(), set()
    for (prefix, arch), src in latest.items():
        m = FILENAME_RE.match(src.name)
        files[f"{prefix}::{arch}"] = {
            "track": prefix, "arch": arch, "filename": src.name,
            "date": m.group("date"), "commit": m.group("hash"),
        }
        tracks.add(prefix); arches.add(arch)
    return {
        "generated_utc": date.today().isoformat(),
        "tracks": sorted(tracks),
        "arches": sorted(arches),
        "files": files,
    }

def main() -> None:
    latest = discover_latest()
    if not latest:
        print(f"ERROR: no result JSONs found in {RESULTS_DIR}", file=sys.stderr)
        sys.exit(1)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    for (prefix, arch), src in latest.items():
        dest = OUTPUT_DIR / src.name
        shutil.copy2(src, dest)
        print(f"  copied  {src.name}  ({prefix}, {arch})  →  {dest}")
    manifest = build_manifest(latest)
    (OUTPUT_DIR / "manifest.json").write_text(json.dumps(manifest, indent=2))
    print(f"\nTracks: {manifest['tracks']}\nArches: {manifest['arches']}")

if __name__ == "__main__":
    main()
