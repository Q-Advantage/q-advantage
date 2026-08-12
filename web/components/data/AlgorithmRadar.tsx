"use client";
// web/components/data/AlgorithmRadar.tsx
//
// Speed-vs-size-vs-security-level radar per algorithm family — a genuinely
// new view, InferenceX-inspired (qshield-update-spec.md §5's "Table/Chart/
// Radar three-way toggle" on the GPU Specs page pattern).
//
// Each axis is normalized to 0-100 *within its family* (fastest/smallest
// member of the family scores 100 on that axis) so members at very
// different absolute scales (e.g. ML-KEM-512 vs ML-KEM-1024) still plot
// legibly on the same chart. This is a relative-ranking view, not a
// unit-preserving one — the exact µs/byte numbers live in the table/chart
// views and the compare-detail section below.

import { useMemo } from "react";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Legend,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { NormalizedAlgorithm, AlgorithmFamily } from "@/lib/data/types";

const SERIES_COLORS = ["#4ade80", "#2a8aae", "#c084fc", "#f59e0b", "#f87171", "#60a5fa"];

function normalizeInverse(values: number[]): number[] {
  // fastest/smallest (lowest value) scores 100; others scale proportionally.
  const min = Math.min(...values);
  if (min <= 0) return values.map(() => 0);
  return values.map((v) => (v > 0 ? Math.round((min / v) * 100) : 0));
}

function buildFamilyRadarData(members: NormalizedAlgorithm[]) {
  // Speed axis: keygen is the one operation every kind (KEM or sig) shares.
  const speeds = members.map((a) => a.operations.keygen?.mean_us ?? Number.POSITIVE_INFINITY);
  const sizes = members.map((a) => a.pubkey_bytes);
  const speedScores = normalizeInverse(speeds);
  const sizeScores = normalizeInverse(sizes);

  const axes: { axis: string; [algoId: string]: string | number }[] = [
    { axis: "Keygen speed", ...Object.fromEntries(members.map((a, i) => [a.id, speedScores[i]])) },
    { axis: "Key compactness", ...Object.fromEntries(members.map((a, i) => [a.id, sizeScores[i]])) },
    {
      axis: "Security level",
      ...Object.fromEntries(members.map((a) => [a.id, Math.round((a.nist_level / 5) * 100)])),
    },
  ];
  return axes;
}

function FamilyRadar({ family, members }: { family: AlgorithmFamily; members: NormalizedAlgorithm[] }) {
  const data = useMemo(() => buildFamilyRadarData(members), [members]);
  if (members.length < 2) return null;

  return (
    <div className="border border-border rounded-md bg-bg-inset px-5 py-4">
      <div className="eyebrow mb-3">{family}</div>
      <ResponsiveContainer width="100%" height={280}>
        <RadarChart data={data} outerRadius="70%">
          <PolarGrid stroke="rgba(255,255,255,0.08)" />
          <PolarAngleAxis dataKey="axis" tick={{ fill: "#6b6b72", fontSize: 11 }} />
          <PolarRadiusAxis domain={[0, 100]} tick={{ fill: "#6b6b72", fontSize: 9 }} axisLine={false} />
          {members.map((a, i) => (
            <Radar
              key={a.id}
              name={a.display_name}
              dataKey={a.id}
              stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
              fill={SERIES_COLORS[i % SERIES_COLORS.length]}
              fillOpacity={0.15}
            />
          ))}
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Tooltip
            contentStyle={{ background: "var(--color-bg-elevated, #1a1a1e)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6, fontSize: 12 }}
          />
        </RadarChart>
      </ResponsiveContainer>
      <p className="text-2xs text-fg-subtle mt-2 leading-relaxed">
        Axes normalized within {family} — fastest/most-compact member scores 100 on that axis.
        Relative ranking, not absolute units; see the table below for real µs/byte figures.
      </p>
    </div>
  );
}

export function AlgorithmRadar({ algorithms }: { algorithms: NormalizedAlgorithm[] }) {
  const families = useMemo(() => {
    const byFamily: Record<string, NormalizedAlgorithm[]> = {};
    for (const a of algorithms) {
      if (!byFamily[a.family]) byFamily[a.family] = [];
      byFamily[a.family].push(a);
    }
    return Object.entries(byFamily) as [AlgorithmFamily, NormalizedAlgorithm[]][];
  }, [algorithms]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      {families.map(([family, members]) => (
        <FamilyRadar key={family} family={family} members={members} />
      ))}
    </div>
  );
}
