"use client";
// web/components/data/HybridVsClassical.tsx
//
// The suites this session's founder flagged as missing from /q-shield/compare
// (X25519MLKEM768 and friends) were never absent from the data — they're
// real, measured daily since June in benchmark/results/protocols/{tls,ssh}-
// composed-*.json. This component is the fix: it exposes those composed
// suites (hybrid AND classical baseline) as their own comparison group,
// alongside two derived metrics that fall straight out of already-measured
// fields — amplification factor and (honestly labeled) bytes-on-wire.

import { useMemo } from "react";
import type { ComposedSuite } from "@/lib/protocols/types";
import {
  amplificationFactor,
  formatAmplificationFactor,
  BYTES_ON_WIRE_LABEL,
  classifySuite,
  formatMultiplier,
  type SuiteClassification,
} from "@/lib/protocols/derive";
import { publishableVsBaselinePct, publishableHybridToPurePqcRatio } from "@/lib/protocols/anomaly";
import { formatDuration, formatBytes, githubCommitUrl } from "@/lib/format";
import { toCsv, downloadCsv } from "@/lib/csv";
import { ShareButton } from "./ShareButton";

const CLASS_LABEL: Record<SuiteClassification, string> = {
  hybrid: "hybrid",
  "pure-pqc": "pure PQC",
  classical: "classical",
  unknown: "unclassified",
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-2xs uppercase tracking-eyebrow text-fg-subtle font-mono">{label}</span>
      <span className="num text-sm text-fg">{value}</span>
    </div>
  );
}

function DeltaBadge({ pct }: { pct: number | undefined }) {
  if (pct == null) return <span className="text-2xs text-fg-subtle">classical baseline</span>;
  const faster = pct < 0;
  const abs = Math.abs(pct).toFixed(1);
  return (
    <span className={`text-xs font-medium ${faster ? "text-emerald-500" : "text-fg"}`}>
      {abs}% {faster ? "faster" : "slower"} <span className="text-fg-subtle font-bold">vs classical</span>
    </span>
  );
}

function SuiteRow({
  name,
  suite,
  protocol,
  siblings,
  purePqcSuite,
}: {
  name: string;
  suite: ComposedSuite;
  protocol: "TLS" | "SSH";
  /** The other suites from the same file — the delta is computed against these. */
  siblings: Record<string, ComposedSuite>;
  /** Same-protocol pure-PQC suite to compare against, when one was measured.
   * Only meaningful when this row itself classifies as "hybrid"; ssh-composed
   * has no pure-PQC suite, so this is legitimately absent there. */
  purePqcSuite?: ComposedSuite;
}) {
  const factor = amplificationFactor(suite);
  const classification = classifySuite(suite);
  const ratioToPurePqc =
    classification === "hybrid" && purePqcSuite
      ? publishableHybridToPurePqcRatio(suite, purePqcSuite)
      : null;

  return (
    <div className="border border-border rounded-md bg-bg-inset px-5 py-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-2xs num text-fg-subtle border border-border rounded px-1.5 py-0.5">{protocol}</span>
          <span className="num text-fg font-medium">{name}</span>
          <span
            className={`text-2xs border rounded px-1.5 py-0.5 ${
              classification === "pure-pqc"
                ? "text-emerald-500 border-emerald-500/30"
                : "text-fg-subtle border-border"
            }`}
          >
            {CLASS_LABEL[classification]}
          </span>
        </div>
        <DeltaBadge pct={publishableVsBaselinePct(suite, siblings) ?? undefined} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Stat label="median latency" value={formatDuration(suite.timing.median_us)} />
        <Stat
          label={BYTES_ON_WIRE_LABEL}
          value={suite.size ? formatBytes(suite.size.bytes_total) : "—"}
        />
        <Stat
          label="amplification factor"
          value={formatAmplificationFactor(factor)}
        />
        <Stat
          label="client → server"
          value={suite.size ? `${formatBytes(suite.size.bytes_client_to_server)} → ${formatBytes(suite.size.bytes_server_to_client)}` : "—"}
        />
        {classification === "hybrid" && (
          <Stat
            label="vs pure PQC alone"
            value={
              ratioToPurePqc == null
                ? purePqcSuite
                  ? "withheld — see note"
                  : "no pure-PQC suite measured"
                : `${formatMultiplier(ratioToPurePqc)} slower`
            }
          />
        )}
      </div>

      {suite.audit?.git_commit && (
        <a
          href={githubCommitUrl(suite.audit.git_commit)}
          className="text-2xs text-fg-subtle hover:text-accent transition-colors self-start"
        >
          commit {suite.audit.git_commit.slice(0, 7)} ↗
        </a>
      )}
    </div>
  );
}

