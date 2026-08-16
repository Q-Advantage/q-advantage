"use client";
// web/components/product/table.tsx
//
// The interactive twin of kit.tsx's DataTable: sortable columns and
// expandable rows, rendered through the same `tableClass` constants so the
// two cannot drift.
//
// Two properties this component must never lose:
//
//   1. Every measured number is in the static HTML. Rows render in the
//      server's default order and detail panels are emitted into the DOM
//      (hidden, not unmounted). A site whose claim is "the numbers are
//      public" cannot put its numbers behind a click handler.
//   2. No hydration mismatch. These pages are force-static, so
//      useSearchParams() is empty during prerender and populated on the
//      client. Reading it during render would reorder rows between server
//      and client HTML. It is read in a mount effect instead.

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { tableClass, type KitRow } from "./kit";
import {
  decodeSort,
  encodeSort,
  nextSortState,
  sortRows,
  type SortDir,
  type SortState,
} from "@/lib/table/sort";

export interface SortColumn {
  id: string;
  label: string;
  /** Direction applied on the first click. Numeric columns usually open descending. */
  defaultDir?: SortDir;
}

/** A plain string is an unsortable column. */
export type Column = string | SortColumn;

function columnId(c: Column): string | null {
  return typeof c === "string" ? null : c.id;
}

function columnLabel(c: Column): string {
  return typeof c === "string" ? c : c.label;
}

export function SortableDataTable({
  head,
  rows,
  defaultSort = null,
  sortParam,
  expandParam,
  expandHint = "detail",
}: {
  head: Column[];
  rows: KitRow[];
  /** The server's order. Null sort state means "leave rows as given". */
  defaultSort?: SortState | null;
  /** When set, the active sort mirrors into ?<sortParam>=col:dir. */
  sortParam?: string;
  /** When set, the expanded row key mirrors into ?<expandParam>=key. */
  expandParam?: string;
  /** Word used in the expand affordance's accessible label, e.g. "phases". */
  expandHint?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const sortableIds = head.map(columnId).filter((id): id is string => id !== null);

  const [sort, setSort] = useState<SortState | null>(defaultSort);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Adopt URL state after mount only — see the hydration note at the top.
  useEffect(() => {
    if (sortParam) {
      const fromUrl = decodeSort(searchParams.get(sortParam), sortableIds);
      if (fromUrl) setSort(fromUrl);
    }
    if (expandParam) {
      const key = searchParams.get(expandParam);
      if (key && rows.some((r) => r.key === key && r.detail)) setExpanded(key);
    }
    // Mount-only: later URL changes come from this component's own writes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function writeParam(param: string | undefined, value: string | null) {
    if (!param) return;
    const next = new URLSearchParams(Array.from(searchParams.entries()));
    if (value === null) next.delete(param);
    else next.set(param, value);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  function onHeaderClick(col: SortColumn) {
    const next = nextSortState(sort, col.id, col.defaultDir ?? "asc");
    setSort(next ?? defaultSort);
    writeParam(sortParam, encodeSort(next));
  }

  function onToggleRow(key: string) {
    const next = expanded === key ? null : key;
    setExpanded(next);
    writeParam(expandParam, next);
  }

  const ordered = sort ? sortRows(rows, sort.id, sort.dir) : rows;
  const columnCount = head.length;

  return (
    <div className={tableClass.wrap}>
      <div className={tableClass.scroll}>
        <table className={tableClass.table}>
          <thead>
            <tr>
              {head.map((c, i) => {
                const id = columnId(c);
                const active = id !== null && sort?.id === id;
                return (
                  <th
                    key={columnLabel(c)}
                    className={tableClass.th(i)}
                    aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
                  >
                    {id === null ? (
                      columnLabel(c)
                    ) : (
                      <button
                        type="button"
                        onClick={() => onHeaderClick(c as SortColumn)}
                        className={`inline-flex items-center gap-1 uppercase tracking-eyebrow transition-colors hover:text-fg ${
                          active ? "text-fg" : ""
                        }`}
                      >
                        {columnLabel(c)}
                        <span aria-hidden className={active ? "text-accent" : "text-fg-subtle/40"}>
                          {active ? (sort.dir === "asc" ? "↑" : "↓") : "↕"}
                        </span>
                      </button>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {ordered.map((r) => {
              const isOpen = expanded === r.key;
              return (
                <FragmentRow
                  key={r.key}
                  row={r}
                  isOpen={isOpen}
                  columnCount={columnCount}
                  expandHint={expandHint}
                  onToggle={() => onToggleRow(r.key)}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FragmentRow({
  row,
  isOpen,
  columnCount,
  expandHint,
  onToggle,
}: {
  row: KitRow;
  isOpen: boolean;
  columnCount: number;
  expandHint: string;
  onToggle: () => void;
}) {
  const expandable = Boolean(row.detail);

  return (
    <>
      <tr className={tableClass.row}>
        {row.cells.map((c, i) => (
          <td key={i} className={tableClass.td(i)}>
            {i === 0 && expandable ? (
              <span className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onToggle}
                  aria-expanded={isOpen}
                  aria-label={`${isOpen ? "Hide" : "Show"} ${expandHint} for ${row.key}`}
                  className="shrink-0 rounded border border-border px-1 text-[10px] leading-4 text-fg-subtle transition-colors hover:border-border-strong hover:text-fg"
                >
                  {isOpen ? "−" : "+"}
                </button>
                {c}
              </span>
            ) : (
              c
            )}
          </td>
        ))}
      </tr>
      {expandable && (
        // Always in the DOM: hidden, not unmounted, so the numbers are in the
        // static HTML and reachable without JavaScript.
        <tr hidden={!isOpen}>
          <td colSpan={columnCount} className="border-t border-border-subtle bg-bg-inset/40 px-3.5 py-4">
            {row.detail}
          </td>
        </tr>
      )}
    </>
  );
}
