import type { Metadata } from "next";
import { Suspense } from "react";
import { PageShell } from "@/components/chrome/PageShell";
import { AuditBand, Caveat, DataTable, RowName, Section } from "@/components/product/kit";
import { CalculatorView, type CalculatorData } from "@/components/calculator/CalculatorView";
import { loadProtocolsData } from "@/lib/protocols/load";
import { ARCHETYPES, EGRESS_GB, HORIZONS, SESSION_REUSE, VCPU_HOUR } from "@/lib/calculator/defaults";
import { formatUsd, runScenario } from "@/lib/calculator/model";
import { formatBytes, formatDuration, shortCpuModel } from "@/lib/format";

export const metadata: Metadata = {
  title: "PQC Cost Calculator",
  description:
    "The ROI of PQC migration, computed: what post-quantum TLS actually costs at your traffic volume, from measured handshakes and cited public pricing. Free, no signup.",
};

export const dynamic = "force-static";

const SUITE_DISPLAY: Record<string, string> = {
  X25519: "X25519",
  X25519MLKEM768: "X25519 + ML-KEM-768",
  SecP256r1MLKEM768: "P-256 + ML-KEM-768",
  MLKEM768: "ML-KEM-768",
};

/**
 * /calculator — the PQC Migration Cost Calculator. Work-order 009.
 *
 * The first surface here that computes rather than reports. Layers 1–2 are
 * measured (Q-Shield's composed TLS track); layers 3–4 are cited public
 * defaults the reader can edit.
 */
