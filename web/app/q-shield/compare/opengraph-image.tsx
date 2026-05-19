import { ImageResponse } from "next/og";
import { getLatestRun } from "@/lib/data/load";
import { formatDuration } from "@/lib/format";
import type { Operation } from "@/lib/data/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const alt = "Q-Shield algorithm comparison";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

interface OgProps {
  searchParams: { a?: string; b?: string; op?: string };
}

/**
 * Dynamic OG image for /q-shield/compare?a=<id>&b=<id>&op=<op>.
 *
 * Generates a "headline ratio" card for any specific comparison. The marketing
 * system can paste a URL like:
 *   https://qadvantage.io/q-shield/compare/opengraph-image?a=ml-dsa-65&b=slh-dsa-shake-128s&op=sign
 * to get a ready-to-share PNG.
 *
 * Renders at request time (node runtime) since query params drive the content.
 */
export default async function Image({ searchParams }: OgProps) {
  const sp = searchParams || {};
  const run = getLatestRun();
  const algA = run.algorithms_by_id[sp.a || "ml-dsa-65"] ?? run.algorithms[0];
  const algB =
    run.algorithms_by_id[sp.b || "slh-dsa-shake-128s"] ??
    run.algorithms[1];
  const op: Operation = (sp.op as Operation) || "sign";

  const statsA = algA.operations[op];
  const statsB = algB.operations[op];

  let ratioText = "—";
  let fasterName = algA.display_name;
  let slowerName = algB.display_name;

  if (statsA && statsB) {
    const ratio = Math.max(statsA.mean_us, statsB.mean_us) / Math.min(statsA.mean_us, statsB.mean_us);
    if (statsA.mean_us < statsB.mean_us) {
      fasterName = algA.display_name;
      slowerName = algB.display_name;
    } else {
      fasterName = algB.display_name;
      slowerName = algA.display_name;
    }
    if (ratio >= 1000) ratioText = `${(ratio / 1000).toFixed(1)}k×`;
    else if (ratio >= 100) ratioText = `${Math.round(ratio)}×`;
    else if (ratio >= 10) ratioText = `${ratio.toFixed(1)}×`;
    else ratioText = `${ratio.toFixed(2)}×`;
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "linear-gradient(135deg, #0a0a0b 0%, #111114 100%)",
          padding: 64,
          fontFamily: "sans-serif",
          color: "#ededed",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -200,
            right: -200,
            width: 800,
            height: 800,
            background: "radial-gradient(circle, rgba(74, 222, 128, 0.08) 0%, transparent 60%)",
            display: "flex",
          }}
        />

        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 32 }}>
          <div
            style={{
              width: 32,
              height: 32,
              border: "1.5px solid #ededed",
              borderRadius: 4,
              transform: "rotate(45deg)",
              display: "flex",
            }}
          />
          <div style={{ fontSize: 26, fontWeight: 500, letterSpacing: "-0.02em" }}>Q-Advantage</div>
          <div
            style={{
              marginLeft: 16,
              fontSize: 16,
              color: "#6b6b72",
              fontFamily: "monospace",
              textTransform: "uppercase",
              letterSpacing: "0.18em",
              display: "flex",
            }}
          >
            Q-Shield · Compare
          </div>
        </div>

        <div style={{ fontSize: 18, color: "#6b6b72", fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.18em", marginBottom: 24, display: "flex" }}>
          Operation · {op}
        </div>

        <div style={{ fontSize: 64, fontWeight: 400, letterSpacing: "-0.025em", lineHeight: 1.1, color: "#ededed", marginBottom: 40, display: "flex", flexDirection: "column" }}>
          <span style={{ color: "#4ade80", display: "flex" }}>{fasterName}</span>
          <span style={{ display: "flex", color: "#a1a1a6", fontSize: 36 }}>
            is{" "}
            <span style={{ color: "#4ade80", margin: "0 12px", fontFamily: "monospace" }}>{ratioText}</span>{" "}
            faster than
          </span>
          <span style={{ color: "#a1a1a6", display: "flex" }}>{slowerName}</span>
        </div>

        {/* Per-algorithm headline numbers */}
        {statsA && statsB && (
          <div style={{ display: "flex", gap: 48, marginTop: 16 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: 13, color: "#6b6b72", fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.18em", display: "flex" }}>
                {algA.display_name} · mean
              </span>
              <span style={{ fontSize: 30, color: "#ededed", fontFamily: "monospace", display: "flex" }}>
                {formatDuration(statsA.mean_us)}
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: 13, color: "#6b6b72", fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.18em", display: "flex" }}>
                {algB.display_name} · mean
              </span>
              <span style={{ fontSize: 30, color: "#ededed", fontFamily: "monospace", display: "flex" }}>
                {formatDuration(statsB.mean_us)}
              </span>
            </div>
          </div>
        )}

        <div
          style={{
            position: "absolute",
            bottom: 48,
            left: 64,
            right: 64,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 16,
            color: "#6b6b72",
            fontFamily: "monospace",
          }}
        >
          <div style={{ display: "flex" }}>qadvantage.io/q-shield/compare</div>
          <div style={{ display: "flex" }}>Auditable on GitHub</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
