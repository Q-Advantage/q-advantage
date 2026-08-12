"use client";
// web/components/data/CompareViewTabs.tsx
//
// Two-way toggle: the existing table+chart detail view (CompareView, which
// already renders both together) vs the new radar view (AlgorithmRadar).
// A true three-way Table/Chart/Radar split (per qshield-update-spec.md §5's
// InferenceX-parity ask) would need decomposing CompareView's chart and
// table apart from each other — a real, separable follow-up, not attempted
// here to avoid rushing a change to that component's existing, working
// layout under this session's scope.

import { useState } from "react";
import type { NormalizedAlgorithm } from "@/lib/data/types";
import { CompareView } from "./CompareView";
import { AlgorithmRadar } from "./AlgorithmRadar";

type Mode = "detail" | "radar";

export function CompareViewTabs({ algorithms }: { algorithms: NormalizedAlgorithm[] }) {
  const [mode, setMode] = useState<Mode>("detail");

  return (
    <div className="space-y-6">
      <div className="flex gap-2 border-b border-border">
        {(
          [
            ["detail", "Table & chart"],
            ["radar", "Radar"],
          ] as [Mode, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setMode(id)}
            className={`px-4 py-2.5 text-sm -mb-px border-b-2 transition-colors ${
              mode === id ? "border-accent text-fg" : "border-transparent text-fg-muted hover:text-fg"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === "detail" ? (
        <CompareView algorithms={algorithms} />
      ) : (
        <AlgorithmRadar algorithms={algorithms} />
      )}
    </div>
  );
}
