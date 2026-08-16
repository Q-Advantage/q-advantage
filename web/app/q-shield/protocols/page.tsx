import type { Metadata } from "next";
import { Suspense } from "react";
import { PageShell } from "@/components/chrome/PageShell";
import { GitHubStarPopup } from "@/components/chrome/GitHubStarPopup";
import {
  AuditBand,
  Caveat,
  DataTable,
  ExportRow,
  RowName,
  Section,
  StackedBar,
  Tag,
  type KitRow,
} from "@/components/product/kit";
import { SortableTable, TabbedPanels } from "@/components/product/interactive";
import type { TabItem } from "@/components/product/tabs";
import { loadProtocolsData } from "@/lib/protocols/load";
import { decomposePhases } from "@/lib/protocols/phases";
import { aesBaselinesByArch, formatTailRatio, tailRatio } from "@/lib/protocols/metrics";
import type { ComposedSuite, TimingBlock } from "@/lib/protocols/types";
import {
  formatBytes,
  formatDuration,
  formatOpsPerSec,
  githubCommitUrl,
  shortCpuModel,
} from "@/lib/format";

export const metadata: Metadata = {
  title: "Protocol tracks — Q-Shield",
  description:
    "Post-quantum key exchange measured inside full TLS and SSH handshakes, not as primitives in isolation — with bytes on the wire, phase decomposition, and the classical baseline alongside.",
};

export const dynamic = "force-static";

/**
 * Protocol tracks, rebuilt on components/product/kit.
 *
 * The composed measurements are the thing Q-Shield has that primitive
 * benchmarks structurally don't, so they get plain dense tables rather than
 * card stacks — this is a page people read numbers off, not browse.
 *
 * Work-order 008 added the phase decomposition this page has always claimed to
 * show, plus the AES-GCM track and tail latency, all of which were measured
 * daily and rendered nowhere.
 */

const SUITE_HEAD = [
  { id: "suite", label: "Suite" },
  { id: "mean", label: "Mean" },
  { id: "median", label: "Median" },
  { id: "p95", label: "p95" },
  { id: "p99", label: "p99" },
  { id: "tail", label: "Tail", defaultDir: "desc" as const },
  { id: "ops", label: "Ops/sec", defaultDir: "desc" as const },
  { id: "bytes", label: "Key-exchange bytes" },
  { id: "vs", label: "vs classical" },
];

/** Full nine-field timing block, so nothing measured is left off the page. */
function TimingRows({ blocks }: { blocks: { label: string; t: TimingBlock }[] }) {
  return (
    <DataTable
      head={["Phase", "Mean", "Median", "p95", "p99", "Stdev", "Min", "Max", "Iterations"]}
      rows={blocks.map(({ label, t }) => ({
        key: label,
        cells: [
          <RowName key="n" name={label} />,
          formatDuration(t.mean_us),
          formatDuration(t.median_us),
          formatDuration(t.p95_us),
          formatDuration(t.p99_us),
          formatDuration(t.stdev_us),
          formatDuration(t.min_us),
          formatDuration(t.max_us),
          t.n_iterations.toLocaleString(),
        ],
      }))}
    />
  );
}

/**
 * The phase breakdown for one suite. Rendered on the server into the row's
 * detail slot, so every phase number is in the static HTML.
 */
function PhasePanel({ name, suite }: { name: string; suite: ComposedSuite }) {
  const d = decomposePhases(suite);
  if (!d) {
    return (
      <p className="text-[12px] text-fg-subtle">
        No phase decomposition was recorded for this suite.
      </p>
    );
  }

  const host = suite.host;

  return (
    <div className="space-y-4">
      <StackedBar
        segments={d.phases.map((p) => ({
          key: p.key,
          label: p.label,
          value: p.contribution_us,
          display: formatDuration(p.contribution_us),
          note:
            p.occurrences === 2
              ? `${formatDuration(p.timing.mean_us)} × 2 — client and server`
              : undefined,
        }))}
        total={formatDuration(d.composed_us)}
      />

      {!d.exact && (
        <Caveat label="This decomposition does not add up">
          The phases compose to {formatDuration(d.composed_us)} against a reported handshake mean of{" "}
          {formatDuration(d.handshake_mean_us)} — a {formatDuration(Math.abs(d.residual_us))}{" "}
          discrepancy. Treat the breakdown above as unreliable until the harness is checked. This
          notice is generated from the data, not written by hand.
        </Caveat>
      )}

      <TimingRows blocks={d.phases.map((p) => ({ label: p.label, t: p.timing }))} />

      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[11px] text-fg-subtle">
        {host?.build_path && <span>{host.build_path}</span>}
        {host?.steal_time_pct != null && <span className="num">CPU steal {host.steal_time_pct}%</span>}
        {suite.audit?.git_commit && (
          <a
            href={githubCommitUrl(suite.audit.git_commit)}
            className="font-semibold text-fg-muted transition-colors hover:text-accent"
          >
            run {suite.audit.git_commit.slice(0, 7)} ↗
          </a>
        )}
        <span className="text-fg-subtle/70">{name}</span>
      </div>
    </div>
  );
}

