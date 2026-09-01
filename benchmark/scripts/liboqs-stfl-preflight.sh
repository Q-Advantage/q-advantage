#!/usr/bin/env bash
#
# Preflight for the LMS/XMSS rebuild. Reports only — changes nothing.
#
# docs/runbook.md's rebuild sketch carried the caveat "to be confirmed against
# however liboqs was originally installed on that host". This script is that
# confirmation. Run it on the measurement box before rebuild-liboqs-stfl.sh and
# read the output; it tells you where liboqs actually lives, which stateful
# flags the current build has, and whether the rebuild has anything to do.
#
# Safe to run on a live runner at any time. It imports oqs read-only and never
# writes outside /tmp.

set -uo pipefail

say() { printf '%s\n' "$*"; }
hr()  { printf '%s\n' "------------------------------------------------------------"; }

say "liboqs stateful-signature preflight"
say "host: $(hostname)   date: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
hr

# --- the venv the workflow sources -----------------------------------------
VENV="${VENV:-$HOME/q-advantage/venv}"
if [[ -f "$VENV/bin/activate" ]]; then
  say "venv:            $VENV"
  # shellcheck disable=SC1091
  source "$VENV/bin/activate"
else
  say "venv:            NOT FOUND at $VENV"
  say "                 (set VENV=... if the workflow sources a different one)"
fi

say "python:          $(command -v python3 || echo 'not found')"
hr

# --- what the installed liboqs actually reports -----------------------------
python3 - <<'PY'
import sys

try:
    import oqs
except Exception as exc:
    print(f"oqs import:      FAILED — {type(exc).__name__}: {exc}")
    print("                 Nothing else can be determined. Fix this first.")
    sys.exit(0)

ver = getattr(oqs, "oqs_version", lambda: "unknown")()
pyver = getattr(oqs, "oqs_python_version", lambda: "unknown")()
print(f"liboqs:          {ver}")
print(f"liboqs-python:   {pyver}")

lib = getattr(getattr(oqs, "_liboqs", None), "_name", None)
if lib:
    print(f"shared object:   {lib}")

fn = getattr(oqs, "get_enabled_stateful_sig_mechanisms", None)
if fn is None:
    print("stateful API:    ABSENT — get_enabled_stateful_sig_mechanisms() not in this")
    print("                 liboqs-python build. StatefulSignature support is likely")
    print("                 missing entirely; the rebuild must also reinstall the")
    print("                 python binding against the new library.")
    enabled = []
else:
    enabled = list(fn())
    print(f"enabled stateful mechanisms ({len(enabled)}): {enabled or 'NONE'}")

# The list above is populated by the HAZARDOUS keygen flag. Option A does not
# set it, so an empty list is EXPECTED after an Option A rebuild and is not
# evidence the rebuild failed. What Option A changes is whether the mechanism
# can be CONSTRUCTED at all -- which is what the harness's verify-only path
# needs. Test that directly.
SCHEMES = [
    "LMS_SHA256_H10_W8",
    "LMS_SHA256_H15_W8",
    "XMSS-SHA2_10_256",
    "XMSSMT-SHA2_20/2_256",
]
print()
print("constructible (this is what Option A actually changes):")
compiled = 0
for name in SCHEMES:
    try:
        with oqs.StatefulSignature(name):
            print(f"  {name:24} YES — compiled in")
            compiled += 1
    except Exception as exc:
        print(f"  {name:24} no  — {type(exc).__name__}")

print()
if compiled == len(SCHEMES):
    print("VERDICT: all four are already compiled in. The rebuild has nothing to do.")
    print("         If the daily run still reports 'unavailable', the problem is")
    print("         elsewhere -- check the KAT vectors, not the build.")
elif compiled == 0:
    print("VERDICT: none are compiled in. This is the documented state since")
    print("         2026-08-14. Proceed with rebuild-liboqs-stfl.sh.")
else:
    print(f"VERDICT: {compiled} of {len(SCHEMES)} compiled in -- a partial build.")
    print("         Investigate before rebuilding; this is not a state the")
    print("         documented procedure produces.")
PY

hr

# --- the KAT vectors the verify-only path needs -----------------------------
REPO="${REPO:-$HOME/q-advantage}"
VEC="$REPO/benchmark/protocols/vectors"
if [[ -d "$VEC" ]]; then
  say "KAT vectors:     $VEC"
  count=$(find "$VEC" -name '*.rsp' 2>/dev/null | wc -l | tr -d ' ')
  say "                 $count .rsp files present (4 expected)"
  if [[ "$count" != "4" ]]; then
    say "                 WARNING: verify-only timing needs all four. Run"
    say "                 benchmark/protocols/fetch_kat_vectors.py on this host."
  fi
else
  say "KAT vectors:     NOT FOUND at $VEC (set REPO=... if the checkout differs)"
fi

hr
say "Nothing was changed. To rebuild: benchmark/scripts/rebuild-liboqs-stfl.sh"
