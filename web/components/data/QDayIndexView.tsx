"use client";

import React, { useState, useMemo } from "react";
import type { QDayIndexData, ScoredSystem, Readiness } from "@/lib/data/q-day-types";

/*
 * Q-Day Index — dashboard view (/q-day-index)
 * Renders the OUTPUT of scoring.py (via the prebuild emitter). No math here.
 *
 * Inherits site design tokens via the .qday-root class (defined in globals.css),
 * which maps --qd-* vars onto the site theme + fonts. No injected <style> block.
 *
 * The non-negotiable design problem: threat and readiness must NEVER be confusable.
 *   - Threat  = radial GAUGE (distance to a named RSA estimate; multiplicative; honest zeros)
 *   - Readiness = stacked COMPONENT BARS (additive preconditions; "what would change this")
 */


// ---- methodology deep-links. One helper so there's a single place to keep the
// anchors aligned with the merged methodology page's heading ids. ----
const M = "/methodology"; // merged methodology page route
const anchor = (id: string) => `${M}#${id}`;
const LINKS = {
  anchorMoving: anchor("q-day-anchor-moving-target"),
  ecRule: anchor("q-day-below-threshold-rule"),
  notCrowned: anchor("q-day-field-frontier"),
  crossMethod: anchor("q-day-cross-method-fidelity"),
  analog: anchor("q-day-analog-systems"),
  inputConf: anchor("q-day-input-confidence"),
  neutrality: anchor("q-day-neutrality"),
  formula: anchor("q-day-threat-formula"),
  glossary: (term: string) => anchor(`glossary-${term.replace(/_/g, "-")}`),
};

// Turn a machine field / method tag into human label: "median_ECR_error" -> "Median ECR error".
const ACRONYMS = new Set(["ECR", "XEB", "RB", "SX", "AQ", "QCCD", "FPQA", "CPMG", "RSA", "EC", "2Q", "1Q", "NA", "SPAM", "iSWAP", "fSim"]);
function humanize(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .split("_")
    .map((w, i) => {
      const up = w.toUpperCase();
      if (ACRONYMS.has(up)) return up;
      if (i === 0) return w.charAt(0).toUpperCase() + w.slice(1);
      return w;
    })
    .join(" ");
}

// Brief glossary definitions for hovercards (one line + purpose). Full prose lives
// on the methodology page; the hovercard links out to it.
const GLOSSARY_BRIEF: Record<string, string> = {
  median_ECR_error: "Median error of IBM's echoed cross-resonance two-qubit gate. IBM's native 2-qubit metric.",
  randomized_benchmarking: "Fidelity estimated by running random gate sequences. Isolates gate error from state-prep/readout.",
  direct_RB: "A streamlined randomized-benchmarking variant measuring gate error directly.",
  XEB: "Cross-entropy benchmarking — fidelity from random-circuit sampling. Google's headline metric.",
  XEB_and_logical_error_per_cycle: "Google leads with logical error per error-correction cycle and random-circuit XEB, not an isolated 2-qubit number.",
  simultaneous_gate_fidelity: "Fidelity measured with gates running in parallel — a stricter, more realistic figure.",
  median_iSWAP_fidelity: "Median fidelity of the general-purpose iSWAP two-qubit gate.",
  median_fSim_fidelity: "Median fidelity of the specialized fSim gate used for random-circuit sampling.",
  vendor_reported_2Q_fidelity: "A two-qubit fidelity stated by the vendor without a published benchmarking protocol.",
  analog_not_applicable: "An analog simulator has no discrete two-qubit gate, so gate fidelity does not apply.",
  device_specification: "Value taken from the vendor's published device specification sheet.",
  surface_code_demonstration: "A logical qubit shown via a surface-code error-correction experiment, not standing hardware.",
  "surface_code_lambda_2.14": "Error suppressed by a factor of 2.14 per added code distance — the below-threshold result.",
  median_SX_error: "Median error of the single-qubit SX gate.",
  median_device_snapshot: "A dated median across the device's qubits, not a live calibration reading.",
  mean_T1: "Average energy-relaxation time across qubits.",
  T2_CPMG: "Phase-coherence time measured with the CPMG pulse sequence.",
  readout_fidelity: "Probability a qubit's state is measured correctly.",
  average_coherence_time: "A single averaged coherence figure where T1 and T2 aren't separately reported.",
  publication_date: "Dated by the peer-reviewed publication.",
  clifford_RB: "Randomized benchmarking over Clifford gates — the standard single-qubit fidelity method.",
};

const fmt = (n: number | null | undefined, d = 3): string =>
  n === null || n === undefined ? "—" : Number(n).toFixed(d);
const pct = (n: number | null | undefined): string => (n === null || n === undefined ? "—" : `${(n * 100).toFixed(2)}%`);

const CONF_COLOR: Record<string, string> = {
  high: "var(--qd-green)",
  medium: "#d9b54a",
  low: "#c77b54",
  none: "var(--qd-dim)",
};

// disclaimer-key → short human label for chips. Full prose lives on the methodology
// page; chips link out, never duplicate it.
const DKEY_LABEL: Record<string, string> = {
  analog_not_gate_model: "analog · N/A",
  press_vs_paper: "press vs paper",
  aq_not_qubit_count: "#AQ is not qubits",
  logical_qubits_are_demos: "logical = demo",
  milestone_not_cloud: "milestone, not cloud",
  readout_preprint_vs_published: "preprint vs published",
  calibration_snapshot_drifts: "dated snapshot",
  modality_not_comparable: "cross-modality",
  historical_anchor: "historical",
  anchor_is_algorithm_specific: "anchor is algorithm-specific",
};

