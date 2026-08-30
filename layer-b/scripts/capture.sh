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
