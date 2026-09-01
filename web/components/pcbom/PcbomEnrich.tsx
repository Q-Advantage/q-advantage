"use client";

import { useMemo, useRef, useState } from "react";
import type { PcbomCatalog } from "@/lib/pcbom/catalog";
import {
  checkCdxStructure,
  coverageSentence,
  enrichCdxDocument,
  parseCdxText,
  type EnrichResult,
  type SkipReason,
  type StructureProblem,
} from "@/lib/pcbom/enrich";
import { ActionButton, triggerDownload } from "./shared";

/**
 * Capability 2 — upload-and-enrich.
 *
 * Everything happens in this component, in the reader's browser. There is no
 * fetch, no action, no server component in the path: an uploaded CBOM is a
 * company's real cryptographic inventory, and the way to be trustworthy about
 * it is to have no code that could send it anywhere, rather than a promise not
 * to log it.
 */

const SKIP_LABEL: Record<SkipReason, string> = {
  "not-measured": "Not in Q-Shield's measured set",
  "asset-type-out-of-scope": "Not an algorithm asset",
  "no-algorithm-identifier": "No algorithm identifier declared",
};

const SKIP_EXPLANATION: Record<SkipReason, string> = {
  "not-measured":
    "We have no measurement for this algorithm, so there is nothing honest to attach. It is listed here by name rather than dropped.",
  "asset-type-out-of-scope":
    "P-CBOM v0.1 binds to algorithm assets. Protocol assets — a whole TLS suite as one entry — are v0.2 scope, so these were left exactly as you supplied them.",
  "no-algorithm-identifier":
    "The component declares neither a parameterSetIdentifier nor a usable name, so there is nothing to match on.",
};

