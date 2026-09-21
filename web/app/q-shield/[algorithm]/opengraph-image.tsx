import { getLatestRun } from "@/lib/data/load";
import { formatDuration, formatOpsPerSec } from "@/lib/format";

// Keep this legacy URL buildable without next/og's Node renderer. The latter
// currently fails while prerendering dynamic images on Windows/Node 24. A
// self-contained SVG preserves the social card and works in the Node runtime
// required by the filesystem-backed benchmark loader.
export const runtime = "nodejs";
export const alt = "PQC Arena algorithm benchmark";
export const size = { width: 1200, height: 630 };
export const contentType = "image/svg+xml";

export function generateStaticParams() {
  const latest = getLatestRun();
  return latest.algorithms.map((algorithm) => ({ algorithm: algorithm.id }));
}

function escapeXml(value: string | number) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export default function Image({ params }: { params: { algorithm: string } }) {
  const run = getLatestRun();
  const algorithm = run.algorithms_by_id[params.algorithm];

  if (!algorithm) {
    return new Response(
      '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect width="1200" height="630" fill="#101114"/><text x="64" y="120" fill="#fff" font-family="sans-serif" font-size="48">Benchmark not found</text></svg>',
      { headers: { "Content-Type": contentType } },
    );
  }

  const headlineOperation = algorithm.kind === "kem" ? "encap" : "sign";
  const stats = algorithm.operations[headlineOperation]!;
  const payloadLabel = algorithm.kind === "kem" ? "Ciphertext" : "Signature";
  const payloadBytes =
    algorithm.kind === "kem" ? algorithm.ciphertext_bytes : algorithm.signature_bytes;
  const family = escapeXml(algorithm.family);
  const kind = algorithm.kind === "kem" ? "KEY ENCAPSULATION" : "DIGITAL SIGNATURE";
  const name = escapeXml(algorithm.display_name);
  const duration = escapeXml(formatDuration(stats.mean_us));
  const throughput = escapeXml(formatOpsPerSec(stats.ops_per_sec));
  const route = escapeXml(`qadvantage.io/pqc-arena/${algorithm.id}`);

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
      <defs>
        <linearGradient id="background" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#0a0a0b"/>
          <stop offset="1" stop-color="#16181c"/>
        </linearGradient>
        <radialGradient id="glow" cx="1" cy="0" r="1">
          <stop offset="0" stop-color="#8ca9ff" stop-opacity="0.18"/>
          <stop offset="0.68" stop-color="#8ca9ff" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="1200" height="630" fill="url(#background)"/>
      <rect width="1200" height="630" fill="url(#glow)"/>
      <text x="64" y="76" fill="#f4f5f7" font-family="Arial, sans-serif" font-size="28" font-weight="600">Coldproof</text>
      <text x="222" y="76" fill="#8d929c" font-family="monospace" font-size="16" letter-spacing="3">PQC ARENA</text>
      <text x="64" y="154" fill="#8d929c" font-family="monospace" font-size="17" letter-spacing="3">${family}  ·  ${kind}</text>
      <text x="64" y="258" fill="#f4f5f7" font-family="Arial, sans-serif" font-size="88" font-weight="500" letter-spacing="-3">${name}</text>
      <line x1="64" y1="316" x2="1136" y2="316" stroke="#333841"/>
      <text x="64" y="372" fill="#8d929c" font-family="monospace" font-size="14" letter-spacing="2">${headlineOperation.toUpperCase()} · MEAN</text>
      <text x="64" y="442" fill="#8ca9ff" font-family="monospace" font-size="54">${duration}</text>
      <text x="430" y="372" fill="#8d929c" font-family="monospace" font-size="14" letter-spacing="2">OPS / SECOND</text>
      <text x="430" y="442" fill="#f4f5f7" font-family="monospace" font-size="54">${throughput}</text>
      <text x="806" y="372" fill="#8d929c" font-family="monospace" font-size="14" letter-spacing="2">${payloadLabel.toUpperCase()}</text>
      <text x="806" y="442" fill="#f4f5f7" font-family="monospace" font-size="54">${payloadBytes === undefined ? "—" : `${escapeXml(payloadBytes)} B`}</text>
      <text x="64" y="574" fill="#707680" font-family="monospace" font-size="15">${route}</text>
      <text x="1136" y="574" fill="#707680" font-family="monospace" font-size="15" text-anchor="end">DATED · REPRODUCIBLE · PUBLIC</text>
    </svg>`;

  return new Response(svg, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, immutable, no-transform, max-age=31536000",
    },
  });
}
