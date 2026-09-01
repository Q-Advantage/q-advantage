#!/usr/bin/env bash
#
# Rebuild liboqs on the measurement host with LMS and XMSS compiled in.
#
# This is Option A from docs/runbook.md -- verify-only. It deliberately does NOT
# set OQS_HAZARDOUS_EXPERIMENTAL_ENABLE_SIG_STFL_KEY_SIG_GEN, the flag that
# enables key generation and signing. Upstream "explicitly discourages enabling
# this variable and reserves the right to remove this feature in future
# releases if its use causes actual harm". Enabling it is a founder decision
# with a disclosure obligation attached, not a maintenance task, and this
# script will not make it for you.
#
# What this changes: the same liboqs 0.15.0, rebuilt with two extra ON flags.
# No version bump. Every algorithm the daily benchmark already measures is
# still there afterwards -- and this script checks that before it finishes,
# because breaking the daily run to add a new one would be a bad trade.
#
# Run benchmark/scripts/liboqs-stfl-preflight.sh first.
#
# This script does not touch .github/workflows/benchmark.yml or the runner
# configuration. Neither needs to change for this.

set -euo pipefail

LIBOQS_VERSION="${LIBOQS_VERSION:-0.15.0}"
SRC="${SRC:-$HOME/src/liboqs}"
PREFIX="${PREFIX:-$HOME/.local}"
VENV="${VENV:-$HOME/q-advantage/venv}"

say() { printf '\n=== %s\n' "$*"; }

say "Rebuilding liboqs ${LIBOQS_VERSION} with LMS/XMSS (Option A, verify-only)"
printf '  source:  %s\n  prefix:  %s\n  venv:    %s\n' "$SRC" "$PREFIX" "$VENV"

# --- refuse to guess --------------------------------------------------------
if [[ ! -d "$SRC/.git" ]]; then
  cat >&2 <<EOF

ERROR: no liboqs git checkout at $SRC

This script will not clone one. Where liboqs was originally installed
determines what the daily benchmark links against, and guessing wrong would
leave two builds on the box with the workflow using whichever it finds first.

Run liboqs-stfl-preflight.sh -- it prints the shared object the installed
oqs module is actually loading -- then set SRC= and PREFIX= to match, or
point them at wherever the original build lives.
EOF
  exit 1
fi

if [[ ! -f "$VENV/bin/activate" ]]; then
  echo "ERROR: no venv at $VENV. Set VENV= to the one benchmark.yml sources." >&2
  exit 1
fi

# --- capture what works now, to compare against afterwards ------------------
say "Recording the current mechanism inventory (to detect regressions)"
# shellcheck disable=SC1091
source "$VENV/bin/activate"
BEFORE="$(mktemp)"
python3 -c "
import json, oqs
print(json.dumps({
    'kem': sorted(oqs.get_enabled_kem_mechanisms()),
    'sig': sorted(oqs.get_enabled_sig_mechanisms()),
}))" > "$BEFORE"
python3 -c "
import json;d=json.load(open('$BEFORE'))
print(f\"  {len(d['kem'])} KEM and {len(d['sig'])} signature mechanisms before\")"
deactivate

# --- build ------------------------------------------------------------------
say "Checking out ${LIBOQS_VERSION}"
git -C "$SRC" fetch --tags --quiet
git -C "$SRC" checkout --quiet "$LIBOQS_VERSION"

say "Configuring"
# Same two flags Layer B's image already proves work (layer-b/Dockerfile).
cmake -S "$SRC" -B "$SRC/build" \
  -DCMAKE_INSTALL_PREFIX="$PREFIX" \
  -DBUILD_SHARED_LIBS=ON \
  -DOQS_ENABLE_SIG_STFL_LMS=ON \
  -DOQS_ENABLE_SIG_STFL_XMSS=ON

say "Building"
cmake --build "$SRC/build" --parallel

say "Installing to $PREFIX"
cmake --install "$SRC/build"
command -v ldconfig >/dev/null && ldconfig 2>/dev/null || true

# --- rebind the python binding ---------------------------------------------
say "Reinstalling liboqs-python against the new library"
# shellcheck disable=SC1091
source "$VENV/bin/activate"
pip install --quiet --force-reinstall --no-binary :all: "liboqs-python==${LIBOQS_VERSION}"

# --- verify: the new thing works AND the old things still do ----------------
say "Verifying"
python3 - "$BEFORE" <<'PY'
import json, sys

import oqs

before = json.load(open(sys.argv[1]))
kem_now = sorted(oqs.get_enabled_kem_mechanisms())
sig_now = sorted(oqs.get_enabled_sig_mechanisms())

lost_kem = sorted(set(before["kem"]) - set(kem_now))
lost_sig = sorted(set(before["sig"]) - set(sig_now))

print(f"  KEM mechanisms: {len(before['kem'])} -> {len(kem_now)}")
print(f"  SIG mechanisms: {len(before['sig'])} -> {len(sig_now)}")

SCHEMES = [
    "LMS_SHA256_H10_W8",
    "LMS_SHA256_H15_W8",
    "XMSS-SHA2_10_256",
    "XMSSMT-SHA2_20/2_256",
]
print()
print("  stateful schemes, constructible:")
ok = 0
for name in SCHEMES:
    try:
        with oqs.StatefulSignature(name):
            print(f"    {name:24} YES")
            ok += 1
    except Exception as exc:
        print(f"    {name:24} no  ({type(exc).__name__})")

print()
if lost_kem or lost_sig:
    print("  FAILED: the rebuild DROPPED mechanisms the daily benchmark measures.")
    if lost_kem:
        print(f"    missing KEM: {lost_kem}")
    if lost_sig:
        print(f"    missing SIG: {lost_sig}")
    print("  Do not run the benchmark against this build. Reinstall the previous one.")
    sys.exit(1)

if ok == 0:
    print("  FAILED: no stateful scheme is constructible. The flags did not take.")
    print("  Check that the oqs module is loading the library you just installed --")
    print("  a second liboqs earlier on the loader path is the usual cause.")
    sys.exit(1)

if ok < len(SCHEMES):
    print(f"  PARTIAL: {ok} of {len(SCHEMES)} constructible. Investigate before running.")
    sys.exit(1)

print("  OK: all four stateful schemes compiled in, nothing else lost.")
print()
print("  Note: get_enabled_stateful_sig_mechanisms() stays EMPTY under Option A.")
print("  That list is populated by the keygen flag this build deliberately omits.")
print("  The harness expects that and falls back to timing verification against")
print("  the committed KAT vectors -- status 'ok', mode 'verify_only'.")
PY

rm -f "$BEFORE"

cat <<'EOF'

=== Done.

Next, in order:

  1. Dispatch the verification workflow so the result is on the record:
       gh workflow run liboqs-stfl-verify.yml

  2. Trigger a benchmark run and read the newest
     benchmark/results/protocols/lms-xmss-*.json.

     Expect per scheme: status "ok", mode "verify_only", a verify timing
     block, and NO keygen or sign block. Those are absent because this build
     cannot produce them -- not zero, and not to be filled in.

     Any scheme still "unavailable" is telling you the truth. So is a
     "kat_verification_failed". Do not hand-edit a result file to make this
     look done -- see CLAUDE.md guardrail 1.

  3. If LMS/XMSS numbers are published, the methodology page must say they are
     verification-only and why. Absent keygen and signing figures are a
     property of the build, and a reader comparing them to the other
     signature schemes needs to know that.
EOF
