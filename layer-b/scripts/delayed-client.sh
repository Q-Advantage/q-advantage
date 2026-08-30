#!/usr/bin/env bash
# One handshake with netem-injected latency on the client's egress.
#
# The spec prefers a genuinely remote peer and names netem as the cheaper
# fallback. This is the fallback, and the result labels it as INJECTED latency
# rather than real geography -- a synthetic delay reproduces the round-trip
# cost but not the path, and presenting it as distance would be a false claim.
set -uo pipefail

DELAY_MS="${DELAY_MS:-50}"
tc qdisc add dev eth0 root netem delay "${DELAY_MS}ms" 2>/dev/null \
  || tc qdisc change dev eth0 root netem delay "${DELAY_MS}ms" 2>/dev/null \
  || echo "delayed-client: WARNING could not apply netem, latency is NOT injected"
echo "delayed-client: netem delay=${DELAY_MS}ms"
tc qdisc show dev eth0 || true

exec /layer-b/scripts/client.sh
