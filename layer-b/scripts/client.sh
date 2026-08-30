#!/usr/bin/env bash
# TLS client for one pairwise Layer B run.
#
# Note what this script does NOT do: it never parses s_client's output to
# decide what was negotiated. layer-b-spec.md section 4 makes that binding --
# the negotiated group is read from the captured wire bytes by
# capture/tls_wire.py, because s_client's own reporting is exactly the
# ambiguity Layer B exists to route around. This script only drives traffic.
set -euo pipefail

GROUPS="${GROUPS:-X25519MLKEM768:x25519}"
HOST="${HOST:-server}"
PORT="${PORT:-4433}"

echo "client: connecting to ${HOST}:${PORT} groups=${GROUPS}"
# An exit code of non-zero is a legitimate outcome (the ends may share no
# group), so it is captured rather than allowed to abort the run.
set +e
echo -e "GET / HTTP/1.0\r\n\r\n" | timeout 20 openssl s_client \
  -connect "${HOST}:${PORT}" \
  -tls1_3 \
  -groups "${GROUPS}" \
  -quiet 2>/tmp/client.err >/tmp/client.out
echo "client: exit=$?"
set -e
