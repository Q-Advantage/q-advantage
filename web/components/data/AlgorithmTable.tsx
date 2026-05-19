import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { NormalizedAlgorithm, Operation } from "@/lib/data/types";
import { formatBytes, formatDuration, formatOpsPerSec } from "@/lib/format";
import { cn } from "@/lib/cn";

interface AlgorithmTableProps {
  title: string;
  caption: string;
  algorithms: NormalizedAlgorithm[];
  /** Operations to render as row groups */
  operations: Operation[];
}

/**
 * Dense table rendering all operations for a list of algorithms.
 * One row per (algorithm, operation) pair — same shape as a Bloomberg
 * matrix, scan-readable.
 */
export function AlgorithmTable({
  title,
  caption,
  algorithms,
  operations,
}: AlgorithmTableProps) {
  return (
    <section className="border border-border rounded-md bg-bg-surface overflow-hidden">
      <header className="px-4 py-3 border-b border-border flex items-baseline justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold text-fg">{title}</h2>
          <p className="text-2xs text-fg-subtle mt-0.5">{caption}</p>
        </div>
        <div className="eyebrow">
          {algorithms.length} algorithm{algorithms.length === 1 ? "" : "s"}
        </div>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full text-xs min-w-[680px]">
          <thead>
            <tr className="border-b border-border-subtle text-left">
              <Th className="w-[18%]">Algorithm</Th>
              <Th className="w-[10%]">Op</Th>
              <Th className="w-[12%]" align="right">Mean</Th>
              <Th className="w-[12%]" align="right">p95</Th>
              <Th className="w-[12%]" align="right">p99</Th>
              <Th className="w-[14%]" align="right">Ops/sec</Th>
              <Th className="w-[10%]" align="right">Pub key</Th>
              <Th className="w-[12%]" align="right">
                {operations.includes("encap") ? "Ciphertext" : "Signature"}
              </Th>
            </tr>
          </thead>
          <tbody>
            {algorithms.map((algo, algoIdx) => (
              <AlgorithmRows
                key={algo.id}
                algo={algo}
                operations={operations}
                isLast={algoIdx === algorithms.length - 1}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AlgorithmRows({
  algo,
  operations,
  isLast,
}: {
  algo: NormalizedAlgorithm;
  operations: Operation[];
  isLast: boolean;
}) {
  return (
    <>
      {operations.map((op, opIdx) => {
        const stats = algo.operations[op];
        if (!stats) return null;
        const isFirst = opIdx === 0;
        const isLastOp = opIdx === operations.length - 1;
        return (
          <tr
            key={`${algo.id}-${op}`}
            className={cn(
              "group relative hover:bg-bg-elevated transition-colors",
              !isLastOp && "border-b border-border-subtle/40",
              isLastOp && !isLast && "border-b border-border-subtle",
            )}
          >
            <Td>
              {isFirst ? (
                <span className="inline-flex items-center gap-1 font-medium text-fg group-hover:text-accent transition-colors relative z-[1]">
                  <span>{algo.display_name}</span>
                  <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity" />
                </span>
              ) : (
                <span className="text-fg-faint">″</span>
              )}
              {/*
                Stretched link: this anchor fills the entire row via absolute
                positioning on a transformed ancestor (the <tr> is `relative`).
                Clicking anywhere in the row navigates; the visible algorithm
                name is the accessible label. Server-component safe.
              */}
              <Link
                href={`/q-shield/${algo.id}`}
                className="absolute inset-0 z-0 cursor-pointer"
                aria-label={`View ${algo.display_name} details`}
              >
                <span className="sr-only">{algo.display_name}</span>
              </Link>
            </Td>
            <Td>
              <span className="font-mono text-fg-muted uppercase text-2xs tracking-wider">
                {op}
              </span>
            </Td>
            <Td align="right" mono>
              <span className="text-fg">{formatDuration(stats.mean_us)}</span>
            </Td>
            <Td align="right" mono>
              <span className="text-fg-muted">{formatDuration(stats.p95_us)}</span>
            </Td>
            <Td align="right" mono>
              <span className="text-fg-muted">{formatDuration(stats.p99_us)}</span>
            </Td>
            <Td align="right" mono>
              <span className="text-fg">{formatOpsPerSec(stats.ops_per_sec)}</span>
            </Td>
            <Td align="right" mono>
              {isFirst && <span className="text-fg-muted">{formatBytes(algo.pubkey_bytes)}</span>}
            </Td>
            <Td align="right" mono>
              {isFirst && (
                <span className="text-fg-muted">
                  {algo.kind === "kem"
                    ? formatBytes(algo.ciphertext_bytes!)
                    : formatBytes(algo.signature_bytes!)}
                </span>
              )}
            </Td>
          </tr>
        );
      })}
    </>
  );
}

function Th({
  children,
  className,
  align = "left",
}: {
  children: React.ReactNode;
  className?: string;
  align?: "left" | "right";
}) {
  return (
    <th
      className={cn(
        "px-4 py-2.5 eyebrow font-medium",
        align === "right" && "text-right",
        className,
      )}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align = "left",
  mono,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  mono?: boolean;
}) {
  return (
    <td
      className={cn(
        "px-4 py-2.5",
        align === "right" && "text-right",
        mono && "font-mono tabular-nums",
      )}
    >
      {children}
    </td>
  );
}
