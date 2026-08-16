"use client";
// web/components/calculator/CalculatorView.tsx
//
// The PQC Migration Cost Calculator.
//
// Structure follows ClusterMAX's TCO calculator, which the founder named as
// the bar: one continuous vertical flow — action bar, inputs grouped by
// category, then the result, then the formulae, then the references. No
// sidebar, no split attention. The reader is walked from "what am I
// comparing" to "what does it cost" to "how was that worked out", in that
// order, and the dollar figure arrives AFTER they have described their
// traffic rather than before.
//
// The discipline this surface has to keep, being the first here that computes
// rather than reports: every figure shows where it came from — Measured /
// Public default / Bounded estimate / Your input, on the field itself.
//
// Layout note: every flex/grid child that can hold long text carries `min-w-0`
// and every URL wraps. Without it the source list and the attribution bar
// pushed the page into horizontal scroll.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import type { ComposedSuite } from "@/lib/protocols/types";
import {
  ARCHETYPES,
  CLIFF_NOTE,
  EGRESS_GB,
  HORIZONS,
  PROVENANCE_LABEL,
  SESSION_REUSE,
  STATIC_REFERENCES,
  VCPU_HOUR,
  type Citation,
  type Provenance,
} from "@/lib/calculator/defaults";
import { formatCount, formatUsd, runScenario, type ScenarioInputs } from "@/lib/calculator/model";
import { DataTable, RowName, Tag, Caveat } from "@/components/product/kit";
import { formatBytes, formatDuration, githubChecksUrl } from "@/lib/format";

const SUITE_DISPLAY: Record<string, string> = {
  X25519: "X25519",
  X25519MLKEM768: "X25519 + ML-KEM-768",
  SecP256r1MLKEM768: "P-256 + ML-KEM-768",
  MLKEM768: "ML-KEM-768",
};

const SUITE_KIND: Record<string, string> = {
  X25519: "Classical",
  X25519MLKEM768: "Hybrid",
  SecP256r1MLKEM768: "Hybrid",
  MLKEM768: "PQC-only",
};

const SUITE_BLURB: Record<string, string> = {
  X25519: "What you almost certainly run today.",
  X25519MLKEM768: "The standard migration path — classical and post-quantum together.",
  SecP256r1MLKEM768: "The same idea on a P-256 base, for estates standardised on NIST curves.",
  MLKEM768: "Post-quantum alone. Faster, but no classical fallback if ML-KEM is ever broken.",
};

const STORAGE_KEY = "qadv.calculator.saved.v1";

export interface CalculatorData {
  byArch: Record<string, Record<string, ComposedSuite>>;
  runCommit: string;
  runDate: string;
  liboqsVersion: string;
  cpuModel: string;
}

interface SavedScenario {
  name: string;
  query: string;
  savedAt: string;
}

/* ----------------------------------------------------------- small parts */

function ProvenanceTag({ p }: { p: Provenance }) {
  const tone =
    p === "measured"
      ? "text-status-ok border-status-ok/40"
      : p === "customer-input"
        ? "text-accent border-accent/40"
        : "text-fg-subtle border-border";
  return (
    <span
      className={`shrink-0 rounded border px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-eyebrow ${tone}`}
    >
      {PROVENANCE_LABEL[p]}
    </span>
  );
}

function CiteLink({ c }: { c: Citation }) {
  return (
    <span className="block min-w-0 text-[11px] leading-relaxed text-fg-subtle">
      <a
        href={c.url}
        target="_blank"
        rel="noopener noreferrer"
        className="break-words underline decoration-border-strong underline-offset-2 hover:text-accent"
      >
        {c.text}
      </a>{" "}
      <span className="num whitespace-nowrap">({c.retrieved})</span>
      {c.caveat && <span className="mt-0.5 block break-words text-fg-subtle/90">{c.caveat}</span>}
    </span>
  );
}