// disclaimer-key → methodology-page anchor (link target). One concept = one
// canonical anchor; multiple disclaimer keys may map to the same anchor.
const DKEY_TARGET: Record<string, string> = {
  analog_not_gate_model: "q-day-analog-systems",
  press_vs_paper: "q-day-sourcing-bar",
  aq_not_qubit_count: "q-day-sourcing-bar",
  logical_qubits_are_demos: "q-day-below-threshold-rule",
  milestone_not_cloud: "q-day-sourcing-bar",
  readout_preprint_vs_published: "q-day-sourcing-bar",
  calibration_snapshot_drifts: "q-day-sourcing-bar",
  modality_not_comparable: "q-day-cross-method-fidelity",
  historical_anchor: "q-day-projection",
  anchor_is_algorithm_specific: "q-day-anchor-moving-target",
};

// One-line briefs for hovercard reveal on chips and inline terms. Full prose
// lives on the methodology page.
const DKEY_BRIEF: Record<string, string> = {
  analog_not_gate_model: "This system is an analog Hamiltonian simulator, not a gate-model machine. It has no two-qubit gate fidelity, and no gate-model pathway to factoring RSA.",
  press_vs_paper: "Vendor blog or press releases quote a figure that differs from the peer-reviewed paper. The published value is shown.",
  aq_not_qubit_count: "IonQ's '#AQ' is an algorithmic-qubit benchmark score, not a count of physical or logical qubits. The two are unrelated quantities.",
  logical_qubits_are_demos: "The system's 'logical qubit' figure comes from an error-correction demonstration, not standing always-on hardware capacity.",
  milestone_not_cloud: "Announced as a scale or yield milestone, not as a generally-available cloud machine. Full per-device calibration may never have been released.",
  readout_preprint_vs_published: "The arXiv preprint and the published journal version cite different readout numbers. The published value is shown.",
  calibration_snapshot_drifts: "Vendor publishes this metric as live calibration data that drifts daily. The value here is a fixed dated snapshot, not a current live reading.",
  modality_not_comparable: "Qubit counts and fidelities across superconducting, trapped-ion, neutral-atom, and photonic systems are not directly comparable — different architectures trade qubit count, connectivity, and gate fidelity differently.",
  historical_anchor: "Included as a prior-generation reference point for the trajectory, not as a current frontier machine.",
  anchor_is_algorithm_specific: "The target RSA-2048 estimate is a moving algorithmic figure, not a law of physics. It fell ~20× from 2019 to 2025 on compilation and error-correction progress alone.",
};

// Definitions for formula terms and other inline labels (no glossary anchor needed).
const TERM_BRIEF: Record<string, string> = {
  LogicalCapacity: "How many standing, error-corrected logical qubits the machine has, relative to what's needed to run Shor's algorithm against RSA-2048. Zero for nearly every machine today.",
  FidelityGate: "A 0-or-1 gate on whether the system's two-qubit gate fidelity clears the fault-tolerance threshold. Below the threshold, more qubits don't help — they add more errors than they correct.",
  ECSignal: "Multiplier rewarding a demonstrated below-threshold error-correction result. The rule, not opinion: until a system shows error suppression scales with code distance, it has no path to standing logical qubits.",
};

const CONF_BRIEF: Record<string, string> = {
  high: "All required fields sourced to peer-reviewed publications.",
  medium: "Mix of peer-reviewed and vendor-published sources.",
  low: "Primarily vendor-published, with one or more fields lacking a peer-reviewed citation.",
  none: "No qualifying source found for the required fields.",
};

// ----------------------------------------------------------------------------
// Threat gauge — radial. The hero. Reads as "distance to a fixed, named target".
// ----------------------------------------------------------------------------
function ThreatGauge({ score, band }: { score: number; band: [number, number] }) {
  const max = 100;
  // semicircle gauge, 180deg sweep
  const R = 130;
  const cx = 160;
  const cy = 160;
  // Round to 2 decimals so server and client produce identical path strings
  // (different JS runtimes diverge in float precision past ~10 decimals, which
  // triggers React hydration mismatches and trashes the SVG render).
  const q = (n: number) => Math.round(n * 100) / 100;
  const toXY = (frac: number): [number, number] => {
    const a = Math.PI * (1 - frac); // 0 at left (180°), 1 at right (0°)
    return [q(cx + R * Math.cos(a)), q(cy - R * Math.sin(a))];
  };
  const arc = (f0: number, f1: number): string => {
    const [x0, y0] = toXY(f0);
    const [x1, y1] = toXY(f1);
    const large = f1 - f0 > 0.5 ? 1 : 0;
    return `M ${x0} ${y0} A ${R} ${R} 0 ${large} 1 ${x1} ${y1}`;
  };
  const frac = Math.min(score / max, 1);
  const bandLo = Math.min(band[0] / max, 1);
  const bandHi = Math.min(band[1] / max, 1);
  const [nx, ny] = toXY(frac);

  // ticks at 0, 25, 50, 75, 100
  const ticks = [0, 25, 50, 75, 100];

  return (
    <svg viewBox="0 0 320 200" style={{ width: "100%", maxWidth: 420 }}>
      {/* track */}
      <path d={arc(0, 1)} fill="none" stroke="var(--qd-line)" strokeWidth="14" strokeLinecap="round" />
      {/* confidence band */}
      <path d={arc(bandLo, bandHi)} fill="none" stroke="rgba(74,222,128,0.28)" strokeWidth="14" strokeLinecap="round" />
      {/* value arc */}
      <path d={arc(0, frac)} fill="none" stroke="var(--qd-green)" strokeWidth="14" strokeLinecap="round" />
      {/* ticks */}
      {ticks.map((t) => {
        const [tx, ty] = toXY(t / 100);
        const [lx, ly] = toXY(t / 100);
        return (
          <g key={t}>
            <circle cx={tx} cy={ty} r="2" fill="var(--qd-dim)" />
            <text x={lx} y={ly + (t === 0 || t === 100 ? 18 : -10)} fontSize="9"
              fill="var(--qd-dim)" textAnchor="middle" fontFamily="var(--qd-mono)">{t}</text>
          </g>
        );
      })}
      {/* needle */}
      <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="var(--qd-green)" strokeWidth="2.5" />
      <circle cx={cx} cy={cy} r="5" fill="var(--qd-green)" />
      {/* value */}
      <text x={cx} y={cy - 34} fontSize="46" fill="var(--qd-fg)" textAnchor="middle"
        fontFamily="var(--qd-mono)" fontWeight="500">{fmt(score, 2)}</text>
      <text x={cx} y={cy - 14} fontSize="10" fill="var(--qd-dim)" textAnchor="middle"
        fontFamily="var(--qd-mono)" letterSpacing="0.12em">/ 100  ·  THREAT</text>
    </svg>
  );
}

