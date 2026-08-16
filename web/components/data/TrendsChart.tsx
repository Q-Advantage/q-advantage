"use client";
// web/components/data/TrendsChart.tsx
//
// Measured values over time, one line per algorithm.
//
// Form: a line chart, because the job is change over an ordered time axis.
// Colour encodes algorithm identity (categorical), assigned in fixed order
// from the validated series tokens and capped at MAX_SERIES so a hue is never
// cycled or generated. A legend is always present and every line is directly
// labelled at its right end, so identity never rests on colour alone.
//
// The property that matters most here: `connectNulls={false}`. A missing run
// leaves a visible break in the line. Bridging it would draw a segment through
// values we never measured — the exact thing this product does not do.

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { NormalizedAlgorithm, Operation } from "@/lib/data/types";
import { METRICS, availableOperations, getMetric } from "@/lib/data/board-metrics";
import { MAX_SERIES, RANGES, spreadPct, type TrendsResult } from "@/lib/data/trends-shared";
import { DataTable, RowName, Tag } from "@/components/product/kit";

/** Fixed hue order. Validated as a set; never cycled past MAX_SERIES. */
const SERIES_SLOTS = [1, 2, 4, 5];

function slotColor(i: number): string {
  return `rgb(var(--color-series-${SERIES_SLOTS[i % SERIES_SLOTS.length]}))`;
}

const OP_LABEL: Record<string, string> = {
  keygen: "Keygen",
  sign: "Sign",
  verify: "Verify",
  encap: "Encapsulate",
  decap: "Decapsulate",
};

const selectClass =
  "h-8 rounded border border-border bg-bg-surface px-2 text-[12.5px] font-semibold text-fg transition-colors hover:border-border-strong focus:outline-none focus:ring-1 focus:ring-accent";

function Control({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-bold uppercase tracking-eyebrow text-fg-subtle">{label}</span>
      {children}
    </label>
  );
}

interface ChartRow {
  date: string;
  [seriesId: string]: string | number | null;
}

