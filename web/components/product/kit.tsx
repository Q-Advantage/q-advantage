import type { ReactNode } from "react";

/**
 * The product design kit.
 *
 * Every instrument — Q-Shield today, P-CBOM and the cost calculator next —
 * builds its page out of these pieces. That is the point: the treatment lives
 * in one file, so a new product inherits the design by importing it rather
 * than by someone re-implementing the look and drifting from it.
 *
 * Register is treatment C from ADR 0005: dense, shared edges, tight radii,
 * data-first. Deliberately different from the company site's editorial panels.
 */

/* ------------------------------------------------------------------ header */

export function Section({
  eyebrow,
  title,
  hint,
  children,
}: {
  eyebrow: string;
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="eyebrow">{eyebrow}</div>
          <h2 className="mt-1 text-balance text-[17px] font-bold tracking-[-0.02em] text-fg">
            {title}
          </h2>
        </div>
        {hint && <p className="max-w-[44ch] text-[12px] text-fg-muted">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

/* -------------------------------------------------------------- audit band */

export function AuditBand({ cells }: { cells: { k: string; v: string; tone?: "warn" | "link" }[] }) {
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded border border-border bg-border sm:grid-cols-3 lg:grid-cols-6">
      {cells.map((c) => (
        <div key={c.k} className="min-w-0 bg-bg-surface px-3.5 py-2.5">
          <div className="eyebrow">{c.k}</div>
          <div
            className={`num mt-1 truncate text-[13px] font-bold ${
              c.tone === "warn" ? "text-status-warn" : c.tone === "link" ? "text-link" : "text-fg"
            }`}
          >
            {c.v}
          </div>
        </div>
      ))}
    </div>
  );
}

/* --------------------------------------------------------------- log chart */

export interface LogBar {
  label: string;
  sublabel?: string;
  /** Value in the axis's base unit. */
  value: number;
  display: string;
  /** Series index — colours come from the shared chart tokens. */
  series: 0 | 1;
}

/**
 * Horizontal bars on a logarithmic axis.
 *
 * Log scale is not a styling choice here: the values it plots span four orders
 * of magnitude, and on a linear axis every bar but the largest collapses to
 * nothing. The axis is labelled so nobody mistakes it for linear.
 */
export function LogBars({
  bars,
  minExp,
  maxExp,
  ticks,
  legend,
}: {
  bars: LogBar[];
  /** Axis floor as a power of ten, in the same unit as `value`. */
  minExp: number;
  maxExp: number;
  ticks: { at: number; label: string }[];
  legend: [string, string];
}) {
  const span = maxExp - minExp;
  const pct = (v: number) => Math.max(0, Math.min(100, ((Math.log10(v) - minExp) / span) * 100));

  return (
    <div className="rounded border border-border bg-bg-surface px-4 py-4">
      {bars.map((b) => (
        <div
          key={b.label}
          className="mb-2 grid grid-cols-[110px_1fr_78px] items-center gap-3 sm:grid-cols-[180px_1fr_92px]"
        >
          <div className="min-w-0">
            <div className="truncate text-[12.5px] font-bold text-fg">{b.label}</div>
            {b.sublabel && (
              <div className="truncate text-[10.5px] font-semibold text-fg-subtle">{b.sublabel}</div>
            )}
          </div>
          <div className="h-5 overflow-hidden rounded-sm bg-bg-inset">
            <div
              className="h-full rounded-sm"
              style={{
                width: `${pct(b.value)}%`,
                background: `rgb(var(--color-series-${b.series + 1}))`,
              }}
            />
          </div>
          <div className="num text-right text-[12.5px] font-bold text-fg">{b.display}</div>
        </div>
      ))}

      <div className="mt-2.5 grid grid-cols-[110px_1fr_78px] gap-3 sm:grid-cols-[180px_1fr_92px]">
        <div />
        <div className="relative h-4 border-t border-border">
          {ticks.map((t) => (
            <span
              key={t.label}
              className="absolute top-0 -translate-x-1/2 pt-1 text-[10px] text-fg-subtle"
              style={{ left: `${((t.at - minExp) / span) * 100}%` }}
            >
              {t.label}
            </span>
          ))}
        </div>
        <div />
      </div>

      <div className="mt-2.5 flex gap-4 text-[11.5px] text-fg-muted">
        {legend.map((l, i) => (
          <span key={l} className="inline-flex items-center gap-1.5">
            <i
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ background: `rgb(var(--color-series-${i + 1}))` }}
            />
            {l}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ tables */

/**
 * The table treatment, as bare class strings.
 *
 * `DataTable` (server) and `SortableDataTable` (client, in ./table.tsx) both
 * render through these, so the interactive table cannot visually drift from
 * the static one — the two are the same table with different behaviour, and
 * the #007 render is the contract for both.
 */
export const tableClass = {
  wrap: "overflow-hidden rounded border border-border",
  scroll: "overflow-x-auto",
  table: "w-full min-w-[700px] border-collapse",
  th: (i: number) =>
    `whitespace-nowrap bg-bg-inset px-3.5 py-2.5 text-2xs font-bold uppercase tracking-eyebrow text-fg-subtle ${
      i === 0 ? "text-left" : "text-right"
    }`,
  td: (i: number) =>
    `num whitespace-nowrap border-t border-border-subtle px-3.5 py-2.5 text-[13px] font-semibold ${
      i === 0 ? "text-left" : "text-right"
    }`,
  row: "hover:bg-bg-surface",
} as const;

/**
 * A table row. `cells` render as-is; `sort` and `detail` are ignored by the
 * static `DataTable` and consumed by `SortableDataTable`.
 */
export interface KitRow {
  key: string;
  /** Cell 0 renders left-aligned; the rest right-aligned, tabular. */
  cells: ReactNode[];
  /**
   * Serializable sort keys by column id. null sorts last in both directions —
   * see web/lib/table/sort.ts. Values only; no accessor functions, because
   * these cross the server/client boundary.
   */
  sort?: Record<string, number | string | null>;
  /** Server-rendered expansion panel. Its presence makes the row expandable. */
  detail?: ReactNode;
}

export function DataTable({ head, rows }: { head: string[]; rows: KitRow[] }) {
  return (
    <div className={tableClass.wrap}>
      <div className={tableClass.scroll}>
        <table className={tableClass.table}>
          <thead>
            <tr>
              {head.map((h, i) => (
                <th key={h} className={tableClass.th(i)}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className={tableClass.row}>
                {r.cells.map((c, i) => (
                  <td key={i} className={tableClass.td(i)}>
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * First-column cell: name over a quiet qualifier.
 *
 * With `href`, the name becomes the row's link target — recovered from the
 * since-deleted AlgorithmTable, which was the only component that let you
 * click a row through to its algorithm page.
 */
export function RowName({ name, note, href }: { name: string; note?: string; href?: string }) {
  const body = (
    <>
      <span className="block text-[13.5px] font-bold tracking-[-0.01em] text-fg">{name}</span>
      {note && <span className="mt-px block text-[10.5px] font-semibold text-fg-subtle">{note}</span>}
    </>
  );

  if (!href) return <span className="block">{body}</span>;

  return (
    <a href={href} className="block transition-colors hover:text-accent [&>span:first-child]:hover:text-accent">
      {body}
    </a>
  );
}

/* ------------------------------------------------------------ stacked bar */

export interface StackedSegment {
  key: string;
  label: string;
  /** Contribution in the axis's own unit. Widths are share-of-total. */
  value: number;
  /** Pre-formatted figure, e.g. "23.59 µs". Never derived here. */
  display: string;
  /** Quiet qualifier under the label, e.g. "×2 — client and server". */
  note?: string;
  series?: number;
}

/**
 * Horizontal stacked bar over segments that genuinely sum to the whole.
 *
 * Only use this where the parts are known to account for the total. If a
 * decomposition leaves a remainder, do not pass it as a segment and do not
 * silently drop it — say so in a Caveat next to the bar. A stacked bar
 * asserts "this is all of it", which is a claim about the measurement.
 */
export function StackedBar({
  segments,
  total,
  compact,
}: {
  segments: StackedSegment[];
  /** Pre-formatted total, shown at the right of the axis. */
  total?: string;
  compact?: boolean;
}) {
  const sum = segments.reduce((acc, s) => acc + s.value, 0);
  if (sum <= 0) return null;

  return (
    <div className={compact ? "" : "rounded border border-border bg-bg-surface px-4 py-4"}>
      <div className="flex h-5 overflow-hidden rounded-sm bg-bg-inset">
        {segments.map((s, i) => (
          <div
            key={s.key}
            title={`${s.label} — ${s.display}`}
            style={{
              width: `${(s.value / sum) * 100}%`,
              background: `rgb(var(--color-series-${(s.series ?? i) % 6 + 1}))`,
            }}
          />
        ))}
      </div>

      {!compact && (
        <div className="mt-3 grid gap-x-5 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-3">
          {segments.map((s, i) => (
            <div key={s.key} className="flex items-baseline gap-2">
              <span
                aria-hidden
                className="mt-1 h-2 w-2 shrink-0 rounded-[1px]"
                style={{ background: `rgb(var(--color-series-${(s.series ?? i) % 6 + 1}))` }}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12px] font-semibold text-fg">{s.label}</span>
                {s.note && (
                  <span className="block truncate text-[10.5px] font-semibold text-fg-subtle">
                    {s.note}
                  </span>
                )}
              </span>
              <span className="num shrink-0 text-[12px] font-bold text-fg">{s.display}</span>
            </div>
          ))}
        </div>
      )}

      {total && (
        <div className="mt-3 flex items-baseline justify-between border-t border-border-subtle pt-2">
          <span className="text-[11px] font-semibold uppercase tracking-eyebrow text-fg-subtle">
            Total
          </span>
          <span className="num text-[12.5px] font-bold text-fg">{total}</span>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------- provenance */

export interface ProvenanceRow {
  label: string;
  /** "—" when the field was looked for and no qualifying value exists. */
  value: ReactNode;
  method?: ReactNode;
  asOf?: string | null;
  confidence?: string | null;
  source?: string | null;
  notes?: string | null;
}

/**
 * Per-field provenance: what the value is, where it came from, how it was
 * obtained, and as of when.
 *
 * This is the component the sourcing standard in CLAUDE.md actually cashes
 * out to — an uncited identity block is the same failure mode as a fabricated
 * benchmark. A row with no `source` renders as having no source. It never
 * substitutes a plausible-looking one.
 */
export function ProvenanceTable({ rows }: { rows: ProvenanceRow[] }) {
  if (rows.length === 0) return null;

  return (
    <div className="space-y-2.5">
      {rows.map((r) => (
        <div key={r.label} className="border-t border-border-subtle pt-2.5 first:border-t-0 first:pt-0">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-[12px] font-bold text-fg">{r.label}</span>
            <span className="num text-[12.5px] font-bold text-fg">{r.value}</span>
            {r.method && <span className="text-[11px] text-fg-muted">{r.method}</span>}
            {r.asOf && <span className="num text-[11px] text-fg-subtle">as of {r.asOf}</span>}
            {r.confidence && <Tag>{r.confidence.replace(/_/g, " ")}</Tag>}
            {r.source ? (
              <a
                href={r.source}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] font-semibold text-fg-muted underline decoration-border-strong underline-offset-2 transition-colors hover:text-accent"
              >
                source ↗
              </a>
            ) : (
              <span className="text-[11px] font-semibold text-fg-subtle">no qualifying source</span>
            )}
          </div>
          {r.notes && (
            <p className="mt-1 max-w-[80ch] text-[11.5px] leading-relaxed text-fg-muted">{r.notes}</p>
          )}
        </div>
      ))}
    </div>
  );
}

export function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="inline-block rounded bg-bg-inset px-1.5 py-0.5 text-[10px] font-bold text-fg-muted">
      {children}
    </span>
  );
}

/* ------------------------------------------------------------ suites + misc */

export function SuiteGrid({
  suites,
}: {
  suites: { name: string; note: string; stats: { k: string; v: string; tone?: "pos" | "mute" }[]; baseline?: boolean }[];
}) {
  return (
    <div className="grid grid-cols-1 gap-px overflow-hidden rounded border border-border bg-border md:grid-cols-2">
      {suites.map((s) => (
        <div key={s.name} className={`min-w-0 px-4 py-3.5 ${s.baseline ? "bg-bg-inset" : "bg-bg-surface"}`}>
          <div className="text-[13.5px] font-bold tracking-[-0.01em] text-fg">{s.name}</div>
          <div className="mt-px text-[11.5px] text-fg-subtle">{s.note}</div>
          <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-2">
            {s.stats.map((st) => (
              <div key={st.k} className="min-w-0">
                <div className="eyebrow">{st.k}</div>
                <div
                  className={`num mt-0.5 text-[14px] font-bold ${
                    st.tone === "pos" ? "text-status-ok" : st.tone === "mute" ? "text-fg-subtle" : "text-fg"
                  }`}
                >
                  {st.v}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** A standing caveat. Used where a number is soft and shouldn't be quoted bare. */
export function Caveat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded border border-l-[3px] border-border border-l-accent bg-accent/10 px-4 py-3 text-[12.5px] leading-relaxed text-fg-muted">
      <span className="mb-1 block text-2xs font-bold uppercase tracking-eyebrow text-status-warn">
        {label}
      </span>
      {children}
    </div>
  );
}

export function ExportRow({ items }: { items: { label: string; href: string; primary?: boolean }[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((i) => (
        <a
          key={i.label}
          href={i.href}
          className={`inline-flex h-[34px] items-center gap-1.5 rounded-md border px-3.5 text-[12.5px] font-bold transition-colors ${
            i.primary
              ? "border-fg bg-fg text-bg"
              : "border-border bg-bg-surface text-fg hover:border-fg-subtle"
          }`}
        >
          {i.label}
        </a>
      ))}
    </div>
  );
}