/** A numbered step — the guide rail, so the reader always knows where they are. */
function Step({
  n,
  title,
  lede,
  accent,
  children,
}: {
  n: number;
  title: string;
  lede: string;
  accent?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className={accent ? "border-t-2 border-accent/40 pt-6" : "border-t border-border pt-6"}>
      <div className="mb-4 flex items-start gap-3">
        <span
          className={`num mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[12px] font-bold text-fg ${
            accent ? "border-accent bg-accent/10" : "border-border-strong"
          }`}
        >
          {n}
        </span>
        <div className="min-w-0">
          <h2 className="text-[17px] font-bold tracking-[-0.02em] text-fg">{title}</h2>
          <p className="mt-0.5 max-w-[70ch] text-[13px] leading-relaxed text-fg-muted">{lede}</p>
        </div>
      </div>
      <div className="min-w-0 sm:pl-9">{children}</div>
    </section>
  );
}

function Field({
  label,
  provenance,
  hint,
  children,
}: {
  label: string;
  provenance: Provenance;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0 space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-bold uppercase tracking-eyebrow text-fg-subtle">{label}</span>
        <ProvenanceTag p={provenance} />
      </div>
      {children}
      {hint && <span className="block text-[11px] leading-relaxed text-fg-subtle">{hint}</span>}
    </div>
  );
}

const inputClass =
  "h-9 w-full min-w-0 rounded border border-border bg-bg-surface px-2.5 text-[13px] font-semibold text-fg " +
  "num transition-colors hover:border-border-strong focus:outline-none focus:ring-1 focus:ring-accent";