// ----------------------------------------------------------------------------
// Readiness bar — stacked components. Structurally unlike the gauge on purpose.
// ----------------------------------------------------------------------------
function ReadinessBar({ readiness, compact = false }: { readiness: Readiness | null; compact?: boolean }) {
  if (!readiness) {
    return <span style={{ color: "var(--qd-dim)", fontFamily: "var(--qd-mono)", fontSize: 12 }}>N/A</span>;
  }
  const segs = [
    { key: "fidelity", label: "Fidelity", v: readiness.fidelity_progress * 0.4, c: "var(--qd-green)" },
    { key: "ec", label: "Error-correction", v: readiness.ec_progress * 0.4, c: "#8be39c" },
    { key: "scale", label: "Scale", v: readiness.scale_progress * 0.2, c: "#3f7d52" },
  ];
  const total = readiness.readiness;
  return (
    <div style={{ width: "100%" }}>
      <div style={{ display: "flex", height: compact ? 10 : 16, borderRadius: 4, overflow: "hidden", background: "var(--qd-line)" }}>
        {segs.map((s) => (
          <div key={s.key} title={`${s.label}: +${(s.v * 100).toFixed(1)}`}
            style={{ width: `${s.v * 100}%`, background: s.c }} />
        ))}
      </div>
      {!compact && (
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 11, fontFamily: "var(--qd-mono)", color: "var(--qd-dim)" }}>
          <span><span style={{ color: "var(--qd-green)" }}>■</span> fid {(readiness.fidelity_progress * 100).toFixed(0)}</span>
          <span><span style={{ color: "#8be39c" }}>■</span> EC {(readiness.ec_progress * 100).toFixed(0)}</span>
          <span><span style={{ color: "#3f7d52" }}>■</span> scale {(readiness.scale_progress * 100).toFixed(0)}</span>
          <span style={{ color: "var(--qd-fg)" }}>Σ {total.toFixed(1)}</span>
        </div>
      )}
    </div>
  );
}

// Hovercard: shows a brief definition + purpose on hover. Optionally links to a
// glossary entry. Uses React state (not CSS-only hover) so it works regardless
// of stylesheet ordering / Tailwind layer purging.
function HoverDef({
  label,
  brief,
  term,
  hrefOverride,
  underlineStyle = "dotted",
  className,
}: {
  label: React.ReactNode;
  brief: string | undefined;
  term?: string; // if provided + no hrefOverride, the trigger links to the glossary entry
  hrefOverride?: string; // if provided, overrides the glossary link
  underlineStyle?: "dotted" | "none";
  className?: string;
}) {
  const [show, setShow] = useState(false);
  const linkHref = hrefOverride ?? (term ? LINKS.glossary(term) : null);
  if (!brief) {
    // No definition available — render the label as-is, no hovercard.
    return linkHref ? (
      <a href={linkHref} className={className}>{label}</a>
    ) : (
      <span className={className}>{label}</span>
    );
  }
  const triggerStyle: React.CSSProperties = {
    cursor: "help",
    ...(underlineStyle === "dotted"
      ? { borderBottom: "1px dotted var(--qd-border)" }
      : {}),
  };
  const triggerProps = {
    onMouseEnter: () => setShow(true),
    onMouseLeave: () => setShow(false),
    style: triggerStyle,
    className,
  };
  const trigger = linkHref ? (
    <a href={linkHref} {...triggerProps}
      style={{ ...triggerStyle, color: "inherit", textDecoration: "none" }}>{label}</a>
  ) : (
    <span {...triggerProps}>{label}</span>
  );
  return (
    <span style={{ position: "relative", display: "inline-block" }}>
      {trigger}
      {show && (
        <span style={{
          position: "absolute", bottom: "calc(100% + 6px)", left: 0, zIndex: 50,
          width: 260, padding: "10px 12px", borderRadius: 8,
          background: "var(--qd-panel)", border: "1px solid var(--qd-line)",
          boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
          fontFamily: "var(--qd-sans)", fontSize: 12, lineHeight: 1.5, color: "var(--qd-fg2)",
          pointerEvents: "none", whiteSpace: "normal", textAlign: "left",
        }}>
          <span style={{ display: "block", color: "var(--qd-fg)", fontWeight: 500, marginBottom: 3 }}>
            {typeof label === "string" ? label : term ?? "Definition"}
          </span>
          {brief}
          {linkHref && (
            <span style={{ display: "block", marginTop: 6, color: "var(--qd-green)", fontSize: 11 }}>
              Full definition in methodology →
            </span>
          )}
        </span>
      )}
    </span>
  );
}

function ConfChip({ level }: { level: keyof typeof CONF_COLOR }) {
  const labelText = `${level} conf`;
  return (
    <HoverDef
      label={
        <span style={{
          fontFamily: "var(--qd-mono)", fontSize: 10, letterSpacing: "0.08em",
          textTransform: "uppercase", padding: "2px 7px", borderRadius: 999,
          border: `1px solid ${CONF_COLOR[level]}`, color: CONF_COLOR[level],
          display: "inline-block",
        }}>{labelText}</span>
      }
      brief={CONF_BRIEF[level]}
      hrefOverride={LINKS.inputConf}
      underlineStyle="none"
    />
  );
}

