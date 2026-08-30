import type { Metadata } from "next";
import { PageShell } from "@/components/chrome/PageShell";
import { AuditBand, Caveat, DataTable, RowName, Section, Tag, type KitRow } from "@/components/product/kit";
import { loadLayerBData } from "@/lib/layer-b/load";
import {
  scenarioBlurb,
  crossedTheCliff,
  groupLabel,
  negotiatedFromWire,
  orderScenarios,
  outcomeTone,
  publishableDuration,
  withheldTimingReason,
} from "@/lib/layer-b/derive";
import type { LayerBResult } from "@/lib/layer-b/types";
import { formatBytes } from "@/lib/format";

export const metadata: Metadata = {
  // Unlinked and de-indexed 2026-08-30 — see app/q-shield/layout.tsx for why.
  // Orphaning a page without this leaves it in search results, reachable by
  // exactly the people we least want landing on it cold.
  robots: { index: false, follow: false },
  title: "Layer B — live handshakes | Q-Shield",
  description:
    "Real TLS handshakes between stacks we control, captured on the wire. Packets per handshake, congestion-window pressure, and downgrade behaviour — measurements the composed harness structurally cannot produce.",
};

function OutcomeTag({ result }: { result: LayerBResult }) {
  const tone = outcomeTone(result);
  const cls =
    tone === "ok"
      ? "text-status-ok"
      : tone === "finding"
        ? "text-status-warn"
        : "text-fg-subtle";
  return <span className={`font-bold ${cls}`}>{result.outcome.outcome.replace(/_/g, " ")}</span>;
}

function scenarioRows(byScenario: Record<string, LayerBResult>): KitRow[] {
  return orderScenarios(Object.keys(byScenario)).map((label) => {
    const r = byScenario[label];
    const s = r.structure;
    const g = groupLabel(r.wire?.negotiated_group);
    const cliff = crossedTheCliff(r);

    return {
      key: label,
      cells: [
        <RowName key="n" name={label} note={scenarioBlurb(label)} />,
        <OutcomeTag key="o" result={r} />,
        <span key="g" className="tabular-nums">
          {g ? (
            <>
              {g.name}
              {g.unverified && (
                <span
                  className="ml-1.5 text-2xs uppercase tracking-eyebrow text-fg-subtle"
                  title="Code point named but not confirmed against a primary source"
                >
                  unverified
                </span>
              )}
            </>
          ) : (
            <span className="text-fg-subtle">&mdash;</span>
          )}
        </span>,
        <span key="p" className="tabular-nums">
          {s ? s.packets_total : r.concurrency?.packets_total ?? <span className="text-fg-subtle">&mdash;</span>}
        </span>,
        <span key="b" className="tabular-nums">
          {s ? formatBytes(s.wire_bytes_total) : <span className="text-fg-subtle">&mdash;</span>}
        </span>,
        <span key="c" className="tabular-nums">
          {cliff == null ? (
            <span className="text-fg-subtle">&mdash;</span>
          ) : cliff ? (
            <span className="font-bold text-status-warn">crossed</span>
          ) : (
            <span className="text-fg-muted">fits</span>
          )}
        </span>,
      ],
    };
  });
}

