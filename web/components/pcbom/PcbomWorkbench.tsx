"use client";

import { useState } from "react";
import type { PcbomCatalog } from "@/lib/pcbom/catalog";
import { PcbomTool } from "./PcbomTool";
import { PcbomEnrich } from "./PcbomEnrich";

/**
 * The two P-CBOM capabilities on one page, per the build spec's two-tab layout.
 *
 * Generate is first because it needs nothing from the reader: it demonstrates
 * what a P-CBOM record is before asking anyone to hand over an inventory.
 */
type Tab = "generate" | "enrich";

const TABS: { id: Tab; label: string; hint: string }[] = [
  { id: "generate", label: "Generate a snippet", hint: "Pick an algorithm, get a cited record" },
  { id: "enrich", label: "Enrich my CBOM", hint: "Annotate your own inventory" },
];

export function PcbomWorkbench({ catalog }: { catalog: PcbomCatalog }) {
  const [tab, setTab] = useState<Tab>("generate");

  return (
    <div className="min-w-0">
      <div role="tablist" aria-label="P-CBOM tools" className="flex flex-wrap gap-2 border-b border-border pb-3">
        {TABS.map((t) => {
          const on = t.id === tab;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={on}
              type="button"
              onClick={() => setTab(t.id)}
              className={`min-w-0 rounded border px-3.5 py-2 text-left transition-colors ${
                on
                  ? "border-accent bg-accent/10"
                  : "border-border bg-bg-surface hover:border-border-strong"
              }`}
            >
              <span className={`block text-[13px] font-bold ${on ? "text-fg" : "text-fg-muted"}`}>
                {t.label}
              </span>
              <span className="block text-[11px] text-fg-subtle">{t.hint}</span>
            </button>
          );
        })}
      </div>

      <div className="pt-6">
        {tab === "generate" ? (
          <PcbomTool entries={catalog.entries} arch={catalog.arch} />
        ) : (
          <PcbomEnrich catalog={catalog} />
        )}
      </div>
    </div>
  );
}
