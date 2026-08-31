#!/usr/bin/env bash
# Application compatibility (work-order 023) end to end.
#
# Separate from run-scenario.sh on purpose. Every scenario in that script ends
# in a packet capture and a pcap-derived result; this one produces neither. It
# sends HTTP requests at front doors and hands certificates to parsers, so
# folding it into a pipeline that ends in `parse_capture.py` would mean either
# a fake pcap or a special case threaded through the whole script.
#
# Usage: ./run-compat.sh
set -uo pipefail

cd "$(dirname "$0")"
mkdir -p out/certs out/results

echo "=== application compatibility"

# The certificates come first: the parser half of the probe has nothing to read
# without them. Reusing the same generator as the chain-sizing job rather than a
# second one, so both probes are looking at identical certificates.
echo "--- minting chains"
docker run --rm \
  -v "$PWD/certs:/certs:ro" \
  -v "$PWD/out:/out" \
  -e OUT_DIR=/out/certs \
  q-advantage/layer-b:dev bash /certs/generate-chains.sh

echo "--- bringing up the front doors"
docker compose --profile compat up -d compat-nginx compat-haproxy compat-node

echo "--- probing"
docker compose --profile compat up --no-log-prefix compat-probe

# Captured before teardown: a front door's own log is the other half of the
# story when it rejects something, and it disappears with the container.
docker compose --profile compat logs --no-color > out/compat-containers.log 2>&1 || true
docker compose --profile compat down -v --timeout 30 || true

echo "--- front door logs ---"
cat out/compat-containers.log || true

echo "--- result ---"
if ls out/results/app-compat-*.json >/dev/null 2>&1; then
  cat out/results/app-compat-*.json
else
  echo "no result file was written" >&2
  exit 1
fi
