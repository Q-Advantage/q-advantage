// web/components/data/ComplianceBadges.tsx
//
// CNSA 2.0 / BSI / ANSSI approval-status badges for an already-benchmarked
// algorithm family. Labeling only — every claim traces to lib/data/
// compliance.ts's cited sources; nothing here is a new measurement.

import type { AlgorithmFamily } from "@/lib/data/types";
import { COMPLIANCE_TABLE, type RegimeApproval } from "@/lib/data/compliance";

const STATUS_COLOR: Record<string, string> = {
  approved: "text-emerald-500 border-emerald-500/30",
  recommended: "text-emerald-500 border-emerald-500/30",
  conditional: "text-amber-500 border-amber-500/30",
  "not-addressed": "text-fg-subtle border-border",
  unverified: "text-fg-subtle border-border",
};

const STATUS_LABEL: Record<string, string> = {
  approved: "Approved",
  recommended: "Recommended",
  conditional: "Conditional",
  "not-addressed": "Not addressed",
  unverified: "Unverified",
};

function Badge({ regime, approval }: { regime: string; approval: RegimeApproval }) {
  return (
    <a
      href={approval.sourceUrl}
      className={`flex flex-col gap-1 border rounded-md px-3 py-2.5 hover:bg-bg-elevated transition-colors ${STATUS_COLOR[approval.status] ?? STATUS_COLOR.unverified}`}
      title={approval.note}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-2xs uppercase tracking-eyebrow text-fg-subtle font-mono">{regime}</span>
        <span className="text-2xs font-medium">{STATUS_LABEL[approval.status]}</span>
      </div>
      <p className="text-2xs text-fg-muted leading-relaxed line-clamp-3">{approval.note}</p>
      <span className="text-2xs text-fg-subtle mt-0.5">
        {approval.source}
        {approval.verification === "search-corroborated" && (
          <span className="text-amber-500/80"> · not directly verified this session, spot-check the source</span>
        )}
      </span>
    </a>
  );
}

export function ComplianceBadges({ family }: { family: AlgorithmFamily }) {
  const entry = COMPLIANCE_TABLE.find((e) => e.family === family);
  if (!entry) return null;

  return (
    <section className="border border-border rounded-md bg-bg-surface">
      <header className="px-4 py-3 border-b border-border">
        <h2 className="text-sm font-semibold text-fg">Regulatory approval status</h2>
        <p className="text-2xs text-fg-subtle mt-0.5">
          Whether this algorithm family is approved/recommended for use under three regimes. Every
          badge links to its source — click through before citing this elsewhere.
        </p>
      </header>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 px-4 py-4">
        <Badge regime="CNSA 2.0 (US/NSA)" approval={entry.cnsa2} />
        <Badge regime="BSI TR-02102-1 (DE)" approval={entry.bsi} />
        <Badge regime="ANSSI (FR)" approval={entry.anssi} />
      </div>
    </section>
  );
}
