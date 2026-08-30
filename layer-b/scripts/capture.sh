#!/usr/bin/env bash
# Capture sidecar. Runs in the server's network namespace.
set -uo pipefail

SECONDS_TO_RUN="${CAPTURE_SECONDS:-40}"
SCENARIO="${SCENARIO:-pairwise}"
mkdir -p /out

# Sample kernel socket accounting alongside the capture. This is how the
# "bytes of state per half-open connection" question gets answered without
# building a SYN flooder: under the concurrency scenario, connections pass
# through SYN_RECV legitimately, so sampling the real accounting while that
# happens observes the thing rather than manufacturing it.
(
  echo "ts,tcp_inuse,tcp_orphan,tcp_tw,tcp_alloc,tcp_mem_pages,syn_recv,established"
  END=$(( $(date +%s) + SECONDS_TO_RUN ))
  while [ "$(date +%s)" -lt "$END" ]; do
    LINE=$(grep '^TCP:' /proc/net/sockstat 2>/dev/null || echo "")
    INUSE=$(echo "$LINE"  | sed -n 's/.*inuse \([0-9]*\).*/\1/p')
    ORPHAN=$(echo "$LINE" | sed -n 's/.*orphan \([0-9]*\).*/\1/p')
    TW=$(echo "$LINE"     | sed -n 's/.*tw \([0-9]*\).*/\1/p')
    ALLOC=$(echo "$LINE"  | sed -n 's/.*alloc \([0-9]*\).*/\1/p')
    MEM=$(echo "$LINE"    | sed -n 's/.*mem \([0-9]*\).*/\1/p')
    SR=$(ss -H -n state syn-recv 2>/dev/null | wc -l)
    EST=$(ss -H -n state established 2>/dev/null | wc -l)
    echo "$(date +%s.%N),${INUSE:-},${ORPHAN:-},${TW:-},${ALLOC:-},${MEM:-},${SR:-0},${EST:-0}"
    sleep 0.2
  done
) > "/out/sockstat-${SCENARIO}.csv" 2>/dev/null &

# Optionally delay the SERVER's egress as well as the client's.
#
# This sidecar shares the server's network namespace, so netem applied here
# delays traffic leaving the server. That matters because the capture is taken
# at the server: a delay injected only on the client's egress happens before
# the SYN arrives, so a server-side observer correctly sees no round trip at
# all. The first real RTT run read 40 microseconds against 50 ms injected for
# exactly that reason. Delaying both directions makes the path symmetric, which
# is the condition under which an endpoint capture can see a round trip.
if [ -n "${EGRESS_DELAY_MS:-}" ]; then
  tc qdisc add dev eth0 root netem delay "${EGRESS_DELAY_MS}ms" 2>/dev/null     || tc qdisc change dev eth0 root netem delay "${EGRESS_DELAY_MS}ms" 2>/dev/null     || echo "capture: WARNING could not apply server-side netem"
  echo "capture: server egress delayed ${EGRESS_DELAY_MS}ms"
fi

echo "capture: scenario=${SCENARIO} seconds=${SECONDS_TO_RUN}"
# -s 0 keeps whole packets: a truncated snaplen would cut off the very
# key_share bytes this exercise exists to read.
# -U writes each packet as it arrives. Without it, stopping this container
# between the handshake and the flush truncates the file into something that
# parses as "no traffic" -- which is also a real outcome, so the two must never
# be confusable.
timeout "${SECONDS_TO_RUN}" tcpdump -i any -s 0 -U -w "/out/${SCENARIO}.pcap" \
  "tcp port 4433" || true
wait || true
echo "capture: done"
