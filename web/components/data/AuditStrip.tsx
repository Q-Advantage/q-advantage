import { ExternalLink, AlertTriangle } from "lucide-react";
import type { NormalizedRun } from "@/lib/data/types";
import {
  classifyStealPercent,
  computeStealPercent,
  formatRunDate,
  formatStealPercent,
  formatWallClock,
  githubCommitUrl,
  shortCpuModel,
  shortSha,
} from "@/lib/format";
import { cn } from "@/lib/cn";

interface AuditStripProps {
  run: NormalizedRun;
}

/**
 * The audit-trail strip. Renders provenance metadata for a single run.
 *
 * Every data page on Q-Shield carries this at the top. The brand promise
 * is "auditable benchmarks" — this strip is where that promise becomes
 * visible chrome. It tells the truth about its own provenance, including
 * version skew and CPU steal-time.
 */
export function AuditStrip({ run }: AuditStripProps) {
  const env = run.environment;
  const rm = run.runtime_metrics;

  const stealPct = rm
    ? computeStealPercent(rm.cpu_steal_seconds, rm.wall_clock_seconds)
    : null;
  const stealQuality = stealPct !== null ? classifyStealPercent(stealPct) : null;

  return (
    <section
      aria-label="Run provenance"
      className="border border-border rounded-md bg-bg-surface"
    >
      {/* Top row: run identity */}
      <div className="px-4 py-3 border-b border-border-subtle flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-2xs uppercase tracking-eyebrow text-fg-subtle font-medium">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent shadow-[0_0_8px_theme(colors.accent.DEFAULT)]" />
            Latest run
          </span>
          <span className="text-sm font-medium text-fg num">
            {formatRunDate(env.iso_timestamp)}
          </span>
        </div>

        <a
          href={githubCommitUrl(env.git_commit)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-mono text-fg-muted hover:text-accent transition-colors group"
        >
          <span className="text-fg-subtle">commit</span>
          <span className="text-fg">{shortSha(env.git_commit)}</span>
          <ExternalLink className="w-3 h-3 opacity-60 group-hover:opacity-100" />
        </a>
      </div>

      {/* Detail grid */}
      <dl className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-x-4 gap-y-3 px-4 py-4 text-xs">
        <Field label="CPU" value={shortCpuModel(env.cpu_model)} mono />
        <Field
          label="Instance"
          value={env.ec2_instance_type}
          suffix={
            rm?.burstable ? (
              <span className="ml-1.5 text-2xs uppercase tracking-eyebrow text-fg-subtle">
                burstable
              </span>
            ) : null
          }
        />
        <Field
          label="OS / Kernel"
          value={env.os_release.replace(/Ubuntu /, "")}
          mono
          hint={env.kernel}
        />
        <Field
          label="liboqs"
          value={env.liboqs_version}
          mono
        />

        {rm ? (
          <>
            <Field
              label="Wall clock"
              value={formatWallClock(rm.wall_clock_seconds)}
              mono
            />
            <Field
              label="CPU steal"
              value={formatStealPercent(stealPct!)}
              mono
              tone={
                stealQuality === "clean"
                  ? "ok"
                  : stealQuality === "marginal"
                    ? "warn"
                    : "err"
              }
              hint={`${rm.cpu_steal_seconds.toFixed(2)}s of ${formatWallClock(rm.wall_clock_seconds)}`}
            />
          </>
        ) : (
          <div className="col-span-2 flex items-center gap-2 text-xs text-fg-subtle">
            <AlertTriangle className="w-3 h-3 text-status-warn" />
            <span>Older run — runtime metrics unavailable.</span>
          </div>
        )}
      </dl>
    </section>
  );
}

interface FieldProps {
  label: string;
  value: string;
  mono?: boolean;
  hint?: string;
  suffix?: React.ReactNode;
  tone?: "ok" | "warn" | "err";
}

function Field({ label, value, mono, hint, suffix, tone }: FieldProps) {
  return (
    <div className="min-w-0">
      <dt className="eyebrow mb-1">{label}</dt>
      <dd className="flex items-baseline flex-wrap">
        <span
          className={cn(
            "text-fg truncate",
            mono && "font-mono tabular-nums",
            tone === "ok" && "text-status-ok",
            tone === "warn" && "text-status-warn",
            tone === "err" && "text-status-err",
          )}
          title={hint}
        >
          {value}
        </span>
        {suffix}
      </dd>
    </div>
  );
}
