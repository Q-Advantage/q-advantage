import { ImageResponse } from "next/og";
import { getLatestRun } from "@/lib/data/load";
import { formatDuration, formatOpsPerSec } from "@/lib/format";

// next/og runs in the edge runtime, but our data loader uses node:fs which
// doesn't work there. So we run this on the node runtime instead and lose
// the speed advantage — fine because these are static-generated at build time,
// not request-time.
export const runtime = "nodejs";
export const alt = "Q-Shield algorithm benchmark";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export function generateStaticParams() {
  const latest = getLatestRun();
  return latest.algorithms.map((a) => ({ algorithm: a.id }));
}

export default async function Image({ params }: { params: { algorithm: string } }) {
  const run = getLatestRun();
  const algo = run.algorithms_by_id[params.algorithm];

  if (!algo) {
    return new ImageResponse(<div>Not found</div>, size);
  }

  // Use the most "interesting" operation: sign for sigs, encap for KEMs
  const headlineOp = algo.kind === "kem" ? "encap" : "sign";
  const stats = algo.operations[headlineOp]!;

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

        {/* Brand mark */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 48 }}>
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
          <div style={{ fontSize: 26, fontWeight: 500, letterSpacing: "-0.02em" }}>
            Q-Advantage
          </div>
          <div style={{ marginLeft: 16, fontSize: 16, color: "#6b6b72", fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.18em", display: "flex" }}>
            Q-Shield
          </div>
        </div>

        {/* Family eyebrow */}
        <div
          style={{
            fontSize: 18,
            color: "#6b6b72",
            textTransform: "uppercase",
            letterSpacing: "0.18em",
            marginBottom: 16,
            display: "flex",
            gap: 12,
          }}
        >
          <span>{algo.family}</span>
          <span style={{ color: "#404048" }}>·</span>
          <span>{algo.kind === "kem" ? "Key encapsulation" : "Digital signature"}</span>
        </div>

        {/* Algorithm name */}
        <div
          style={{
            fontSize: 96,
            fontWeight: 400,
            letterSpacing: "-0.025em",
            lineHeight: 1.05,
            color: "#ededed",
            marginBottom: 56,
            display: "flex",
          }}
        >
          {algo.display_name}
        </div>

        {/* Headline stats */}
        <div style={{ display: "flex", gap: 80 }}>
          <Stat
            label={`${headlineOp} · mean`}
            value={formatDuration(stats.mean_us)}
            accent
          />
          <Stat label="Ops/sec" value={formatOpsPerSec(stats.ops_per_sec)} />
          <Stat
            label={algo.kind === "kem" ? "Ciphertext" : "Signature"}
            value={`${algo.kind === "kem" ? algo.ciphertext_bytes : algo.signature_bytes} B`}
          />
        </div>

        {/* Footer */}
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
          <div style={{ display: "flex" }}>qadvantage.io/q-shield/{algo.id}</div>
          <div style={{ display: "flex" }}>Auditable on GitHub</div>
        </div>
      </div>
    ),
    { ...size },
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div
        style={{
          fontSize: 14,
          color: "#6b6b72",
          textTransform: "uppercase",
          letterSpacing: "0.18em",
          display: "flex",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 56,
          color: accent ? "#4ade80" : "#ededed",
          fontFamily: "monospace",
          display: "flex",
        }}
      >
        {value}
      </div>
    </div>
  );
}
