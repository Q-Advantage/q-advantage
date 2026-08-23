/**
 * P-CBOM catalog — every (algorithm, operation) pair the snippet generator
 * can emit a record for, built from this repo's own live protocol data
 * (`lib/protocols/load.ts`), not a hard-coded list. New algorithms Q-Shield
 * starts measuring flow in automatically the next time this is rebuilt
 * (`pcbom-web-tool-spec.md §Open items 4`).
 *
 * Coverage is intentionally partial and stated as such, not padded:
 *
 * - ML-KEM records come from `tls-composed`'s *pure* KEM suites (suite name
 *   matching `MLKEM\d+` — a hybrid suite like `X25519MLKEM768` is a protocol
 *   asset, out of P-CBOM v0.1's algorithm scope). Today that's ML-KEM-768
 *   only; ML-KEM-512/1024 have no pure-KEM composed-suite entry yet, so they
 *   are correctly absent here rather than guessed from a different dataset.
 * - ML-DSA / SLH-DSA records come from `sig-track`'s schemes. These carry no
 *   classical-baseline comparison — the reference tool never attaches one to
 *   signature ops, matching upstream `emit_pcbom.py`.
 * - AES and LMS/XMSS are in Q-Shield's data but the reference emitter does
 *   not parse those shapes (`AES` appears in its type table but is never
 *   wired to a parser) — left out here for the same reason: port, don't
 *   invent.
 */

import { loadProtocolsData } from "../protocols/load";
import type { TimingBlock } from "../protocols/types";
import {
  buildPcbomRecord,
  toCdx,
  normalizePcbomName,
  type PcbomRecord,
  type PcbomCdxComponent,
} from "./emit";

export interface PcbomCatalogEntry {
  /** Stable id for this algorithm+operation pair, e.g. "ml-kem-768-encaps". */
  id: string;
  algorithmId: string;
  algorithmName: string;
  family: "ML-KEM" | "ML-DSA" | "SLH-DSA";
  operation: string;
  native: PcbomRecord;
  cdx: PcbomCdxComponent;
}

export interface PcbomCatalog {
  entries: PcbomCatalogEntry[];
  /** The architecture the catalog was built from. */
  arch: string;
}

const PURE_MLKEM_RE = /^MLKEM\d+$/;
const PREFERRED_ARCH = "x86_64";

function familyOf(name: string): "ML-KEM" | "ML-DSA" | "SLH-DSA" | null {
  const up = name.toUpperCase();
  if (up.startsWith("ML-KEM")) return "ML-KEM";
  if (up.startsWith("ML-DSA")) return "ML-DSA";
  if (up.startsWith("SLH-DSA")) return "SLH-DSA";
  return null;
}

export function getPcbomCatalog(): PcbomCatalog {
  const data = loadProtocolsData();
  const arch = data.byArch[PREFERRED_ARCH] ? PREFERRED_ARCH : (Object.keys(data.byArch)[0] ?? "unknown");
  const bucket = data.byArch[arch];
  const entries: PcbomCatalogEntry[] = [];
  if (!bucket) return { entries, arch };

  const manifestEntry = (track: string) => data.manifest?.files[`${track}::${arch}`];

  // ------------------------------------------------------------- ML-KEM ---
  if (bucket.tls) {
    const tlsFile = manifestEntry("tls-composed");
    const refFile = tlsFile?.filename ?? "unknown";
    const env = bucket.tls.environment;

    for (const [suiteName, suite] of Object.entries(bucket.tls.suites)) {
      if (!PURE_MLKEM_RE.test(suiteName)) continue;
      const name = suiteName.replace(/^MLKEM(\d+)$/, "ML-KEM-$1");
      const phases = suite.phases ?? {};
      const commit = suite.audit?.git_commit ?? env.git_commit;
      const timestamp = suite.audit?.timestamp_utc ?? env.iso_timestamp;
      const suiteArch = suite.host?.arch ?? arch;
      const cpuModel = suite.host?.cpu_model ?? "unknown CPU";
      const liboqsVersion = suite.toolchain?.liboqs ?? env.liboqs_version;

      const opMap: [keyof NonNullable<typeof phases>, string][] = [
        ["kem_keygen", "keygen"],
        ["kem_encaps", "encaps"],
        ["kem_decaps", "decaps"],
      ];

      for (const [phaseKey, op] of opMap) {
        const stats: TimingBlock | undefined = phases[phaseKey];
        if (!stats) continue;

        // Baseline delta is a suite-level (key-exchange) figure — attach it to
        // encaps as the representative KEM operation, labelled as such. Same
        // choice the Python reference makes in from_composed().
        const baseline =
          op === "encaps" && suite.baseline
            ? {
                classicalAlgorithm: suite.baseline.baseline_suite,
                pctOverClassical: suite.baseline.pct_over_classical,
                comparison: "composed key-exchange vs classical baseline suite",
              }
            : undefined;

        const native = buildPcbomRecord({
          name,
          operation: op,
          medianUs: stats.median_us,
          p95Us: stats.p95_us,
          opsPerSec: stats.ops_per_sec,
          publicKeyBytes: suite.size?.bytes_client_to_server,
          ciphertextBytes: suite.size?.bytes_server_to_client,
          arch: suiteArch,
          cpuModel,
          buildFlags: suite.host?.build_path,
          liboqsVersion,
          commit,
          timestamp,
          refFile,
          baseline,
        });

        entries.push({
          id: `${native.algorithm.name.toLowerCase()}-${op}`,
          algorithmId: native.algorithm.name.toLowerCase(),
          algorithmName: name,
          family: "ML-KEM",
          operation: op,
          native,
          cdx: toCdx(native),
        });
      }
    }
  }

  // ------------------------------------------------------ ML-DSA / SLH-DSA
  if (bucket.sig) {
    const sigFile = manifestEntry("sig-track");
    const refFile = sigFile?.filename ?? "unknown";
    const env = bucket.sig.environment;

    for (const [rawName, scheme] of Object.entries(bucket.sig.schemes)) {
      const name = normalizePcbomName(scheme.scheme ?? rawName);
      const family = familyOf(name);
      if (family !== "ML-DSA" && family !== "SLH-DSA") continue;

      const ops: ["keygen" | "sign" | "verify"][] = [["keygen"], ["sign"], ["verify"]];
      for (const [op] of ops) {
        const stats: TimingBlock | undefined = scheme[op];
        if (!stats) continue;

        const native = buildPcbomRecord({
          name,
          operation: op,
          medianUs: stats.median_us,
          p95Us: stats.p95_us,
          opsPerSec: stats.ops_per_sec,
          signatureBytes: scheme.signature_bytes,
          publicKeyBytes: scheme.public_key_bytes,
          arch: env.arch ?? arch,
          cpuModel: env.cpu_model ?? "unknown CPU",
          buildFlags: env.build_path,
          liboqsVersion: env.liboqs_version,
          commit: env.git_commit,
          timestamp: env.iso_timestamp,
          refFile,
        });

        entries.push({
          id: `${native.algorithm.name.toLowerCase()}-${op}`,
          algorithmId: native.algorithm.name.toLowerCase(),
          algorithmName: name,
          family,
          operation: op,
          native,
          cdx: toCdx(native),
        });
      }
    }
  }

  entries.sort((a, b) => a.algorithmName.localeCompare(b.algorithmName) || a.operation.localeCompare(b.operation));
  return { entries, arch };
}
