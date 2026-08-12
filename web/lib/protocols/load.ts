// web/lib/protocols/load.ts
//
// Loads the arch-aware protocol-track manifest + per-track result files from
// web/public/data/protocols/ (populated by benchmark/build_manifest.py).
// Extracted from web/app/q-shield/protocols/page.tsx so /q-shield/compare
// can reuse the same loader — behavior is unchanged from the inline version.

import fs from "fs";
import path from "path";
import type {
  Manifest,
  TLSComposedFile,
  SigTrackFile,
  SSHComposedFile,
  AesBaselineFile,
  LmsXmssFile,
  ProtocolsData,
  ArchBucket,
} from "./types";

function dataDir(): string {
  return path.join(process.cwd(), "public", "data", "protocols");
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

export function loadProtocolsData(): ProtocolsData {
  const dir = dataDir();
  const manifestPath = path.join(dir, "manifest.json");

  if (!fs.existsSync(manifestPath)) {
    return { manifest: null, byArch: {} };
  }

  const manifest = readJson<Manifest>(manifestPath);
  const byArch: Record<string, ArchBucket> = {};

  for (const arch of manifest.arches) {
    byArch[arch] = { tls: null, sig: null, ssh: null, aes: null, lmsXmss: null };
  }

  for (const entry of Object.values(manifest.files)) {
    const bucket = byArch[entry.arch];
    if (!bucket) continue;
    const filePath = path.join(dir, entry.filename);
    if (!fs.existsSync(filePath)) continue;

    // New track prefixes (aes-baseline, lms-xmss) are additive — a manifest
    // built before PR A's harness ever runs simply won't have these keys,
    // and byArch[arch].aes/lmsXmss stay null. Consumers must handle null.
    if (entry.track === "tls-composed") {
      bucket.tls = readJson<TLSComposedFile>(filePath);
    } else if (entry.track === "sig-track") {
      bucket.sig = readJson<SigTrackFile>(filePath);
    } else if (entry.track === "ssh-composed") {
      bucket.ssh = readJson<SSHComposedFile>(filePath);
    } else if (entry.track === "aes-baseline") {
      bucket.aes = readJson<AesBaselineFile>(filePath);
    } else if (entry.track === "lms-xmss") {
      bucket.lmsXmss = readJson<LmsXmssFile>(filePath);
    }
  }

  return { manifest, byArch };
}
