#!/usr/bin/env bash
# Run one Layer B scenario end to end and emit its result file.
#
# Runs on the HOST (or the CI runner), driving docker compose. The container
# scripts under scripts/ run inside the testbed; this one orchestrates them.
#
# Usage: ./run-scenario.sh <scenario>
#   pairwise     one hybrid handshake, the baseline case
#   mismatch     client and server share no group -- rejection is the result
#   concurrency  N simultaneous live connections
#   rtt          netem-injected latency
#   middlebox    a passthrough proxy in the path
set -uo pipefail

SCENARIO="${1:-pairwise}"
cd "$(dirname "$0")"
mkdir -p out

# Per-scenario configuration. The client/server group lists are the knob that
# turns a normal run into the deliberate-misconfiguration case: they are set
# here rather than inside the images so a run's configuration is visible in the
# result rather than baked into a container.
CLIENT_PROFILE="$SCENARIO"
ENV_NOTE=""
case "$SCENARIO" in
  pairwise)
    export GROUPS_CLIENT="X25519MLKEM768:x25519"
    export GROUPS_SERVER="X25519MLKEM768:x25519"
    export CAPTURE_SECONDS=30
    ;;
  mismatch)
    # No overlap at all. A handshake that fails here is the POINT: it produces
    # the failure/downgrade dataset spec 3a exists to generate, and the result
    # must distinguish a clean rejection from a silent fall back to classical.
    export GROUPS_CLIENT="X25519MLKEM768"
    export GROUPS_SERVER="x25519"
    export CAPTURE_SECONDS=30
    ENV_NOTE="deliberate misconfiguration: client and server share no group"
    ;;
  concurrency)
    export GROUPS_CLIENT="X25519MLKEM768:x25519"
    export GROUPS_SERVER="X25519MLKEM768:x25519"
    export CONNECTIONS="${CONNECTIONS:-50}"
    export CAPTURE_SECONDS=90
    ENV_NOTE="${CONNECTIONS} simultaneous live connections"
    ;;
  rtt)
    export GROUPS_CLIENT="X25519MLKEM768:x25519"
    export GROUPS_SERVER="X25519MLKEM768:x25519"
    export DELAY_MS="${DELAY_MS:-50}"
    export CAPTURE_SECONDS=40
    # Recorded explicitly because an injected delay must never be read as real
    # geography. netem reproduces the round-trip cost, not the path.
    ENV_NOTE="netem ${DELAY_MS}ms injected on the client egress (synthetic, not real distance)"
    ;;
  middlebox)
    export GROUPS_CLIENT="X25519MLKEM768:x25519"
    export GROUPS_SERVER="X25519MLKEM768:x25519"
    export PROXY_IMAGE="${PROXY_IMAGE:-nginx:1.27-alpine}"
    export PROXY_CONF="${PROXY_CONF:-nginx.conf}"
    export CAPTURE_SECONDS=45
    ENV_NOTE="TCP passthrough proxy in the path: ${PROXY_IMAGE}"
    ;;
  *)
    echo "unknown scenario: $SCENARIO" >&2
    exit 2
    ;;
esac
export SCENARIO

echo "=== scenario: $SCENARIO"
echo "    client groups: ${GROUPS_CLIENT}"
echo "    server groups: ${GROUPS_SERVER}"
[ -n "$ENV_NOTE" ] && echo "    path: $ENV_NOTE"

docker compose --profile "$CLIENT_PROFILE" up -d

# Wait for the traffic-generating container to finish, then let the capture
# stop on its own timeout. Tearing down the instant the client exits races
# tcpdump's flush, and a truncated capture parses as "no traffic" -- which is
# also a real outcome, so the two must never be confusable.
case "$SCENARIO" in
  concurrency) WAIT_FOR=swarm ;;
  rtt)         WAIT_FOR=delayed-client ;;
  middlebox)   WAIT_FOR=proxy-client ;;
  *)           WAIT_FOR=client ;;
esac

timeout 180 bash -c \
  "until [ -n \"\$(docker compose --profile $CLIENT_PROFILE ps -a --status exited -q $WAIT_FOR)\" ]; do sleep 2; done" \
  || echo "warning: $WAIT_FOR did not exit within the wait window"

# Give the capture time to flush and the sampler to finish its window.
sleep 8

docker compose --profile "$CLIENT_PROFILE" logs --no-color > "out/${SCENARIO}-containers.log" 2>&1 || true
docker compose --profile "$CLIENT_PROFILE" down -v --timeout 30 || true

echo "--- container logs ---"
cat "out/${SCENARIO}-containers.log" || true
echo "--- captured files ---"
ls -la out/ || true

SOCKSTAT_ARG=()
[ -f "out/sockstat-${SCENARIO}.csv" ] && SOCKSTAT_ARG=(--sockstat "out/sockstat-${SCENARIO}.csv")

python3 capture/parse_capture.py "out/${SCENARIO}.pcap" \
  --label "$SCENARIO" \
  --client-groups "$GROUPS_CLIENT" \
  --server-groups "$GROUPS_SERVER" \
  --env-note "$ENV_NOTE" \
  "${SOCKSTAT_ARG[@]}" \
  --output-dir out/results

echo "--- result ---"
cat out/results/layer-b-"${SCENARIO}"-*.json
