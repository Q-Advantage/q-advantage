"use client";

import { useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  NormalizedAlgorithm,
  Operation,
  AlgorithmKind,
} from "@/lib/data/types";
import {
  formatBytes,
  formatDuration,
  formatOpsPerSec,
} from "@/lib/format";
import { CHART, seriesColor } from "@/lib/chart-theme";

interface CompareViewProps {
  algorithms: NormalizedAlgorithm[];
}

/**
 * Side-by-side comparison of two algorithms on one operation.
 *
 * URL state: ?a=<id>&b=<id>&op=<operation>. Selecting from the dropdowns
 * updates the URL via router.replace so the comparison is shareable.
 *
 * Constraint: the operation has to be valid for both algorithms. KEMs and
 * signatures don't share operation names beyond "keygen", so picking a
 * KEM and a signature defaults the operation to "keygen". Cross-kind
 * comparisons are allowed (sometimes useful) but the operation menu is
 * intersected to what both support.
 */
export function CompareView({ algorithms }: CompareViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Read selected algorithms from URL, with sensible defaults.
  const aId = searchParams.get("a") || "ml-dsa-65";
  const bId = searchParams.get("b") || "slh-dsa-shake-128s";
  const requestedOp = searchParams.get("op") as Operation | null;

  const algA = algorithms.find((x) => x.id === aId) ?? algorithms[0];
  const algB =
    algorithms.find((x) => x.id === bId && x.id !== algA.id) ??
    algorithms.find((x) => x.id !== algA.id) ??
    algorithms[1];

  // Determine the set of operations both algorithms support
  const sharedOps: Operation[] = useMemo(() => {
    const kemOps: Operation[] = ["keygen", "encap", "decap"];
    const sigOps: Operation[] = ["keygen", "sign", "verify"];
    const aOps = algA.kind === "kem" ? kemOps : sigOps;
    const bOps = algB.kind === "kem" ? kemOps : sigOps;
    return aOps.filter((o) => bOps.includes(o));
  }, [algA, algB]);

  const op: Operation =
    requestedOp && sharedOps.includes(requestedOp) ? requestedOp : sharedOps[0];

  const updateUrl = useCallback(
    (next: { a?: string; b?: string; op?: Operation }) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next.a) params.set("a", next.a);
      if (next.b) params.set("b", next.b);
      if (next.op) params.set("op", next.op);
      router.replace(`/q-shield/compare?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  const statsA = algA.operations[op];
  const statsB = algB.operations[op];

  const chartData = useMemo(() => {
    if (!statsA || !statsB) return [];
    return [
      {
        label: "Mean",
        [algA.display_name]: statsA.mean_us,
        [algB.display_name]: statsB.mean_us,
      },
      {
        label: "p95",
        [algA.display_name]: statsA.p95_us,
        [algB.display_name]: statsB.p95_us,
      },
      {
        label: "p99",
        [algA.display_name]: statsA.p99_us,
        [algB.display_name]: statsB.p99_us,
      },
    ];
  }, [statsA, statsB, algA.display_name, algB.display_name]);

  const useLogScale =
    statsA && statsB
      ? Math.max(statsA.mean_us, statsB.mean_us) /
          Math.max(1, Math.min(statsA.mean_us, statsB.mean_us)) >
        100
      : false;

  return (
    <div className="space-y-8">
      {/* Pickers */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
        <PickerField label="Algorithm A">
          <Select value={algA.id} onValueChange={(v) => updateUrl({ a: v })}>
            <SelectTrigger>
              <SelectValue placeholder="Pick an algorithm" />
            </SelectTrigger>
            <SelectContent>
              {groupByFamily(algorithms).map(([family, items]) => (
                <SelectGroup key={family} family={family} items={items} />
              ))}
            </SelectContent>
          </Select>
        </PickerField>

        <PickerField label="Algorithm B">
          <Select value={algB.id} onValueChange={(v) => updateUrl({ b: v })}>
            <SelectTrigger>
              <SelectValue placeholder="Pick an algorithm" />
            </SelectTrigger>
            <SelectContent>
              {groupByFamily(algorithms).map(([family, items]) => (
                <SelectGroup key={family} family={family} items={items} />
              ))}
            </SelectContent>
          </Select>
        </PickerField>

        <PickerField label="Operation">
          <Select value={op} onValueChange={(v) => updateUrl({ op: v as Operation })}>
            <SelectTrigger>
              <SelectValue placeholder="Pick an operation" />
            </SelectTrigger>
            <SelectContent>
              {sharedOps.map((o) => (
                <SelectItem key={o} value={o}>
                  <span className="font-mono uppercase text-xs">{o}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </PickerField>
      </div>

      {/* Technical context strip — security level + comparison kind hint */}
      <ComparisonContext algA={algA} algB={algB} />

      {/* Headline metric */}
      {statsA && statsB && (
        <HeadlineMetric
          aLabel={algA.display_name}
          bLabel={algB.display_name}
          aValue={statsA.mean_us}
          bValue={statsB.mean_us}
          op={op}
        />
      )}

      {/* Side-by-side bar chart */}
      {statsA && statsB && (
        <section className="border border-border rounded-md bg-bg-surface p-4 md:p-6">
          <div className="flex items-baseline justify-between gap-4 flex-wrap mb-4">
            <div>
              <div className="eyebrow mb-1">Latency profile</div>
              <h3 className="text-sm font-semibold text-fg">
                {op} mean / p95 / p99 (µs)
              </h3>
            </div>
            {useLogScale && (
              <span className="font-mono text-2xs text-fg-subtle uppercase tracking-eyebrow">
                Log scale — values span &gt;100×
              </span>
            )}
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} margin={{ top: 10, right: 12, left: 8, bottom: 4 }}>
              <CartesianGrid stroke={CHART.grid} strokeDasharray="2 4" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: CHART.tick, fontSize: 11, fontFamily: CHART.font }}
                stroke={CHART.axis}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(v) => formatDuration(Number(v))}
                tick={{ fill: CHART.tick, fontSize: 10, fontFamily: CHART.font }}
                stroke={CHART.axis}
                axisLine={false}
                tickLine={false}
                scale={useLogScale ? "log" : "auto"}
                domain={useLogScale ? ["auto", "auto"] : [0, "auto"]}
                allowDataOverflow={false}
                width={70}
              />
              <Tooltip
                cursor={{ fill: CHART.cursor }}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  return (
                    <div className="bg-bg-elevated border border-border-strong rounded-md px-3 py-2 text-xs shadow-md">
                      <div className="font-mono text-fg-subtle mb-1">{label}</div>
                      {payload.map((entry) => (
                        <div key={String(entry.dataKey)} className="flex items-center gap-2 font-mono">
                          <span
                            className="w-2 h-2 rounded-sm"
                            style={{ background: entry.color }}
                          />
                          <span className="text-fg-muted">{entry.dataKey}</span>
                          <span className="text-fg ml-auto">{formatDuration(Number(entry.value))}</span>
                        </div>
                      ))}
                    </div>
                  );
                }}
              />
              <Bar dataKey={algA.display_name} fill={seriesColor(0)} radius={[3, 3, 0, 0]} />
              <Bar dataKey={algB.display_name} fill={seriesColor(1)} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-5 mt-3 text-xs">
            <LegendDot color={seriesColor(0)} label={algA.display_name} />
            <LegendDot color={seriesColor(1)} label={algB.display_name} />
          </div>
        </section>
      )}

      {/* Key metrics table */}
      {statsA && statsB && (
        <CompareKeyMetrics algA={algA} algB={algB} op={op} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function PickerField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="eyebrow mb-2">{label}</div>
      {children}
    </div>
  );
}

function groupByFamily(
  algorithms: NormalizedAlgorithm[],
): [string, NormalizedAlgorithm[]][] {
  const groups: Record<string, NormalizedAlgorithm[]> = {};
  for (const a of algorithms) {
    if (!groups[a.family]) groups[a.family] = [];
    groups[a.family].push(a);
  }
  return Object.entries(groups);
}

function SelectGroup({
  family,
  items,
}: {
  family: string;
  items: NormalizedAlgorithm[];
}) {
  return (
    <>
      <div className="px-2 py-1.5 font-mono text-[10px] uppercase tracking-eyebrow text-fg-subtle">
        {family}
      </div>
      {items.map((a) => (
        <SelectItem key={a.id} value={a.id}>
          {a.display_name}
        </SelectItem>
      ))}
    </>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-fg-muted">
      <span className="inline-block w-2 h-2 rounded-sm" style={{ background: color }} />
      {label}
    </span>
  );
}

function HeadlineMetric({
  aLabel,
  bLabel,
  aValue,
  bValue,
  op,
}: {
  aLabel: string;
  bLabel: string;
  aValue: number;
  bValue: number;
  op: Operation;
}) {
  const faster = aValue < bValue ? aLabel : bLabel;
  const slower = aValue < bValue ? bLabel : aLabel;
  const ratio = Math.max(aValue, bValue) / Math.min(aValue, bValue);
  return (
    <section className="border border-border rounded-md bg-bg-surface p-4 md:p-6">
      <div className="eyebrow mb-2">Headline · {op} mean</div>
      <p className="font-serif text-2xl md:text-3xl text-fg leading-snug tracking-tight">
        <span className="text-accent">{faster}</span> is{" "}
        <span className="font-mono text-accent tabular-nums">{formatRatio(ratio)}</span> faster
        than <span className="text-fg-muted">{slower}</span> on {op}.
      </p>
    </section>
  );
}

function formatRatio(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k×`;
  if (n >= 100) return `${Math.round(n)}×`;
  if (n >= 10) return `${n.toFixed(1)}×`;
  return `${n.toFixed(2)}×`;
}

function CompareKeyMetrics({
  algA,
  algB,
  op,
}: {
  algA: NormalizedAlgorithm;
  algB: NormalizedAlgorithm;
  op: Operation;
}) {
  const statsA = algA.operations[op]!;
  const statsB = algB.operations[op]!;
  const rows: { label: string; aVal: string; bVal: string }[] = [
    { label: "Mean", aVal: formatDuration(statsA.mean_us), bVal: formatDuration(statsB.mean_us) },
    { label: "Median", aVal: formatDuration(statsA.median_us), bVal: formatDuration(statsB.median_us) },
    { label: "p95", aVal: formatDuration(statsA.p95_us), bVal: formatDuration(statsB.p95_us) },
    { label: "p99", aVal: formatDuration(statsA.p99_us), bVal: formatDuration(statsB.p99_us) },
    { label: "Stdev", aVal: formatDuration(statsA.stdev_us), bVal: formatDuration(statsB.stdev_us) },
    { label: "Ops / sec", aVal: formatOpsPerSec(statsA.ops_per_sec), bVal: formatOpsPerSec(statsB.ops_per_sec) },
    {
      label: "Public key",
      aVal: formatBytes(algA.pubkey_bytes),
      bVal: formatBytes(algB.pubkey_bytes),
    },
    {
      label: algA.kind === algB.kind ? (algA.kind === "kem" ? "Ciphertext" : "Signature") : "Output",
      aVal: formatBytes(algA.ciphertext_bytes ?? algA.signature_bytes ?? 0),
      bVal: formatBytes(algB.ciphertext_bytes ?? algB.signature_bytes ?? 0),
    },
  ];

  return (
    <section className="border border-border rounded-md bg-bg-surface overflow-hidden">
      <header className="px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold text-fg">Full statistics</h3>
      </header>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border-subtle text-left">
            <th className="px-4 py-2.5 eyebrow font-medium w-1/3">Metric</th>
            <th className="px-4 py-2.5 eyebrow font-medium text-right">
              <span style={{ color: seriesColor(0) }}>{algA.display_name}</span>
            </th>
            <th className="px-4 py-2.5 eyebrow font-medium text-right">
              <span style={{ color: seriesColor(1) }}>{algB.display_name}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr
              key={row.label}
              className={idx < rows.length - 1 ? "border-b border-border-subtle/40" : ""}
            >
              <td className="px-4 py-2.5 text-fg-muted">{row.label}</td>
              <td className="px-4 py-2.5 text-right font-mono tabular-nums text-fg">{row.aVal}</td>
              <td className="px-4 py-2.5 text-right font-mono tabular-nums text-fg">{row.bVal}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

// Mark unused type imports as used (placate strict typescript)
type _Unused = AlgorithmKind;

/**
 * Inline technical context: shows family + NIST security level of both
 * algorithms, plus a one-line note about whether the comparison is
 * apples-to-apples (same kind, same level) or whether the reader should
 * mentally adjust for a security-level or kind mismatch.
 *
 * Goal: make every comparison technically defensible so a sophisticated
 * reader doesn't get blindsided by "ML-KEM-512 is 1.6× faster than
 * ML-KEM-1024" without context for what that ratio means.
 */
function ComparisonContext({
  algA,
  algB,
}: {
  algA: NormalizedAlgorithm;
  algB: NormalizedAlgorithm;
}) {
  const sameLevel = algA.nist_level === algB.nist_level;
  const sameKind = algA.kind === algB.kind;
  const sameFamily = algA.family === algB.family;

  let note: string;
  if (sameLevel && sameFamily) {
    note = "Same family, same NIST security level. Direct apples-to-apples.";
  } else if (sameLevel && sameKind) {
    note = `Different families (${algA.family} vs ${algB.family}) at the same NIST level — the cleanest cross-family comparison.`;
  } else if (sameLevel && !sameKind) {
    note = "Different cryptographic kinds (KEM vs signature). Compare only on shared operations like keygen.";
  } else if (!sameLevel && sameFamily) {
    note = `Different NIST levels within ${algA.family}. The faster one targets a weaker security category — that's the trade-off, not a flaw.`;
  } else {
    note = "Different families AND different NIST levels. Useful for raw performance intuition, but adjust mentally for the security delta.";
  }

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 px-4 py-3 border border-border-subtle rounded-md bg-bg-inset">
      <div className="flex items-center gap-3 md:gap-5 flex-wrap text-xs">
        <AlgoTag algo={algA} color={seriesColor(0)} />
        <span className="text-fg-faint">vs</span>
        <AlgoTag algo={algB} color={seriesColor(1)} />
      </div>
      <p className="text-2xs text-fg-muted md:max-w-md md:text-right leading-relaxed">
        {note}
      </p>
    </div>
  );
}

function AlgoTag({ algo, color }: { algo: NormalizedAlgorithm; color: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 font-mono">
      <span className="inline-block w-2 h-2 rounded-sm" style={{ background: color }} />
      <span className="text-fg">{algo.display_name}</span>
      <span className="text-fg-subtle">
        · NIST L{algo.nist_level}
        <span className="text-fg-faint ml-1">·</span>
        <span className="ml-1">{algo.kind === "kem" ? "KEM" : "Signature"}</span>
      </span>
    </span>
  );
}