function ActionButton({
  onClick,
  children,
  primary,
}: {
  onClick: () => void;
  children: React.ReactNode;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-8 shrink-0 rounded border px-2.5 text-[12px] font-semibold transition-colors ${
        primary
          ? "border-accent bg-accent/10 text-fg hover:bg-accent/20"
          : "border-border bg-bg-surface text-fg-muted hover:border-border-strong hover:text-fg"
      }`}
    >
      {children}
    </button>
  );
}

/* --------------------------------------------- attribution (responsive) */

function AttributionChart({
  cpuShare,
  egressShare,
  cpuUsd,
  egressUsd,
  svgRef,
}: {
  cpuShare: number;
  egressShare: number;
  cpuUsd: number;
  egressUsd: number;
  svgRef: React.RefObject<SVGSVGElement>;
}) {
  const cpuPct = Math.round(cpuShare * 100);
  const egressPct = 100 - cpuPct;

  return (
    <div className="min-w-0 space-y-3">
      {/* viewBox + preserveAspectRatio="none" + w-full: scales to the column at
          any width. A fixed-width SVG here pushed the page into h-scroll. */}
      <svg
        ref={svgRef}
        viewBox="0 0 100 6"
        preserveAspectRatio="none"
        className="h-6 w-full rounded-sm"
        role="img"
        aria-label={`${cpuPct}% of the difference is CPU time, ${egressPct}% is bytes on the wire`}
      >
        <rect x="0" y="0" width="100" height="6" fill="rgb(var(--color-bg-inset))" />
        <rect x="0" y="0" width={Math.max(0, cpuShare * 100)} height="6" fill="rgb(var(--color-series-1))" />
        <rect
          x={Math.max(0, cpuShare * 100) + 0.4}
          y="0"
          width={Math.max(0, egressShare * 100 - 0.4)}
          height="6"
          fill="rgb(var(--color-series-2))"
        />
      </svg>

      <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
        {[
          {
            label: "CPU time",
            pct: cpuPct,
            usd: cpuUsd,
            series: 1,
            why: "Extra microseconds per handshake, billed as compute.",
          },
          {
            label: "Bytes on the wire",
            pct: egressPct,
            usd: egressUsd,
            series: 2,
            why: "A bigger key exchange, billed as egress.",
          },
        ].map((row) => (
          <div key={row.label} className="flex min-w-0 items-baseline gap-2">
            <span
              aria-hidden
              className="mt-1 h-2 w-2 shrink-0 rounded-[1px]"
              style={{ background: `rgb(var(--color-series-${row.series}))` }}
            />
            <span className="min-w-0 flex-1">
              <span className="block text-[12.5px] font-bold text-fg">
                {row.label} — {row.pct}%
              </span>
              <span className="block text-[11px] leading-relaxed text-fg-subtle">{row.why}</span>
            </span>
            <span className="num shrink-0 text-[12.5px] font-bold text-fg">{formatUsd(row.usd)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ main */

export function CalculatorView({ data }: { data: CalculatorData }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const svgRef = useRef<SVGSVGElement>(null);

  const arches = Object.keys(data.byArch);
  const [arch, setArch] = useState(arches.includes("x86_64") ? "x86_64" : arches[0]);
  const suites = useMemo(() => data.byArch[arch] ?? {}, [data.byArch, arch]);
  const suiteNames = useMemo(() => Object.keys(suites), [suites]);

  const [selected, setSelected] = useState<string[]>(() =>
    ["X25519", "X25519MLKEM768"].filter((s) => suiteNames.includes(s)),
  );
  const [archetypeId, setArchetypeId] = useState(ARCHETYPES[0].id);

  // Numeric fields are DRAFT until Calculate (or Enter) is pressed. Discrete
  // choices — suites, architecture, archetype, horizon — apply immediately,
  // because a dropdown that needs a second confirmation click reads as broken.
  // The split exists because a figure that changes while you are still typing
  // a number is not obviously a figure you asked for.
  const [draftHs, setDraftHs] = useState(ARCHETYPES[0].perSecond ?? 1500);
  const [draftReuse, setDraftReuse] = useState(SESSION_REUSE.value);
  const [draftVcpu, setDraftVcpu] = useState(VCPU_HOUR.value);
  const [draftEgress, setDraftEgress] = useState(EGRESS_GB.value);

  const [hsPerSec, setHsPerSec] = useState(ARCHETYPES[0].perSecond ?? 1500);
  const [reuse, setReuse] = useState(SESSION_REUSE.value);
  const [vcpu, setVcpu] = useState(VCPU_HOUR.value);
  const [egress, setEgress] = useState(EGRESS_GB.value);
  const [horizonId, setHorizonId] = useState(HORIZONS[0].id);
  const [saved, setSaved] = useState<SavedScenario[]>([]);

  const archetype = ARCHETYPES.find((a) => a.id === archetypeId) ?? ARCHETYPES[0];
  const horizon = HORIZONS.find((h) => h.id === horizonId) ?? HORIZONS[0];

  useEffect(() => {
    const p = searchParams;
    // Read only params actually present. Number(null) is 0, which would
    // silently replace a cited default with zero.
    const num = (k: string, fallback: number, min = 0, max = Infinity) => {
      const raw = p.get(k);
      if (raw === null || raw === "") return fallback;
      const v = Number(raw);
      return Number.isFinite(v) && v >= min && v <= max ? v : fallback;
    };
    const a = p.get("arch");
    if (a && arches.includes(a)) setArch(a);
    const s = p.get("suites");
    if (s) {
      const ids = s.split(",").filter((x) => suiteNames.includes(x));
      if (ids.length) setSelected(ids);
    }
    const arc = p.get("archetype");
    if (arc && ARCHETYPES.some((x) => x.id === arc)) setArchetypeId(arc);
    setHsPerSec((v) => { const n = num("hs", v); setDraftHs(n); return n; });
    setReuse((v) => { const n = num("reuse", v, 0, 100); setDraftReuse(n); return n; });
    setVcpu((v) => { const n = num("vcpu", v); setDraftVcpu(n); return n; });
    setEgress((v) => { const n = num("egress", v); setDraftEgress(n); return n; });
    const h = p.get("horizon");
    if (h && HORIZONS.some((x) => x.id === h)) setHorizonId(h);

    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setSaved(JSON.parse(raw) as SavedScenario[]);
    } catch {
      /* localStorage unavailable — saving is a convenience, never required */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const query = useMemo(
    () =>
      new URLSearchParams({
        arch,
        suites: selected.join(","),
        archetype: archetypeId,
        hs: String(hsPerSec),
        reuse: String(reuse),
        vcpu: String(vcpu),
        egress: String(egress),
        horizon: horizonId,
      }).toString(),
    [arch, selected, archetypeId, hsPerSec, reuse, vcpu, egress, horizonId],
  );

  // Update the address bar WITHOUT going through the router.
  //
  // router.replace() re-renders the route on every call. On this force-static
  // page that meant every keystroke and every suite click kicked off a render
  // pass that fought the component's own state — selections looked inert and
  // typed values did not take. history.replaceState keeps the URL shareable
  // with none of that.
  useEffect(() => {
    window.history.replaceState(null, "", `${pathname}?${query}`);
  }, [query, pathname]);

  const inputs: ScenarioInputs = useMemo(
    () => ({
      handshakesPerSecond: hsPerSec,
      sessionReusePct: reuse,
      vcpuHourUsd: vcpu,
      egressGbUsd: egress,
      months: horizon.months,
    }),
    [hsPerSec, reuse, vcpu, egress, horizon.months],
  );
  const result = useMemo(() => runScenario(selected, suites, inputs), [selected, suites, inputs]);

  function toggleSuite(name: string) {
    setSelected((cur) =>
      cur.includes(name) ? (cur.length > 1 ? cur.filter((s) => s !== name) : cur) : [...cur, name],
    );
  }

  function applyArchetype(id: string) {
    setArchetypeId(id);
    const a = ARCHETYPES.find((x) => x.id === id);
    const next = a?.perSecond ?? a?.range?.low;
    if (next != null) {
      setHsPerSec(next);
      setDraftHs(next);
    }
  }

  const reset = useCallback(() => {
    setArch(arches.includes("x86_64") ? "x86_64" : arches[0]);
    setSelected(["X25519", "X25519MLKEM768"].filter((s) => suiteNames.includes(s)));
    setArchetypeId(ARCHETYPES[0].id);
    const hs = ARCHETYPES[0].perSecond ?? 1500;
    setHsPerSec(hs); setDraftHs(hs);
    setReuse(SESSION_REUSE.value); setDraftReuse(SESSION_REUSE.value);
    setVcpu(VCPU_HOUR.value); setDraftVcpu(VCPU_HOUR.value);
    setEgress(EGRESS_GB.value); setDraftEgress(EGRESS_GB.value);
    setHorizonId(HORIZONS[0].id);
  }, [arches, suiteNames]);

  const dirty =
    draftHs !== hsPerSec || draftReuse !== reuse || draftVcpu !== vcpu || draftEgress !== egress;

  const applyDraft = useCallback(() => {
    setHsPerSec(draftHs);
    setReuse(draftReuse);
    setVcpu(draftVcpu);
    setEgress(draftEgress);
  }, [draftHs, draftReuse, draftVcpu, draftEgress]);

  /** Enter anywhere in the input steps calculates, like any form. */
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      applyDraft();
    }
  }

  function copyLink() {
    void navigator.clipboard?.writeText(`${window.location.origin}${pathname}?${query}`);
  }

  function saveScenario() {
    const name = window.prompt("Name this scenario", `${archetype.label} — ${horizon.label}`);
    if (!name) return;
    const next = [
      { name, query, savedAt: new Date().toISOString().slice(0, 10) },
      ...saved.filter((s) => s.name !== name),
    ].slice(0, 12);
    setSaved(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* the URL already holds the whole scenario */
    }
  }

  function downloadJson() {
    const payload = {
      generated_utc: new Date().toISOString(),
      note: "Computed from measured Q-Shield handshakes and cited public defaults. Nothing here is interpolated.",
      run: { commit: data.runCommit, date: data.runDate, url: githubChecksUrl(data.runCommit) },
      inputs: { ...inputs, architecture: arch, archetype: archetype.label, suites: selected },
      results: result,
      sources: STATIC_REFERENCES,
    };
    triggerDownload(
      new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }),
      "pqc-migration-cost-scenario.json",
    );
  }

  function downloadPng() {
    const svg = svgRef.current;
    if (!svg) return;
    const style = getComputedStyle(document.documentElement);
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("width", "1200");
    clone.setAttribute("height", "72");
    clone.querySelectorAll<SVGElement>("*").forEach((el) => {
      const v = el.getAttribute("fill");
      if (v?.startsWith("rgb(var(")) {
        const token = v.slice(v.indexOf("--"), v.indexOf(")"));
        el.setAttribute("fill", `rgb(${style.getPropertyValue(token).trim()})`);
      }
    });
    const src = new XMLSerializer().serializeToString(clone);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 1200;
      canvas.height = 72;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((b) => b && triggerDownload(b, "pqc-migration-cost-attribution.png"));
    };
    img.src = `data:image/svg+xml;base64,${window.btoa(unescape(encodeURIComponent(src)))}`;
  }

  const headline = result.headline;
  const topSuite = result.suites.find((s) => s.name === headline?.suiteName);
  const baseSuite = result.suites.find((s) => s.isBaseline);
  const cliffTriggered = result.suites.some((s) => (s.bytesTotal ?? 0) > CLIFF_NOTE.approxThresholdBytes);

  return (
    <div className="min-w-0 space-y-10">
      {/* ------------------------------------------------------ action bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-4">
        <ActionButton onClick={copyLink} primary>
          Copy link
        </ActionButton>
        <ActionButton onClick={saveScenario}>Save</ActionButton>
        {saved.length > 0 && (
          <select
            className="h-8 shrink-0 rounded border border-border bg-bg-surface px-2 text-[12px] font-semibold text-fg-muted"
            value=""
            onChange={(e) => e.target.value && (window.location.search = e.target.value)}
          >
            <option value="">Load saved… ({saved.length})</option>
            {saved.map((s) => (
              <option key={s.name} value={s.query}>
                {s.name} · {s.savedAt}
              </option>
            ))}
          </select>
        )}
        <ActionButton onClick={reset}>Reset</ActionButton>
        <ActionButton onClick={downloadJson}>JSON</ActionButton>
        <ActionButton onClick={downloadPng}>PNG</ActionButton>
        <span className="ml-auto text-[11px] text-fg-subtle">
          No signup. Every input is in the URL — the link is the scenario.
        </span>
      </div>

      {/* ------------------------------------------------------ 1 · suites */}
      <Step
        n={1}
        title="What are you comparing?"
        lede="Pick the key exchange you run today and the one you are considering. Every timing here is measured on real hardware — not modelled, not vendor-supplied."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {suiteNames.map((name) => {
            const on = selected.includes(name);
            return (
              <button
                key={name}
                type="button"
                onClick={() => toggleSuite(name)}
                aria-pressed={on}
                className={`min-w-0 rounded border px-3.5 py-3 text-left transition-colors ${
                  on ? "border-accent bg-accent/5" : "border-border bg-bg-surface hover:border-border-strong"
                }`}
              >
                <span className="flex flex-wrap items-center gap-2">
                  <span
                    aria-hidden
                    className={`h-3.5 w-3.5 shrink-0 rounded-sm border ${
                      on ? "border-accent bg-accent" : "border-border-strong"
                    }`}
                  />
                  <span className="num text-[13px] font-bold text-fg">{SUITE_DISPLAY[name] ?? name}</span>
                  <Tag>{SUITE_KIND[name] ?? "Suite"}</Tag>
                </span>
                <span className="mt-1 block text-[11.5px] leading-relaxed text-fg-muted">
                  {SUITE_BLURB[name] ?? "Measured composed key exchange."}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-4 max-w-xs">
          <Field
            label="CPU architecture"
            provenance="measured"
            hint="Chosen once — the timings and the pricing lookup both use it."
          >
            <select className={inputClass} value={arch} onChange={(e) => setArch(e.target.value)}>
              {arches.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </Step>

      {/* ----------------------------------------------------- 2 · traffic */}
      <Step
        n={2}
        title="How much traffic do you handle?"
        lede="Only handshakes that run a full key exchange cost anything — resumed sessions skip it entirely. This is the biggest lever on the figure in step 4."
      >
        <div className="grid gap-5 sm:grid-cols-3" onKeyDown={onKeyDown}>
          <Field label="Workload archetype" provenance={archetype.provenance} hint={archetype.note}>
            <select className={inputClass} value={archetypeId} onChange={(e) => applyArchetype(e.target.value)}>
              {ARCHETYPES.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Handshakes / second"
            provenance="customer-input"
            hint={
              archetype.range
                ? `Cited range ${archetype.range.low.toLocaleString()}–${archetype.range.high.toLocaleString()}/sec. Use your own.`
                : "The default is a cited industry example, not you. Change it."
            }
          >
            <input
              type="number"
              min={0}
              className={inputClass}
              value={draftHs}
              onChange={(e) => setDraftHs(Math.max(0, Number(e.target.value)))}
            />
          </Field>

          <Field
            label="Session reuse %"
            provenance={SESSION_REUSE.provenance}
            hint="Reuse hides this cost; churn exposes it."
          >
            <input
              type="number"
              min={0}
              max={100}
              className={inputClass}
              value={draftReuse}
              onChange={(e) => setDraftReuse(Math.min(100, Math.max(0, Number(e.target.value))))}
            />
          </Field>
        </div>

        <div className="mt-4 grid min-w-0 gap-3 lg:grid-cols-2">
          <CiteLink c={archetype.citation} />
          <CiteLink c={SESSION_REUSE.citation} />
        </div>
      </Step>

      {/* ------------------------------------------------------- 3 · rates */}
      <Step
        n={3}
        title="What do you pay for compute and bandwidth?"
        lede="Defaults are AWS list prices. If you have negotiated rates, put them in — the answer moves with them. Press Enter or Calculate to apply."
      >
        <div className="grid gap-5 sm:grid-cols-3" onKeyDown={onKeyDown}>
          <Field label="$ / vCPU-hour" provenance={VCPU_HOUR.provenance}>
            <input
              type="number"
              step="0.0001"
              min={0}
              className={inputClass}
              value={draftVcpu}
              onChange={(e) => setDraftVcpu(Math.max(0, Number(e.target.value)))}
            />
          </Field>
          <Field label="$ / GB egress" provenance={EGRESS_GB.provenance}>
            <input
              type="number"
              step="0.001"
              min={0}
              className={inputClass}
              value={draftEgress}
              onChange={(e) => setDraftEgress(Math.max(0, Number(e.target.value)))}
            />
          </Field>
          <Field label="Over what period" provenance="customer-input">
            <select className={inputClass} value={horizonId} onChange={(e) => setHorizonId(e.target.value)}>
              {HORIZONS.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3 rounded border border-border bg-bg-surface px-4 py-3">
          <button
            type="button"
            onClick={applyDraft}
            className={`inline-flex h-10 items-center rounded border px-4 text-[13.5px] font-bold transition-colors ${
              dirty
                ? "border-accent bg-accent/15 text-fg hover:bg-accent/25"
                : "border-border bg-bg-inset text-fg-muted"
            }`}
          >
            Calculate →
          </button>
          <span className="min-w-0 text-[12px] leading-relaxed text-fg-subtle">
            {dirty
              ? "You have unapplied changes — press Calculate or hit Enter to update the figures below."
              : "The figures below match the inputs above."}
          </span>
        </div>

        <div className="mt-4 grid min-w-0 gap-3 lg:grid-cols-2">
          <CiteLink c={VCPU_HOUR.citation} />
          <CiteLink c={EGRESS_GB.citation} />
        </div>
      </Step>

      {/* ------------------------------------------------------ 4 · answer */}
      <Step n={4} accent title="What it costs" lede="Your traffic, your rates, our measurements.">
        {headline && baseSuite && topSuite ? (
          <div className="min-w-0 space-y-6">
            <div className="rounded border border-border bg-bg-surface px-5 py-6">
              <div className="text-[11px] font-bold uppercase tracking-eyebrow text-fg-subtle">
                Moving to {SUITE_DISPLAY[headline.suiteName] ?? headline.suiteName} · {horizon.label}
              </div>
              <div className="mt-1 flex flex-wrap items-baseline gap-x-3">
                <span className="num text-[clamp(32px,5vw,52px)] font-bold leading-none tracking-[-0.03em] text-fg">
                  {formatUsd(headline.deltaUsd)}
                </span>
                <span className="text-[15px] font-bold text-fg-muted">
                  {horizon.months === 1 ? "per month" : `total over ${horizon.label.toLowerCase()}`}
                </span>
              </div>
              {horizon.months !== 1 && (
                <p className="num mt-1 text-[13px] font-semibold text-fg-muted">
                  ≈ {formatUsd(headline.deltaUsd / horizon.months)} per month
                </p>
              )}
              <p className="mt-3 max-w-[70ch] text-[14px] leading-relaxed text-fg-muted">
                {headline.deltaUsd >= 0 ? "more" : "less"} than{" "}
                {SUITE_DISPLAY[result.baselineName ?? ""] ?? result.baselineName}, at{" "}
                <span className="num font-bold text-fg">
                  {formatCount(result.effectiveHandshakesPerSecond)}
                </span>{" "}
                full handshakes/sec — {formatCount(result.handshakesOverHorizon)} handshakes over{" "}
                {horizon.label.toLowerCase()}.
              </p>
              <p className="mt-2 max-w-[70ch] text-[12.5px] leading-relaxed text-fg-subtle">
                {formatUsd(baseSuite.totalUsd)} today against {formatUsd(topSuite.totalUsd)} after
                {topSuite.multiplier ? ` — a ${topSuite.multiplier.toFixed(2)}× change` : ""}.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {[
                {
                  k: "Recurring, not one-off",
                  v: `${formatUsd(headline.deltaUsd / horizon.months)}/month`,
                  d: "This is an ongoing operating cost for as long as the traffic runs, not a migration project fee.",
                },
                {
                  k: "Per million handshakes",
                  v: formatUsd(
                    result.handshakesOverHorizon > 0
                      ? (headline.deltaUsd / result.handshakesOverHorizon) * 1_000_000
                      : 0,
                  ),
                  d: "The unit figure — multiply by your own volume if you would rather not trust the archetype.",
                },
                {
                  k: "As a share of the classical bill",
                  v: baseSuite.totalUsd > 0
                    ? `${((headline.deltaUsd / baseSuite.totalUsd) * 100).toFixed(0)}%`
                    : "—",
                  d: "What the same traffic costs you today, versus after.",
                },
              ].map((c) => (
                <div key={c.k} className="min-w-0 rounded border border-border bg-bg-surface px-4 py-3">
                  <div className="text-[11px] font-bold uppercase tracking-eyebrow text-fg-subtle">{c.k}</div>
                  <div className="num mt-1 text-[19px] font-bold text-fg">{c.v}</div>
                  <p className="mt-1 text-[11.5px] leading-relaxed text-fg-muted">{c.d}</p>
                </div>
              ))}
            </div>

            <div className="min-w-0">
              <h3 className="mb-3 text-[13px] font-bold text-fg">What drives the difference</h3>
              <div className="min-w-0 rounded border border-border bg-bg-surface px-4 py-4">
                <AttributionChart
                  svgRef={svgRef}
                  cpuShare={headline.cpuShare}
                  egressShare={headline.egressShare}
                  cpuUsd={topSuite.cpuUsd - baseSuite.cpuUsd}
                  egressUsd={topSuite.egressUsd - baseSuite.egressUsd}
                />
              </div>
            </div>

            <div className="min-w-0">
              <h3 className="mb-3 text-[13px] font-bold text-fg">Every suite you selected</h3>
              <DataTable
                head={[
                  "Suite",
                  "Handshake",
                  "Bytes out",
                  "vs classical",
                  "CPU",
                  "Egress",
                  `Total / ${horizon.label.toLowerCase()}`,
                  "×",
                ]}
                rows={result.suites.map((s) => ({
                  key: s.name,
                  cells: [
                    <RowName key="n" name={SUITE_DISPLAY[s.name] ?? s.name} note={SUITE_KIND[s.name]} />,
                    formatDuration(s.medianUs),
                    s.bytesOut != null ? formatBytes(s.bytesOut) : "—",
                    s.vsBaselinePct == null ? (
                      <span key="b" className="text-fg-subtle">
                        baseline
                      </span>
                    ) : (
                      <span key="d" className={s.vsBaselinePct < 0 ? "text-status-ok" : "text-fg"}>
                        {s.vsBaselinePct < 0 ? "−" : "+"}
                        {Math.abs(s.vsBaselinePct).toFixed(1)}%
                      </span>
                    ),
                    formatUsd(s.cpuUsd),
                    formatUsd(s.egressUsd),
                    formatUsd(s.totalUsd),
                    s.multiplier == null ? "—" : `${s.multiplier.toFixed(2)}×`,
                  ],
                }))}
              />
            </div>

            {cliffTriggered && (
              <Caveat label="One effect this number does not include">{CLIFF_NOTE.text}</Caveat>
            )}
          </div>
        ) : (
          <p className="text-[13px] text-fg-subtle">
            Select a classical suite and a post-quantum one in step 1 to see a comparison.
          </p>
        )}
      </Step>

      {/* ---------------------------------------------------- how it works */}
      <section className="border-t border-border pt-6">
        <h2 className="text-[17px] font-bold tracking-[-0.02em] text-fg">
          How that number is worked out
        </h2>
        <p className="mt-1 max-w-[70ch] text-[13px] leading-relaxed text-fg-muted">
          No model, no hidden coefficient. Four multiplications, and you can check every one.
        </p>

        <ol className="mt-4 grid min-w-0 gap-3 sm:pl-9">
          {[
            {
              t: "Count the handshakes that actually happen",
              d: `${hsPerSec.toLocaleString()}/sec minus the ${reuse}% that resume an existing session leaves ${formatCount(result.effectiveHandshakesPerSecond)}/sec doing a real key exchange.`,
            },
            {
              t: "Multiply by what one handshake costs in CPU",
              d: `We measured ${topSuite ? formatDuration(topSuite.medianUs) : "—"} median against ${baseSuite ? formatDuration(baseSuite.medianUs) : "—"} for classical. The difference × your handshakes × your $/vCPU-hour.`,
            },
            {
              t: "Multiply by what one handshake costs on the wire",
              d: `${topSuite?.bytesOut != null ? formatBytes(topSuite.bytesOut) : "—"} leaves your server per handshake instead of ${baseSuite?.bytesOut != null ? formatBytes(baseSuite.bytesOut) : "—"}. That extra × your handshakes × your $/GB egress. Outbound only — inbound is free.`,
            },
            {
              t: "Add the two, over your chosen period",
              d: `Across ${horizon.label.toLowerCase()}. That is the figure in step 4, and the split between the two terms is the bar above it.`,
            },
          ].map((row, i) => (
            <li
              key={row.t}
              className="flex min-w-0 gap-3 rounded border border-border bg-bg-surface px-4 py-3"
            >
              <span className="num shrink-0 text-[12px] font-bold text-fg-subtle">{i + 1}</span>
              <span className="min-w-0">
                <span className="block text-[13px] font-bold text-fg">{row.t}</span>
                <span className="mt-0.5 block text-[12px] leading-relaxed text-fg-muted">{row.d}</span>
              </span>
            </li>
          ))}
        </ol>

        <p className="mt-4 max-w-[70ch] text-[12.5px] leading-relaxed text-fg-subtle">
          The handshake timings are measured. Everything else is either a public figure we cite or a
          number you typed. Nothing is interpolated — there is no value between two of our runs.
        </p>
      </section>

      {/* -------------------------------------------------------- sources */}
      <section className="border-t border-border pt-6">
        <h2 className="text-[17px] font-bold tracking-[-0.02em] text-fg">Sources</h2>
        <p className="mt-1 max-w-[70ch] text-[13px] leading-relaxed text-fg-muted">
          Every figure this page depends on. The first entry changes with your selection.
        </p>

        <div className="mt-4 min-w-0 space-y-4 sm:pl-9">
          <div className="min-w-0 rounded border border-border bg-bg-surface px-4 py-3">
            <div className="mb-1.5 text-[11px] font-bold uppercase tracking-eyebrow text-fg-subtle">
              The run behind these timings
            </div>
            <CiteLink
              c={{
                text: `Q-Shield composed TLS · ${data.runDate} · ${data.runCommit.slice(0, 7)} · liboqs ${data.liboqsVersion} · ${data.cpuModel} (${arch})`,
                url: githubChecksUrl(data.runCommit),
                retrieved: data.runDate,
              }}
            />
          </div>

          <div className="min-w-0 rounded border border-border bg-bg-surface px-4 py-3">
            <div className="mb-1.5 text-[11px] font-bold uppercase tracking-eyebrow text-fg-subtle">
              Reference list
            </div>
            <div className="grid min-w-0 gap-3 lg:grid-cols-2">
              {STATIC_REFERENCES.map((c) => (
                <CiteLink key={c.url + c.text} c={c} />
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
