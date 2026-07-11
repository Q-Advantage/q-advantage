"use client";
// web/components/protocols/ProtocolsView.tsx
//
// Rebuilt to match the real qadvantage.io design language:
// semantic tokens (fg / fg-muted / fg-subtle / border / bg-inset / accent),
// .eyebrow labels, .num mono cells, font-serif for display numerals.

import { useState } from "react";
import type {
  ProtocolsData,
  ComposedSuite,
  SigScheme,
  CrossValidation,
} from "@/lib/protocols/types";

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
function fmtPct(n: number | undefined): string {
  if (n == null) return "—";
  const s = n > 0 ? "+" : "";
  return `${s}${n.toFixed(1)}%`;
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

// ── cross-validation ──────────────────────────────────────────────────────────

function XVal({ xval }: { xval?: CrossValidation }) {
  if (!xval) return null;
  return (
    <div className="mt-4 pt-4 border-t border-border">
      <div className="eyebrow mb-2">Cross-validation</div>
      <div className="grid grid-cols-3 gap-4">
        {xval.liboqs_speed_number != null && (
          <Stat label="liboqs speed" value={`${fmt(xval.liboqs_speed_number)} µs`} />
        )}
        {xval.ebacs_reference_cycles != null && (
          <Stat label="eBACS cycles" value={xval.ebacs_reference_cycles.toLocaleString()} />
        )}
        {xval.measured_vs_reference_pct != null && (
          <Stat label="vs. liboqs ref" value={fmtPct(xval.measured_vs_reference_pct)} />
        )}
      </div>
      {xval.reference_notes && (
        <div className="mt-3">
          <Disclosure label="Reference methodology">
            <p className="text-xs text-fg-muted leading-relaxed font-light">
              {xval.reference_notes}
            </p>
          </Disclosure>
        </div>
      )}
    </div>
  );
}

// ── ML-KEM vs X25519 disclosure (required DoD item) ──────────────────────────

function MLKEMNote() {
  return (
    <div className="mt-3 border-l-2 border-accent/40 pl-3 py-1 text-xs text-fg-muted leading-relaxed font-light">
      <span className="text-fg">Build-path context.</span> ML-KEM-768 timing uses
      liboqs 0.15.0 with <span className="num text-fg-muted">OQS_DIST_BUILD</span> AVX2
      runtime dispatch; X25519 uses the <span className="num text-fg-muted">cryptography</span>{" "}
      library via OpenSSL EVP. These aren&apos;t identical measurement contexts &mdash; the
      delta reflects both algorithm efficiency and library path. Raw liboqs{" "}
      <span className="num text-fg-muted">speed_kem</span> confirms ML-KEM-768 at 48.3 µs
      total (keygen + encaps + decaps) vs X25519 at 161.3 µs under the same binary, so the
      direction holds independent of the harness.{" "}
      <a
        href="/methodology#cross-validation"
        className="text-fg hover:text-accent transition-colors underline decoration-border-strong hover:decoration-accent underline-offset-2"
      >
        Full methodology
      </a>
      .
    </div>
  );
}

// ── suite card (TLS / SSH) ────────────────────────────────────────────────────

function SuiteCard({ suite }: { suite: ComposedSuite }) {
  const pct = suite.baseline?.pct_over_classical;
  const isPureMLKEM = suite.identity.suite === "MLKEM768";
  const showNote = isPureMLKEM || (pct != null && pct < 0);

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="num text-fg font-medium">{suite.identity.suite}</span>
          {suite.host?.arch && (
            <span className="text-2xs num text-fg-subtle border border-border rounded px-1.5 py-0.5">
              {suite.host.arch}
            </span>
          )}
        </div>
        {pct != null && (
          <div className="flex flex-col items-end">
            <span className="font-serif text-2xl leading-none text-fg">{fmtPct(pct)}</span>
            <span className="text-2xs text-fg-subtle mt-1">vs {suite.baseline?.baseline_suite}</span>
          </div>
        )}
      </div>

      {showNote && <MLKEMNote />}

      <div className="grid grid-cols-4 gap-4 mt-4">
        <Stat label="median" value={`${fmt(suite.timing.median_us)} µs`} />
        <Stat label="p95" value={`${fmt(suite.timing.p95_us)} µs`} />
        <Stat label="p99" value={`${fmt(suite.timing.p99_us)} µs`} />
        <Stat label="n" value={suite.timing.n_iterations.toLocaleString()} />
      </div>

      {suite.size && (
        <div className="grid grid-cols-3 gap-4 mt-4">
          <Stat label="client → server" value={fmtBytes(suite.size.bytes_client_to_server)} />
          <Stat label="server → client" value={fmtBytes(suite.size.bytes_server_to_client)} />
          <Stat label="on wire" value={fmtBytes(suite.size.bytes_total)} />
        </div>
      )}

      {suite.phases && Object.keys(suite.phases).length > 0 && (
        <div className="mt-4">
          <Disclosure label="Phase decomposition">
            <div className="grid grid-cols-3 gap-4">
              {Object.entries(suite.phases).map(([name, t]) => (
                <Stat
                  key={name}
                  label={name.replace(/_/g, " ")}
                  value={`${fmt(t.median_us)} µs`}
                  sub={`p95 ${fmt(t.p95_us)}`}
                />
              ))}
            </div>
          </Disclosure>
        </div>
      )}

      <XVal xval={suite.cross_validation} />

      {suite.audit && (
        <div className="mt-4 pt-4 border-t border-border space-y-1">
          {suite.audit.git_commit && <Meta label="commit" value={suite.audit.git_commit.slice(0, 12)} />}
          {suite.audit.timestamp_utc && <Meta label="captured" value={suite.audit.timestamp_utc} />}
          {suite.host?.build_path && <Meta label="build path" value={suite.host.build_path} />}
        </div>
      )}
    </Card>
  );
}

