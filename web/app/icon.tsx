import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

/**
 * Browser tab favicon — green diamond on near-black background.
 * Matches the DiamondMark in components/chrome/Header.tsx.
 *
 * Next.js automatically wires this as <link rel="icon"> on every page.
 */
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0a0b",
        }}
      >
        <div
          style={{
            width: 20,
            height: 20,
            border: "2px solid #4ade80",
            borderRadius: 3,
            transform: "rotate(45deg)",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "flex-start",
            padding: 3,
          }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderLeft: "2px solid #4ade80",
              borderBottom: "2px solid #4ade80",
              display: "flex",
            }}
          />
        </div>
      </div>
    ),
    { ...size },
  );
}
