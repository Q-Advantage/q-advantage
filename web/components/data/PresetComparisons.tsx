import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { getComparisonPresets } from "@/lib/data/presets";
import { getLatestRun } from "@/lib/data/load";
import { formatDuration } from "@/lib/format";
import type { Operation } from "@/lib/data/types";

interface PresetComparisonsProps {
  /** Section title shown above the grid */
  title?: string;
  /** Eyebrow text */
  eyebrow?: string;
  /** Optional subtitle prose */
  subtitle?: string;
  /** Show the "Open compare view" link in the header */
  showOpenLink?: boolean;
}

/**
 * Quick Comparison preset cards.
 *
 * Each card pairs a one-line takeaway with a tiny inline "ratio bar" — two
 * stacked horizontal bars showing log-scale relative speeds. Bars give the
 * visual anchor that text-only cards can't.
 *
 * Used in two places:
 *   - /q-shield (dashboard) with title "The takeaways from this week's data"
 *   - / (home) with title "Quick comparisons" — same data, mirrored
 */
export function PresetComparisons({
  title = "The takeaways from this week's data",
  eyebrow = "Quick comparisons",
  subtitle,
  showOpenLink = true,
}: PresetComparisonsProps) {
  const presets = getComparisonPresets();
  const run = getLatestRun();

  if (presets.length === 0) return null;

  return (
    <section className="space-y-4">
      <div className="flex items-baseline justify-between gap-4 flex-wrap">
        <div>
          <div className="eyebrow mb-1.5">{eyebrow}</div>
          <h2 className="text-xl font-semibold text-fg tracking-tight">{title}</h2>
          {subtitle && (
            <p className="text-sm text-fg-muted mt-1.5 max-w-xl leading-relaxed">
              {subtitle}
            </p>
          )}
        </div>
        {showOpenLink && (
          <Link
            href="/q-shield/compare"
            className="inline-flex items-center gap-1.5 text-xs text-fg-muted hover:text-fg transition-colors"
          >
            Open compare view
            <ArrowUpRight className="w-3 h-3" />
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {presets.map((p) => {
          const a = run.algorithms_by_id[p.algorithms[0]];
          const b = run.algorithms_by_id[p.algorithms[1]];
          const aVal = a?.operations[p.operation]?.mean_us ?? 0;
          const bVal = b?.operations[p.operation]?.mean_us ?? 0;
          return (
            <Link
              key={p.id}
              href={`/q-shield/compare?a=${p.algorithms[0]}&b=${p.algorithms[1]}&op=${p.operation}`}
              className="group block bg-bg-card border border-border rounded-xl p-5 hover:border-border-strong hover:-translate-y-0.5 transition-all"
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="font-mono text-[10px] uppercase tracking-eyebrow text-fg-subtle">
                  {p.eyebrow}
                </div>
                <ArrowUpRight className="w-3.5 h-3.5 text-fg-subtle group-hover:text-accent transition-colors flex-shrink-0" />
              </div>

              <div className="font-serif text-2xl font-normal text-fg leading-tight tracking-tight mb-3">
                {p.headline}
              </div>

              {/* Mini ratio bars */}
              {a && b && aVal > 0 && bVal > 0 && (
                <MiniBars
                  aLabel={a.display_name}
                  bLabel={b.display_name}
                  aValue={aVal}
                  bValue={bVal}
                  op={p.operation}
                />
              )}

              <div className="pt-3 mt-3 border-t border-border-subtle flex items-baseline justify-between gap-2">
                <span className="font-mono text-[10px] uppercase tracking-eyebrow text-fg-subtle">
                  {p.metricLabel}
                </span>
                <span className="font-mono text-2xl text-accent tabular-nums">
                  {p.metric}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

/**
 * Two stacked horizontal bars showing relative speed on log scale.
 * Log scale is essential because some pairs span 6 orders of magnitude
 * (ML-DSA-65 sign vs SLH-DSA-128s sign). The visual goal is "you can see
 * which is much faster," not "you can read precise values from the bar
 * length" — those numbers live in the card's headline ratio.
 */
function MiniBars({
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
  // Use log scale so the visual proportions are scannable. Faster
  // algorithm = shorter bar = green; slower = longer bar = dim.
  const logA = Math.log10(Math.max(aValue, 0.001));
  const logB = Math.log10(Math.max(bValue, 0.001));
  const maxLog = Math.max(logA, logB);
  const minLog = Math.min(logA, logB);
  // Normalize so the longer bar reaches ~95% and the shorter scales proportionally
  const aWidth = Math.max(8, ((logA - minLog + 1) / (maxLog - minLog + 1)) * 95);
  const bWidth = Math.max(8, ((logB - minLog + 1) / (maxLog - minLog + 1)) * 95);
  const aFaster = aValue < bValue;

  return (
    <div className="space-y-2 mb-1">
      <BarRow
        label={aLabel}
        value={formatDuration(aValue)}
        widthPct={aWidth}
        accent={aFaster}
        op={op}
      />
      <BarRow
        label={bLabel}
        value={formatDuration(bValue)}
        widthPct={bWidth}
        accent={!aFaster}
        op={op}
      />
    </div>
  );
}

function BarRow({
  label,
  value,
  widthPct,
  accent,
  op,
}: {
  label: string;
  value: string;
  widthPct: number;
  accent: boolean;
  op: Operation;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-[10px] font-mono mb-1">
        <span className="text-fg-muted truncate pr-2">
          {label}
          <span className="text-fg-subtle ml-1.5 uppercase">· {op}</span>
        </span>
        <span className={accent ? "text-accent" : "text-fg-subtle"}>{value}</span>
      </div>
      <div className="h-1.5 bg-bg-inset rounded-full overflow-hidden">
        <div
          className={accent ? "h-full bg-accent" : "h-full bg-fg-subtle/40"}
          style={{ width: `${widthPct}%` }}
        />
      </div>
    </div>
  );
}