// ── signature card ────────────────────────────────────────────────────────────

function SigCard({ scheme }: { scheme: SigScheme }) {
  return (
    <Card>
      <div className="flex items-center justify-between">
        <span className="num text-fg font-medium">{scheme.scheme}</span>
      </div>

      <div className="grid grid-cols-3 gap-4 mt-4">
        <Stat label="keygen" value={`${fmt(scheme.keygen.median_us)} µs`} />
        <Stat
          label="sign"
          value={`${fmt(scheme.sign.median_us)} µs`}
          sub={`mean ${fmt(scheme.sign.mean_us)}`}
        />
        <Stat label="verify" value={`${fmt(scheme.verify.median_us)} µs`} />
      </div>

      <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-border">
        <div className="flex flex-col gap-0.5">
          <span className="text-2xs uppercase tracking-eyebrow text-fg-subtle font-mono">
            signature size
          </span>
          <span className="font-serif text-xl leading-none text-fg mt-0.5">
            {fmtBytes(scheme.signature_bytes)}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-2xs uppercase tracking-eyebrow text-fg-subtle font-mono">
            public key size
          </span>
          <span className="font-serif text-xl leading-none text-fg mt-0.5">
            {fmtBytes(scheme.public_key_bytes)}
          </span>
        </div>
      </div>

      {scheme.scheme.startsWith("ML-DSA") && (
        <p className="mt-3 text-2xs text-fg-subtle leading-relaxed font-light">
          Sign is right-skewed (Fiat-Shamir with aborts → rejection sampling); mean exceeds
          median, and p99 reflects worst-case abort chains. Median is the representative figure.
        </p>
      )}

      <XVal xval={scheme.cross_validation} />
    </Card>
  );
}

// ── hero strip ────────────────────────────────────────────────────────────────

