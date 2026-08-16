// web/components/product/interactive.tsx
//
// Server wrappers that pair each interactive component with a static fallback
// containing the real data.
//
// Why this file exists, and why pages should use these rather than mounting
// the client components directly:
//
// These pages are `force-static`. A client component that calls
// useSearchParams() makes Next bail out of prerendering the closest Suspense
// boundary and emit its fallback into the static HTML instead. With
// `fallback={null}` — which is what /q-shield and /q-day-index shipped —
// that means the tables were absent from the served HTML entirely and only
// appeared after hydration. Invisible to a crawler, invisible without
// JavaScript, and quietly contradicting the claim that the numbers are public.
//
// The fallback is therefore never null. It is the same rows, rendered by the
// static table in the server's default order. The interactive version takes
// over on hydration.

import { Suspense, type ReactNode } from "react";
import { DataTable, type KitRow } from "./kit";
import { SortableDataTable, type Column } from "./table";
import { Tabs, type TabItem } from "./tabs";

function labels(head: Column[]): string[] {
  return head.map((c) => (typeof c === "string" ? c : c.label));
}

/**
 * Sortable table that degrades to a static one.
 *
 * Same props as SortableDataTable. Use this from server components; reach for
 * SortableDataTable directly only if you are supplying your own fallback that
 * still contains the data.
 */
export function SortableTable(props: Parameters<typeof SortableDataTable>[0]) {
  return (
    <Suspense fallback={<DataTable head={labels(props.head)} rows={props.rows} />}>
      <SortableDataTable {...props} />
    </Suspense>
  );
}

/**
 * Tabs that degrade to every panel stacked.
 *
 * The fallback renders all panels, not just the first — otherwise the other
 * tracks' measurements would be missing from the static HTML, which is the
 * same failure this file exists to prevent, just narrower.
 */
export function TabbedPanels({
  items,
  ariaLabel,
  urlParam,
  defaultId,
  headings = true,
}: {
  items: TabItem[];
  ariaLabel: string;
  urlParam?: string;
  defaultId?: string;
  /** Label each panel in the fallback, since the tab chrome isn't there yet. */
  headings?: boolean;
}) {
  const fallback: ReactNode = (
    <div className="space-y-6">
      {items.map((item) => (
        <div key={item.id}>
          {headings && (
            <div className="mb-2 text-[11px] font-bold uppercase tracking-eyebrow text-fg-subtle">
              {item.label}
            </div>
          )}
          {item.content}
        </div>
      ))}
    </div>
  );

  return (
    <Suspense fallback={fallback}>
      <Tabs items={items} ariaLabel={ariaLabel} urlParam={urlParam} defaultId={defaultId} />
    </Suspense>
  );
}

export type { KitRow, TabItem };
