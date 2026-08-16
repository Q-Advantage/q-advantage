"use client";
// web/components/data/AlgorithmBoard.tsx
//
// The algorithm board: one measured metric across every algorithm, with the
// controls a reader needs to ask their own question rather than only the one
// the page author asked.
//
// Form: horizontal bars. The category labels are long ("SLH-DSA-SHAKE-128s")
// and the comparison is magnitude across a categorical set, which is what
// horizontal bars are for. Visual treatment matches kit.tsx's LogBars so this
// reads as the same instrument.
//
// Colour encodes family identity (categorical, two groups) using series-1 and
// series-2 — the pair validated as passing lightness, chroma, CVD separation
// and contrast against both surfaces. Identity is never colour-alone: the
// legend is always present and every bar carries a direct value label and a
// family qualifier under its name.
//
// Nothing here is modelled. A missing measurement is never plotted as zero —
// it drops out and is named beneath the chart.

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { NormalizedAlgorithm, Operation } from "@/lib/data/types";
import {
  METRICS,
  availableOperations,
  buildBoard,
  getMetric,
  suggestsLogScale,
  type BoardPoint,
} from "@/lib/data/board-metrics";
import { DataTable, RowName, Tag } from "@/components/product/kit";
import { formatDuration, githubChecksUrl } from "@/lib/format";

type View = "chart" | "table";
type Scale = "log" | "linear";

const GROUPS = [
  { id: "lattice" as const, label: "Lattice", series: 1 },
  { id: "hash" as const, label: "Hash-based", series: 2 },
];

const OP_LABEL: Record<Operation, string> = {
  keygen: "Keygen",
  sign: "Sign",
  verify: "Verify",
  encap: "Encapsulate",
  decap: "Decapsulate",
};

function seriesColor(group: BoardPoint["group"]): string {
  return `rgb(var(--color-series-${group === "lattice" ? 1 : 2}))`;
}

/** Shared control chrome so every control reads as one row of the same thing. */
function Control({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-bold uppercase tracking-eyebrow text-fg-subtle">{label}</span>
      {children}
    </label>
  );
}

const selectClass =
  "h-8 rounded border border-border bg-bg-surface px-2 text-[12.5px] font-semibold text-fg transition-colors hover:border-border-strong focus:outline-none focus:ring-1 focus:ring-accent";

