#!/usr/bin/env bash
# TLS server for one pairwise Layer B run.
#
# GROUPS is passed in rather than baked in, because the deliberate-
# misconfiguration mode (spec 3a) works by giving the two ends non-overlapping
# group lists. That is a first-class test case, not an error path.
set -euo pipefail

GROUPS="${GROUPS:-X25519MLKEM768:x25519}"
PORT="${PORT:-4433}"

mkdir -p /tmp/pki
if [ ! -f /tmp/pki/server.key ]; then
  # A throwaway self-signed cert. Layer B v1 measures the KEY EXCHANGE; the
  # certificate chain is explicitly out of scope (see README), so this is
  # deliberately a classical ECDSA cert and its size is not a published figure.
  openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 \
    -keyout /tmp/pki/server.key -out /tmp/pki/server.crt \
    -days 1 -nodes -subj "/CN=layer-b-server" >/dev/null 2>&1
fi

echo "server: listening on :${PORT} groups=${GROUPS}"
exec openssl s_server \
  -accept "${PORT}" \
  -cert /tmp/pki/server.crt \
  -key /tmp/pki/server.key \
  -tls1_3 \
  -groups "${GROUPS}" \
  -www \
  -quiet
