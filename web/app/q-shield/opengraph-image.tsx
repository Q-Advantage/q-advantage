import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Q-Shield — Post-quantum cryptography, measured";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
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
        {/* Subtle green glow accent */}
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
              width: 40,
              height: 40,
              border: "2px solid #ededed",
              borderRadius: 6,
              transform: "rotate(45deg)",
              display: "flex",
            }}
          />
          <div style={{ fontSize: 32, fontWeight: 500, letterSpacing: "-0.02em" }}>
            Q-Advantage
          </div>
        </div>

        {/* Eyebrow */}
        <div
          style={{
            fontSize: 18,
            color: "#6b6b72",
            textTransform: "uppercase",
            letterSpacing: "0.18em",
            marginBottom: 32,
            display: "flex",
          }}
        >
          Q-Shield · PQC benchmarks
        </div>

        {/* Headline */}
        <div
          style={{
            fontSize: 88,
            fontWeight: 400,
            letterSpacing: "-0.025em",
            lineHeight: 1.05,
            color: "#ededed",
            display: "flex",
            flexDirection: "column",
            maxWidth: 1000,
          }}
        >
          Post-quantum cryptography,
          <span style={{ color: "#4ade80", fontStyle: "italic" }}>measured.</span>
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: 24,
            color: "#a1a1a6",
            marginTop: 32,
            lineHeight: 1.5,
            maxWidth: 900,
            display: "flex",
          }}
        >
          Independent benchmarks for ML-KEM, ML-DSA, and SLH-DSA. Auditable, reproducible, public.
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
            fontSize: 18,
            color: "#6b6b72",
            fontFamily: "monospace",
          }}
        >
          <div style={{ display: "flex" }}>qadvantage.io/q-shield</div>
          <div style={{ display: "flex" }}>github.com/Q-Advantage</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
