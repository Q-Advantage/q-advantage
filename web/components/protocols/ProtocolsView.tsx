"use client";
// web/components/protocols/ProtocolsView.tsx
// Arch-aware: renders both x86_64 and aarch64 side-by-side per suite card.
// Percentage delta shows explicit "slower"/"faster" labels; negative = green.

import { useState } from "react";
import type {
  ProtocolsData,
  ComposedSuite,
  SigScheme,
  CrossValidation,
  ArchBucket,
} from "@/lib/protocols/types";
import { amplificationFactor, formatAmplificationFactor } from "@/lib/protocols/derive";

// ── formatting ────────────────────────────────────────────────────────────────

function fmt(n: number | undefined, d = 1): string {
  if (n == null) return "—";
  return n.toFixed(d);
}
function fmtBytes(n: number | undefined): string {
  if (n == null) return "—";
  if (n >= 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${n} B`;
}

function DeltaPct({ pct, baseline }: { pct: number | undefined; baseline?: string }) {
  if (pct == null) return null;
  const faster = pct < 0;
  const abs = Math.abs(pct).toFixed(1);
  const label = faster ? "faster" : "slower";
  const cls = faster ? "text-emerald-500" : "text-fg";
  return (
    <div className="flex flex-col items-end">
      <span className={`font-serif text-2xl leading-none ${cls}`}>
        {abs}% <span className="text-sm font-sans">{label}</span>
      </span>
      {baseline && <span className="text-2xs text-fg-subtle mt-1">vs {baseline}</span>}
    </div>
  );
}

// ── small primitives ──────────────────────────────────────────────────────────

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-2xs uppercase tracking-eyebrow text-fg-subtle font-mono">{label}</span>
      <span className="num text-sm text-fg">{value}</span>
      {sub && <span className="text-2xs text-fg-subtle num">{sub}</span>}
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 text-xs">
      <span className="text-fg-subtle shrink-0 w-24">{label}</span>
      <span className="num text-fg-muted break-all">{value}</span>
    </div>
  );
}

function SectionHead({ title, caption }: { title: string; caption: string }) {
  return (
    <div className="flex flex-col gap-1.5 mb-4">
      <h2 className="font-serif text-[clamp(22px,3vw,30px)] font-normal leading-tight tracking-[-0.01em] text-fg">
        {title}
      </h2>
      <p className="text-sm text-fg-muted max-w-2xl leading-relaxed font-light">{caption}</p>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="border border-border rounded-md bg-bg-inset px-5 py-4">{children}</div>
  );
}

function Disclosure({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="text-xs text-fg-muted hover:text-fg transition-colors underline decoration-border-strong hover:decoration-accent underline-offset-2"
      >
        {open ? `Hide ${label}` : label}
      </button>
      {open && <div className="mt-2">{children}</div>}
    </div>
  );
}

// ── arch pill ─────────────────────────────────────────────────────────────────

function ArchChip({ arch }: { arch: string }) {
  const label = arch === "x86_64" ? "x86 · Intel Xeon" : arch === "aarch64" ? "ARM · Graviton3" : arch;
  return (
    <span className="text-2xs num text-fg-muted border border-border rounded px-1.5 py-0.5">
      {label}
    </span>
  );
}

// ── per-arch column for suite cards ───────────────────────────────────────────

function SuiteArchColumn({ suite }: { suite: ComposedSuite }) {
  const arch = suite.host?.arch ?? "unknown";
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <ArchChip arch={arch} />
        <DeltaPct pct={suite.baseline?.pct_over_classical} baseline={suite.baseline?.baseline_suite} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Stat label="median" value={`${fmt(suite.timing.median_us)} µs`} />
        <Stat label="p95" value={`${fmt(suite.timing.p95_us)} µs`} />
        {suite.size && (
          <Stat label="amplification" value={formatAmplificationFactor(amplificationFactor(suite))} />
        )}
      </div>

      {suite.phases && Object.keys(suite.phases).length > 0 && (
        <Disclosure label="Phases">
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(suite.phases).map(([name, t]) => (
              <Stat key={name} label={name.split("_").join(" ")} value={`${fmt(t.median_us)} µs`} />
            ))}
          </div>
        </Disclosure>
      )}

      {suite.host?.build_path && (
        <div className="text-2xs num text-fg-subtle break-all">{suite.host.build_path}</div>
      )}
    </div>
  );
}

// ── suite card grouping same suite across arches ─────────────────────────────

function SuiteCard({ suiteName, byArch }: { suiteName: string; byArch: Record<string, ComposedSuite> }) {
  const arches = Object.keys(byArch);
  const anySuite = Object.values(byArch)[0];
  if (!anySuite) return null;

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <span className="num text-fg font-medium">{suiteName}</span>
        {anySuite.size && (
          <span className="text-2xs num text-fg-subtle">{fmtBytes(anySuite.size.bytes_total)} on wire</span>
        )}
      </div>

      <div className={`grid gap-5 ${arches.length > 1 ? "md:grid-cols-2" : "grid-cols-1"}`}>
        {arches.map((arch) => (
          <div key={arch} className={arches.length > 1 ? "md:border-l md:border-border md:pl-4 md:first:border-l-0 md:first:pl-0" : ""}>
            <SuiteArchColumn suite={byArch[arch]} />
          </div>
        ))}
      </div>
    </Card>
  );
}

// ── sig card grouping same scheme across arches ──────────────────────────────

function SigCard({ schemeName, byArch }: { schemeName: string; byArch: Record<string, SigScheme> }) {
  const arches = Object.keys(byArch);
  const anyScheme = Object.values(byArch)[0];
  if (!anyScheme) return null;

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <span className="num text-fg font-medium">{schemeName}</span>
        <div className="flex gap-3 text-2xs num text-fg-subtle">
          <span>sig {fmtBytes(anyScheme.signature_bytes)}</span>
          <span>pk {fmtBytes(anyScheme.public_key_bytes)}</span>
        </div>
      </div>

      <div className={`grid gap-5 ${arches.length > 1 ? "md:grid-cols-2" : "grid-cols-1"}`}>
        {arches.map((arch) => {
          const s = byArch[arch];
          return (
            <div key={arch} className={arches.length > 1 ? "md:border-l md:border-border md:pl-4 md:first:border-l-0 md:first:pl-0" : ""}>
              <div className="mb-3">
                <ArchChip arch={arch} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Stat label="keygen" value={`${fmt(s.keygen.median_us)} µs`} />
                <Stat label="sign" value={`${fmt(s.sign.median_us)} µs`} sub={`mean ${fmt(s.sign.mean_us)}`} />
                <Stat label="verify" value={`${fmt(s.verify.median_us)} µs`} />
              </div>
            </div>
          );
        })}
      </div>

      {schemeName.startsWith("ML-DSA") && (
        <p className="mt-3 text-2xs text-fg-subtle leading-relaxed font-light">
          Sign is right-skewed (Fiat-Shamir with aborts → rejection sampling); mean exceeds
          median. Median is the representative figure.
        </p>
      )}
    </Card>
  );
}

// ── stateful (LMS/XMSS) card — persistent caveat, honest about non-"ok" ─────

function StatefulSigCard({
  schemeName,
  byArch,
}: {
  schemeName: string;
  byArch: Record<string, import("@/lib/protocols/types").StatefulSigScheme>;
}) {
  const arches = Object.keys(byArch);
  const anyScheme = Object.values(byArch)[0];
  if (!anyScheme) return null;

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <span className="num text-fg font-medium">{schemeName}</span>
        {anyScheme.status !== "ok" && (
          <span className="text-2xs text-fg-subtle border border-border rounded px-1.5 py-0.5">
            queued — first run pending
          </span>
        )}
      </div>

      {/* Persistent, not a tooltip — spec-mandated: readers must not mistake
          these for TLS-interchangeable stateless signatures. */}
      <p className="text-2xs text-amber-500/90 leading-relaxed font-light mb-3">
        Stateful — firmware/code-signing use case, not general TLS. Reusing a signing index
        breaks the security guarantee; see NIST SP 800-208.
      </p>

      {anyScheme.status !== "ok" ? (
        <p className="text-xs text-fg-subtle">
          {anyScheme.reason ?? anyScheme.error ?? "No real run yet for this scheme."}
        </p>
      ) : (
        <>
          <div className="flex gap-3 text-2xs num text-fg-subtle mb-3">
            <span>sig {fmtBytes(anyScheme.signature_bytes)}</span>
            <span>pk {fmtBytes(anyScheme.public_key_bytes)}</span>
            {anyScheme.sigs_total != null && <span>budget {anyScheme.sigs_total.toLocaleString()} sigs/keypair</span>}
          </div>
          <div className={`grid gap-5 ${arches.length > 1 ? "md:grid-cols-2" : "grid-cols-1"}`}>
            {arches.map((arch) => {
              const s = byArch[arch];
              if (s.status !== "ok") return null;
              return (
                <div key={arch} className={arches.length > 1 ? "md:border-l md:border-border md:pl-4 md:first:border-l-0 md:first:pl-0" : ""}>
                  <div className="mb-3">
                    <ArchChip arch={arch} />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {s.keygen && <Stat label="keygen" value={`${fmt(s.keygen.median_us)} µs`} />}
                    {s.sign && <Stat label="sign" value={`${fmt(s.sign.median_us)} µs`} />}
                    {s.verify && <Stat label="verify" value={`${fmt(s.verify.median_us)} µs`} />}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </Card>
  );
}

// ── AES-GCM baseline card ────────────────────────────────────────────────────

function AesCard({ byArch }: { byArch: Record<string, import("@/lib/protocols/types").AesBaselineRecord> }) {
  const arches = Object.keys(byArch);
  const any = Object.values(byArch)[0];
  if (!any) return null;

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <span className="num text-fg font-medium">{any.algorithm}</span>
        <span className="text-2xs num text-fg-subtle">{fmtBytes(any.payload_bytes)} payload</span>
      </div>
      <p className="text-2xs text-fg-subtle leading-relaxed font-light mb-3">
        The symmetric reference line — what a boring, fast, everyone-already-uses-this operation
        costs, for scale against every asymmetric number above.
      </p>
      <div className={`grid gap-5 ${arches.length > 1 ? "md:grid-cols-2" : "grid-cols-1"}`}>
        {arches.map((arch) => {
          const a = byArch[arch];
          return (
            <div key={arch} className={arches.length > 1 ? "md:border-l md:border-border md:pl-4 md:first:border-l-0 md:first:pl-0" : ""}>
              <div className="mb-3">
                <ArchChip arch={arch} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Stat label="encrypt" value={`${fmt(a.encrypt.median_us)} µs`} />
                <Stat label="decrypt" value={`${fmt(a.decrypt.median_us)} µs`} />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ── hero strip ────────────────────────────────────────────────────────────────

function Hero({ data }: { data: ProtocolsData }) {
  const arches = Object.keys(data.byArch);
  const primary = data.byArch["x86_64"] ?? data.byArch[arches[0]];
  if (!primary) return null;

  const tls = primary.tls?.suites ?? {};
  const sigs = primary.sig?.schemes ?? {};
  const hybrid = tls["X25519MLKEM768"];
  const falcon = sigs["Falcon-512"];
  const slh = sigs["SLH_DSA_PURE_SHAKE_128S"] ?? sigs["SLH_DSA_PURE_SHAKE_128F"];

  type H = { value: string; label: string; note: string; faster?: boolean };
  const heroes: H[] = [];

  if (hybrid && hybrid.baseline) {
    const pct = hybrid.baseline.pct_over_classical;
    const faster = pct < 0;
    heroes.push({
      value: `${Math.abs(pct).toFixed(1)}% ${faster ? "faster" : "slower"}`,
      label: "X25519+ML-KEM-768 TLS vs classical",
      note: `${fmt(hybrid.timing.median_us)} µs median · ${fmtBytes(hybrid.size?.bytes_total)} on wire`,
      faster,
    });
  }
  if (falcon) {
    heroes.push({
      value: fmtBytes(falcon.signature_bytes),
      label: "Falcon-512 signature",
      note: `verify ${fmt(falcon.verify.median_us)} µs · smallest PQC signature`,
    });
  }
  if (slh) {
    heroes.push({
      value: fmtBytes(slh.signature_bytes),
      label: `${slh.scheme.split("_").join("-")} signature`,
      note: `sign ${fmt(slh.sign.median_us)} µs · conservative hash-based`,
    });
  }
  heroes.push({
    value: `${arches.length} arch${arches.length > 1 ? "es" : ""}`,
    label: "Cross-arch coverage",
    note: arches.join(" · "),
  });

  if (!heroes.length) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-border border border-border rounded-md overflow-hidden">
      {heroes.map((h) => (
        <div key={h.label} className="bg-bg-inset px-5 py-5 flex flex-col gap-2">
          <span className={`font-serif text-[clamp(24px,3.5vw,36px)] leading-none ${h.faster ? "text-emerald-500" : "text-fg"}`}>
            {h.value}
          </span>
          <span className="text-sm text-fg font-medium leading-tight">{h.label}</span>
          <span className="text-2xs text-fg-subtle num leading-relaxed">{h.note}</span>
        </div>
      ))}
    </div>
  );
}

function Empty() {
  return (
    <div className="border border-border rounded-md bg-bg-inset px-6 py-10 text-center">
      <p className="text-sm text-fg-muted">Protocol benchmark data not yet available.</p>
      <p className="text-xs text-fg-subtle mt-1">
        The daily run populates this page automatically at 06:00 UTC.
      </p>
    </div>
  );
}

// ── main ──────────────────────────────────────────────────────────────────────

type Tab = "tls" | "signatures" | "ssh" | "aes" | "stateful";

// group same suite/scheme across arches
function groupByName<T>(byArch: Record<string, ArchBucket>, extract: (b: ArchBucket) => Record<string, T> | undefined | null): Record<string, Record<string, T>> {
  const grouped: Record<string, Record<string, T>> = {};
  for (const [arch, bucket] of Object.entries(byArch)) {
    const items = extract(bucket) ?? {};
    for (const [name, item] of Object.entries(items)) {
      if (!grouped[name]) grouped[name] = {};
      grouped[name][arch] = item;
    }
  }
  return grouped;
}

// AES baseline is one record per arch (no name key to group by) — collapse
// straight to arch -> record.
function groupAesByArch(byArch: Record<string, ArchBucket>): Record<string, import("@/lib/protocols/types").AesBaselineRecord> {
  const grouped: Record<string, import("@/lib/protocols/types").AesBaselineRecord> = {};
  for (const [arch, bucket] of Object.entries(byArch)) {
    if (bucket.aes?.baseline) grouped[arch] = bucket.aes.baseline;
  }
  return grouped;
}

export function ProtocolsView({ data }: { data: ProtocolsData }) {
  const [tab, setTab] = useState<Tab>("tls");

  const tlsGrouped = groupByName(data.byArch, (b) => b.tls?.suites);
  const sigGrouped = groupByName(data.byArch, (b) => b.sig?.schemes);
  const sshGrouped = groupByName(data.byArch, (b) => b.ssh?.suites);
  const statefulGrouped = groupByName(data.byArch, (b) => b.lmsXmss?.schemes);
  const aesByArch = groupAesByArch(data.byArch);

  const hasData =
    Object.keys(tlsGrouped).length ||
    Object.keys(sigGrouped).length ||
    Object.keys(sshGrouped).length ||
    Object.keys(statefulGrouped).length ||
    Object.keys(aesByArch).length;
  const manifest = data.manifest;

  const tabs = [
    { id: "tls" as Tab, label: "TLS", count: Object.keys(tlsGrouped).length },
    { id: "signatures" as Tab, label: "Signatures", count: Object.keys(sigGrouped).length },
    { id: "ssh" as Tab, label: "SSH", count: Object.keys(sshGrouped).length },
    { id: "stateful" as Tab, label: "Hash-based sigs", count: Object.keys(statefulGrouped).length },
    { id: "aes" as Tab, label: "AES-GCM", count: Object.keys(aesByArch).length ? 1 : 0 },
  ].filter((t) => t.count > 0);

  const active = tabs.find((t) => t.id === tab) ? tab : tabs[0]?.id;

  if (!hasData) return <Empty />;

  const arches = Object.keys(data.byArch);

  return (
    <div className="space-y-8">
      {manifest && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-fg-subtle border-y border-border py-3">
          <span className="num">{arches.length > 1 ? `${arches.length} architectures` : arches[0]}</span>
          <span>Generated {manifest.generated_utc}</span>
          <a
          
            href="/data/protocols/manifest.json"
            className="text-fg-muted hover:text-accent transition-colors ml-auto"
          >
            Raw JSON ↗
          </a>
        </div>
      )}

      <Hero data={data} />

      {tabs.length > 1 && (
        <div className="flex gap-2 flex-wrap border-b border-border">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2.5 text-sm -mb-px border-b-2 transition-colors ${
                active === t.id
                  ? "border-accent text-fg"
                  : "border-transparent text-fg-muted hover:text-fg"
              }`}
            >
              {t.label}
              <span className="ml-1.5 text-2xs num text-fg-subtle">{t.count}</span>
            </button>
          ))}
        </div>
      )}

      {active === "tls" && (
        <div>
          <SectionHead
            title="TLS handshake"
            caption="The real cost of running post-quantum key exchange inside a TLS handshake — measured phase by phase against the classical baseline everyone already runs. Every suite on both x86 and ARM."
          />
          <div className="grid grid-cols-1 gap-5">
            {Object.entries(tlsGrouped).map(([name, byArch]) => (
              <SuiteCard key={name} suiteName={name} byArch={byArch} />
            ))}
          </div>
        </div>
      )}

      {active === "signatures" && (
        <div>
          <SectionHead
            title="Signature track"
            caption="Signature schemes measured for keygen, sign, and verify — and for the number that decides whether they fit on a certificate or on a blockchain: signature size."
          />
          <div className="grid grid-cols-1 gap-5">
            {Object.entries(sigGrouped).map(([name, byArch]) => (
              <SigCard key={name} schemeName={name} byArch={byArch} />
            ))}
          </div>
        </div>
      )}

      {active === "ssh" && (
        <div>
          <SectionHead
            title="SSH key exchange"
            caption="The same measurement, in SSH: OpenSSH 10&apos;s post-quantum default versus the classical curve25519 that&apos;s been the standard for a decade."
          />
          <div className="grid grid-cols-1 gap-5">
            {Object.entries(sshGrouped).map(([name, byArch]) => (
              <SuiteCard key={name} suiteName={name} byArch={byArch} />
            ))}
          </div>
        </div>
      )}

      {active === "stateful" && (
        <div>
          <SectionHead
            title="Hash-based signatures"
            caption="LMS and XMSS (NIST SP 800-208) — stateful, firmware/code-signing use case. A scheme shows &ldquo;queued&rdquo; until its first real run has landed; nothing here is ever a placeholder number."
          />
          <div className="grid grid-cols-1 gap-5">
            {Object.entries(statefulGrouped).map(([name, byArch]) => (
              <StatefulSigCard key={name} schemeName={name} byArch={byArch} />
            ))}
          </div>
        </div>
      )}

      {active === "aes" && (
        <div>
          <SectionHead
            title="AES-GCM baseline"
            caption="The symmetric reference line under every asymmetric number on this page."
          />
          <div className="grid grid-cols-1 gap-5">
            <AesCard byArch={aesByArch} />
          </div>
        </div>
      )}
    </div>
  );
}
