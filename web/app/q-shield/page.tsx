import type { Metadata } from "next";
import { Suspense } from "react";
import { PageShell } from "@/components/chrome/PageShell";
import { GitHubStarPopup } from "@/components/chrome/GitHubStarPopup";
import { StatBand } from "@/components/chrome/ProductNav";
import {
  AuditBand,
  Caveat,
  DataTable,
  ExportRow,
  LogBars,
  RowName,
  Section,
  SuiteGrid,
  Tag,
  type LogBar,
} from "@/components/product/kit";
import { SortableDataTable } from "@/components/product/table";
import { getLatestRun } from "@/lib/data/load";
import { getHomeMetrics } from "@/lib/data/home-metrics";
import {
  formatBytes,
  formatDuration,
  formatOpsPerSec,
  formatStealPercent,
  shortCpuModel,
  githubCommitUrl,
} from "@/lib/format";

/**
 * Format a measured duration, or an em-dash when the operation was not
 * measured. Never `?? 0` — a missing measurement rendered as "0.00 µs" reads
 * as the fastest row on the board, which is a fabricated number by omission.
 */
function dur(us: number | undefined): string {
  return us == null ? "—" : formatDuration(us);
}

export const metadata: Metadata = {
  title: "Q-Shield — PQC benchmarks",
  description:
    "Independent performance benchmarks for ML-KEM, ML-DSA, and SLH-DSA — composed into full TLS and SSH handshakes. Auditable, reproducible, public.",
};

/**
 * Q-Shield overview.
 *
 * Built entirely from components/product/kit — the shared instrument design.
 * P-CBOM and the cost calculator should be assembled the same way rather than
 * re-implementing the look, which is how the treatment drifted before.
 *
 * Every figure derives from the measured run. No literals.
 */
