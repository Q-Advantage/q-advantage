// web/lib/layer-b/types.ts
//
// The Layer B result shape, mirroring schema/layer_b_result.schema.json.
//
// The distinction that governs every field below: Layer B produces STRUCTURAL
// facts and TIMINGS, and they are not equally portable. Packets, wire bytes,
// the negotiated group, fragmentation and the congestion-window verdict are
// properties of the protocol exchange — identical wherever the capture was
// taken, so publishable from anywhere. Timings are properties of the machine.
//
// That is why `timing.publishable` exists and why nothing in the UI may render
// a duration without checking it. See lib/layer-b/derive.ts.

export interface LayerBGroup {
  code: number;
  /** Name for the code point, or its hex value when it cannot be named. */
  name: string;
  /**
   * Whether this code point's identity is confirmed against a primary source.
   * False means the name is `#unverified` per CLAUDE.md's sourcing standard —
   * the hybrid PQC code points are currently in that state.
   */
  identity_verified: boolean;
  /** Present on the negotiated group: where the claim came from. */
  source?: string;
}

export type LayerBOutcomeKind =
  | "negotiated"
  | "negotiated_after_retry"
  | "downgraded_to_classical"
  | "no_client_hello"
  | "no_server_hello"
  | "server_hello_without_key_share"
  | "no_traffic_captured";

export interface LayerBOutcome {
  outcome: LayerBOutcomeKind;
  detail: string;
}

export interface LayerBWire {
  client_hello_seen: boolean;
  server_hello_seen: boolean;
  client_supported_groups: LayerBGroup[];
  client_key_share_groups: LayerBGroup[];
  negotiated_group: LayerBGroup | null;
  hello_retry_request: boolean;
  client_hello_bytes: number;
  server_hello_bytes: number;
  fragmented_messages: string[];
  /** Records after the ServerHello are encrypted: counted, never claimed read. */
  unparsed_after_serverhello: number;
}

export interface LayerBStructure {
  packets_total: number;
  packets_client_to_server: number;
  packets_server_to_client: number;
  wire_bytes_total: number;
  wire_bytes_client_to_server: number;
  wire_bytes_server_to_client: number;
  ip_fragments: number;
  segment_sizes: number[];
  largest_segment_bytes: number;
  note?: string;
}

/**
 * The initial-congestion-window verdict.
 *
 * `assumed_initcwnd_bytes` travels with it deliberately: initcwnd is a tunable
 * per-route default, so a verdict without its assumption is not reproducible.
 */
export interface LayerBCongestion {
  measurable: boolean;
  reason?: string;
  assumed_initcwnd_bytes: number;
  assumed_initcwnd_note?: string;
  first_flight_bytes?: number;
  first_flight_packets?: number;
  first_flight_ack_delay_seconds?: number | null;
  exceeded_initcwnd?: boolean;
  headroom_bytes?: number;
  flights?: number;
  flight_sizes?: number[];
}

export interface LayerBRoundTrips {
  direction_changes: number;
  approx_round_trips: number;
  note?: string;
}

/**
 * SYN to SYN/ACK, measured at the capture point.
 *
 * Deliberately NOT called round-trip time. The capture sits in the server's
 * network namespace, so a delay injected on the client's egress happens before
 * the SYN arrives and is invisible from that end — the first real run read 40 µs
 * against 50 ms injected. `is_full_round_trip` records whether the observation
 * can be read as a path property at all.
 */
export interface LayerBRtt {
  measurable: boolean;
  syn_to_synack_seconds?: number;
  observed_at?: string;
  is_full_round_trip?: boolean;
  source?: string;
  reason?: string;
  note?: string;
}

export interface LayerBTiming {
  duration_seconds: number | null;
  /** False for any run on a laptop or a shared CI runner. Never render without checking. */
  publishable: boolean;
  note?: string;
}

export interface LayerBConcurrency {
  connections: number;
  measurable: boolean;
  reason?: string;
  /**
   * Carried in the payload, not just in prose. `layer-b-spec.md` §7: this
   * number and Layer A's cryptographic-throughput-under-contention number
   * answer different questions and must never share one casual name.
   */
  label?: string;
  label_note?: string;
  duration_seconds?: { min: number; median: number; p95: number; max: number };
  wall_clock_seconds?: number | null;
  completed_per_second?: number | null;
  packets_total?: number;
  wire_bytes_total?: number;
}

export interface LayerBSockets {
  measurable: boolean;
  reason?: string;
  samples?: number;
  peak_syn_recv?: number;
  peak_established?: number;
  peak_tcp_mem_bytes?: number;
  method_note?: string;
  bytes_per_established_connection?: {
    median: number;
    min: number;
    max: number;
    samples: number;
    note?: string;
  } | null;
  bytes_per_established_reason?: string;
  syn_recv_observations?: number;
  bytes_per_half_open_connection?: {
    median: number;
    min: number;
    max: number;
    samples: number;
    note?: string;
  } | null;
  bytes_per_half_open_reason?: string;
}

export interface LayerBEnvironment {
  /** What was in the network path — an injected delay, a proxy product. */
  path_note?: string;
  sockets?: LayerBSockets;
}

export interface LayerBResult {
  schema: string;
  identity: {
    layer: "B";
    protocol: string;
    mode: string;
    label: string;
    client_groups_offered?: string;
    server_groups_accepted?: string;
  };
  outcome: LayerBOutcome;
  wire?: LayerBWire;
  structure?: LayerBStructure;
  congestion?: LayerBCongestion;
  round_trips?: LayerBRoundTrips;
  rtt?: LayerBRtt;
  timing?: LayerBTiming;
  concurrency?: LayerBConcurrency;
  outcomes_by_kind?: Record<string, number>;
  negotiated_groups?: Record<string, number>;
  environment?: LayerBEnvironment;
  audit?: { git_commit?: string | null; timestamp_utc?: string };
}

export interface LayerBData {
  /** One result per scenario, keyed by `identity.label`. */
  byScenario: Record<string, LayerBResult>;
  scenarios: string[];
}
