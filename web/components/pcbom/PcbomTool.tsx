"use client";

import { useMemo, useState } from "react";
import type { PcbomCatalogEntry } from "@/lib/pcbom/catalog";
import { Caveat } from "@/components/product/kit";
import { ActionButton, inputClass, triggerDownload } from "./shared";

const OP_LABEL: Record<string, string> = {
  keygen: "Key generation",
  sign: "Sign",
  verify: "Verify",
  encaps: "Encapsulate",
  decaps: "Decapsulate",
};

export function PcbomTool({ entries, arch }: { entries: PcbomCatalogEntry[]; arch: string }) {
  const algorithms = useMemo(() => {
    const seen = new Map<string, { id: string; name: string; family: string }>();
    for (const e of entries) {
      if (!seen.has(e.algorithmId)) seen.set(e.algorithmId, { id: e.algorithmId, name: e.algorithmName, family: e.family });
    }
    return [...seen.values()];
  }, [entries]);

  const [algorithmId, setAlgorithmId] = useState(algorithms[0]?.id ?? "");
  const opsForAlgorithm = useMemo(
    () => entries.filter((e) => e.algorithmId === algorithmId).map((e) => e.operation),
    [entries, algorithmId],
  );
  const [operation, setOperation] = useState(opsForAlgorithm[0] ?? "");
  const [form, setForm] = useState<"native" | "cdx">("native");
  const [copied, setCopied] = useState(false);

  const entry =
    entries.find((e) => e.algorithmId === algorithmId && e.operation === operation) ??
    entries.find((e) => e.algorithmId === algorithmId) ??
    entries[0];

  function onAlgorithmChange(id: string) {
    setAlgorithmId(id);
    const nextOps = entries.filter((e) => e.algorithmId === id).map((e) => e.operation);
    if (!nextOps.includes(operation)) setOperation(nextOps[0] ?? "");
  }

  if (!entry) {
    return (
      <Caveat label="No data">
        Q-Shield&rsquo;s current run has no algorithm measurements in a shape this tool can emit yet.
      </Caveat>
    );
  }

  const record = form === "native" ? entry.native : entry.cdx;
  const json = JSON.stringify(record, null, 2);
  const filename = `${entry.algorithmId}-${entry.operation}.${form === "cdx" ? "cdx." : ""}p-cbom.json`;
  const perf = entry.native.performance;

  return (
    <div className="min-w-0 space-y-6">
      {/* -------------------------------------------------------- picker */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="min-w-0 space-y-1.5">
          <span className="text-[11px] font-bold uppercase tracking-eyebrow text-fg-subtle">Algorithm</span>
          <select className={inputClass} value={algorithmId} onChange={(e) => onAlgorithmChange(e.target.value)}>
            {algorithms.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-0 space-y-1.5">
          <span className="text-[11px] font-bold uppercase tracking-eyebrow text-fg-subtle">Operation</span>
          <select className={inputClass} value={operation} onChange={(e) => setOperation(e.target.value)}>
            {opsForAlgorithm.map((op) => (
              <option key={op} value={op}>
                {OP_LABEL[op] ?? op}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-0 space-y-1.5">
          <span className="text-[11px] font-bold uppercase tracking-eyebrow text-fg-subtle">Form</span>
          <div className="flex h-9 overflow-hidden rounded border border-border">
            {(["native", "cdx"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setForm(f)}
                className={`flex-1 text-[12.5px] font-bold transition-colors ${
                  form === f ? "bg-accent/15 text-fg" : "bg-bg-surface text-fg-muted hover:text-fg"
                }`}
              >
                {f === "native" ? "Native" : "CycloneDX"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ----------------------------------------------------- action bar */}
      <div className="flex flex-wrap items-center gap-2 border-y border-border py-3">
        <ActionButton
          primary
          onClick={() => {
            navigator.clipboard.writeText(json);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? "Copied" : "Copy JSON"}
        </ActionButton>
        <ActionButton onClick={() => triggerDownload(new Blob([json], { type: "application/json" }), filename)}>
          Download
        </ActionButton>
        <span className="ml-auto text-[11px] text-fg-subtle">
          Generated in your browser from real Q-Shield data — nothing you enter here is sent anywhere.
        </span>
      </div>

      {/* -------------------------------------------------------- record */}
      <div className="overflow-hidden rounded border border-border">
        <pre className="num max-h-[520px] overflow-auto bg-bg-inset p-4 text-[12px] leading-relaxed text-fg">
          {json}
        </pre>
      </div>

      {/* ----------------------------------------------------- citation */}
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-t border-border-subtle pt-3 text-[11.5px] text-fg-muted">
        <span>
          Source: <span className="font-semibold text-fg">{perf.source}</span>
        </span>
        <span>
          Measured: <span className="num font-semibold text-fg">{perf.last_measured}</span>
        </span>
        <span>
          Commit:{" "}
          <a
            href={`https://github.com/Q-Advantage/q-advantage/commit/${perf.commit}`}
            target="_blank"
            rel="noopener noreferrer"
            className="num font-semibold text-fg underline decoration-border-strong underline-offset-2 hover:text-accent"
          >
            {perf.commit}
          </a>
        </span>
        <a
          href={perf.ref_url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-fg underline decoration-border-strong underline-offset-2 hover:text-accent"
        >
          Raw measurement file ↗
        </a>
      </div>

      <p className="text-[11px] text-fg-subtle">
        Architecture: <span className="num font-semibold">{arch}</span>. Only algorithms Q-Shield has
        actually measured on this architecture appear above — nothing here is interpolated or guessed.
      </p>
    </div>
  );
}
