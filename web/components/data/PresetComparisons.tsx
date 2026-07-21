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
  /** Render as four large cards, two per row, instead of the compact 4-up grid */
  large?: boolean;
}

/**
 * Quick Comparison preset cards.
 *
 * Each card pairs a takeaway with two stacked log-scale bars comparing the
 * two algorithms on one operation. The faster algorithm's bar is green, the
 * slower is grey — a "green = faster" legend in the section header makes
 * that mapping explicit (an earlier version dropped the bars because the
 * color meaning wasn't obvious; the legend solves that).
 *
 * Log scale is essential: some pairs span 6 orders of magnitude (ML-DSA-65
 * sign at ~149µs vs SLH-DSA-128s sign at ~1.29s), so a linear bar would
 * render the faster one as a single pixel.
 *
 * Used on both /q-shield and the home page.
 */
export function PresetComparisons({
  title = "The takeaways from this week's data",
  eyebrow = "Quick comparisons",
  subtitle,
  showOpenLink = true,
  large = false,
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
        <div className="flex flex-col items-end gap-2">
          {showOpenLink && (
            <Link
              href="/q-shield/compare"
              className="inline-flex items-center gap-1.5 text-xs text-fg-muted hover:text-fg transition-colors"
            >
              Open compare view
              <ArrowUpRight className="w-3 h-3" />
            </Link>
          )}
          {/* Legend — makes the green/grey bar meaning explicit */}
          <div className="flex items-center gap-3 text-2xs font-mono text-fg-subtle">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block w-3 h-1.5 rounded-full bg-accent" />
              faster
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block w-3 h-1.5 rounded-full bg-fg-subtle/40" />
              slower
            </span>
          </div>
        </div>
      </div>

      <div
        className={
          large
            ? "grid grid-cols-1 sm:grid-cols-2 gap-5"
            : "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3"
        }
      >
        {presets.map((p) => {
          const a = run.algorithms_by_id[p.algorithms[0]];
          const b = run.algorithms_by_id[p.algorithms[1]];
          const aVal = a?.operations[p.operation]?.mean_us ?? 0;
          const bVal = b?.operations[p.operation]?.mean_us ?? 0;
          return (
            <Link
              key={p.id}
              href={`/q-shield/compare?a=${p.algorithms[0]}&b=${p.algorithms[1]}&op=${p.operation}`}
              className={
                large
                  ? "group block bg-bg-card border border-border rounded-xl p-7 md:p-8 hover:border-border-strong hover:-translate-y-0.5 transition-all"
                  : "group block bg-bg-card border border-border rounded-xl p-5 hover:border-border-strong hover:-translate-y-0.5 transition-all"
              }
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="font-mono text-[10px] uppercase tracking-eyebrow text-fg-subtle">
                  {p.eyebrow}
                </div>
                <ArrowUpRight className="w-3.5 h-3.5 text-fg-subtle group-hover:text-accent transition-colors flex-shrink-0" />
              </div>

              <div
                className={
                  large
                    ? "font-serif text-3xl md:text-4xl font-normal text-fg leading-tight tracking-tight mb-4"
                    : "font-serif text-2xl font-normal text-fg leading-tight tracking-tight mb-3"
                }
              >
                {p.headline}
              </div>

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
                <span
                  className={
                    large
                      ? "font-mono text-3xl text-accent tabular-nums"
                      : "font-mono text-2xl text-accent tabular-nums"
                  }
                >
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
 * Two stacked horizontal bars on log scale. Faster = green, slower = grey.
 * Bar length encodes relative magnitude (log-scaled so wide-range pairs
 * stay scannable). The legend in the section header explains the colors.
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
  const logA = Math.log10(Math.max(aValue, 0.001));
  const logB = Math.log10(Math.max(bValue, 0.001));
  const maxLog = Math.max(logA, logB);
  const minLog = Math.min(logA, logB);
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