function Hero({ data }: { data: ProtocolsData }) {
  const tls = data.tls?.suites ?? {};
  const sigs = data.sig?.schemes ?? {};

  const hybrid = tls["X25519MLKEM768"];
  const falcon = sigs["Falcon-512"];
  const slh = sigs["SLH_DSA_PURE_SHAKE_128S"] ?? sigs["SLH_DSA_PURE_SHAKE_128F"];
  const mlkem = tls["MLKEM768"];
  const x25519 = tls["X25519"];

  type H = { value: string; label: string; note: string };
  const heroes: H[] = [];

  if (hybrid) {
    heroes.push({
      value: fmtPct(hybrid.baseline?.pct_over_classical),
      label: "X25519+ML-KEM-768 TLS overhead",
      note: `${fmt(hybrid.timing.median_us)} µs median · ${fmtBytes(hybrid.size?.bytes_total)} on wire`,
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
      label: `${slh.scheme.replace(/_/g, "-")} signature`,
      note: `sign ${fmt(slh.sign.median_us)} µs · conservative hash-based`,
    });
  }
  if (mlkem && x25519) {
    const pct = ((mlkem.timing.median_us - x25519.timing.median_us) / x25519.timing.median_us) * 100;
    heroes.push({
      value: fmtPct(pct),
      label: "ML-KEM-768 vs X25519",
      note: `${fmt(mlkem.timing.median_us)} µs vs ${fmt(x25519.timing.median_us)} µs · AVX2 dispatch`,
    });
  }

  if (!heroes.length) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-border border border-border rounded-md overflow-hidden">
      {heroes.map((h) => (
        <div key={h.label} className="bg-bg-inset px-5 py-5 flex flex-col gap-2">
          <span className="font-serif text-[clamp(28px,4vw,40px)] leading-none text-fg">
            {h.value}
          </span>
          <span className="text-sm text-fg font-medium leading-tight">{h.label}</span>
          <span className="text-2xs text-fg-subtle num leading-relaxed">{h.note}</span>
        </div>
      ))}
    </div>
  );
}

// ── empty state ───────────────────────────────────────────────────────────────

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

type Tab = "tls" | "signatures" | "ssh";

export function ProtocolsView({ data }: { data: ProtocolsData }) {
  const [tab, setTab] = useState<Tab>("tls");

  const tlsSuites = Object.values(data.tls?.suites ?? {});
  const sigSchemes = Object.values(data.sig?.schemes ?? {});
  const sshSuites = Object.values(data.ssh?.suites ?? {});
  const hasData = tlsSuites.length || sigSchemes.length || sshSuites.length;
  const manifest = data.manifest;

  const tabs = (
    [
      { id: "tls" as Tab, label: "TLS", count: tlsSuites.length },
      { id: "signatures" as Tab, label: "Signatures", count: sigSchemes.length },
      { id: "ssh" as Tab, label: "SSH", count: sshSuites.length },
    ] as { id: Tab; label: string; count: number }[]
  ).filter((t) => t.count > 0);

  const active = tabs.find((t) => t.id === tab) ? tab : tabs[0]?.id;

  const cpu =
    tlsSuites[0]?.host?.cpu_model ?? data.sig?.environment?.cpu_model ?? "production hardware";

  if (!hasData) return <Empty />;

  return (
    <div className="space-y-8">
      {/* provenance line — echoes the AuditStrip idea in one row */}
      {manifest && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-fg-subtle border-y border-border py-3">
          <span className="num">{cpu}</span>
          <span>Generated {manifest.generated_utc}</span>
          {manifest.files["tls-composed"] && (
            <span>
              Commit{" "}
              <a
                href={`https://github.com/Q-Advantage/q-advantage/commit/${manifest.files["tls-composed"].commit}`}
                target="_blank"
                rel="noopener noreferrer"
                className="num text-fg-muted hover:text-accent transition-colors"
              >
                {manifest.files["tls-composed"].commit}
              </a>
            </span>
          )}
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

      {active === "tls" && tlsSuites.length > 0 && (
        <div>
          <SectionHead
            title="TLS handshake"
            caption="Composed crypto cost (Layer A): the actual operations a TLS handshake performs, built from liboqs primitives plus a classical X25519 reference. Fully in-process — isolates the PQC-attributable cost and enables the phase decomposition below."
          />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {tlsSuites.map((s) => (
              <SuiteCard key={s.identity.suite} suite={s} />
            ))}
          </div>
        </div>
      )}

      {active === "signatures" && sigSchemes.length > 0 && (
        <div>
          <SectionHead
            title="Signature track"
            caption="Authentication schemes measured for keygen / sign / verify timing and — the figure that decides on-chain and certificate viability — signature and public-key size. Falcon is smallest; SLH-DSA is the conservative hash-based option at a size cost; ML-DSA sits between."
          />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {sigSchemes.map((s) => (
              <SigCard key={s.scheme} scheme={s} />
            ))}
          </div>
        </div>
      )}

      {active === "ssh" && sshSuites.length > 0 && (
        <div>
          <SectionHead
            title="SSH key exchange"
            caption="The same composed-cost measurement applied to SSH KEX: the OpenSSH 10 default hybrid against the classical curve25519 baseline."
          />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {sshSuites.map((s) => (
              <SuiteCard key={s.identity.suite} suite={s} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
