"use client";
// web/components/product/tabs.tsx
//
// Tab bar for the product surfaces. The treatment is the one already approved
// on /q-shield/compare (CompareViewTabs) — accent underline on the active tab,
// muted label otherwise — lifted into the kit so protocols, compare and
// whatever comes next share one implementation.
//
// Every panel is server-rendered and shipped; inactive panels carry `hidden`
// rather than being unmounted, so all content is in the static HTML.

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export interface TabItem {
  id: string;
  label: string;
  /** Rendered as a quiet count beside the label. Omit for no count. */
  count?: number;
  content: ReactNode;
}

export function Tabs({
  items,
  ariaLabel,
  urlParam,
  defaultId,
}: {
  items: TabItem[];
  ariaLabel: string;
  /** When set, the active tab mirrors into ?<urlParam>=id. */
  urlParam?: string;
  defaultId?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const first = defaultId && items.some((i) => i.id === defaultId) ? defaultId : items[0]?.id;
  const [active, setActive] = useState<string | undefined>(first);

  // Mount-only URL adoption, same hydration discipline as SortableDataTable:
  // these pages are force-static, so search params are empty at prerender.
  useEffect(() => {
    if (!urlParam) return;
    const fromUrl = searchParams.get(urlParam);
    if (fromUrl && items.some((i) => i.id === fromUrl)) setActive(fromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onSelect(id: string) {
    setActive(id);
    if (!urlParam) return;
    const next = new URLSearchParams(Array.from(searchParams.entries()));
    next.set(urlParam, id);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  if (items.length === 0) return null;

  return (
    <div className="space-y-4">
      <div role="tablist" aria-label={ariaLabel} className="flex flex-wrap gap-2 border-b border-border">
        {items.map((item) => {
          const isActive = item.id === active;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`panel-${item.id}`}
              id={`tab-${item.id}`}
              onClick={() => onSelect(item.id)}
              className={`-mb-px border-b-2 px-3.5 py-2 text-[13px] font-semibold transition-colors ${
                isActive
                  ? "border-accent text-fg"
                  : "border-transparent text-fg-muted hover:text-fg"
              }`}
            >
              {item.label}
              {item.count != null && (
                <span className="num ml-1.5 text-[11px] text-fg-subtle">{item.count}</span>
              )}
            </button>
          );
        })}
      </div>

      {items.map((item) => (
        <div
          key={item.id}
          role="tabpanel"
          id={`panel-${item.id}`}
          aria-labelledby={`tab-${item.id}`}
          hidden={item.id !== active}
        >
          {item.content}
        </div>
      ))}
    </div>
  );
}