export function TrendsChart({
  algorithms,
  initial,
  initialSelection,
}: {
  algorithms: NormalizedAlgorithm[];
  /** Server-computed for the default view, so first paint has real data. */
  initial: TrendsResult;
  initialSelection: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const ops = useMemo(() => availableOperations(algorithms), [algorithms]);

  const [metricId, setMetricId] = useState("mean");
  const [op, setOp] = useState<Operation>(ops[0] ?? "keygen");
  const [range, setRange] = useState<string>("all");
  const [selected, setSelected] = useState<string[]>(initialSelection);
  const [logScale, setLogScale] = useState(false);
  const [view, setView] = useState<"chart" | "table">("chart");
  const [data, setData] = useState<TrendsResult>(initial);
  const [loading, setLoading] = useState(false);

  // Mount-only URL adoption — this page is force-static, so reading search
  // params during render would change the chart between server and client.
  useEffect(() => {
    const p = searchParams;
    const m = p.get("metric");
    if (m && METRICS.some((x) => x.id === m)) setMetricId(m);
    const o = p.get("op");
    if (o && ops.includes(o as Operation)) setOp(o as Operation);
    const r = p.get("range");
    if (r && RANGES.some((x) => x.id === r)) setRange(r);
    const v = p.get("view");
    if (v === "chart" || v === "table") setView(v);
    if (p.get("scale") === "log") setLogScale(true);
    const sel = p.get("algos");
    if (sel) {
      const ids = sel.split(",").filter((id) => algorithms.some((a) => a.id === id));
      if (ids.length) setSelected(ids.slice(0, MAX_SERIES));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refetch from the public API whenever the query changes. Same endpoint any
  // reader can call — the page is not privileged over its own API.
  useEffect(() => {
    let cancelled = false;
    const isDefault =
      metricId === "mean" &&
      op === (ops[0] ?? "keygen") &&
      range === "all" &&
      selected.join(",") === initialSelection.join(",");
    if (isDefault) {
      setData(initial);
      return;
    }

    setLoading(true);
    (async () => {
      const metric = getMetric(metricId);
      const series = await Promise.all(
        selected.map(async (id) => {
          const res = await fetch(`/api/v1/algorithms/${id}/history`);
          if (!res.ok) return null;
          const json = await res.json();
          const raw: Record<string, unknown>[] = json.series?.[op] ?? [];
          const algo = algorithms.find((a) => a.id === id);
          const points = raw
            .map((r) => {
              const v = pickMetric(r, metricId);
              return v == null || !Number.isFinite(v) || v <= 0
                ? null
                : {
                    date: String(r.date),
                    commit: String(r.commit),
                    run_url: String(r.run_url),
                    value: v,
                  };
            })
            .filter(Boolean) as TrendsResult["series"][number]["points"];
          const values = points.map((p) => p.value);
          return {
            id,
            label: algo?.display_name ?? id,
            family: algo?.family ?? "ML-KEM",
            points,
            gaps: raw.length - points.length,
            min: values.length ? Math.min(...values) : 0,
            max: values.length ? Math.max(...values) : 0,
          };
        }),
      );

      if (cancelled) return;
      const live = series.filter(Boolean) as TrendsResult["series"];
      const days = RANGES.find((r) => r.id === range)?.days ?? null;
      const trimmed = live.map((s) => ({
        ...s,
        points: days == null ? s.points : s.points.slice(Math.max(0, s.points.length - days)),
      }));
      const dates = [...new Set(trimmed.flatMap((s) => s.points.map((p) => p.date)))].sort();
      setData({
        series: trimmed,
        metricLabel: metric.label,
        unit: metric.unit,
        dates,
        runsInRange: dates.length,
        empty: [],
      });
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metricId, op, range, selected]);

  function write(patch: Record<string, string | null>) {
    const next = new URLSearchParams(Array.from(searchParams.entries()));
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) next.delete(k);
      else next.set(k, v);
    }
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  function toggleAlgo(id: string) {
    let next: string[];
    if (selected.includes(id)) {
      if (selected.length === 1) return; // never empty the chart
      next = selected.filter((x) => x !== id);
    } else {
      if (selected.length >= MAX_SERIES) return; // never cycle hues
      next = [...selected, id];
    }
    setSelected(next);
    write({ algos: next.join(",") });
  }

  // One row per date; a series with no point that day contributes null, and
  // Recharts leaves the line broken there.
  const rows: ChartRow[] = data.dates.map((date) => {
    const row: ChartRow = { date };
    for (const s of data.series) {
      row[s.id] = s.points.find((p) => p.date === date)?.value ?? null;
    }
    return row;
  });

  const atCap = selected.length >= MAX_SERIES;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-x-4 gap-y-3 border-b border-border pb-4">
        <Control label="Metric">
          <select
            className={selectClass}
            value={metricId}
            onChange={(e) => {
              setMetricId(e.target.value);
              write({ metric: e.target.value });
            }}
          >
            {METRICS.filter((m) => m.perOperation).map((m) => (
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
            onChange={(e) => {
              setOp(e.target.value as Operation);
              write({ op: e.target.value });
            }}
          >
            {ops.map((o) => (
              <option key={o} value={o}>
                {OP_LABEL[o] ?? o}
              </option>
            ))}
          </select>
        </Control>

        <Control label="Range">
          <select
            className={selectClass}
            value={range}
            onChange={(e) => {
              setRange(e.target.value);
              write({ range: e.target.value });
            }}
          >
            {RANGES.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </Control>

        <Control label="Axis">
          <div className="flex h-8 overflow-hidden rounded border border-border">
            {[
              { id: "linear", label: "Linear" },
              { id: "log", label: "Log" },
            ].map((o) => (
              <button
                key={o.id}
                type="button"
                aria-pressed={logScale === (o.id === "log")}
                onClick={() => {
                  setLogScale(o.id === "log");
                  write({ scale: o.id === "log" ? "log" : null });
                }}
                className={`px-2.5 text-[12px] font-semibold transition-colors ${
                  logScale === (o.id === "log")
                    ? "bg-bg-inset text-fg"
                    : "bg-bg-surface text-fg-muted hover:text-fg"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </Control>

        <Control label="View">
          <div className="flex h-8 overflow-hidden rounded border border-border">
            {[
              { id: "chart", label: "Chart" },
              { id: "table", label: "Table" },
            ].map((o) => (
              <button
                key={o.id}
                type="button"
                aria-pressed={view === o.id}
                onClick={() => {
                  setView(o.id as "chart" | "table");
                  write({ view: o.id });
                }}
                className={`px-2.5 text-[12px] font-semibold transition-colors ${
                  view === o.id ? "bg-bg-inset text-fg" : "bg-bg-surface text-fg-muted hover:text-fg"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </Control>
      </div>

      {/* Algorithm picker doubles as the legend. */}
      <div className="flex flex-wrap items-center gap-1.5">
        {algorithms
          .filter((a) => a.status === "ok")
          .map((a) => {
            const idx = data.series.findIndex((s) => s.id === a.id);
            const on = selected.includes(a.id);
            const disabled = !on && atCap;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => toggleAlgo(a.id)}
                aria-pressed={on}
                disabled={disabled}
                title={disabled ? `Showing the maximum of ${MAX_SERIES} series` : undefined}
                className={`flex h-7 items-center gap-1.5 rounded border px-2 text-[11.5px] font-semibold transition-colors ${
                  on
                    ? "border-border-strong bg-bg-inset text-fg"
                    : disabled
                      ? "cursor-not-allowed border-border bg-bg-surface text-fg-subtle/50"
                      : "border-border bg-bg-surface text-fg-subtle hover:text-fg-muted"
                }`}
              >
                <span
                  aria-hidden
                  className="h-2 w-2 rounded-[1px]"
                  style={{
                    background: on && idx >= 0 ? slotColor(idx) : "rgb(var(--color-border-strong))",
                  }}
                />
                {a.display_name}
              </button>
            );
          })}
        <span className="ml-auto text-[11px] text-fg-subtle">
          {data.metricLabel} · {data.unit} · {OP_LABEL[op]?.toLowerCase() ?? op} ·{" "}
          {data.runsInRange} runs{loading ? " · updating…" : ""}
        </span>
      </div>

      {view === "chart" ? (
        <div className="rounded border border-border bg-bg-surface px-3 py-4">
          <ResponsiveContainer width="100%" height={340}>
            <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 4, left: 4 }}>
              <CartesianGrid stroke="rgb(var(--color-border-subtle))" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: "rgb(var(--color-fg-subtle))" }}
                tickLine={false}
                axisLine={{ stroke: "rgb(var(--color-border))" }}
                minTickGap={40}
              />
              <YAxis
                scale={logScale ? "log" : "linear"}
                domain={logScale ? ["auto", "auto"] : [0, "auto"]}
                allowDataOverflow={false}
                tick={{ fontSize: 11, fill: "rgb(var(--color-fg-subtle))" }}
                tickLine={false}
                axisLine={false}
                width={64}
              />
              <Tooltip
                contentStyle={{
                  background: "rgb(var(--color-bg-surface))",
                  border: "1px solid rgb(var(--color-border-strong))",
                  borderRadius: 4,
                  fontSize: 12,
                }}
                labelStyle={{ color: "rgb(var(--color-fg))", fontWeight: 700 }}
                formatter={(value: number, name: string) => {
                  const s = data.series.find((x) => x.id === name);
                  return [getMetric(metricId).format(value), s?.label ?? name];
                }}
              />
              {data.series.map((s, i) => (
                <Line
                  key={s.id}
                  type="monotone"
                  dataKey={s.id}
                  stroke={slotColor(i)}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                  // A missing run is a hole, not a bridge. Never true.
                  connectNulls={false}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>

          <p className="mt-3 text-[11px] leading-relaxed text-fg-subtle">
            Measured points only. A break in a line is a run with no measurement — it is not
            smoothed over, and there is no value between two runs.
          </p>
        </div>
      ) : (
        <DataTable
          head={["Algorithm", "First", "Latest", "Change", "Observed range", "Points", "Gaps"]}
          rows={data.series.map((s) => {
            const first = s.points[0];
            const last = s.points[s.points.length - 1];
            const change =
              s.points.length >= 2 && first.value > 0
                ? ((last.value - first.value) / first.value) * 100
                : null;
            const fmt = getMetric(metricId).format;
            return {
              key: s.id,
              cells: [
                <RowName key="n" name={s.label} note={s.family} href={`/q-shield/${s.id}`} />,
                `${fmt(first.value)} · ${first.date}`,
                `${fmt(last.value)} · ${last.date}`,
                change == null ? "—" : `${change > 0 ? "+" : ""}${change.toFixed(1)}%`,
                `${fmt(s.min)} – ${fmt(s.max)}`,
                String(s.points.length),
                s.gaps > 0 ? <Tag key="g">{s.gaps}</Tag> : "0",
              ],
            };
          })}
        />
      )}

      {data.empty.length > 0 && (
        <p className="text-[11.5px] text-fg-subtle">
          No measurements in range: {data.empty.join(", ")}.
        </p>
      )}
    </div>
  );
}

/** Pull one metric off an API history row. Mirrors board-metrics field names. */
function pickMetric(row: Record<string, unknown>, metricId: string): number | null {
  const num = (k: string) => (typeof row[k] === "number" ? (row[k] as number) : null);
  switch (metricId) {
    case "mean":
      return num("mean_us");
    case "median":
      return num("median_us");
    case "p95":
      return num("p95_us");
    case "p99":
      return num("p99_us");
    case "max":
      return num("max_us");
    case "ops":
      return num("ops_per_sec");
    case "tail": {
      const max = num("max_us");
      const med = num("median_us");
      return max != null && med != null && med > 0 ? max / med : null;
    }
    default:
      return num("mean_us");
  }
}
