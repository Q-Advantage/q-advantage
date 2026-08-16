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

export function DataTable({
  head,
  rows,
}: {
  head: string[];
  /** Cell 0 renders left-aligned; the rest right-aligned, tabular. */
  rows: { key: string; cells: ReactNode[] }[];
}) {
  return (
    <div className="overflow-hidden rounded border border-border">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px] border-collapse">
          <thead>
            <tr>
              {head.map((h, i) => (
                <th
                  key={h}
                  className={`whitespace-nowrap bg-bg-inset px-3.5 py-2.5 text-2xs font-bold uppercase tracking-eyebrow text-fg-subtle ${
                    i === 0 ? "text-left" : "text-right"
                  }`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="hover:bg-bg-surface">
                {r.cells.map((c, i) => (
                  <td
                    key={i}
                    className={`num whitespace-nowrap border-t border-border-subtle px-3.5 py-2.5 text-[13px] font-semibold ${
                      i === 0 ? "text-left" : "text-right"
                    }`}
                  >
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

/** First-column cell: name over a quiet qualifier. */
export function RowName({ name, note }: { name: string; note?: string }) {
  return (
    <span className="block">
      <span className="block text-[13.5px] font-bold tracking-[-0.01em] text-fg">{name}</span>
      {note && <span className="mt-px block text-[10.5px] font-semibold text-fg-subtle">{note}</span>}
    </span>
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