function DKeyChips({ keys }: { keys: string[] }) {
  return (
    <span style={{ display: "inline-flex", gap: 5, flexWrap: "wrap" }}>
      {keys.map((k: string) => (
        <span key={k}>
          <HoverDef
            label={
              <span style={{
                fontFamily: "var(--qd-mono)", fontSize: 10, padding: "1px 6px", borderRadius: 4,
                background: "var(--qd-line)", color: "var(--qd-dim)",
                border: "1px solid var(--qd-border)", display: "inline-block",
              }}>{DKEY_LABEL[k] || k}</span>
            }
            brief={DKEY_BRIEF[k]}
            hrefOverride={DKEY_TARGET[k] ? anchor(DKEY_TARGET[k]) : undefined}
            underlineStyle="none"
          />
        </span>
      ))}
    </span>
  );
}

// ----------------------------------------------------------------------------
// Per-system detail (expanded row)
// ----------------------------------------------------------------------------
function SystemDetail({ s }: { s: ScoredSystem }) {
  const isAnalog = s.na_reason === "analog_not_gate_model";
  const p = s.provenance;
  const row = (label: string, field: string, render?: (v: any) => React.ReactNode) => {
    const f = p[field];
    if (!f) return null;
    return (
      <tr>
        <td style={tdLabel}>{label}</td>
        <td style={tdVal}>{render ? render(f.value) : (f.value ?? "—")}</td>
        <td style={tdMeta}>
          {f.method && (
            <HoverDef
              label={humanize(f.method)}
              brief={GLOSSARY_BRIEF[f.method]}
              term={f.method}
              className="text-fg-subtle"
            />
          )}
        </td>
        <td style={tdMeta}>{f.as_of || ""}</td>
        <td style={tdMeta}>
          {f.confidence ? (
            <span style={{ color: CONF_COLOR[f.confidence === "peer_reviewed" ? "high" : "medium"] }}>
              {f.confidence === "peer_reviewed" ? "peer-reviewed" : "vendor"}
            </span>
          ) : <span style={{ color: "var(--qd-dim)" }}>—</span>}
          {f.source && (
            <a href={f.source} target="_blank" rel="noreferrer"
              style={{ marginLeft: 6, color: "var(--qd-green)", textDecoration: "none" }}>↗</a>
          )}
        </td>
      </tr>
    );
  };

  return (
    <div style={{ padding: "18px 20px", background: "var(--qd-panel2)", borderTop: "1px solid var(--qd-border)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28, alignItems: "start" }}>
        {/* left: the two axes side by side, clearly labelled distinct */}
        <div>
          <div style={{ display: "flex", gap: 24, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div>
              <div style={axisLabel}>THREAT — distance to RSA estimate</div>
              {isAnalog ? (
                <div style={{ fontFamily: "var(--qd-mono)", color: "var(--qd-dim)", marginTop: 6 }}>
                  N/A <span style={{ fontSize: 11 }}>(category difference)</span>
                </div>
              ) : (
                <>
                  <div style={{ fontFamily: "var(--qd-mono)", fontSize: 28, color: (s.threat_score ?? 0) > 0 ? "var(--qd-green)" : "var(--qd-fg)" }}>
                    {fmt(s.threat_score, 3)}
                  </div>
                  <div style={{ fontFamily: "var(--qd-mono)", fontSize: 11, color: "var(--qd-dim)", marginTop: 4 }}>
                    LC {fmt(s.threat_components!.logical_capacity, 3)} × FG {fmt(s.threat_components!.fidelity_gate, 2)} × EC {fmt(s.threat_components!.ec_signal, 2)} × 100
                  </div>
                  <div style={{ fontSize: 11, color: "var(--qd-dim)", marginTop: 4 }}>
                    effective standing logical qubits: <b style={{ color: "var(--qd-fg)" }}>{s.threat_components!.effective_logical}</b>
                  </div>
                </>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={axisLabel}>READINESS — preconditions, <i>not</i> RSA distance</div>
              <div style={{ marginTop: 10 }}><ReadinessBar readiness={s.readiness} /></div>
            </div>
          </div>

          {/* flags */}
          <div style={{ marginTop: 16 }}>
            <div style={axisLabel}>FLAGS</div>
            <ul style={{ margin: "8px 0 0", paddingLeft: 16, fontSize: 12.5, color: "var(--qd-fg2)", lineHeight: 1.6 }}>
              {s.flags.map((f: string, i: number) => <li key={i}>{f}</li>)}
              {s.presentation && s.presentation.region_gated && (
                <li style={{ color: "#d9b54a" }}>{s.presentation.region_note}</li>
              )}
            </ul>
          </div>

          {s.notes && (
            <p style={{ marginTop: 14, fontSize: 12, color: "var(--qd-dim)", lineHeight: 1.6, fontStyle: "italic" }}>{s.notes}</p>
          )}
        </div>

        {/* right: full provenance table */}
        <div>
          <div style={axisLabel}>SPECIFICATIONS &amp; PROVENANCE — every number sourced</div>
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8 }}>
            <thead>
              <tr style={{ fontSize: 9.5, color: "var(--qd-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                <th style={thMeta}>Field</th><th style={thMeta}>Value</th>
                <th style={thMeta}>Method</th><th style={thMeta}>As of</th><th style={thMeta}>Source</th>
              </tr>
            </thead>
            <tbody>
              {row("Physical qubits", "physical_qubits")}
              {row("Logical qubits (standing)", "logical_qubits")}
              {row("2Q gate fidelity", "two_qubit_gate_fidelity", (v) => v === null ? <span style={{ color: "var(--qd-dim)" }}>null (by design)</span> : pct(v))}
              {row("1Q gate fidelity", "single_qubit_gate_fidelity", (v) => v === null ? "—" : pct(v))}
              {row("T1 coherence (µs)", "t1_coherence_us")}
              {row("T2 coherence (µs)", "t2_coherence_us")}
              {row("Below-threshold EC", "error_correction_below_threshold", (v) => v ? <span style={{ color: "var(--qd-green)" }}>demonstrated</span> : "not demonstrated")}
              {row("Cloud available", "cloud_available", (v) => v ? "yes" : "no")}
            </tbody>
          </table>
          <div style={{ marginTop: 10, fontSize: 11, color: "var(--qd-dim)" }}>
            <a href={LINKS.crossMethod} style={{ color: "var(--qd-green)", textDecoration: "none" }}>
              Why the 2Q column is not a ranking →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Main
// ----------------------------------------------------------------------------
export default function QDayIndexView({ data }: { data: QDayIndexData }) {
  const [open, setOpen] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState("threat");

  const scored = data.systems.filter((s) => s.na_reason === null);
  const na = data.systems.filter((s) => s.na_reason !== null);

  const sortedScored = useMemo(() => {
    const arr = [...scored];
    if (sortKey === "threat") arr.sort((a, b) => (b.threat_score ?? 0) - (a.threat_score ?? 0));
    else if (sortKey === "readiness") arr.sort((a, b) => (b.readiness?.readiness || 0) - (a.readiness?.readiness || 0));
    else if (sortKey === "year") arr.sort((a, b) => (b.release_year ?? 0) - (a.release_year ?? 0));
    return arr;
  }, [scored, sortKey]);

  const h = data.hero;
  const a = data.anchor;
  const ap = data.anchor_prior;

  return (
    <div className="qday-root" style={styles.root}>

      {/* ===== HEADER ===== */}
      <header style={{ marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
          <h1 style={styles.h1}>Q-Day Index</h1>
          <span style={styles.kicker}>RSA-2048 · launch target</span>
        </div>
        <p style={styles.sub}>
          A 0–100 measure of how close today&apos;s quantum hardware is to breaking RSA-2048 encryption,
          scored against a <i>named, published</i> resource estimate. Higher means closer. The honest
          reading today is low single digits — <b style={{ color: "var(--qd-fg)" }}>the trajectory is the story, not the digit.</b>
        </p>
      </header>

      {/* ===== THE LOAD-BEARING CAVEAT (anchor is moving) ===== */}
      <a href={LINKS.anchorMoving} style={styles.anchorStripLink}>
        <div style={styles.anchorStrip}>
          <div style={{ fontFamily: "var(--qd-mono)", fontSize: 11, color: "var(--qd-green)", letterSpacing: "0.1em", marginBottom: 4 }}>
            WHAT THIS SCORE IS DISTANCE TO ↗
          </div>
          <div style={{ fontSize: 13.5, color: "var(--qd-fg2)", lineHeight: 1.55 }}>
            The <b style={{ color: "var(--qd-fg)" }}>{a.label}</b> estimate:
            {" "}<b style={{ color: "var(--qd-fg)" }}>{a.physical_qubits.toLocaleString()}</b> physical qubits, {a.runtime}, to factor RSA-2048 with Shor&apos;s algorithm.
            {" "}This is a <b>moving research target</b>, not a law of physics — it fell <b style={{ color: "var(--qd-green)" }}>~20×</b> from
            {" "}{ap.label.replace("+", " & ")}&apos;s {ap.physical_qubits.toLocaleString()} qubits ({ap.runtime}) in six years, on algorithmic and
            error-correction progress alone, with hardware assumptions held identical. <span style={{ color: "var(--qd-green)" }}>Read the anchor caveat →</span>
          </div>
        </div>
      </a>

      {/* ===== HERO: THREAT GAUGE + COMPOSITE ===== */}
      <section style={styles.heroGrid}>
        <div style={styles.heroCard}>
          <div style={styles.cardHead}>
            <span>FIELD FRONTIER · THREAT</span>
            <a href={LINKS.neutrality} style={styles.headLink} title="How the frontier is defined">how this is defined ↗</a>
          </div>
          <div style={{ display: "flex", justifyContent: "center", padding: "6px 0 0" }}>
            <ThreatGauge score={h.frontier_threat_score} band={h.confidence_band} />
          </div>
          <div style={{ textAlign: "center", marginTop: -8 }}>
            <div style={{ fontSize: 12, color: "var(--qd-dim)", fontFamily: "var(--qd-mono)" }}>
              confidence band {fmt(h.confidence_band[0], 2)} – {fmt(h.confidence_band[1], 2)}
            </div>
            <p style={{ fontSize: 13, color: "var(--qd-fg2)", marginTop: 10, lineHeight: 1.55, maxWidth: 460, marginInline: "auto" }}>
              The field&apos;s leading edge sits at <b style={{ color: "var(--qd-green)" }}>{fmt(h.frontier_threat_score, 2)}</b> / 100, and
              today&apos;s real-world threat to RSA-2048 is <b style={{ color: "var(--qd-fg)" }}>low</b>. The table below names
              every machine and its score. One system is non-zero today only because it is the sole machine with a
              publicly demonstrated below-threshold result — the ranking will shift as others clear that same bar.
              {" "}<a href={LINKS.ecRule} style={styles.inlineLink}>The rule, not our opinion ↗</a>
            </p>
          </div>
        </div>

        <div style={styles.sideCol}>
          <div style={styles.miniCard}>
            <div style={styles.cardHead}><span>COMPOSITE · INDUSTRY</span></div>
            <div style={{ fontFamily: "var(--qd-mono)", fontSize: 40, color: "var(--qd-fg)", lineHeight: 1.1 }}>
              {fmt(h.composite_industry_score, 2)}
            </div>
            <div style={{ fontSize: 11.5, color: "var(--qd-dim)" }}>mean across {h.n_scored} scored systems</div>
            <div style={{ fontSize: 11.5, color: "var(--qd-dim)", marginTop: 2 }}>{h.n_na} analog / out-of-category (N/A)</div>
          </div>
          <div style={styles.miniCard}>
            <div style={styles.cardHead}><span>THE FORMULA</span><a href={LINKS.formula} style={styles.headLink}>how it works ↗</a></div>
            <div style={{ fontFamily: "var(--qd-mono)", fontSize: 12.5, color: "var(--qd-fg2)", lineHeight: 1.7 }}>
              Threat = <HoverDef label="LogicalCapacity" brief={TERM_BRIEF.LogicalCapacity} /><br />
              <span style={{ color: "var(--qd-dim)" }}>　　×</span> <HoverDef label="FidelityGate" brief={TERM_BRIEF.FidelityGate} /><br />
              <span style={{ color: "var(--qd-dim)" }}>　　×</span> <HoverDef label="ECSignal" brief={TERM_BRIEF.ECSignal} /> × 100
            </div>
            <div style={{ fontSize: 11.5, color: "var(--qd-dim)", marginTop: 8, lineHeight: 1.5 }}>
              A multiplicative gate: zero standing error-corrected logical qubits → <b style={{ color: "var(--qd-fg)" }}>0.000</b>. That is the honest answer for nearly all hardware today.
            </div>
          </div>
        </div>
      </section>

      {/* ===== TWO-AXIS EXPLAINER (firewall, before the table) ===== */}
      <section style={styles.firewall}>
        <div style={styles.firewallCol}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <GaugeGlyph /><span style={styles.firewallTitle}>Threat score — a gauge</span>
          </div>
          <p style={styles.firewallText}>
            Distance to the named RSA estimate. <b>Multiplicative.</b> Honest zeros everywhere a system
            lacks demonstrated error-corrected logical qubits. This is the headline and it stays uncompromising.
          </p>
        </div>
        <div style={styles.firewallDivider} />
        <div style={styles.firewallCol}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <BarsGlyph /><span style={styles.firewallTitle}>Readiness — stacked bars</span>
          </div>
          <p style={styles.firewallText}>
            Progress toward the <b>preconditions</b> (fidelity, error-correction, scale). <b>Additive.</b>{" "}
            <b style={{ color: "var(--qd-fg)" }}>NOT distance to breaking RSA.</b> A machine can have real readiness and a
            0.000 threat score at once — that is the correct, honest state of the field.
          </p>
        </div>
      </section>

      {/* ===== PER-VENDOR TABLE ===== */}
      <section style={{ marginTop: 28 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
          <h2 style={styles.h2}>Per-system</h2>
          <div style={{ display: "flex", gap: 6, fontFamily: "var(--qd-mono)", fontSize: 11 }}>
            {[["threat", "threat"], ["readiness", "readiness"], ["year", "newest"]].map(([k, label]) => (
              <button key={k} onClick={() => setSortKey(k)} style={{
                ...styles.sortBtn, ...(sortKey === k ? styles.sortBtnActive : {}),
              }}>sort: {label}</button>
            ))}
          </div>
        </div>

        <div style={styles.table}>
          {/* header */}
          <div style={{ ...styles.trow, ...styles.thead }}>
            <div style={{ flex: "0 0 28px" }} />
            <div style={{ flex: 3 }}>System</div>
            <div style={{ flex: 2, textAlign: "right" }}>Threat ⌀</div>
            <div style={{ flex: 3 }}>Readiness ▭</div>
            <div style={{ flex: 2 }}>Inputs</div>
          </div>

          {sortedScored.map((s, i) => {
            const id = `${s.vendor}-${s.system_name}`;
            const isOpen = open === id;
            return (
              <div key={id}>
                <div style={{ ...styles.trow, cursor: "pointer", background: isOpen ? "var(--qd-panel2)" : "transparent" }}
                  onClick={() => setOpen(isOpen ? null : id)}>
                  <div style={{ flex: "0 0 28px", color: "var(--qd-dim)", fontFamily: "var(--qd-mono)" }}>{isOpen ? "▾" : "▸"}</div>
                  <div style={{ flex: 3 }}>
                    <div style={{ fontWeight: 500, color: "var(--qd-fg)" }}>{s.vendor}</div>
                    <div style={{ fontSize: 12, color: "var(--qd-dim)" }}>
                      {s.system_name} · {s.modality.replace(/_/g, "-")} · {s.release_year}
                      {s.presentation?.region_gated && (
                        <span title={s.presentation.region_note} style={styles.regionFlag}>⚑ region-gated</span>
                      )}
                    </div>
                  </div>
                  <div style={{ flex: 2, textAlign: "right" }}>
                    <span style={{ fontFamily: "var(--qd-mono)", fontSize: 17, color: (s.threat_score ?? 0) > 0 ? "var(--qd-green)" : "var(--qd-fg2)" }}>
                      {fmt(s.threat_score, 3)}
                    </span>
                  </div>
                  <div style={{ flex: 3, paddingRight: 12 }}>
                    <ReadinessBar readiness={s.readiness} compact />
                    <div style={{ fontFamily: "var(--qd-mono)", fontSize: 10, color: "var(--qd-dim)", marginTop: 3 }}>
                      Σ {s.readiness!.readiness.toFixed(1)}
                    </div>
                  </div>
                  <div style={{ flex: 2, display: "flex", flexDirection: "column", gap: 5, alignItems: "flex-start" }}>
                    <ConfChip level={s.input_confidence.level} />
                    <DKeyChips keys={s.disclaimer_keys} />
                  </div>
                </div>
                {isOpen && <SystemDetail s={s} />}
              </div>
            );
          })}

          {/* N/A analog rows — explicit category difference */}
          {na.map((s) => {
            const id = `${s.vendor}-${s.system_name}`;
            const isOpen = open === id;
            return (
              <div key={id}>
                <div style={{ ...styles.trow, cursor: "pointer", opacity: 0.92, background: isOpen ? "var(--qd-panel2)" : "transparent" }}
                  onClick={() => setOpen(isOpen ? null : id)}>
                  <div style={{ flex: "0 0 28px", color: "var(--qd-dim)", fontFamily: "var(--qd-mono)" }}>{isOpen ? "▾" : "▸"}</div>
                  <div style={{ flex: 3 }}>
                    <div style={{ fontWeight: 500, color: "var(--qd-fg)" }}>{s.vendor}</div>
                    <div style={{ fontSize: 12, color: "var(--qd-dim)" }}>{s.system_name} · {s.modality.replace(/_/g, "-")} · {s.release_year}</div>
                  </div>
                  <div style={{ flex: 2, textAlign: "right" }}>
                    <a href={LINKS.analog} onClick={(e) => e.stopPropagation()} style={{ ...styles.naPill }}>
                      N/A · analog
                    </a>
                  </div>
                  <div style={{ flex: 3, fontSize: 12, color: "var(--qd-dim)", paddingRight: 12 }}>
                    category difference, not a low score
                  </div>
                  <div style={{ flex: 2 }}><DKeyChips keys={s.disclaimer_keys} /></div>
                </div>
                {isOpen && <SystemDetail s={s} />}
              </div>
            );
          })}
        </div>

        <p style={styles.tableNote}>
          The raw 2-qubit fidelity column is deliberately <b>not</b> shown as a ranking. Each value carries its
          measurement method (XEB vs ECR vs RB vs …); these are not comparable to the third decimal.{" "}
          <a href={LINKS.crossMethod} style={styles.inlineLink}>The cross-method problem, in full ↗</a>
        </p>
      </section>

      {/* ===== WHAT WOULD CHANGE THIS SCORE ===== */}
      <section style={styles.changeBox}>
        <h2 style={styles.h2}>What would change this score</h2>
        <p style={{ fontSize: 13.5, color: "var(--qd-fg2)", lineHeight: 1.6, maxWidth: 720 }}>
          The threat score is gated on one thing above all: <b style={{ color: "var(--qd-fg)" }}>standing, error-corrected logical qubits</b>,
          evidenced by a demonstrated below-threshold result. The readiness bars above show which preconditions each
          system has assembled toward that. Concretely, the frontier moves when:
        </p>
        <div style={styles.changeGrid}>
          <div style={styles.changeItem}>
            <div style={styles.changeNum}>01</div>
            <b style={{ color: "var(--qd-fg)" }}>More demonstrated below-threshold systems.</b>
            <span> Today only one system clears this bar (<a href={LINKS.ecRule} style={styles.inlineLink}>the public evidence rule ↗</a>). Each new one that does is a step-change, not a decimal.</span>
          </div>
          <div style={styles.changeItem}>
            <div style={styles.changeNum}>02</div>
            <b style={{ color: "var(--qd-fg)" }}>Standing logical-qubit count climbing.</b>
            <span> Demonstrations of <i>one</i> logical qubit must become standing registers of many. Physical qubit count alone does not move the threat score.</span>
          </div>
          <div style={styles.changeItem}>
            <div style={styles.changeNum}>03</div>
            <b style={{ color: "var(--qd-fg)" }}>The anchor moving.</b>
            <span> A better Shor compilation could cut the target again (it already fell 20×). We track the published estimate and re-anchor with a citation. <a href={LINKS.anchorMoving} style={styles.inlineLink}>the moving anchor ↗</a></span>
          </div>
        </div>
      </section>

      {/* ===== TRAJECTORY (the visible climb — NO projected year) ===== */}
      <section style={{ marginTop: 30 }}>
        <h2 style={styles.h2}>The visible climb</h2>
        <p style={{ fontSize: 13, color: "var(--qd-fg2)", lineHeight: 1.6, maxWidth: 720, marginBottom: 14 }}>
          Prior-generation systems, shown for context. The climb is real and we show it. We do{" "}
          <b style={{ color: "var(--qd-fg)" }}>not</b> publish a projected &quot;Q-Day year&quot; — a forecast is only as good as its
          model, and ours is held back until it is defensible. Receipts, not press releases.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {[...data.historical_anchors].sort((a, b) => a.release_year - b.release_year).map((hh) => (
            <div key={hh.system_name} style={styles.histChip}>
              <div style={{ fontSize: 11, color: "var(--qd-dim)", fontFamily: "var(--qd-mono)" }}>{hh.release_year}</div>
              <div style={{ color: "var(--qd-fg)", fontWeight: 500 }}>{hh.vendor} {hh.system_name}</div>
              <div style={{ fontSize: 11.5, color: "var(--qd-dim)", fontFamily: "var(--qd-mono)" }}>{hh.physical_qubits} physical</div>
            </div>
          ))}
        </div>
      </section>

      {/* ===== FOOTER: methodology + announced-not-scored ===== */}
      <footer style={styles.footer}>
        <div>
          <div style={styles.footHead}>Methodology &amp; disclaimers</div>
          <p style={{ fontSize: 12.5, color: "var(--qd-dim)", lineHeight: 1.6, maxWidth: 640 }}>
            Every number on this page is vendor-published or peer-reviewed, carries its source, and links to a
            single methodology document — definitions are written once there, never duplicated here.{" "}
            <a href={M} style={styles.inlineLink}>Full methodology ↗</a> ·{" "}
            <a href={LINKS.crossMethod} style={styles.inlineLink}>cross-method comparability ↗</a> ·{" "}
            <a href={LINKS.neutrality} style={styles.inlineLink}>neutrality firewall ↗</a>
          </p>
        </div>
        <div style={{ marginTop: 18 }}>
          <div style={styles.footHead}>Announced, not scored</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 6 }}>
            {data.announced_not_scored.map((x) => (
              <div key={x.vendor} style={styles.histChip} title={x.reason}>
                <div style={{ color: "var(--qd-fg2)", fontWeight: 500 }}>{x.vendor}</div>
                <div style={{ fontSize: 11, color: "var(--qd-dim)" }}>{x.modality} · no qualifying specs</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ marginTop: 20, fontSize: 11, color: "var(--qd-dim)", fontFamily: "var(--qd-mono)" }}>
          Anchor: {a.label} · {a.source.replace("https://", "")} · {a.confidence.replace("_", "-")} · rendered from scoring.py
        </div>
      </footer>
    </div>
  );
}

// ---- tiny glyphs that visually distinguish the two axes ----
function GaugeGlyph() {
  return (
    <svg width="20" height="14" viewBox="0 0 20 14">
      <path d="M2 12 A8 8 0 0 1 18 12" fill="none" stroke="var(--qd-green)" strokeWidth="2" />
      <line x1="10" y1="12" x2="14" y2="6" stroke="var(--qd-green)" strokeWidth="1.5" />
    </svg>
  );
}
function BarsGlyph() {
  return (
    <svg width="20" height="14" viewBox="0 0 20 14">
      <rect x="1" y="4" width="7" height="6" fill="var(--qd-green)" />
      <rect x="8" y="4" width="5" height="6" fill="#8be39c" />
      <rect x="13" y="4" width="3" height="6" fill="#3f7d52" />
    </svg>
  );
}

// ---------------------------------------------------------------------------- styles
const tdLabel: React.CSSProperties = { fontSize: 11.5, color: "var(--qd-dim)", padding: "4px 8px 4px 0", whiteSpace: "nowrap" };
const tdVal: React.CSSProperties = { fontSize: 12, color: "var(--qd-fg)", fontFamily: "var(--qd-mono)", padding: "4px 8px" };
const tdMeta: React.CSSProperties = { fontSize: 10.5, color: "var(--qd-fg2)", fontFamily: "var(--qd-mono)", padding: "4px 8px" };
const thMeta: React.CSSProperties = { textAlign: "left", padding: "0 8px 4px 0", fontWeight: 500 };
const axisLabel: React.CSSProperties = { fontFamily: "var(--qd-mono)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--qd-dim)" };

const styles: Record<string, React.CSSProperties> = {
  root: { background: "var(--qd-bg)", color: "var(--qd-fg2)", fontFamily: "var(--qd-sans)", padding: "32px 30px 60px", maxWidth: 1080, margin: "0 auto", lineHeight: 1.5 },
  h1: { fontFamily: "var(--qd-serif)", fontSize: 46, fontWeight: 400, color: "var(--qd-fg)", margin: 0, letterSpacing: "-0.01em" },
  kicker: { fontFamily: "var(--qd-mono)", fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--qd-green)", border: "1px solid var(--qd-line)", padding: "3px 9px", borderRadius: 5 },
  sub: { fontSize: 15, color: "var(--qd-fg2)", maxWidth: 760, marginTop: 12, lineHeight: 1.55 },
  anchorStripLink: { textDecoration: "none", display: "block", marginTop: 20 },
  anchorStrip: { border: "1px solid var(--qd-line)", borderLeft: "3px solid var(--qd-green)", borderRadius: 8, padding: "14px 18px", background: "linear-gradient(90deg, rgba(74,222,128,0.05), transparent)" },
  heroGrid: { display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 16, marginTop: 18 },
  heroCard: { background: "var(--qd-panel)", border: "1px solid var(--qd-line)", borderRadius: 12, padding: "16px 20px 22px" },
  sideCol: { display: "flex", flexDirection: "column", gap: 16 },
  miniCard: { background: "var(--qd-panel)", border: "1px solid var(--qd-line)", borderRadius: 12, padding: "14px 16px", flex: 1 },
  cardHead: { display: "flex", justifyContent: "space-between", fontFamily: "var(--qd-mono)", fontSize: 10.5, letterSpacing: "0.12em", color: "var(--qd-dim)", textTransform: "uppercase", marginBottom: 10 },
  headLink: { color: "var(--qd-green)", textDecoration: "none", textTransform: "none", letterSpacing: 0 },
  inlineLink: { color: "var(--qd-green)", textDecoration: "none", borderBottom: "1px solid rgba(74,222,128,0.3)" },
  firewall: { display: "flex", gap: 0, marginTop: 18, border: "1px dashed var(--qd-line)", borderRadius: 10, padding: "16px 20px", background: "var(--qd-panel2)" },
  firewallCol: { flex: 1, padding: "0 18px" },
  firewallDivider: { width: 1, background: "var(--qd-line)" },
  firewallTitle: { fontFamily: "var(--qd-serif)", fontSize: 19, color: "var(--qd-fg)" },
  firewallText: { fontSize: 12.5, color: "var(--qd-fg2)", lineHeight: 1.55, margin: 0 },
  h2: { fontFamily: "var(--qd-serif)", fontSize: 26, fontWeight: 400, color: "var(--qd-fg)", margin: 0 },
  sortBtn: { background: "transparent", border: "1px solid var(--qd-line)", color: "var(--qd-dim)", padding: "3px 8px", borderRadius: 5, cursor: "pointer" },
  sortBtnActive: { color: "var(--qd-green)", borderColor: "var(--qd-green)" },
  table: { border: "1px solid var(--qd-line)", borderRadius: 10, overflow: "hidden" },
  trow: { display: "flex", alignItems: "center", gap: 8, padding: "12px 14px", borderBottom: "1px solid var(--qd-border)" },
  thead: { fontFamily: "var(--qd-mono)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--qd-dim)", background: "var(--qd-panel2)" },
  regionFlag: { marginLeft: 8, color: "#d9b54a", fontFamily: "var(--qd-mono)", fontSize: 10 },
  naPill: { fontFamily: "var(--qd-mono)", fontSize: 11, color: "var(--qd-dim)", border: "1px solid var(--qd-line)", borderRadius: 999, padding: "2px 9px", textDecoration: "none" },
  tableNote: { fontSize: 12, color: "var(--qd-dim)", marginTop: 10, lineHeight: 1.55 },
  changeBox: { marginTop: 30, background: "var(--qd-panel)", border: "1px solid var(--qd-line)", borderRadius: 12, padding: "20px 22px" },
  changeGrid: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginTop: 16 },
  changeItem: { fontSize: 12.5, color: "var(--qd-fg2)", lineHeight: 1.55, borderTop: "2px solid var(--qd-line)", paddingTop: 10 },
  changeNum: { fontFamily: "var(--qd-mono)", fontSize: 11, color: "var(--qd-green)", marginBottom: 6 },
  histChip: { border: "1px solid var(--qd-line)", borderRadius: 8, padding: "8px 12px", background: "var(--qd-panel2)" },
  footer: { marginTop: 40, borderTop: "1px solid var(--qd-line)", paddingTop: 20 },
  footHead: { fontFamily: "var(--qd-mono)", fontSize: 10.5, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--qd-dim)", marginBottom: 6 },
};
