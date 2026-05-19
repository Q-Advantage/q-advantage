/**
 * Display formatters.
 *
 * The dashboard renders values that span 6 orders of magnitude
 * (ML-KEM-512 keygen at 14µs to SLH-DSA-128s sign at 1.29s). Naive rendering
 * loses precision or readability. These formatters apply unit-shifting and
 * precision rules consistently.
 */

/**
 * Format a duration given in microseconds, choosing units to keep
 * 3–5 significant digits on screen.
 *
 *  < 1,000 µs       → µs with 1 decimal:  "14.0 µs"
 *  < 1,000,000 µs   → ms with 2 decimals: "61.69 ms"
 *  ≥ 1,000,000 µs   → s  with 3 decimals: "1.286 s"
 */
export function formatDuration(us: number): string {
  if (us < 1_000) return `${us.toFixed(1)} \u00B5s`;
  if (us < 1_000_000) return `${(us / 1_000).toFixed(2)} ms`;
  return `${(us / 1_000_000).toFixed(3)} s`;
}

/**
 * Format ops/sec with precision that scales to magnitude.
 *
 *  < 1       → 2 decimals: "0.78"
 *  < 100     → 1 decimal:  "16.2"
 *  ≥ 100     → integer w/ thousands separators: "73,657"
 */
export function formatOpsPerSec(ops: number): string {
  if (ops < 1) return ops.toFixed(2);
  if (ops < 100) return ops.toFixed(1);
  return Math.round(ops).toLocaleString("en-US");
}

/**
 * Format byte counts. KEM key/ciphertext sizes are always < 64KB so we
 * stay in bytes/KB territory.
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1_024) return `${bytes} B`;
  return `${(bytes / 1_024).toFixed(2)} KB`;
}

/**
 * Strip the verbose vendor noise out of a CPU model string.
 *   "Intel(R) Xeon(R) Platinum 8259CL CPU @ 2.50GHz"
 *     → "Xeon Platinum 8259CL @ 2.50GHz"
 */
export function shortCpuModel(cpu: string): string {
  return cpu
    .replace(/\(R\)/g, "")
    .replace(/\(TM\)/g, "")
    .replace(/\s+CPU\s+/i, " ")
    .replace(/^Intel\s+/i, "")
    .replace(/^AMD\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Format a short SHA (7 chars) from a full commit hash.
 */
export function shortSha(full_sha: string): string {
  return full_sha.slice(0, 7);
}

/**
 * Format an ISO timestamp as a compact run label.
 *   "2026-05-16T03:31:39Z" → "2026-05-16 03:31 UTC"
 */
export function formatRunDate(iso: string): string {
  const d = new Date(iso);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const min = String(d.getUTCMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${min} UTC`;
}

/**
 * Format wall-clock seconds as "Nm Ms" for the audit strip.
 *   2953.99 → "49m 14s"
 */
export function formatWallClock(seconds: number): string {
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}

/**
 * Steal-time percentage classification. The audit strip uses this to
 * color the steal indicator — honest signal about run quality.
 *
 *  < 1%   → "clean"     (green)
 *  1–5%   → "marginal"  (amber)
 *  ≥ 5%   → "throttled" (red)
 */
export type StealQuality = "clean" | "marginal" | "throttled";

export function classifyStealPercent(percent: number): StealQuality {
  if (percent < 1) return "clean";
  if (percent < 5) return "marginal";
  return "throttled";
}

export function computeStealPercent(
  steal_seconds: number,
  wall_seconds: number,
): number {
  if (wall_seconds <= 0) return 0;
  return (steal_seconds / wall_seconds) * 100;
}

export function formatStealPercent(percent: number): string {
  if (percent < 0.01) return "<0.01%";
  if (percent < 1) return `${percent.toFixed(2)}%`;
  return `${percent.toFixed(1)}%`;
}

/**
 * GitHub commit URL builder. Hardcoded to the canonical repo —
 * change once if the repo ever moves.
 */
export const GITHUB_REPO = "Q-Advantage/q-advantage";

export function githubCommitUrl(full_sha: string): string {
  return `https://github.com/${GITHUB_REPO}/commit/${full_sha}`;
}
