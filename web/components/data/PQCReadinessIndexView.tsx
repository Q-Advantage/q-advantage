"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  PQCReadinessIndexData,
  PQCInstitutionEntry,
  PQCCategory,
} from "@/lib/data/pqc-readiness-types";

/*
 * PQC Readiness Index — dashboard view (/pqc-readiness-index)
 *
 * Two-track discipline (magnet-spec-v0.md §4), enforced in the render, not
 * just the data: KEX and AUTH are ALWAYS two separate columns. There is no
 * composite score column, anywhere on this page — a composite would hide
 * that authentication is flat near zero while key exchange improves.
 *
 * "null" (zero measurable endpoints) renders as "—", never as 0% — those
 * are different claims ("we don't know" vs "we know it's zero").
 *
 * Excluded institutions (measurement-ethics.md §5) render as a named,
 * dated exclusion notice, never silently dropped from the list and never
 * scored as zero.
 */

const pct = (n: number | null): string => (n === null ? "—" : `${Math.round(n * 100)}%`);

const CATEGORY_ORDER: PQCCategory[] = [
  "bank_gsib",
  "bank_national_retail",
  "exchange_ccp",
  "card_network_processor",
  "ca",
];

type SortKey = "name" | "kex_score" | "auth_score" | "measurable_endpoints";

