/**
 * Shared product-page furniture.
 *
 * The `ProductNav` component that gave this file its name was removed on
 * 2026-09-01: nothing rendered it, but it carried its own TABS array, and a
 * route added there instead of to app/q-shield/layout.tsx never appeared in
 * the navigation. /q-shield/trends shipped that way in #30 and stayed
 * unreachable for months. The real tab list lives in the layout — keep it
 * the only one.
 */

/** The four headline figures, shared-edge tiles. */
export function StatBand({
  items,
}: {
  /**
   * `lead` marks the one figure a reader should leave with.
   *
   * At most one per band, and it is a judgement about which number carries the
   * page — four accented tiles is the same as none.
   */
  items: { k: string; v: string; unit?: string; d: string; lead?: boolean }[];
}) {
  return (
    <div className="grid grid-cols-1 gap-px overflow-hidden rounded border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
      {items.map((s) => (
        <div key={s.k} className="min-w-0 bg-bg-surface px-4 py-4">
          <div className="eyebrow">{s.k}</div>
          <div
            className={`num mt-1.5 text-[27px] font-bold leading-none tracking-[-0.035em] ${
              s.lead ? "text-accent-ink" : "text-fg"
            }`}
          >
            {s.v}
            {s.unit && <span className="ml-0.5 text-[14px] text-fg-muted">{s.unit}</span>}
          </div>
          <div className="mt-1.5 text-[11.5px] leading-snug text-fg-muted">{s.d}</div>
        </div>
      ))}
    </div>
  );
}