function Toggle({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
  ariaLabel: string;
}) {
  return (
    <div role="group" aria-label={ariaLabel} className="flex h-8 overflow-hidden rounded border border-border">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          aria-pressed={value === o.id}
          className={`px-2.5 text-[12px] font-semibold transition-colors ${
            value === o.id
              ? "bg-bg-inset text-fg"
              : "bg-bg-surface text-fg-muted hover:text-fg"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function AlgorithmBoard({
  algorithms,
  runSha,
}: {
  algorithms: NormalizedAlgorithm[];
  /** Commit of the run these numbers came from — every bar links to it. */
  runSha: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const ops = useMemo(() => availableOperations(algorithms), [algorithms]);

  const [op, setOp] = useState<Operation>(ops[0] ?? "keygen");
  const [metricId, setMetricId] = useState<string>("mean");
  const [view, setView] = useState<View>("chart");
  const [scale, setScale] = useState<Scale | null>(null); // null = follow the data
  const [groups, setGroups] = useState<Set<string>>(new Set(["lattice", "hash"]));
  const [hover, setHover] = useState<string | null>(null);

  // Mount-only URL adoption: this page is force-static, so search params are
  // empty during prerender. Reading them in render would change bar order and
  // colour between server and client HTML.
  useEffect(() => {
    const p = searchParams;
    const qOp = p.get("bop");
    if (qOp && ops.includes(qOp as Operation)) setOp(qOp as Operation);
    const qMetric = p.get("metric");
    if (qMetric && METRICS.some((m) => m.id === qMetric)) setMetricId(qMetric);
    const qView = p.get("view");
    if (qView === "chart" || qView === "table") setView(qView);
    const qScale = p.get("scale");
    if (qScale === "log" || qScale === "linear") setScale(qScale);
    const qFam = p.get("fam");
    if (qFam) {
      const wanted = new Set(qFam.split(",").filter((f) => f === "lattice" || f === "hash"));
      if (wanted.size > 0) setGroups(wanted);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function write(patch: Record<string, string | null>) {
    const next = new URLSearchParams(Array.from(searchParams.entries()));
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) next.delete(k);
      else next.set(k, v);
    }
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const { metric, points, omitted } = useMemo(
    () => buildBoard(algorithms, metricId, op, groups),
    [algorithms, metricId, op, groups],
  );

  const autoLog = suggestsLogScale(points);
  const useLog = scale === null ? autoLog : scale === "log";

  const max = points.length ? Math.max(...points.map((p) => p.value)) : 0;
  const min = points.length ? Math.min(...points.map((p) => p.value)) : 0;

  function width(v: number): number {
    if (points.length === 0 || max <= 0) return 0;
    if (!useLog) return Math.max(0.6, (v / max) * 100);
    // Floor the axis a decade below the smallest value so the shortest bar is
    // visible rather than vanishing at the origin.
    const lo = Math.log10(Math.max(min, 1e-6)) - 1;
    const hi = Math.log10(max);
    return Math.max(0.6, ((Math.log10(v) - lo) / (hi - lo)) * 100);
  }

  function toggleGroup(id: string) {
    const next = new Set(groups);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    if (next.size === 0) return; // never let the reader empty the chart
    setGroups(next);
    write({ fam: [...next].sort().join(",") });
  }

  const perOp = metric.perOperation;

  return (
    <div className="space-y-4">
      {/* Controls, one row above the chart. */}
      <div className="flex flex-wrap items-end gap-x-4 gap-y-3 border-b border-border pb-4">
        <Control label="Metric">
          <select
            className={selectClass}
            value={metricId}
            onChange={(e) => {
              setMetricId(e.target.value);
              setScale(null); // a new metric gets a fresh axis decision
              write({ metric: e.target.value, scale: null });
            }}
          >
            {METRICS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </Control>

        <Control label="Operation">
          <select
            className={selectClass}
            value={op}
            disabled={!perOp}
            title={perOp ? undefined : `${metric.label} is not per-operation`}
            onChange={(e) => {
              setOp(e.target.value as Operation);
              write({ bop: e.target.value });
            }}
          >
            {ops.map((o) => (
              <option key={o} value={o}>
                {OP_LABEL[o]}
              </option>
            ))}
          </select>
        </Control>

        <Control label="Family">
          <div className="flex h-8 items-center gap-1.5">
            {GROUPS.map((g) => {
              const on = groups.has(g.id);
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => toggleGroup(g.id)}
                  aria-pressed={on}
                  className={`flex h-8 items-center gap-1.5 rounded border px-2.5 text-[12px] font-semibold transition-colors ${
                    on
                      ? "border-border-strong bg-bg-inset text-fg"
                      : "border-border bg-bg-surface text-fg-subtle hover:text-fg-muted"
                  }`}
                >
                  <span
                    aria-hidden
                    className="h-2 w-2 rounded-[1px]"
                    style={{
                      background: on
                        ? `rgb(var(--color-series-${g.series}))`
                        : "rgb(var(--color-border-strong))",
                    }}
                  />
                  {g.label}
                </button>
              );
            })}
          </div>
        </Control>

        <Control label="Axis">
          <Toggle
            ariaLabel="Axis scale"
            value={useLog ? "log" : "linear"}
            options={[
              { id: "linear", label: "Linear" },
              { id: "log", label: "Log" },
            ]}
            onChange={(id) => {
              setScale(id as Scale);
              write({ scale: id });
            }}
          />
        </Control>

        <Control label="View">
          <Toggle
            ariaLabel="Chart or table"
            value={view}
            options={[
              { id: "chart", label: "Chart" },
              { id: "table", label: "Table" },
            ]}
            onChange={(id) => {
              setView(id as View);
              write({ view: id });
            }}
          />
        </Control>
      </div>

      {/* Legend — always present, so identity is never colour-alone. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {GROUPS.filter((g) => groups.has(g.id)).map((g) => (
          <span key={g.id} className="flex items-center gap-1.5 text-[11.5px] font-semibold text-fg-muted">
            <span
              aria-hidden
              className="h-2 w-2 rounded-[1px]"
              style={{ background: `rgb(var(--color-series-${g.series}))` }}
            />
            {g.label}
          </span>
        ))}
        <span className="ml-auto text-[11px] text-fg-subtle">
          {metric.label} · {metric.unit}
          {perOp ? ` · ${OP_LABEL[op].toLowerCase()}` : ""}
          {useLog ? " · log axis" : ""}
        </span>
      </div>

      {points.length === 0 ? (
        <p className="text-[13px] text-fg-subtle">
          No algorithm has a measured {metric.label.toLowerCase()} for this selection.
        </p>
      ) : view === "chart" ? (
        <div className="rounded border border-border bg-bg-surface px-4 py-4">
          {points.map((p) => {
            const isHover = hover === p.id;
            return (
              <div
                key={p.id}
                className="mb-2 grid grid-cols-[110px_1fr_92px] items-center gap-3 sm:grid-cols-[190px_1fr_104px]"
                onMouseEnter={() => setHover(p.id)}
                onMouseLeave={() => setHover(null)}
              >
                <div className="min-w-0">
                  <a
                    href={`/q-shield/${p.id}`}
                    className="block truncate text-[12.5px] font-bold text-fg transition-colors hover:text-accent"
                  >
                    {p.label}
                  </a>
                  <div className="truncate text-[10.5px] font-semibold text-fg-subtle">
                    {p.group === "hash" ? "Hash-based" : `Lattice · level ${p.nistLevel}`}
                  </div>
                </div>

                <a
                  href={githubChecksUrl(runSha)}
                  title={
                    p.stats
                      ? `${p.label} — ${p.display}\nmedian ${formatDuration(p.stats.median_us)} · p95 ${formatDuration(
                          p.stats.p95_us,
                        )} · p99 ${formatDuration(p.stats.p99_us)} · max ${formatDuration(p.stats.max_us)}\n${
                          p.stats.n_iterations
                        } iterations — click for the run`
                      : `${p.label} — ${p.display}\nclick for the run`
                  }
                  className="block h-5 overflow-hidden rounded-sm bg-bg-inset"
                >
                  <div
                    className="h-full rounded-sm transition-[width,opacity] duration-150"
                    style={{
                      width: `${width(p.value)}%`,
                      background: seriesColor(p.group),
                      opacity: hover && !isHover ? 0.45 : 1,
                    }}
                  />
                </a>

                <div className="num text-right text-[12.5px] font-bold text-fg">{p.display}</div>
              </div>
            );
          })}
        </div>
      ) : (
        <DataTable
          head={["Algorithm", metric.label, "Family", "NIST level"]}
          rows={points.map((p) => ({
            key: p.id,
            cells: [
              <RowName
                key="n"
                name={p.label}
                note={perOp ? OP_LABEL[op] : undefined}
                href={`/q-shield/${p.id}`}
              />,
              p.display,
              <Tag key="f">{p.group === "hash" ? "Hash" : "Lattice"}</Tag>,
              String(p.nistLevel),
            ],
          }))}
        />
      )}

      {omitted.length > 0 && (
        <p className="text-[11.5px] text-fg-subtle">
          Not plotted — no measured {metric.label.toLowerCase()}: {omitted.join(", ")}. Absent rather
          than drawn at zero.
        </p>
      )}
    </div>
  );
}
