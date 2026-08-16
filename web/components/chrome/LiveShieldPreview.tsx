import Link from "next/link";
import { getLatestRun } from "@/lib/data/load";
import {
  formatDuration,
  formatOpsPerSec,
  formatRunDate,
  shortSha,
} from "@/lib/format";

/**
 * Hero card on the marketing landing.
 *
 * Pulls real numbers from the latest benchmark run rather than a static
 * mock. Freshness is established by the audit footer (run date, commit
 * SHA) — an inspectable fact, not a blinking badge.
 *
 * Renders three highlight rows from the most recent run. Whole card is a
 * link to /q-shield.
 */
export function LiveShieldPreview() {
  const run = getLatestRun();

  // Pick three "story" algorithms across all three families.
  const mlKem = run.algorithms_by_id["ml-kem-768"];
  const mlDsa = run.algorithms_by_id["ml-dsa-65"];
  const slhDsa = run.algorithms_by_id["slh-dsa-shake-128s"];

  const rows: { algo: typeof mlKem; op: "sign" | "encap"; label: string }[] = [];
  if (mlKem) rows.push({ algo: mlKem, op: "encap", label: "ENCAP" });
  if (mlDsa) rows.push({ algo: mlDsa, op: "sign", label: "SIGN" });
  if (slhDsa) rows.push({ algo: slhDsa, op: "sign", label: "SIGN" });

  return (
    <Link
      href="/q-shield"
      className="reveal reveal-3 group block bg-bg-card border border-border rounded-xl p-7 relative overflow-hidden hover:border-border-strong transition-colors"
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(135deg, rgba(74, 222, 128, 0.04) 0%, transparent 50%)",
        }}
      />

      {/* Header */}
      <div className="mb-6 relative">
        <span className="font-mono text-[11px] uppercase tracking-eyebrow text-fg-subtle">
          Q-Shield · Latest run
        </span>
      </div>

      {/* Headline metric — biggest "sign mean" number, anchors the visual */}
      {mlDsa?.operations.sign && (
        <div className="relative">
          <div className="font-mono text-[10px] uppercase tracking-eyebrow text-fg-subtle mb-1">
            ML-DSA-65 · sign mean
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-[72px] leading-none font-bold text-accent tracking-[-0.04em]">
              {formatDuration(mlDsa.operations.sign.mean_us).split(" ")[0]}
            </span>
            <span className="font-mono text-base text-fg-muted">
              {formatDuration(mlDsa.operations.sign.mean_us).split(" ")[1]}
            </span>
          </div>
          <div className="font-mono text-xs text-fg-muted mb-6 relative">
            {formatOpsPerSec(mlDsa.operations.sign.ops_per_sec)} ops/sec
          </div>
        </div>
      )}

      <div className="h-px bg-border my-4" />

      {/* Three more algorithm highlights */}
      {rows.map(({ algo, op, label }) => {
        if (!algo) return null;
        const stats = algo.operations[op];
        if (!stats) return null;
        return (
          <div
            key={`${algo.id}-${op}`}
            className="flex justify-between items-center font-mono text-xs mb-2.5 relative"
          >
            <span className="text-fg-subtle">
              {algo.display_name}
              <span className="text-fg-faint ml-1.5">· {label}</span>
            </span>
            <span className="text-fg-muted">{formatDuration(stats.mean_us)}</span>
          </div>
        );
      })}

      {/* Audit footer */}
      <div className="mt-6 pt-4 border-t border-border-subtle flex items-center justify-between text-[10px] font-mono uppercase tracking-eyebrow text-fg-subtle relative">
        <span>{formatRunDate(run.environment.iso_timestamp)}</span>
        <span className="text-fg-subtle">
          {shortSha(run.environment.git_commit)}
        </span>
      </div>

      <div className="mt-3 font-mono text-[10px] text-fg-subtle uppercase tracking-eyebrow flex items-center justify-end gap-1 relative group-hover:text-accent transition-colors">
        <span>View full dashboard</span>
        <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
          →
        </span>
      </div>
    </Link>
  );
}