export default function CalculatorPage() {
  const protocols = loadProtocolsData();

  const byArch: Record<string, Record<string, import("@/lib/protocols/types").ComposedSuite>> = {};
  for (const [arch, bucket] of Object.entries(protocols.byArch)) {
    if (bucket.tls?.suites) byArch[arch] = bucket.tls.suites;
  }
  const primaryArch = byArch["x86_64"] ? "x86_64" : Object.keys(byArch)[0];
  const primary = byArch[primaryArch] ?? {};
  const env = protocols.byArch[primaryArch]?.tls?.environment;
  const anySuite = Object.values(primary)[0];

  const data: CalculatorData = {
    byArch,
    runCommit: env?.git_commit ?? "",
    runDate: env?.iso_timestamp?.slice(0, 10) ?? "",
    liboqsVersion: env?.liboqs_version ?? "",
    cpuModel: shortCpuModel(anySuite?.host?.cpu_model ?? "—"),
  };

  // The opening scenario, computed on the server and rendered below as real
  // page content — not a Suspense fallback, which on a force-static page never
  // reaches the served HTML. See components/product/interactive.tsx.
  const defaultScenario = runScenario(Object.keys(primary), primary, {
    handshakesPerSecond: ARCHETYPES[0].perSecond ?? 1500,
    sessionReusePct: SESSION_REUSE.value,
    vcpuHourUsd: VCPU_HOUR.value,
    egressGbUsd: EGRESS_GB.value,
    months: HORIZONS[0].months,
  });

  return (
    <PageShell variant="frame" className="min-w-0 space-y-10">
      {/* --------------------------------------------------------- hero */}
      <div className="flex flex-col gap-4">
        <div className="eyebrow">Cost engine · free, no signup</div>
        <h1 className="max-w-[20ch] text-balance text-[clamp(30px,4vw,44px)] font-bold leading-[1.05] tracking-[-0.03em] text-fg">
          PQC Cost Calculator
        </h1>
        <p className="max-w-[62ch] text-[17px] font-medium leading-relaxed text-fg">
          Post-quantum TLS is slower and heavier than what you run today. This tells you what that
          costs on your traffic, in dollars, before you commit to it.
        </p>

        <div className="grid gap-4 border-t border-border pt-5 sm:grid-cols-3">
          {[
            {
              k: "Who it's for",
              v: "Network and infrastructure leads, and CISOs sizing PQC across a TLS-heavy estate.",
            },
            {
              k: "The problem",
              v: "Vendors quote percentages on a benchmark you can't inspect. Nobody tells you what the percentage means on your bill.",
            },
            {
              k: "What you get",
              v: "A dollar figure from handshakes we measured daily on real hardware, plus the arithmetic that produced it.",
            },
          ].map((c) => (
            <div key={c.k} className="min-w-0">
              <div className="text-[11px] font-bold uppercase tracking-eyebrow text-fg-subtle">{c.k}</div>
              <p className="mt-1 text-[13px] leading-relaxed text-fg-muted">{c.v}</p>
            </div>
          ))}
        </div>
      </div>

      {env && (
        <AuditBand
          cells={[
            { k: "Run date", v: data.runDate },
            { k: "Commit", v: data.runCommit.slice(0, 7), tone: "link" },
            { k: "Host", v: data.cpuModel },
            { k: "liboqs", v: data.liboqsVersion },
            { k: "Architectures", v: Object.keys(byArch).join(" · ") },
            { k: "Pricing", v: "AWS list, editable" },
          ]}
        />
      )}

      <Suspense fallback={null}>
        <CalculatorView data={data} />
      </Suspense>

      {/* Real page content, not a fallback — the opening scenario is in the
          served HTML for a crawler and for a reader without JavaScript. */}
      <Section
        eyebrow="Opening scenario"
        title={`${ARCHETYPES[0].label} · ${SESSION_REUSE.value}% session reuse · one month`}
        hint="The figures the calculator starts on, rendered statically. Everything above moves them."
      >
        <DataTable
          head={["Suite", "Handshake", "Bytes out", "CPU $/mo", "Egress $/mo", "Total $/mo", "×"]}
          rows={defaultScenario.suites.map((s) => ({
            key: s.name,
            cells: [
              <RowName key="n" name={SUITE_DISPLAY[s.name] ?? s.name} />,
              formatDuration(s.medianUs),
              s.bytesOut != null ? formatBytes(s.bytesOut) : "—",
              formatUsd(s.cpuUsd),
              formatUsd(s.egressUsd),
              formatUsd(s.totalUsd),
              s.multiplier == null ? "—" : `${s.multiplier.toFixed(2)}×`,
            ],
          }))}
        />
      </Section>

      <Caveat label="What this is, and what it is not">
        Everything else Q-Advantage publishes reports a measurement. This page{" "}
        <strong className="font-bold text-fg">computes</strong> — it multiplies measured handshake
        costs by traffic volumes and cloud rates to produce a figure nobody measured. That is
        arithmetic over cited inputs, not a model with hidden coefficients, and every input carries a
        tag saying whether it is measured, a public default, a bounded estimate, or yours.
        <br />
        <br />
        It covers the TLS key exchange only — no certificate-chain signing, no packet-level effects,
        AWS list pricing. A real estate has negotiated rates, its own session-reuse behaviour, and a
        certificate chain that matters. This gets you the shape and the order of magnitude. It does
        not replace measuring your own.
      </Caveat>

      {/* ---------------------------------------------------------- CTA */}
      <section className="rounded border border-border-strong bg-bg-inset px-6 py-8">
        <div className="eyebrow">The number above is the easy half</div>
        <h2 className="mt-2 max-w-[26ch] text-balance text-[clamp(22px,2.6vw,30px)] font-bold leading-[1.15] tracking-[-0.02em] text-fg">
          Now do it against your actual infrastructure.
        </h2>
        <p className="mt-3 max-w-[64ch] text-[14px] leading-relaxed text-fg-muted">
          This page prices one key exchange against one set of assumptions. A migration decision
          needs the rest of it: which of your endpoints are actually negotiating what, how much of
          your traffic resumes rather than handshakes, what your certificate chain does to the
          picture, and where the cost lands across a whole estate rather than a single gateway.
        </p>

        <div className="mt-6 grid gap-5 sm:grid-cols-3">
          {[
            {
              k: "Your endpoints, measured",
              v: "We measure what your estate actually negotiates today, rather than assuming one uniform baseline across every endpoint.",
            },
            {
              k: "Your real traffic profile",
              v: "Session-reuse rates and handshake volumes taken from your own telemetry, not an industry archetype we had to cite because we did not know you.",
            },
            {
              k: "The whole cost, not the wire",
              v: "Certificate reissuance, HSM headroom, and the internal service-mesh multiplier that usually dwarfs the edge — priced together.",
            },
          ].map((c) => (
            <div key={c.k} className="min-w-0">
              <div className="text-[12.5px] font-bold text-fg">{c.k}</div>
              <p className="mt-1 text-[12.5px] leading-relaxed text-fg-muted">{c.v}</p>
            </div>
          ))}
        </div>

        <div className="mt-7 flex flex-wrap items-center gap-3">
          <a
            href="/contact"
            className="inline-flex h-10 items-center rounded border border-accent bg-accent/10 px-4 text-[13.5px] font-bold text-fg transition-colors hover:bg-accent/20"
          >
            Price it against your estate →
          </a>
          <a
            href="/q-shield/protocols"
            className="inline-flex h-10 items-center rounded border border-border px-4 text-[13.5px] font-semibold text-fg-muted transition-colors hover:border-border-strong hover:text-fg"
          >
            See the underlying measurements
          </a>
          <a
            href="/methodology"
            className="inline-flex h-10 items-center px-1 text-[13.5px] font-semibold text-fg-muted underline decoration-border-strong underline-offset-4 transition-colors hover:text-accent"
          >
            How we measure
          </a>
        </div>

        <p className="mt-5 max-w-[64ch] text-[11.5px] leading-relaxed text-fg-subtle">
          We do not sell migration tooling and we do not resell anyone&rsquo;s PQC product. We
          measure, and we tell you what the measurements mean for your bill — which is the only
          reason to trust a number that came from a vendor&rsquo;s competitor or from us.
        </p>
      </section>
    </PageShell>
  );
}