export default function LayerBPage() {
  const data = loadLayerBData();
  const labels = orderScenarios(data.scenarios);
  const primary = data.byScenario["pairwise"];

  // Every result committed so far is a capability run, not a measurement-host
  // run, so no duration is publishable. Computed rather than assumed, so the
  // page tells the truth the day that changes.
  const anyPublishableTiming = labels.some((l) => publishableDuration(data.byScenario[l]) != null);

  return (
    <PageShell variant="frame" className="space-y-8">
      <div className="flex flex-col gap-3">
        <div className="eyebrow">Q-Shield · Layer B</div>
        <h1 className="max-w-[24ch] text-balance text-[clamp(28px,3.6vw,40px)] font-bold leading-[1.08] tracking-[-0.03em] text-fg">
          Real handshakes, read off the wire.
        </h1>
        <p className="max-w-[68ch] text-[15px] font-medium leading-relaxed text-fg-muted">
          Everything else on this site is Layer A: each cryptographic phase timed in its own loop and
          summed. That makes the primitive numbers clean, and it means there is no socket, no packet
          and no network — so packets per handshake, congestion-window pressure and downgrade
          behaviour are not merely unmeasured there, they are unmeasurable. Layer B runs two stacks we
          control against each other and captures what actually crosses the link.
        </p>
      </div>

      {labels.length === 0 ? (
        <Caveat label="No Layer B run has been published yet">
          Layer B runs on demand rather than daily, and no result has been committed to this build.
          The harness exists and its scenarios are exercised in CI; this page shows nothing rather
          than showing a zero.
        </Caveat>
      ) : (
        <>
          {primary?.audit?.timestamp_utc && (
            <AuditBand
              cells={[
                { k: "Scenarios", v: String(labels.length) },
                { k: "Latest run", v: primary.audit.timestamp_utc.slice(0, 10) },
                { k: "Commit", v: (primary.audit.git_commit ?? "—").slice(0, 7) },
                {
                  k: "Negotiation read from",
                  v: negotiatedFromWire(primary) ? "wire bytes" : "—",
                },
              ]}
            />
          )}

          <Section
            eyebrow="Every scenario"
            title="One row per configuration, including the ones designed to fail."
            hint="The mismatch row succeeds by not negotiating: a clean rejection and a silent fall back to classical look identical from outside, and telling them apart is the point of the instrument."
          >
            <DataTable
              head={["Scenario", "Outcome", "Negotiated group", "Packets", "Wire bytes", "initcwnd"]}
              rows={scenarioRows(data.byScenario)}
            />
          </Section>

          {primary?.congestion?.measurable && (
            <Section
              eyebrow="The cliff"
              title="Whether the server's first flight fits in the initial congestion window."
              hint="Exceeding it does not just make the handshake bigger — it makes it wait, because the rest cannot go until an acknowledgement comes back. That costs a full round trip regardless of bandwidth."
            >
              <div className="grid gap-3 sm:grid-cols-3">
                <Stat
                  label="First flight"
                  value={formatBytes(primary.congestion.first_flight_bytes ?? 0)}
                  note={`${primary.congestion.first_flight_packets ?? 0} packets`}
                />
                <Stat
                  label="Assumed window"
                  value={formatBytes(primary.congestion.assumed_initcwnd_bytes)}
                  note="RFC 6928 default, tunable per route"
                />
                <Stat
                  label="Verdict"
                  value={primary.congestion.exceeded_initcwnd ? "Crossed" : "Fits"}
                  note={
                    primary.congestion.headroom_bytes != null
                      ? `${formatBytes(Math.abs(primary.congestion.headroom_bytes))} ${
                          primary.congestion.headroom_bytes >= 0 ? "headroom" : "over"
                        }`
                      : ""
                  }
                />
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-fg-subtle">
                {primary.congestion.assumed_initcwnd_note} The assumed window is published next to
                the verdict because it is a setting, not a property of the network — a reader on a
                different one needs to be able to re-judge.
              </p>
            </Section>
          )}

          {data.byScenario["concurrency"]?.concurrency?.measurable && (
            <ConcurrencyPanel result={data.byScenario["concurrency"]} />
          )}
        </>
      )}

      <Caveat label="Timings from this page are not published figures">
        {anyPublishableTiming ? (
          <>
            Some runs on this page were taken on the measurement host and their durations are shown.
            Any run that was not is shown without one.
          </>
        ) : (
          <>
            None of these runs happened on the Q-Shield measurement host, so no duration is shown for
            any of them. What <em>is</em> shown — packets, wire bytes, the negotiated group,
            fragmentation, the congestion verdict — are properties of the protocol exchange rather
            than of the machine, so they hold wherever the capture was taken. A handshake timed on a
            shared runner would not, and putting one beside Q-Shield&rsquo;s measured figures would
            make it indistinguishable from one.
          </>
        )}
      </Caveat>

      <Caveat label="What Layer B does not claim">
        The negotiated group is parsed from the ServerHello&rsquo;s <code>key_share</code> bytes,
        never from a stack&rsquo;s own report — an implementation&rsquo;s self-description of what it
        negotiated is exactly the ambiguity this layer exists to route around. Beyond that: records
        after the ServerHello are encrypted and are counted, not read; hybrid group code points are
        named but not yet confirmed against a primary source and are marked accordingly; and a
        middlebox that passes a handshake through tells you about that product at that version with
        that configuration, not about proxies in general.
      </Caveat>
    </PageShell>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded border border-border bg-bg-surface p-3">
      <div className="text-[10px] font-bold uppercase tracking-eyebrow text-fg-subtle">{label}</div>
      <div className="mt-1 text-[20px] font-bold tabular-nums text-fg">{value}</div>
      {note && <div className="mt-0.5 text-[11px] text-fg-subtle">{note}</div>}
    </div>
  );
}

function ConcurrencyPanel({ result }: { result: LayerBResult }) {
  const c = result.concurrency!;
  const sockets = result.environment?.sockets;
  return (
    <Section
      eyebrow="Connections per core"
      title="Many live connections at once, sockets and all."
      hint={c.label_note}
    >
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Connections" value={String(c.connections)} />
        <Stat
          label="Median"
          value={c.duration_seconds ? `${(c.duration_seconds.median * 1000).toFixed(1)} ms` : "—"}
          note="per connection, capture-derived"
        />
        <Stat
          label="p95"
          value={c.duration_seconds ? `${(c.duration_seconds.p95 * 1000).toFixed(1)} ms` : "—"}
        />
        <Stat
          label="Peak established"
          value={sockets?.measurable ? String(sockets.peak_established ?? "—") : "—"}
          note={sockets?.measurable ? `peak SYN_RECV ${sockets.peak_syn_recv ?? 0}` : undefined}
        />
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-fg-subtle">
        These durations are relative comparisons within one capture, not published per-connection
        timings — see the timing caveat below.{" "}
        {sockets?.bytes_per_half_open_connection == null && sockets?.bytes_per_half_open_reason}
      </p>
      <div className="mt-2">
        <Tag>{c.label}</Tag>
      </div>
    </Section>
  );
}
