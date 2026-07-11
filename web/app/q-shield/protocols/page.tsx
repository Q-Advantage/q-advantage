// web/app/q-shield/protocols/page.tsx
//
// Build-time Server Component — reads protocol JSON via fs from the manifest.
// Static-generated: numbers land in HTML (SEO-visible), no client-side fetch,
// no loading spinner. Rebuilds on every Vercel deploy (triggered by the daily
// cron commit).
//
// Data path: web/public/data/protocols/manifest.json
//   → web/public/data/protocols/<prefix>-YYYY-MM-DD-<hash>.json
//
// process.cwd() at Vercel build time = .../web  (Root Directory: web)
// so all paths are relative to web/.

import fs from "fs";
import path from "path";
import { ProtocolsView } from "@/components/protocols/ProtocolsView";
import type {
  Manifest,
  TLSComposedFile,
  SigTrackFile,
  SSHComposedFile,
  ProtocolsData,
} from "@/lib/protocols/types";

// ── path helpers ─────────────────────────────────────────────────────────────

function dataDir(): string {
  return path.join(process.cwd(), "public", "data", "protocols");
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

// ── data loading ─────────────────────────────────────────────────────────────

function loadData(): ProtocolsData {
  const dir = dataDir();
  const manifestPath = path.join(dir, "manifest.json");

  if (!fs.existsSync(manifestPath)) {
    // First deploy before any cron run — return empty state so the page
    // renders with a "data not yet available" message rather than throwing.
    return { manifest: null, tls: null, sig: null, ssh: null };
  }

  const manifest = readJson<Manifest>(manifestPath);

  const tls = manifest.files["tls-composed"]
    ? readJson<TLSComposedFile>(
        path.join(dir, manifest.files["tls-composed"].filename)
      )
    : null;

  const sig = manifest.files["sig-track"]
    ? readJson<SigTrackFile>(
        path.join(dir, manifest.files["sig-track"].filename)
      )
    : null;

  const ssh = manifest.files["ssh-composed"]
    ? readJson<SSHComposedFile>(
        path.join(dir, manifest.files["ssh-composed"].filename)
      )
    : null;

  return { manifest, tls, sig, ssh };
}

// ── page ─────────────────────────────────────────────────────────────────────

export const metadata = {
  title: "Protocol Benchmarks — Q-Shield | Q-Advantage",
  description:
    "Live post-quantum TLS and SSH handshake performance: timing, bytes on wire, phase decomposition, and cross-validation against liboqs and eBACS reference data.",
};

export default function ProtocolsPage() {
  const data = loadData();
  return <ProtocolsView data={data} />;
}
