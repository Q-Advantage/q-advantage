"use client";

import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { useRouter } from "next/navigation";
import { formatDuration, formatRunDate, shortSha, githubChecksUrl } from "@/lib/format";

interface SparklinePoint {
  /** ISO timestamp string for x-axis */
  timestamp: string;
  /** Mean operation time in microseconds */
  mean_us: number;
  /** p95 in microseconds */
  p95_us: number;
  /** Full git SHA for link-back */
  full_sha: string;
  /** Short SHA for display */
  short_sha: string;
}

interface SparklineProps {
  data: SparklinePoint[];
  /** Height in pixels (default 80) */
  height?: number;
  /** Show axes and grid (false for tiny inline use) */
  full?: boolean;
}

/**
 * Sparkline showing operation mean over time. Every point hyperlinks to
 * the GitHub commit that produced the run — InferenceX-style audit trail
 * built into the chart itself.
 */
export function Sparkline({ data, height = 80, full = false }: SparklineProps) {
  const router = useRouter();

  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-2xs text-fg-subtle"
        style={{ height }}
      >
        no data
      </div>
    );
  }

  if (data.length === 1) {
    // Single point — no line to draw, show the value as text
    return (
      <div
        className="flex items-center justify-center text-2xs text-fg-subtle font-mono"
        style={{ height }}
      >
        {formatDuration(data[0].mean_us)} — single run, awaiting trend
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart
        data={data}
        margin={full ? { top: 6, right: 12, left: 12, bottom: 6 } : { top: 4, right: 4, left: 4, bottom: 4 }}
      >
        {full && (
          <>
            <CartesianGrid stroke="#1f1f23" strokeDasharray="2 4" vertical={false} />
            <XAxis
              dataKey="timestamp"
              tick={{ fill: "#6b6b73", fontSize: 10, fontFamily: "var(--font-geist-mono)" }}
              tickFormatter={(v) => formatRunDate(v).split(" ")[0]}
              stroke="#1f1f23"
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fill: "#6b6b73", fontSize: 10, fontFamily: "var(--font-geist-mono)" }}
              tickFormatter={(v) => formatDuration(v)}
              stroke="#1f1f23"
              tickLine={false}
              axisLine={false}
              width={70}
            />
          </>
        )}
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const p = payload[0].payload as SparklinePoint;
            return (
              <div className="bg-bg-elevated border border-border-strong rounded-md px-2.5 py-1.5 text-2xs shadow-md">
                <div className="font-mono text-fg">{formatDuration(p.mean_us)}</div>
                <div className="text-fg-subtle">{formatRunDate(p.timestamp)}</div>
                <div className="text-fg-muted font-mono mt-0.5">
                  {p.short_sha} <span className="text-fg-subtle">— click to view</span>
                </div>
              </div>
            );
          }}
        />
        <Line
          type="monotone"
          dataKey="mean_us"
          stroke="#4ade80"
          strokeWidth={1.5}
          dot={(props: DotProps) => <ClickableDot {...props} />}
          activeDot={(props: DotProps) => <ClickableDot {...props} active />}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

/**
 * Recharts custom dot. Receives the per-point payload via `props.payload`,
 * so each dot's onClick correctly routes to that specific commit. This is
 * the fix for the "all dots open the same commit" bug — previously the click
 * handler was on the whole LineChart and read activePayload incorrectly.
 */
interface DotProps {
  cx?: number;
  cy?: number;
  payload?: SparklinePoint;
  active?: boolean;
}

function ClickableDot({ cx, cy, payload, active }: DotProps) {
  if (cx == null || cy == null || !payload) return null;
  return (
    <g style={{ cursor: "pointer" }}>
      {/* Larger transparent hit target — easier to click on small screens */}
      <circle
        cx={cx}
        cy={cy}
        r={10}
        fill="transparent"
        onClick={() =>
          window.open(githubChecksUrl(payload.full_sha), "_blank", "noopener")
        }
      />
      {/* Visible dot */}
      <circle
        cx={cx}
        cy={cy}
        r={active ? 4 : 2.5}
        fill="#4ade80"
        stroke={active ? "#0a0a0b" : "transparent"}
        strokeWidth={active ? 2 : 0}
        pointerEvents="none"
      />
    </g>
  );
}