function suiteRows(suites: Record<string, ComposedSuite> | undefined): KitRow[] {
  return Object.entries(suites ?? {})
    .sort(([, a], [, b]) => a.timing.mean_us - b.timing.mean_us)
    .map(([name, s]) => {
      const pct = s.baseline?.pct_over_classical;
      const tail = tailRatio(s.timing);
      return {
        key: name,
        sort: {
          suite: name,
          mean: s.timing.mean_us,
          median: s.timing.median_us ?? null,
          p95: s.timing.p95_us ?? null,
          p99: s.timing.p99_us ?? null,
          tail,
          ops: s.timing.ops_per_sec ?? null,
          bytes: s.size?.bytes_total ?? null,
          vs: pct ?? null,
        },
        cells: [
          <RowName
            key="n"
            name={name}
            note={s.baseline?.baseline_suite ? `vs ${s.baseline.baseline_suite}` : "classical baseline"}
          />,
          formatDuration(s.timing.mean_us),
          formatDuration(s.timing.median_us),
          formatDuration(s.timing.p95_us),
          formatDuration(s.timing.p99_us),
          formatTailRatio(tail),
          formatOpsPerSec(s.timing.ops_per_sec),
          s.size ? `${s.size.bytes_total.toLocaleString()} B` : "—",
          pct == null ? (
            <span key="b" className="text-fg-subtle">
              baseline
            </span>
          ) : (
            <span key="d" className={pct < 0 ? "text-status-ok" : "text-fg"}>
              {pct < 0 ? "−" : "+"}
              {Math.abs(pct).toFixed(1)}%
            </span>
          ),
        ],
        detail: <PhasePanel name={name} suite={s} />,
      };
    });
}