export default function QShieldPage() {
  const run = getLatestRun();
  const m = getHomeMetrics();
  const env = run.environment;

  const kems = run.algorithms.filter((a) => a.kind === "kem" && a.status === "ok");
  const sigs = run.algorithms.filter((a) => a.kind === "sig" && a.status === "ok");

  // Signing bars, sorted fastest-first. Lattice and hash-based get distinct
  // series so the family split is visible without reading the labels.
  const bars: LogBar[] = sigs
    .filter((a) => a.operations.sign)
    .map((a) => ({
      label: a.display_name,
      sublabel: a.family === "SLH-DSA" ? "Hash-based" : `Lattice · level ${a.nist_level}`,
      value: a.operations.sign!.mean_us,
      display: formatDuration(a.operations.sign!.mean_us),
      series: (a.family === "SLH-DSA" ? 1 : 0) as 0 | 1,
    }))
    .sort((x, y) => x.value - y.value);

  return (
    <>
      <PageShell variant="frame" className="space-y-8">
        <div className="flex flex-col gap-3">
          <div className="eyebrow">FIPS 203 · 204 · 205 · measured daily</div>
          <h1 className="max-w-[20ch] text-balance text-[clamp(28px,3.6vw,40px)] font-bold leading-[1.08] tracking-[-0.03em] text-fg">
            Post-quantum cryptography, measured.
          </h1>
          <p className="max-w-[66ch] text-[15px] font-medium leading-relaxed text-fg-muted">
            Every NIST-standardized post-quantum algorithm, benchmarked on real silicon and composed
            into full TLS and SSH handshakes. One thousand timed iterations per operation, garbage
            collector disabled, process pinned to a core. Every number links to the run that produced
            it.
          </p>
        </div>

        <AuditBand
          cells={[
            { k: "Run date", v: m.run.date },
            { k: "Commit", v: m.run.shortSha, tone: "link" },
            { k: "Host", v: shortCpuModel(env.cpu_model) },
            { k: "Instance", v: m.run.instanceType },
            { k: "liboqs", v: m.run.liboqsVersion },
            {
              k: "CPU steal",
              v: m.run.stealPct != null ? formatStealPercent(m.run.stealPct) : "—",
              tone: "warn",
            },
          ]}
        />

        <StatBand
          items={[
            {
              k: "Algorithms tracked",
              v: String(run.algorithms.length),
              d: `${kems.length} KEMs, ${sigs.length} signature schemes`,
            },
            {
              k: "Signing spread",
              v: m.signatures ? Math.round(m.signatures.ratio).toLocaleString() : "—",
              unit: m.signatures ? "×" : undefined,
              d: m.signatures
                ? `${m.signatures.fastestName} against ${m.signatures.slowestName}`
                : "Signature track unavailable",
            },
            {
              k: "Hybrid TLS wire cost",
              v: m.wire ? m.wire.ratio.toFixed(1) : "—",
              unit: m.wire ? "×" : undefined,
              d: m.wire
                ? `${m.wire.hybridBytes.toLocaleString()} B against classical ${m.wire.classicalBytes} B`
                : "Protocol track unavailable",
            },
            {
              k: "Run integrity",
              v: m.run.stealPct != null ? formatStealPercent(m.run.stealPct) : "—",
              d: `CPU steal on ${m.run.instanceType}. Disclosed, not hidden`,
            },
          ]}
        />

        {bars.length > 1 && (
          <Section
            eyebrow="Signing time"
            title="The gap the standard doesn't warn you about."
            hint="Logarithmic axis — on a linear one, all but the largest bar would be invisible. That is the finding, not a plotting convenience."
          >
            <LogBars
              bars={bars}
              minExp={2}
              maxExp={6.5}
              ticks={[
                { at: 2, label: "100 µs" },
                { at: 3, label: "1 ms" },
                { at: 4, label: "10 ms" },
                { at: 5, label: "100 ms" },
                { at: 6, label: "1 s" },
              ]}
              legend={["Lattice (FIPS 204)", "Hash-based (FIPS 205)"]}
            />
          </Section>
        )}

        <Section
          eyebrow="FIPS 203"
          title="Key encapsulation — ML-KEM."
          hint="Replaces RSA and ECC key exchange. Sizes are what goes on the wire."
        >
          <Suspense fallback={null}>
            <SortableDataTable
              head={[
                { id: "name", label: "Algorithm" },
                { id: "keygen", label: "Keygen" },
                { id: "encap", label: "Encap" },
                { id: "decap", label: "Decap" },
                { id: "encap_ops", label: "Encap ops/sec", defaultDir: "desc" },
                { id: "pubkey", label: "Public key" },
                { id: "ciphertext", label: "Ciphertext" },
              ]}
              sortParam="kem"
              rows={kems.map((a) => ({
                key: a.id,
                sort: {
                  name: a.display_name,
                  keygen: a.operations.keygen?.mean_us ?? null,
                  encap: a.operations.encap?.mean_us ?? null,
                  decap: a.operations.decap?.mean_us ?? null,
                  encap_ops: a.operations.encap?.ops_per_sec ?? null,
                  pubkey: a.pubkey_bytes ?? null,
                  ciphertext: a.ciphertext_bytes ?? null,
                },
                cells: [
                  <RowName
                    key="n"
                    name={a.display_name}
                    note={`NIST level ${a.nist_level}`}
                    href={`/q-shield/${a.id}`}
                  />,
                  dur(a.operations.keygen?.mean_us),
                  dur(a.operations.encap?.mean_us),
                  dur(a.operations.decap?.mean_us),
                  a.operations.encap ? formatOpsPerSec(a.operations.encap.ops_per_sec) : "—",
                  formatBytes(a.pubkey_bytes),
                  a.ciphertext_bytes ? formatBytes(a.ciphertext_bytes) : "—",
                ],
              }))}
            />
          </Suspense>
        </Section>

        <Section
          eyebrow="FIPS 204 · 205"
          title="Digital signatures — ML-DSA and SLH-DSA."
          hint="Note the inversion: the hash-based schemes carry the smallest public keys and the slowest signing on the board."
        >
          <Suspense fallback={null}>
            <SortableDataTable
              head={[
                { id: "name", label: "Algorithm" },
                { id: "keygen", label: "Keygen" },
                { id: "sign", label: "Sign" },
                { id: "verify", label: "Verify" },
                { id: "pubkey", label: "Public key" },
                { id: "signature", label: "Signature" },
                { id: "family", label: "Family" },
              ]}
              sortParam="sig"
              rows={sigs.map((a) => ({
                key: a.id,
                sort: {
                  name: a.display_name,
                  keygen: a.operations.keygen?.mean_us ?? null,
                  sign: a.operations.sign?.mean_us ?? null,
                  verify: a.operations.verify?.mean_us ?? null,
                  pubkey: a.pubkey_bytes ?? null,
                  signature: a.signature_bytes ?? null,
                  family: a.family,
                },
                cells: [
                  <RowName
                    key="n"
                    name={a.display_name}
                    note={`NIST level ${a.nist_level}`}
                    href={`/q-shield/${a.id}`}
                  />,
                  dur(a.operations.keygen?.mean_us),
                  dur(a.operations.sign?.mean_us),
                  dur(a.operations.verify?.mean_us),
                  formatBytes(a.pubkey_bytes),
                  a.signature_bytes ? formatBytes(a.signature_bytes) : "—",
                  <Tag key="f">{a.family === "SLH-DSA" ? "Hash" : "Lattice"}</Tag>,
                ],
              }))}
            />
          </Suspense>
        </Section>

        {m.ranked.length > 0 && (
          <Section
            eyebrow="TLS 1.3 key exchange · composed"
            title="What it costs inside a real handshake."
            hint="Primitives in isolation don't tell you this. Full handshakes, same host, same night."
          >
            <div className="space-y-3">
              <SuiteGrid
                suites={m.ranked.map((r) => ({
                  name: r.name,
                  note: r.note,
                  baseline: r.isBaseline,
                  stats: [
                    { k: "Mean", v: formatDuration(r.meanUs), tone: r.isBaseline ? "mute" : undefined },
                    {
                      k: "Wire",
                      v: r.bytesTotal != null ? `${r.bytesTotal.toLocaleString()} B` : "—",
                      tone: r.isBaseline ? "mute" : undefined,
                    },
                    {
                      k: "vs classical",
                      v:
                        r.pctOverClassical == null
                          ? "baseline"
                          : `${r.pctOverClassical < 0 ? "−" : "+"}${Math.abs(r.pctOverClassical).toFixed(1)}%`,
                      tone: r.pctOverClassical == null ? "mute" : r.pctOverClassical < 0 ? "pos" : undefined,
                    },
                  ],
                }))}
              />

              <Caveat label="Read this before quoting a timing delta">
                {m.run.stealPct != null && (
                  <>
                    This run carried{" "}
                    <strong className="font-bold text-fg">
                      {formatStealPercent(m.run.stealPct)} CPU steal
                    </strong>{" "}
                    on a burstable instance, which inflates the classical baseline and compresses
                    every delta above.{" "}
                  </>
                )}
                <strong className="font-bold text-fg">
                  Timing deltas from this host are a distribution, not a verdict. The byte counts are
                  not
                </strong>{" "}
                — those are fixed by the protocol, not the processor. Read the wire column as the
                durable number. Migration to a dedicated-core instance is scheduled.
              </Caveat>
            </div>
          </Section>
        )}

        <Section
          eyebrow="Take the data"
          title="Nothing here is behind a login."
          hint="Current-day snapshot free, forever. Clone the harness and you should reproduce these within run-to-run variance."
        >
          <ExportRow
            items={[
              { label: "Compare algorithms →", href: "/q-shield/compare", primary: true },
              { label: "Protocol tracks →", href: "/q-shield/protocols" },
              { label: "View the run", href: githubCommitUrl(m.run.fullSha) },
              { label: "Benchmark source", href: "https://github.com/Q-Advantage/q-advantage" },
              { label: "Methodology", href: "/methodology" },
            ]}
          />
        </Section>
      </PageShell>
      <GitHubStarPopup />
    </>
  );
}