export function HybridVsClassical({
  tlsSuites,
  sshSuites,
}: {
  tlsSuites?: Record<string, ComposedSuite>;
  sshSuites?: Record<string, ComposedSuite>;
}) {
  const rows = useMemo(() => {
    const out: {
      name: string;
      suite: ComposedSuite;
      protocol: "TLS" | "SSH";
      siblings: Record<string, ComposedSuite>;
    }[] = [];
    for (const [name, suite] of Object.entries(tlsSuites ?? {}))
      out.push({ name, suite, protocol: "TLS", siblings: tlsSuites ?? {} });
    for (const [name, suite] of Object.entries(sshSuites ?? {}))
      out.push({ name, suite, protocol: "SSH", siblings: sshSuites ?? {} });
    return out;
  }, [tlsSuites, sshSuites]);

  // One pure-PQC suite per protocol for hybrids to be compared against, when
  // one was measured. Not a hardcoded name match — classifySuite() reads the
  // actual phase block, so this stays correct if suites are added or renamed.
  // ssh-composed has no pure-PQC suite today; that resolves to undefined and
  // the row says so rather than borrowing TLS's.
  const purePqcByProtocol = useMemo(() => {
    const found: Partial<Record<"TLS" | "SSH", ComposedSuite>> = {};
    for (const { suite, protocol } of rows) {
      if (classifySuite(suite) === "pure-pqc" && !found[protocol]) found[protocol] = suite;
    }
    return found;
  }, [rows]);

  function handleExport() {
    const headers = [
      "protocol",
      "suite",
      "classification",
      "median_latency_us",
      "pct_over_classical_recomputed_same_run",
      "vs_pure_pqc_ratio",
      "bytes_client_to_server",
      "bytes_server_to_client",
      "bytes_total",
      "amplification_factor",
      "git_commit",
    ];
    const csvRows = rows.map(({ name, suite, protocol, siblings }) => {
      const classification = classifySuite(suite);
      const pure = purePqcByProtocol[protocol];
      const ratio =
        classification === "hybrid" && pure ? publishableHybridToPurePqcRatio(suite, pure) : null;
      return [
        protocol,
        name,
        classification,
        suite.timing.median_us,
        publishableVsBaselinePct(suite, siblings) ?? "",
        ratio ?? "",
        suite.size?.bytes_client_to_server ?? "",
        suite.size?.bytes_server_to_client ?? "",
        suite.size?.bytes_total ?? "",
        amplificationFactor(suite) ?? "",
        suite.audit?.git_commit ?? "",
      ];
    });
    downloadCsv("q-shield-hybrid-vs-classical.csv", toCsv(headers, csvRows));
  }

  if (rows.length === 0) return null;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-[clamp(22px,3vw,28px)] font-bold leading-tight tracking-[-0.01em] text-fg">
            Hybrid vs classical.
          </h3>
          <p className="text-sm text-fg-muted mt-1 max-w-2xl leading-relaxed font-medium">
            Real TLS and SSH handshake suites — hybrid post-quantum key exchange next to the classical
            baseline everyone already runs. Amplification factor (server bytes returned per byte the
            client sends) is a first-to-publish number here: not measured elsewhere for these suites.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ShareButton title="Q-Shield — Hybrid vs Classical" />
          <button
            onClick={handleExport}
            className="text-xs text-fg-muted hover:text-accent transition-colors border border-border rounded px-2.5 py-1.5"
          >
            Export CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {rows.map(({ name, suite, protocol, siblings }) => (
          <SuiteRow
            key={`${protocol}-${name}`}
            name={name}
            suite={suite}
            protocol={protocol}
            siblings={siblings}
            purePqcSuite={purePqcByProtocol[protocol]}
          />
        ))}
      </div>
    </div>
  );
}
