#!/usr/bin/env bash
# N simultaneous live TCP+TLS connections.
#
# This is spec section 7's "connections per core" number: real accept()/
# connect(), real socket buffers, real handshake state machine. It is NOT
# Layer A's concurrency figure, which is cryptographic throughput under CPU
# contention with no sockets involved. The two answer different questions and
# the spec is explicit that they must never share a label.
set -uo pipefail

GROUPS="${GROUPS:-X25519MLKEM768:x25519}"
HOST="${HOST:-server}"
PORT="${PORT:-4433}"
N="${CONNECTIONS:-50}"
sleep "${START_DELAY:-6}"

echo "swarm: opening ${N} concurrent connections to ${HOST}:${PORT} groups=${GROUPS}"
START=$(date +%s.%N)

pids=()
for i in $(seq 1 "$N"); do
  (
    echo -e "GET / HTTP/1.0\r\n\r\n" | timeout 30 openssl s_client \
      -connect "${HOST}:${PORT}" -tls1_3 -groups "${GROUPS}" -quiet \
      >/dev/null 2>&1
    echo "$?" > "/tmp/rc.$i"
  ) &
  pids+=($!)
done

for p in "${pids[@]}"; do wait "$p" || true; done
END=$(date +%s.%N)

ok=0; fail=0
for i in $(seq 1 "$N"); do
  if [ "$(cat "/tmp/rc.$i" 2>/dev/null || echo 1)" = "0" ]; then ok=$((ok+1)); else fail=$((fail+1)); fi
done

mkdir -p /out
# Client-side wall clock, recorded separately from anything derived from the
# capture so the two can be cross-checked rather than conflated.
cat > /out/swarm.json <<JSON
{
  "connections_requested": ${N},
  "connections_succeeded": ${ok},
  "connections_failed": ${fail},
  "wall_clock_seconds": $(echo "$END - $START" | bc -l),
  "groups": "${GROUPS}",
  "note": "Client-side wall clock. Kept separate from capture-derived timings so the two can be cross-checked."
}
JSON
echo "swarm: ${ok} ok, ${fail} failed"
cat /out/swarm.json
