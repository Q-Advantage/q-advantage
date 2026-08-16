import type { Metadata } from "next";
import { PageShell } from "@/components/chrome/PageShell";
import { GitHubStarPopup } from "@/components/chrome/GitHubStarPopup";
import {
  AuditBand,
  Caveat,
  DataTable,
  ExportRow,
  RowName,
  Section,
  Tag,
} from "@/components/product/kit";
import { loadProtocolsData } from "@/lib/protocols/load";
import type { ComposedSuite } from "@/lib/protocols/types";
import { formatBytes, formatDuration, formatOpsPerSec, shortCpuModel } from "@/lib/format";

export const metadata: Metadata = {
  title: "Protocol tracks — Q-Shield",
  description:
    "Post-quantum key exchange measured inside full TLS and SSH handshakes, not as primitives in isolation — with bytes on the wire, phase decomposition, and the classical baseline alongside.",
};

/**
 * Protocol tracks, rebuilt on components/product/kit.
 *
 * The composed measurements are the thing Q-Shield has that primitive
 * benchmarks structurally don't, so they get plain dense tables rather than
 * card stacks — this is a page people read numbers off, not browse.
 */
export default function ProtocolsPage() {
  const data = loadProtocolsData();
  const arches = Object.keys(data.byArch);
  const primary = data.byArch["x86_64"] ?? data.byArch[arches[0]];
  const env = primary?.tls?.environment;

  const suiteRows = (suites: Record<string, ComposedSuite> | undefined) =>
    Object.entries(suites ?? {})
      .sort(([, a], [, b]) => a.timing.mean_us - b.timing.mean_us)
      .map(([name, s]) => {
        const pct = s.baseline?.pct_over_classical;
        return {
          key: name,
          cells: [
            <RowName
              key="n"
              name={name}
              note={s.baseline?.baseline_suite ? `vs ${s.baseline.baseline_suite}` : "classical baseline"}
            />,
            formatDuration(s.timing.mean_us),
            formatDuration(s.timing.p95_us),
            formatDuration(s.timing.p99_us),
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
        };
      });

  const head = ["Suite", "Mean", "p95", "p99", "Ops/sec", "Bytes on wire", "vs classical"];

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

        {arches.map((arch) => {
          const bucket = data.byArch[arch];
          if (!bucket?.tls?.suites) return null;
          return (
            <Section
              key={`tls-${arch}`}
              eyebrow={`TLS 1.3 key exchange · ${arch}`}
              title="Hybrid and pure post-quantum against the classical baseline."
              hint="The wire column is fixed by the protocol. The timing columns move with host load — read them as a distribution."
            >
              <DataTable head={head} rows={suiteRows(bucket.tls.suites)} />
            </Section>
          );
        })}

        {arches.map((arch) => {
          const bucket = data.byArch[arch];
          if (!bucket?.ssh?.suites) return null;
          return (
            <Section
              key={`ssh-${arch}`}
              eyebrow={`SSH key exchange · ${arch}`}
              title="The same primitive, a different protocol around it."
              hint="Composition matters: the overhead a primitive adds depends on what wraps it."
            >
              <DataTable head={head} rows={suiteRows(bucket.ssh.suites)} />
            </Section>
          );
        })}

        {primary?.sig?.schemes && (
          <Section
            eyebrow="Signature track"
            title="Signing and verification, with sizes."
            hint="Verification cost matters more than signing wherever a signature is checked many times — every node on a chain, every client on a connection."
          >
            <DataTable
              head={["Scheme", "Sign", "Verify", "Public key", "Signature", "Family"]}
              rows={Object.entries(primary.sig.schemes).map(([name, s]) => ({
                key: name,
                cells: [
                  <RowName key="n" name={name} />,
                  formatDuration(s.sign.mean_us),
                  formatDuration(s.verify.mean_us),
                  formatBytes(s.public_key_bytes),
                  formatBytes(s.signature_bytes),
                  <Tag key="f">{name.toUpperCase().includes("SLH") ? "Hash" : "Lattice"}</Tag>,
                ],
              }))}
            />
          </Section>
        )}

        <Caveat label="What these benchmarks do not measure">
          These are composed handshakes timed end to end and sized on the wire. They are{" "}
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
