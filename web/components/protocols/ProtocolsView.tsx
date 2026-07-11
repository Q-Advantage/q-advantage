"use client";
// web/components/protocols/ProtocolsView.tsx
//
// Client component so we can use useState for tab switching and collapsibles.
// All data is passed in as props — loaded at build time in the Server Component.
// No fetches, no loading states in production.

import { useState } from "react";
import type {
  ProtocolsData,
  ComposedSuite,
  SigScheme,
  CrossValidation,
} from "@/lib/protocols/types";

// ── formatting helpers ────────────────────────────────────────────────────────

function fmt(n: number | undefined, decimals = 1): string {
  if (n == null) return "—";
  return n.toFixed(decimals);
}

function fmtBytes(n: number | undefined): string {
  if (n == null) return "—";
  if (n >= 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${n} B`;
}

function fmtPct(n: number | undefined): string {
  if (n == null) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

function pctClass(n: number | undefined): string {
  if (n == null) return "text-[var(--color-text-secondary)]";
  // For protocol overhead: positive = PQC slower = warning; negative = PQC faster = good
  if (n > 0) return "text-[var(--color-text-warning)]";
  return "text-[var(--color-text-success)]";
}

// ── sub-components ────────────────────────────────────────────────────────────

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 text-xs">
      <span className="text-[var(--color-text-tertiary)] shrink-0 w-28">{label}</span>
      <span className="font-mono text-[var(--color-text-secondary)] break-all">{value}</span>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-secondary)] mt-5 mb-2">
      {children}
    </div>
  );
}

function StatCell({
  label,
  value,
  sub,
  className = "",
}: {
  label: string;
  value: string;
  sub?: string;
  className?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] text-[var(--color-text-tertiary)]">{label}</span>
      <span className={`font-mono text-sm font-medium text-[var(--color-text-primary)] ${className}`}>
        {value}
      </span>
      {sub && <span className="text-[11px] text-[var(--color-text-tertiary)]">{sub}</span>}
    </div>
  );
}

function Pill({ children, variant = "default" }: { children: React.ReactNode; variant?: "default" | "success" | "warning" | "info" }) {
  const cls = {
    default: "bg-[var(--color-background-secondary)] text-[var(--color-text-secondary)]",
    success: "bg-[var(--color-background-success)] text-[var(--color-text-success)]",
    warning: "bg-[var(--color-background-warning)] text-[var(--color-text-warning)]",
    info:    "bg-[var(--color-background-info)] text-[var(--color-text-info)]",
  }[variant];
  return (
    <span className={`inline-block text-[11px] px-2 py-0.5 rounded-full font-medium ${cls}`}>
      {children}
    </span>
  );
}

function CollapsibleNote({ notes }: { notes: string }) {
  const [open, setOpen] = useState(false);
  const preview = notes.slice(0, 120) + (notes.length > 120 ? "…" : "");
  return (
    <div className="mt-2 text-xs text-[var(--color-text-secondary)] leading-relaxed">
      <span>{open ? notes : preview}</span>{" "}
      {notes.length > 120 && (
        <button
          onClick={() => setOpen(!open)}
          className="text-[var(--color-text-info)] underline-offset-2 hover:underline"
        >
          {open ? "collapse" : "full methodology"}
        </button>
      )}
    </div>
  );
}

function XValBlock({ xval }: { xval?: CrossValidation }) {
  if (!xval) return null;
  return (
    <div className="mt-3 rounded-lg border border-[var(--color-border-tertiary)] bg-[var(--color-background-secondary)] p-3">
      <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-secondary)] mb-2">
        Cross-validation
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {xval.liboqs_speed_number != null && (
          <StatCell label="liboqs speed" value={`${fmt(xval.liboqs_speed_number)} µs`} />
        )}
        {xval.ebacs_reference_cycles != null && (
          <StatCell label="eBACS cycles" value={xval.ebacs_reference_cycles.toLocaleString()} />
        )}
        {xval.measured_vs_reference_pct != null && (
          <StatCell
            label="vs. liboqs ref"
            value={fmtPct(xval.measured_vs_reference_pct)}
            className={pctClass(-xval.measured_vs_reference_pct)}
          />
        )}
      </div>
      {xval.reference_notes && <CollapsibleNote notes={xval.reference_notes} />}
    </div>
  );
}

// ── ML-KEM vs X25519 disclosure ───────────────────────────────────────────────
// Required DoD item: inline caveat on the counterintuitive ML-KEM > X25519 result.

function MLKEMDisclosure() {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-[var(--color-border-info)] bg-[var(--color-background-info)] p-3 mt-3 text-xs text-[var(--color-text-info)] leading-relaxed">
      <strong>Build-path context:</strong> ML-KEM-768 timing uses liboqs 0.15.0 with{" "}
      <code className="font-mono">OQS_DIST_BUILD</code> AVX2 runtime dispatch. X25519 timing
      uses the <code className="font-mono">cryptography</code> library via OpenSSL EVP. These
      are not identical measurement contexts — the delta reflects both algorithm efficiency and
      library path. Raw liboqs{" "}
      <code className="font-mono">speed_kem</code> confirms ML-KEM-768 at 48.3 µs total
      (keygen + encaps + decaps) vs X25519 at 161.3 µs under the same binary.{" "}
      <button
        onClick={() => setOpen(!open)}
        className="underline underline-offset-2 hover:opacity-80"
      >
        {open ? "hide" : "full methodology"}
      </button>
      {open && (
        <p className="mt-2">
          Cross-validation: our Python harness measures ML-KEM-768 at 60.2 µs median total
          (keygen + encaps + decaps), +24.7% over the liboqs reference — consistent with Python
          binding overhead. The X25519 EVP path carries its own per-call overhead not present in
          a raw liboqs comparison. The directional result (ML-KEM faster than X25519 in this
          deployment configuration) holds in both the Python harness and the raw liboqs binary.
          See <a href="/methodology#cross-validation" className="underline">Methodology §8</a> for
          the full three-pattern cross-validation story.
        </p>
      )}
    </div>
  );
}

// ── TLS suite card ────────────────────────────────────────────────────────────

function TLSSuiteCard({ suite }: { suite: ComposedSuite }) {
  const [phasesOpen, setPhasesOpen] = useState(false);
  const isMLKEMvsX25519 =
    suite.identity.suite === "X25519MLKEM768" &&
    suite.baseline?.baseline_suite === "X25519";
  const pctOver = suite.baseline?.pct_over_classical;

  return (
    <div className="rounded-xl border border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] p-4">
      {/* header */}
      <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
        <div>
          <span className="font-mono font-medium text-[var(--color-text-primary)]">
            {suite.identity.suite}
          </span>
          {suite.host?.arch && (
            <Pill variant="default">{suite.host.arch}</Pill>
          )}
        </div>
        {pctOver != null && (
          <div className="flex flex-col items-end">
            <span className={`font-mono text-lg font-semibold ${pctClass(pctOver)}`}>
              {fmtPct(pctOver)}
            </span>
            <span className="text-[11px] text-[var(--color-text-tertiary)]">
              vs {suite.baseline?.baseline_suite}
            </span>
          </div>
        )}
      </div>

      {/* ML-KEM > X25519 disclosure — required DoD item */}
      {isMLKEMvsX25519 && pctOver != null && pctOver < 0 && <MLKEMDisclosure />}
      {/* Also show if the suite IS "pure ML-KEM" compared to X25519 */}
      {suite.identity.suite === "ML-KEM-768" && <MLKEMDisclosure />}

      {/* timing */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
        <StatCell label="median" value={`${fmt(suite.timing.median_us)} µs`} />
        <StatCell label="p95" value={`${fmt(suite.timing.p95_us)} µs`} />
        <StatCell label="p99" value={`${fmt(suite.timing.p99_us)} µs`} />
        <StatCell label="n" value={suite.timing.n_iterations.toLocaleString()} />
      </div>

      {/* size */}
      {suite.size && (
        <div className="grid grid-cols-3 gap-3 mt-3">
          <StatCell label="client → server" value={fmtBytes(suite.size.bytes_client_to_server)} />
          <StatCell label="server → client" value={fmtBytes(suite.size.bytes_server_to_client)} />
          <StatCell label="total on wire" value={fmtBytes(suite.size.bytes_total)} />
        </div>
      )}

      {/* phase decomposition */}
      {suite.phases && Object.keys(suite.phases).length > 0 && (
        <div className="mt-3">
          <button
            onClick={() => setPhasesOpen(!phasesOpen)}
            className="text-xs text-[var(--color-text-info)] hover:underline underline-offset-2"
          >
            {phasesOpen ? "▾ hide phase decomposition" : "▸ phase decomposition"}
          </button>
          {phasesOpen && (
            <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-3">
              {Object.entries(suite.phases).map(([phaseName, timing]) => (
                <StatCell
                  key={phaseName}
                  label={phaseName.replace(/_/g, " ")}
                  value={`${fmt(timing.median_us)} µs`}
                  sub={`p95 ${fmt(timing.p95_us)}`}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* cross-validation */}
      <XValBlock xval={suite.cross_validation} />

      {/* audit */}
      {suite.audit && (
        <div className="mt-3 space-y-1">
          {suite.audit.git_commit && (
            <MetaRow label="commit" value={suite.audit.git_commit.slice(0, 12)} />
          )}
          {suite.audit.timestamp_utc && (
            <MetaRow label="captured" value={suite.audit.timestamp_utc} />
          )}
          {suite.host?.build_path && (
            <MetaRow label="build path" value={suite.host.build_path} />
          )}
        </div>
      )}
    </div>
  );
}

// ── signature scheme card ─────────────────────────────────────────────────────

function SigSchemeCard({ scheme }: { scheme: SigScheme }) {
  // Flag the SLH-DSA size story prominently
  const isSLH = scheme.scheme.startsWith("SLH-DSA");
  const isFalcon = scheme.scheme.startsWith("Falcon");

  return (
    <div className="rounded-xl border border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] p-4">
      {/* header */}
      <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
        <span className="font-mono font-medium text-[var(--color-text-primary)]">
          {scheme.scheme}
        </span>
        <div className="flex gap-2 flex-wrap">
          {isSLH && <Pill variant="warning">large sigs</Pill>}
          {isFalcon && <Pill variant="success">smallest sigs</Pill>}
        </div>
      </div>

      {/* timing grid */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <div className="text-[11px] text-[var(--color-text-tertiary)] mb-1">keygen</div>
          <StatCell label="median" value={`${fmt(scheme.keygen.median_us)} µs`} />
        </div>
        <div>
          <div className="text-[11px] text-[var(--color-text-tertiary)] mb-1">sign</div>
          <StatCell label="median" value={`${fmt(scheme.sign.median_us)} µs`} />
          <span className="text-[11px] text-[var(--color-text-tertiary)]">
            mean {fmt(scheme.sign.mean_us)} µs
          </span>
        </div>
        <div>
          <div className="text-[11px] text-[var(--color-text-tertiary)] mb-1">verify</div>
          <StatCell label="median" value={`${fmt(scheme.verify.median_us)} µs`} />
        </div>
      </div>

      {/* sizes — first-class */}
      <div className="grid grid-cols-2 gap-3 mt-3 rounded-lg bg-[var(--color-background-secondary)] p-3">
        <StatCell
          label="signature size"
          value={fmtBytes(scheme.signature_bytes)}
          className={isSLH ? "text-[var(--color-text-warning)]" : isFalcon ? "text-[var(--color-text-success)]" : ""}
        />
        <StatCell label="public key size" value={fmtBytes(scheme.public_key_bytes)} />
      </div>

      {/* ML-DSA sign note: right-skewed due to rejection sampling */}
      {scheme.scheme.startsWith("ML-DSA") && (
        <div className="mt-2 text-[11px] text-[var(--color-text-tertiary)] leading-relaxed">
          Sign is right-skewed (Fiat-Shamir with aborts → rejection sampling).
          Mean significantly exceeds median; p99 reflects worst-case abort chains.
        </div>
      )}

      <XValBlock xval={scheme.cross_validation} />
    </div>
  );
}

// ── hero stat strip ───────────────────────────────────────────────────────────

function HeroStrip({ data }: { data: ProtocolsData }) {
  // Surface the four headline numbers at the top.
  const tlsSuites = data.tls?.suites ?? {};
  const sigSchemes = data.sig?.schemes ?? {};

  const x25519mlkem = tlsSuites["X25519MLKEM768"];
  const falcon512 = sigSchemes["Falcon-512"];
  const slhDsa128s = sigSchemes["SLH-DSA-128s"] ?? sigSchemes["SLH-DSA-SHAKE-128s"];
  const mlKem768 = tlsSuites["ML-KEM-768"];
  const x25519 = tlsSuites["X25519"];

  const heroes: { label: string; value: string; note: string; variant: "success" | "warning" | "info" | "default" }[] = [];

  if (x25519mlkem) {
    heroes.push({
      label: "X25519+ML-KEM-768 TLS overhead",
      value: fmtPct(x25519mlkem.baseline?.pct_over_classical),
      note: `${fmt(x25519mlkem.timing.median_us)} µs median · ${fmtBytes(x25519mlkem.size?.bytes_total)} on wire`,
      variant: "warning",
    });
  }

  if (falcon512) {
    heroes.push({
      label: "Falcon-512 signature size",
      value: fmtBytes(falcon512.signature_bytes),
      note: `verify ${fmt(falcon512.verify.median_us)} µs median`,
      variant: "success",
    });
  }

  if (slhDsa128s) {
    heroes.push({
      label: "SLH-DSA-128S signature size",
      value: fmtBytes(slhDsa128s.signature_bytes),
      note: `sign ${fmt(slhDsa128s.sign.median_us)} µs median`,
      variant: "warning",
    });
  }

  if (mlKem768 && x25519) {
    const mlkemMedian = mlKem768.timing.median_us;
    const x25519Median = x25519.timing.median_us;
    const pct = ((mlkemMedian - x25519Median) / x25519Median) * 100;
    heroes.push({
      label: "ML-KEM-768 vs X25519",
      value: fmtPct(pct),
      note: `${fmt(mlkemMedian)} µs vs ${fmt(x25519Median)} µs · AVX2 dispatch`,
      variant: pct < 0 ? "success" : "warning",
    });
  }

  if (heroes.length === 0) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      {heroes.map((h) => (
        <div
          key={h.label}
          className={`rounded-xl p-4 border ${
            h.variant === "success"
              ? "border-[var(--color-border-success)] bg-[var(--color-background-success)]"
              : h.variant === "warning"
              ? "border-[var(--color-border-warning)] bg-[var(--color-background-warning)]"
              : "border-[var(--color-border-info)] bg-[var(--color-background-info)]"
          }`}
        >
          <div
            className={`font-mono text-2xl font-bold mb-1 ${
              h.variant === "success"
                ? "text-[var(--color-text-success)]"
                : h.variant === "warning"
                ? "text-[var(--color-text-warning)]"
                : "text-[var(--color-text-info)]"
            }`}
          >
            {h.value}
          </div>
          <div className="text-xs font-medium text-[var(--color-text-primary)] mb-1">
            {h.label}
          </div>
          <div className="text-[11px] text-[var(--color-text-secondary)]">{h.note}</div>
        </div>
      ))}
    </div>
  );
}

// ── empty state ───────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="rounded-xl border border-[var(--color-border-tertiary)] bg-[var(--color-background-secondary)] p-8 text-center">
      <div className="text-[var(--color-text-secondary)] text-sm mb-2">
        Protocol benchmark data not yet available.
      </div>
      <div className="text-[var(--color-text-tertiary)] text-xs">
        The daily benchmark run will populate this page automatically.
        Data is committed to the repository at 06:00 UTC.
      </div>
    </div>
  );
}

// ── main view ─────────────────────────────────────────────────────────────────

type Tab = "tls" | "signatures" | "ssh";

export function ProtocolsView({ data }: { data: ProtocolsData }) {
  const [activeTab, setActiveTab] = useState<Tab>("tls");

  const hasAnyData = data.tls || data.sig || data.ssh;
  const manifest = data.manifest;

  const tlsSuites = Object.values(data.tls?.suites ?? {});
  const sigSchemes = Object.values(data.sig?.schemes ?? {});
  const sshSuites = Object.values(data.ssh?.suites ?? {});

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "tls" as Tab, label: "TLS", count: tlsSuites.length },
    { id: "signatures" as Tab, label: "Signatures", count: sigSchemes.length },
    { id: "ssh" as Tab, label: "SSH", count: sshSuites.length },
  ].filter((t) => t.count > 0);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-1">
          Protocol Benchmarks
        </h1>
        <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed max-w-2xl">
          Post-quantum TLS and SSH handshake performance measured in context — timing,
          bytes on wire, phase decomposition, and cross-validation against liboqs and eBACS
          reference data. Measured daily on{" "}
          {data.tls?.suites
            ? Object.values(data.tls.suites)[0]?.host?.cpu_model ?? "production hardware"
            : "production hardware"}
          .
        </p>
        {manifest && (
          <div className="mt-3 flex flex-wrap gap-4 text-xs text-[var(--color-text-tertiary)]">
            <span>Generated {manifest.generated_utc}</span>
            {manifest.files["tls-composed"] && (
              <span>
                Data commit{" "}
                <a
                  href={`https://github.com/Q-Advantage/q-advantage/commit/${manifest.files["tls-composed"].commit}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-[var(--color-text-info)] hover:underline"
                >
                  {manifest.files["tls-composed"].commit}
                </a>
              </span>
            )}
            <a
              href="/data/protocols/manifest.json"
              className="text-[var(--color-text-info)] hover:underline"
            >
              raw JSON ↗
            </a>
          </div>
        )}
      </div>

      {!hasAnyData ? (
        <EmptyState />
      ) : (
        <>
          <HeroStrip data={data} />

          {/* tab bar */}
          {tabs.length > 1 && (
            <div className="flex gap-2 mb-5 flex-wrap">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`px-4 py-1.5 rounded-lg text-sm border transition-colors ${
                    activeTab === t.id
                      ? "bg-[var(--color-background-primary)] text-[var(--color-text-primary)] border-[var(--color-border-primary)] font-medium"
                      : "bg-[var(--color-background-secondary)] text-[var(--color-text-secondary)] border-[var(--color-border-tertiary)]"
                  }`}
                >
                  {t.label}
                  <span className="ml-1.5 text-[11px] opacity-60">{t.count}</span>
                </button>
              ))}
            </div>
          )}

          {/* TLS panel */}
          {(activeTab === "tls" || tabs.length === 1) && tlsSuites.length > 0 && (
            <div>
              <SectionLabel>TLS handshake — composed crypto cost (Layer A)</SectionLabel>
              <div className="text-xs text-[var(--color-text-secondary)] mb-3 leading-relaxed max-w-2xl">
                Measures the actual crypto operations a TLS handshake performs, composed from
                liboqs-python primitives and a classical X25519 reference. Fully in-process —
                isolates PQC-attributable cost and enables phase decomposition. Not a live
                handshake (Layer B is on the roadmap).
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {tlsSuites.map((s) => (
                  <TLSSuiteCard key={s.identity.suite} suite={s} />
                ))}
              </div>
            </div>
          )}

          {/* Signatures panel */}
          {activeTab === "signatures" && sigSchemes.length > 0 && (
            <div>
              <SectionLabel>Signature track — authentication + on-chain sizing</SectionLabel>
              <div className="text-xs text-[var(--color-text-secondary)] mb-3 leading-relaxed max-w-2xl">
                Post-quantum signature schemes measured for keygen / sign / verify timing and —
                critically — signature and public key sizes. Size is the deciding factor for
                on-chain use and certificate overhead. ML-DSA sign is right-skewed due to
                rejection sampling; median is the representative figure.
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {sigSchemes.map((s) => (
                  <SigSchemeCard key={s.scheme} scheme={s} />
                ))}
              </div>
            </div>
          )}

          {/* SSH panel */}
          {activeTab === "ssh" && sshSuites.length > 0 && (
            <div>
              <SectionLabel>SSH key exchange — composed crypto cost (Layer A)</SectionLabel>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {sshSuites.map((s) => (
                  <TLSSuiteCard key={s.identity.suite} suite={s} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