export default function PQCReadinessIndexView({ data }: { data: PQCReadinessIndexData }) {
  const [categoryFilter, setCategoryFilter] = useState<PQCCategory | "all">("all");
  const [sortKey, setSortKey] = useState<SortKey>("kex_score");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const filtered = useMemo(() => {
    const rows =
      categoryFilter === "all"
        ? data.institutions
        : data.institutions.filter((i) => i.category === categoryFilter);
    const sorted = [...rows].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortKey === "name") return a.name.localeCompare(b.name) * dir;
      const av = a[sortKey] ?? -1;
      const bv = b[sortKey] ?? -1;
      return (av - bv) * dir;
    });
    return sorted;
  }, [data.institutions, categoryFilter, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  return (
    <div>
      {/* ============ HERO ============ */}
      <div className="mb-10">
        <div className="eyebrow mb-3">PQC Readiness Index</div>
        <h1 className="font-serif text-[clamp(32px,5vw,52px)] font-normal leading-[1.05] tracking-[-0.02em] text-fg mb-4">
          Key exchange moved. Authentication didn&apos;t.
        </h1>
        <p className="text-base text-fg-muted leading-[1.7] font-light max-w-[720px]">
          Weekly-measured TLS posture of named financial institutions, exchanges, card networks,
          and certificate authorities — split into two tracks that are never merged into one
          score, because merging them would hide the half that matters.
        </p>

        <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-4 border-t border-b border-border py-6">
          <Stat label="Institutions" value={String(data.hero.n_institutions)} />
          <Stat label="Field KEX average" value={pct(data.hero.kex_field_average)} tone="accent" />
          <Stat label="Field AUTH average" value={pct(data.hero.auth_field_average)} tone="warn" />
          <Stat label="Sweep" value={data.sweep_date} mono />
        </div>
      </div>

      {/* ============ FILTER BAR ============ */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Select
          value={categoryFilter}
          onValueChange={(v) => setCategoryFilter(v as PQCCategory | "all")}
        >
          <SelectTrigger className="w-[240px]">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {CATEGORY_ORDER.map((c) => (
              <SelectItem key={c} value={c}>
                {data.categories[c]?.label ?? c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-fg-subtle">{filtered.length} shown</span>
      </div>

      {/* ============ TABLE ============ */}
      <div className="border border-border rounded-lg overflow-x-auto bg-bg-card">
        <table className="w-full text-sm min-w-[760px]">
          <thead>
            <tr className="border-b border-border text-left">
              <Th onClick={() => toggleSort("name")} active={sortKey === "name"} dir={sortDir}>
                Institution
              </Th>
              <th className="px-4 py-3 text-2xs uppercase tracking-eyebrow text-fg-subtle font-mono">
                Category
              </th>
              <Th onClick={() => toggleSort("kex_score")} active={sortKey === "kex_score"} dir={sortDir} numeric>
                KEX
              </Th>
              <Th onClick={() => toggleSort("auth_score")} active={sortKey === "auth_score"} dir={sortDir} numeric>
                AUTH
              </Th>
              <th className="px-4 py-3 text-2xs uppercase tracking-eyebrow text-fg-subtle font-mono">
                Hygiene
              </th>
              <Th onClick={() => toggleSort("measurable_endpoints")} active={sortKey === "measurable_endpoints"} dir={sortDir} numeric>
                Measured
              </Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((inst) => (
              <Row key={inst.id} inst={inst} />
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-fg-subtle mt-4 max-w-[640px]">
        Support, not preference — a row shows whether an endpoint <em>accepts</em> a hybrid
        post-quantum key-exchange group when offered, never which group it negotiates by default.
        See the{" "}
        <Link href="/methodology#pqc-readiness-index" className="text-fg-muted hover:text-accent transition-colors underline decoration-border-strong hover:decoration-accent underline-offset-2">
          methodology
        </Link>{" "}
        for the full scoring rules, sourcing bar, and what counts as &ldquo;not measurable.&rdquo;
      </p>
    </div>
  );
}

function Row({ inst }: { inst: PQCInstitutionEntry }) {
  if (inst.excluded) {
    return (
      <tr className="border-b border-border-subtle last:border-0">
        <td className="px-4 py-3 text-fg-muted" colSpan={6}>
          <span className="font-medium text-fg">{inst.name}</span> — excluded at the
          institution&apos;s request, {inst.excluded.date}. No score in either track.
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-border-subtle last:border-0 hover:bg-bg-surface transition-colors">
      <td className="px-4 py-3">
        <Link href={`/pqc-readiness-index/${inst.id}`} className="text-fg hover:text-accent transition-colors font-medium">
          {inst.name}
        </Link>
        {inst.unverified && (
          <span className="ml-2 inline-block px-1.5 py-0.5 rounded text-2xs uppercase tracking-eyebrow text-fg-subtle border border-border-strong">
            unverified
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-fg-muted text-xs">{CATEGORY_LABEL[inst.category]}</td>
      <td className="px-4 py-3 text-right font-mono tabular-nums">
        <ScoreCell value={inst.kex_score} tone="accent" />
      </td>
      <td className="px-4 py-3 text-right font-mono tabular-nums">
        <ScoreCell value={inst.auth_score} tone="warn" />
      </td>
      <td className="px-4 py-3">
        <HygieneBadges hygiene={inst.hygiene} />
      </td>
      <td className="px-4 py-3 text-right font-mono tabular-nums text-fg-muted text-xs">
        {inst.measurable_endpoints}/{inst.total_endpoints}
      </td>
    </tr>
  );
}

const CATEGORY_LABEL: Record<PQCCategory, string> = {
  bank_gsib: "G-SIB",
  bank_national_retail: "National bank",
  exchange_ccp: "Exchange/CCP",
  card_network_processor: "Card network",
  ca: "CA",
};

function ScoreCell({ value, tone }: { value: number | null; tone: "accent" | "warn" }) {
  if (value === null) return <span className="text-fg-faint">—</span>;
  const color = tone === "accent" ? "text-accent" : value > 0 ? "text-status-warn" : "text-fg-muted";
  return <span className={color}>{pct(value)}</span>;
}

function HygieneBadges({ hygiene }: { hygiene: PQCInstitutionEntry["hygiene"] }) {
  const flags: Array<[boolean, string, string]> = [
    [hygiene.tls_1_2_accepted, "TLS 1.2", "Still accepts TLS 1.2"],
    [hygiene.weak_signature_algorithm, "Weak sig", "Weak/deprecated certificate signature algorithm"],
    [hygiene.short_key, "Short key", "Certificate key below recommended minimum size"],
    [hygiene.expired_or_near_expiry, "Expiry", "Certificate expired or expiring within 90 days"],
  ];
  const active = flags.filter(([f]) => f);
  if (active.length === 0) {
    return <span className="text-fg-faint text-xs">none</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {active.map(([, label, title]) => (
        <span
          key={label}
          title={title}
          className="inline-block px-1.5 py-0.5 rounded text-2xs uppercase tracking-eyebrow text-status-warn border border-status-warn/40"
        >
          {label}
        </span>
      ))}
    </div>
  );
}

function Stat({ label, value, tone, mono }: { label: string; value: string; tone?: "accent" | "warn"; mono?: boolean }) {
  const color = tone === "accent" ? "text-accent" : tone === "warn" ? "text-status-warn" : "text-fg";
  return (
    <div>
      <div className="text-2xs uppercase tracking-eyebrow text-fg-subtle mb-1.5 font-mono">{label}</div>
      <div className={`text-2xl font-serif ${color} ${mono ? "font-mono text-lg" : ""}`}>{value}</div>
    </div>
  );
}

function Th({
  children,
  onClick,
  active,
  dir,
  numeric,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active: boolean;
  dir: "asc" | "desc";
  numeric?: boolean;
}) {
  return (
    <th
      onClick={onClick}
      className={`px-4 py-3 text-2xs uppercase tracking-eyebrow font-mono cursor-pointer select-none hover:text-fg transition-colors ${
        numeric ? "text-right" : ""
      } ${active ? "text-fg" : "text-fg-subtle"}`}
    >
      {children}
      {active && <span className="ml-1">{dir === "asc" ? "↑" : "↓"}</span>}
    </th>
  );
}