function ProblemList({ problems }: { problems: StructureProblem[] }) {
  return (
    <div className="rounded border border-l-[3px] border-border border-l-status-err bg-bg-card px-4 py-3">
      <div className="text-[12px] font-bold text-fg">This document was not enriched.</div>
      <ul className="mt-2 space-y-1.5">
        {problems.map((p) => (
          <li key={p.field} className="text-[12px] leading-relaxed text-fg-muted">
            <span className="num font-semibold text-fg">{p.field}</span> — {p.message}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[11.5px] leading-relaxed text-fg-subtle">
        These are structural checks, not full CycloneDX validation. P-CBOM defines an overlay on a
        CycloneDX document and deliberately does not restate that specification — validate the host
        document with{" "}
        <a
          href="https://github.com/CycloneDX/cyclonedx-cli"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-fg underline decoration-border-strong underline-offset-2 hover:text-accent"
        >
          CycloneDX&rsquo;s own tooling
        </a>
        .
      </p>
    </div>
  );
}

function Stat({ value, label, tone }: { value: string; label: string; tone?: "ok" | "muted" }) {
  return (
    <div className="min-w-0 bg-bg-surface px-4 py-4">
      <div
        className={`num text-[25px] font-bold leading-none tracking-[-0.035em] ${
          tone === "ok" ? "text-status-ok" : "text-fg"
        }`}
      >
        {value}
      </div>
      <div className="eyebrow mt-2">{label}</div>
    </div>
  );
}

export function PcbomEnrich({ catalog }: { catalog: PcbomCatalog }) {
  const [text, setText] = useState("");
  const [filename, setFilename] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [structureProblems, setStructureProblems] = useState<StructureProblem[] | null>(null);
  const [result, setResult] = useState<EnrichResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const skippedByReason = useMemo(() => {
    if (!result) return [];
    const groups = new Map<SkipReason, typeof result.summary.skipped>();
    for (const s of result.summary.skipped) {
      const list = groups.get(s.reason);
      if (list) list.push(s);
      else groups.set(s.reason, [s]);
    }
    return [...groups.entries()];
  }, [result]);

  function reset() {
    setText("");
    setFilename(null);
    setParseError(null);
    setStructureProblems(null);
    setResult(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function run(source: string) {
    setParseError(null);
    setStructureProblems(null);
    setResult(null);

    const parsed = parseCdxText(source);
    if (!parsed.ok) {
      setParseError(parsed.error);
      return;
    }

    const problems = checkCdxStructure(parsed.document);
    if (problems.length > 0) {
      setStructureProblems(problems);
      return;
    }

    setResult(enrichCdxDocument(parsed.document, catalog));
  }

  function onFile(file: File | undefined) {
    if (!file) return;
    setFilename(file.name);
    // FileReader, not an upload. The bytes never leave the machine.
    const reader = new FileReader();
    reader.onload = () => {
      const content = String(reader.result ?? "");
      setText(content);
      run(content);
    };
    reader.onerror = () => setParseError("That file could not be read.");
    reader.readAsText(file);
  }

  const enrichedCount = result?.summary.enriched.length ?? 0;
  const blocked = (result?.overlayProblems.length ?? 0) > 0;

  return (
    <div className="min-w-0 space-y-6">
      {/* ----------------------------------------------------------- input */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            onChange={(e) => onFile(e.target.files?.[0])}
            className="block max-w-full text-[12px] text-fg-muted file:mr-3 file:h-8 file:cursor-pointer file:rounded file:border file:border-border file:bg-bg-surface file:px-2.5 file:text-[12px] file:font-semibold file:text-fg-muted hover:file:border-border-strong hover:file:text-fg"
          />
          {filename && (
            <span className="num text-[11.5px] text-fg-subtle">{filename}</span>
          )}
        </div>

        <div className="text-[11px] font-bold uppercase tracking-eyebrow text-fg-subtle">
          or paste the document
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
          placeholder={'{\n  "bomFormat": "CycloneDX",\n  "specVersion": "1.6",\n  "components": [ … ]\n}'}
          className="num h-44 w-full resize-y rounded border border-border bg-bg-inset p-3 text-[12px] leading-relaxed text-fg transition-colors focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>

      {/* ------------------------------------------------------ action bar */}
      <div className="flex flex-wrap items-center gap-2 border-y border-border py-3">
        <ActionButton primary onClick={() => run(text)} disabled={!text.trim()}>
          Enrich
        </ActionButton>
        <ActionButton
          onClick={() => {
            if (!result) return;
            triggerDownload(
              new Blob([JSON.stringify(result.document, null, 2)], { type: "application/json" }),
              filename ? filename.replace(/\.json$/i, "") + ".p-cbom.json" : "enriched.p-cbom.json",
            );
          }}
          disabled={!result || blocked}
        >
          Download enriched
        </ActionButton>
        <ActionButton onClick={reset}>Reset</ActionButton>
        <span className="ml-auto text-[11px] text-fg-subtle">
          Read and rewritten in your browser. Nothing is uploaded.
        </span>
      </div>

      {parseError && (
        <div className="rounded border border-l-[3px] border-border border-l-status-err bg-bg-card px-4 py-3 text-[12px] leading-relaxed text-fg-muted">
          {parseError}
        </div>
      )}

      {structureProblems && <ProblemList problems={structureProblems} />}

      {blocked && result && (
        <div className="rounded border border-l-[3px] border-border border-l-status-err bg-bg-card px-4 py-3">
          <div className="text-[12px] font-bold text-fg">
            Download withheld — the output did not satisfy the P-CBOM overlay schema.
          </div>
          <ul className="mt-2 space-y-1">
            {result.overlayProblems.map((p) => (
              <li key={p} className="text-[12px] leading-relaxed text-fg-muted">
                {p}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11.5px] leading-relaxed text-fg-subtle">
            This is our bug, not yours. Handing back a file that fails the contract we publish would
            be worse than handing back nothing.
          </p>
        </div>
      )}

      {/* --------------------------------------------------------- summary */}
      {result && !blocked && (
        <div className="space-y-5">
          <div>
            <div className="text-[15px] font-bold text-fg">{coverageSentence(result.summary)}</div>
            <p className="mt-1 text-[12px] leading-relaxed text-fg-muted">
              Every component that was not enriched is listed below by name. Nothing is silently
              skipped, and no algorithm identity is guessed.
            </p>
          </div>

          <div className="grid gap-px overflow-hidden rounded border border-border bg-border sm:grid-cols-3">
            <Stat value={String(result.summary.componentsTotal)} label="Components in document" />
            <Stat value={String(result.summary.cryptoAssetsTotal)} label="Cryptographic assets" />
            <Stat value={String(enrichedCount)} label="Enriched" tone={enrichedCount > 0 ? "ok" : "muted"} />
          </div>

          {result.summary.enriched.length > 0 && (
            <div>
              <div className="eyebrow mb-2">Enriched</div>
              <div className="overflow-hidden rounded border border-border">
                {result.summary.enriched.map((e) => (
                  <div
                    key={`${e.componentName}-${e.matchedAlgorithm}`}
                    className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-border-subtle px-4 py-2.5 last:border-b-0"
                  >
                    <span className="num text-[13px] font-semibold text-fg">{e.componentName}</span>
                    <span className="text-[11.5px] text-fg-muted">
                      matched <span className="num font-semibold text-fg">{e.matchedAlgorithm}</span> ·{" "}
                      {e.operation} · {e.propertiesAdded} properties
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[11.5px] leading-relaxed text-fg-subtle">
                A CycloneDX cryptographic asset names an algorithm; Q-Shield measures one operation
                at a time. Each row carries the representative operation &mdash; encapsulation for a
                KEM, signing for a signature &mdash; and the attached{" "}
                <code className="num">measurement_id</code> says which.
              </p>
            </div>
          )}

          {skippedByReason.map(([reason, items]) => (
            <div key={reason}>
              <div className="eyebrow mb-2">
                {SKIP_LABEL[reason]} · {items.length}
              </div>
              <div className="overflow-hidden rounded border border-border">
                {items.map((s, i) => (
                  <div
                    key={`${s.componentName}-${i}`}
                    className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-border-subtle px-4 py-2.5 last:border-b-0"
                  >
                    <span className="num text-[13px] font-semibold text-fg">{s.componentName}</span>
                    <span className="num text-[11.5px] text-fg-subtle">
                      {s.assetType ? `assetType: ${s.assetType}` : (s.identifier ?? "no identifier")}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[11.5px] leading-relaxed text-fg-subtle">
                {SKIP_EXPLANATION[reason]}
              </p>
            </div>
          ))}

          <div className="border-t border-border-subtle pt-3">
            <div className="eyebrow mb-1.5">What could be matched</div>
            <p className="text-[11.5px] leading-relaxed text-fg-muted">
              Q-Shield measures{" "}
              <span className="num font-semibold text-fg">
                {result.summary.measuredAlgorithms.join(", ")}
              </span>{" "}
              on {catalog.arch} today. Matching is exact: a document naming{" "}
              <code className="num">Kyber768</code> is reported as unmatched rather than treated as{" "}
              <code className="num">ML-KEM-768</code>, because deciding those are the same thing on
              your inventory is a claim we would need a source for.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