export default function ProtocolsPage() {
  const data = loadProtocolsData();
  const arches = Object.keys(data.byArch);
  const primary = data.byArch["x86_64"] ?? data.byArch[arches[0]];
  const env = primary?.tls?.environment;
  const aes = aesBaselinesByArch(data);

  /** One track's table, split by architecture when more than one was measured. */
  function trackPanel(pick: (arch: string) => Record<string, ComposedSuite> | undefined) {
    const withData = arches.filter((a) => pick(a) && Object.keys(pick(a)!).length > 0);
    if (withData.length === 0) return null;

    const table = (arch: string) => (
              <SortableTable
          head={SUITE_HEAD}
          rows={suiteRows(pick(arch))}
          sortParam="sort"
          expandParam="suite"
          expandHint="phase decomposition"
        />
    );

    if (withData.length === 1) return table(withData[0]);

    return (
              <TabbedPanels
          ariaLabel="Architecture"
          urlParam="arch"
          items={withData.map((arch) => ({ id: arch, label: arch, content: table(arch) }))}
        />
    );
  }

  const tlsPanel = trackPanel((a) => data.byArch[a]?.tls?.suites);
  const sshPanel = trackPanel((a) => data.byArch[a]?.ssh?.suites);

  const sigPanel = primary?.sig?.schemes ? (
          <SortableTable
        head={[
          { id: "scheme", label: "Scheme" },
          { id: "keygen", label: "Keygen" },
          { id: "sign", label: "Sign" },
          { id: "verify", label: "Verify" },
          { id: "pubkey", label: "Public key" },
          { id: "sig", label: "Signature" },
          { id: "family", label: "Family" },
        ]}
        sortParam="sigsort"
        rows={Object.entries(primary.sig.schemes).map(([name, s]) => ({
          key: name,
          sort: {
            scheme: name,
            keygen: s.keygen?.mean_us ?? null,
            sign: s.sign.mean_us,
            verify: s.verify.mean_us,
            pubkey: s.public_key_bytes,
            sig: s.signature_bytes,
            family: name.toUpperCase().includes("SLH") ? "Hash" : "Lattice",
          },
          cells: [
            <RowName key="n" name={name} />,
            s.keygen ? formatDuration(s.keygen.mean_us) : "—",
            formatDuration(s.sign.mean_us),
            formatDuration(s.verify.mean_us),
            formatBytes(s.public_key_bytes),
            formatBytes(s.signature_bytes),
            <Tag key="f">{name.toUpperCase().includes("SLH") ? "Hash" : "Lattice"}</Tag>,
          ],
          detail: (
            <TimingRows
              blocks={[
                ...(s.keygen ? [{ label: "Keygen", t: s.keygen }] : []),
                { label: "Sign", t: s.sign },
                { label: "Verify", t: s.verify },
              ]}
            />
          ),
        }))}
      />
  ) : null;

  const aesPanel =
    Object.keys(aes).length > 0 ? (
      <div className="space-y-4">
        {Object.entries(aes).map(([arch, b]) => (
          <div key={arch} className="space-y-3">
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <span className="text-[13px] font-bold text-fg">{b.algorithm}</span>
              <Tag>{arch}</Tag>
              <span className="num text-[12px] text-fg-muted">
                {b.payload_bytes.toLocaleString()} B payload · {b.key_bytes} B key · {b.nonce_bytes} B
                nonce · {b.tag_bytes} B tag
              </span>
            </div>
            <p className="text-[11.5px] text-fg-subtle">
              Payload size is a cited choice, not an arbitrary one: {b.payload_bytes_source}.
            </p>
            <TimingRows
              blocks={[
                { label: "Encrypt", t: b.encrypt },
                { label: "Decrypt", t: b.decrypt },
              ]}
            />
          </div>
        ))}
      </div>
    ) : null;

  const tabs: TabItem[] = [
    tlsPanel && { id: "tls", label: "TLS 1.3", content: tlsPanel },
    sshPanel && { id: "ssh", label: "SSH", content: sshPanel },
    sigPanel && { id: "sig", label: "Signatures", content: sigPanel },
    aesPanel && { id: "aes", label: "AES-GCM", content: aesPanel },
  ].filter(Boolean) as TabItem[];

  return (
    <>
      <PageShell variant="frame" className="space-y-8">
        <div className="flex flex-col gap-3">
          <div className="eyebrow">Composed protocol tracks</div>
          <h1 className="max-w-[22ch] text-balance text-[clamp(28px,3.6vw,40px)] font-bold leading-[1.08] tracking-[-0.03em] text-fg">
            Measured inside the handshake, not beside it.
          </h1>
          <p className="max-w-[66ch] text-[15px] font-medium leading-relaxed text-fg-muted">
            Cycle counts on a primitive don&rsquo;t tell you what a connection costs. These are full
            TLS and SSH key exchanges — decomposed phase by phase, sized to the byte, and
            cross-checked against the liboqs speed tools and eBACS reference cycles so they can be
            verified against the canonical numbers. Measured on x86 and ARM so the figures travel.
          </p>
        </div>

        {env && (
          <AuditBand
            cells={[
              { k: "Run date", v: env.iso_timestamp.slice(0, 10) },
              { k: "Commit", v: env.git_commit.slice(0, 7), tone: "link" },
              {
                k: "Host",
                v: primary?.tls
                  ? shortCpuModel(Object.values(primary.tls.suites)[0]?.host?.cpu_model ?? "—")
                  : "—",
              },
              { k: "liboqs", v: env.liboqs_version },
              { k: "Architectures", v: arches.join(" · ") },
              { k: "OpenSSL", v: (env.openssl_cli ?? "—").split(" ")[1] ?? "—" },
            ]}
          />
        )}

        <Section
          eyebrow="Every track"
          title="Hybrid and pure post-quantum against the classical baseline."
          hint="Expand any suite for its phase decomposition. The wire column is fixed by the protocol; the timing columns move with host load — read them as a distribution, and read the tail column as how far it strays."
        >
          {tabs.length > 0 ? (
                          <TabbedPanels ariaLabel="Protocol track" urlParam="track" items={tabs} />
          ) : (
            <p className="text-[13px] text-fg-subtle">No protocol data is present in this build.</p>
          )}
        </Section>

        <Caveat label="How the handshake figure is built">
          The handshake mean is <strong className="font-bold text-fg">composed</strong>, not timed
          end to end: each phase is measured in its own thousand-iteration loop and the handshake
          figure is their sum, with the classical keygen and derive counted twice because both
          parties perform them. That identity holds across every committed suite to within 0.002%,
          and the smoke test fails the build if it stops holding. It is why the phase bars add to
          exactly 100% — they are the measurement, not an attribution over it.
        </Caveat>

        <Caveat label="What these benchmarks do not measure">
          These are composed handshakes sized on the wire. They are{" "}
          <strong className="font-bold text-fg">not</strong> packet captures: packets per handshake,
          initial congestion window effects, connections per core under real concurrency, and
          per-connection memory are not measured here and are not inferable from this data. Where
          those numbers matter to a capacity decision, they need their own instrument — naming the
          gap is more useful than estimating across it.
        </Caveat>

        <Section
          eyebrow="Take the data"
          title="Every figure traces to a run."
          hint="Clone the harness and you should reproduce these within run-to-run variance."
        >
          <ExportRow
            items={[
              { label: "Overview →", href: "/q-shield", primary: true },
              { label: "Compare algorithms →", href: "/q-shield/compare" },
              { label: "Raw JSON", href: "/data/protocols/manifest.json" },
              { label: "Methodology", href: "/methodology" },
              { label: "Benchmark source", href: "https://github.com/Q-Advantage/q-advantage" },
            ]}
          />
        </Section>
      </PageShell>
      <GitHubStarPopup />
    </>
  );
}
