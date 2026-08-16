import Link from "next/link";

/**
 * Q-Shield's own navigation bar — the "InferenceX by SemiAnalysis" lockup.
 *
 * A product is its own property, not a section of the marketing site. This
 * sits directly under the company header and gives the instrument its own
 * tab set, so clicking into Q-Shield feels like arriving somewhere else.
 */
const TABS = [
  { label: "Overview", href: "/q-shield" },
  { label: "Compare", href: "/q-shield/compare" },
  { label: "Protocols", href: "/q-shield/protocols" },
  { label: "Trends", href: "/q-shield/trends" },
  { label: "Methodology", href: "/methodology" },
];

export function ProductNav({ current = "Overview" }: { current?: string }) {
  return (
    <div className="-mx-5 mb-6 border-b border-border px-5 pb-4 md:-mx-7 md:px-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <span className="text-[21px] font-bold tracking-[-0.025em] text-fg">
            Q<span className="text-accent-ink">-</span>Shield
          </span>
          <span className="text-[11.5px] font-semibold text-fg-subtle">
            by{" "}
            <Link href="/" className="border-b border-border text-fg-muted hover:text-fg">
              Q-Advantage
            </Link>
          </span>
        </div>

        <nav className="-mb-px flex flex-wrap items-center gap-1 overflow-x-auto">
          {TABS.map((t) => {
            const on = t.label === current;
            return (
              <Link
                key={t.label}
                href={t.href}
                className={`flex-none rounded-lg px-3 py-1.5 text-[13px] transition-colors ${
                  on
                    ? "bg-bg-surface font-bold text-fg"
                    : "font-semibold text-fg-muted hover:bg-bg-surface hover:text-fg"
                }`}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

/** The four headline figures, shared-edge tiles. */
export function StatBand({
  items,
}: {
  items: { k: string; v: string; unit?: string; d: string }[];
}) {
  return (
    <div className="grid grid-cols-1 gap-px overflow-hidden rounded border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
      {items.map((s) => (
        <div key={s.k} className="min-w-0 bg-bg-surface px-4 py-4">
          <div className="eyebrow">{s.k}</div>
          <div className="num mt-1.5 text-[27px] font-bold leading-none tracking-[-0.035em] text-fg">
            {s.v}
            {s.unit && <span className="ml-0.5 text-[14px] text-fg-muted">{s.unit}</span>}
          </div>
          <div className="mt-1.5 text-[11.5px] leading-snug text-fg-muted">{s.d}</div>
        </div>
      ))}
    </div>
  );
}
