#!/usr/bin/env python3
"""
Q-Day Index — RSA-2048 threat-score engine.

Computes a 0-100 "distance-to-threshold" threat score per quantum system and a
field-frontier hero number, against a *named, point-in-time* quantum resource
estimate for factoring RSA-2048 with Shor's algorithm.

Read CHAT-A-LOCKED-q-day-index-plan.md (§3, §6, §8) and docs/q-day-methodology.md
before changing anything here. The honest score today is low single digits and the
code is built to *say so*, not to manufacture movement.

Design (signed off, Chat C):
  Q-Day Score = LogicalCapacity x FidelityGate x ECSignal x 100

  - Capability-GATED PRODUCT, not a linear blend (rejects v1's linear formula).
  - LogicalCapacity: effective *standing* logical qubits vs. the anchor, mapped
    LOG-scale so a real "1 logical qubit" stays visibly nonzero but tiny. QEC-demo
    claims (tagged logical_qubits_are_demos) do NOT count as standing capacity.
  - FidelityGate: a sigmoid around the fault-tolerance threshold. DELIBERATELY
    LOW-RESOLUTION: it answers "below / near / above threshold", not "rank the third
    decimal". The cross-method incomparability (XEB vs ECR vs RB vs ...) is the reason;
    see methodology doc. The third decimal is NOT treated as signal.
  - ECSignal: rewards a *demonstrated* below-threshold EC result (Willow Lambda=2.14).
    Everyone else sits at a documented floor.

Hard rules honored here (plan §8):
  - Neutrality firewall: hero = FIELD FRONTIER (leading-edge score + confidence band),
    NOT "highest single machine". The per-machine ranking is shown but no winner is named.
  - Analog systems get explicit N/A (a category difference), never a low score.
  - The anchor qubit count is a SWAPPABLE, SOURCED parameter — RSA assumptions are not
    hard-coded, so a later target (Bitcoin/ECDSA, ...) is a config change, not a rewrite.
  - Aggregate input-confidence is surfaced alongside every score.
  - Nothing auto-runs / auto-publishes. Projection model is BUILT but HELD INTERNAL.
"""

from __future__ import annotations

import json
import math
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Optional


# --------------------------------------------------------------------------------------
# Anchors — versioned, sourced, SWAPPABLE. This is the whole point of the §6
# "don't hard-code RSA assumptions" rule: a target is a data object, not a constant
# buried in the math. A later target swaps the anchor; the formula is unchanged.
#
# NOTE (the disclaimer that does real work): these are estimates for ONE algorithm
# family (Shor + a specific fault-tolerant compilation) under ONE set of hardware
# assumptions. The estimate is a MOVING RESEARCH TARGET, not a law of physics: it fell
# ~20x in six years (2019 -> 2025) from algorithmic / error-correction improvement alone,
# with hardware assumptions held identical. The score measures distance to a *named
# estimate*, and names it. See methodology doc: anchor_is_algorithm_specific.
# --------------------------------------------------------------------------------------

@dataclass(frozen=True)
class Anchor:
    """A point-in-time quantum resource estimate for breaking a specific target."""
    target: str
    label: str
    logical_qubits: int            # order-of-magnitude logical-qubit requirement
    physical_qubits: int           # quoted physical-qubit requirement
    runtime: str
    phys_gate_error_assumed: float # the hardware assumption the estimate is built on
    source: str
    citation: str
    confidence: str
    as_of: str


# The launch anchor object carries BOTH published estimates so the "moving target" is
# on the record in the data, not just the prose. Current scoring uses the 2025 estimate
# (latest peer-tracked figure); the 2019 estimate is retained for the methodology doc
# and the (internal) trajectory context.
ANCHOR_RSA2048_2019 = Anchor(
    target="RSA-2048",
    label="Gidney+Ekera 2019",
    logical_qubits=4000,           # ~thousands logical (order of magnitude)
    physical_qubits=20_000_000,
    runtime="~8 hours",
    phys_gate_error_assumed=0.001,
    source="https://arxiv.org/abs/1905.09749",
    citation="Gidney & Ekera 2019, 'How to factor 2048 bit RSA integers in 8 hours "
             "using 20 million noisy qubits', Quantum 5 (2021) 433.",
    confidence="peer_reviewed",
    as_of="2019-05",
)

ANCHOR_RSA2048_2025 = Anchor(
    target="RSA-2048",
    label="Gidney 2025",
    logical_qubits=4000,           # logical-qubit order of magnitude unchanged; the big
                                   # win was physical overhead, not logical count. Kept at
                                   # the same OoM so the score doesn't lurch on a number
                                   # the paper didn't actually restate as a clean logical
                                   # count. Documented in methodology.
    physical_qubits=1_000_000,
    runtime="<1 week",
    phys_gate_error_assumed=0.001,
    source="https://arxiv.org/abs/2505.15917",
    citation="Gidney 2025, 'How to factor 2048 bit RSA integers with less than a million "
             "noisy qubits' (arXiv:2505.15917). ~20x physical-qubit reduction vs 2019 from "
             "algorithmic + error-correction advances; SAME hardware assumptions.",
    confidence="peer_reviewed",
    as_of="2025-05",
)

# The active anchor for the launch score. Swap this line (or pass a different Anchor to
# score_system) to retarget. Everything downstream is anchor-relative.
ACTIVE_ANCHOR = ANCHOR_RSA2048_2025


# --------------------------------------------------------------------------------------
# Formula parameters. All of these are stated, with rationale, in the methodology doc.
# They live here as named constants so the doc and the code never drift.
# --------------------------------------------------------------------------------------

# Surface-code fault-tolerance threshold region. The gate is a sigmoid CENTERED here.
# We pick the value the anchor itself assumes (0.1% physical gate error => ~99.0% gate
# fidelity) so "the threshold" in the score is the threshold the *target estimate* used,
# not a number we invented. WIDTH is deliberately wide so the gate is low-resolution: a
# machine at 99.0% and one at 99.84% both read as "early but over the line", which is the
# honest reading given XEB-vs-ECR-vs-RB incomparability.
FT_THRESHOLD_FIDELITY = 0.99        # ~ 1 - 0.001 physical gate error (anchor assumption)
FT_GATE_WIDTH = 0.0075              # sigmoid scale: ~0.75 pp. Wide ON PURPOSE.

# ECSignal: a demonstrated below-threshold EC result is the strongest signal in the set.
# Floor applies to everyone who has NOT demonstrated it; the demonstrated bonus is bounded
# so EC alone can't manufacture a large score on its own (it multiplies a tiny capacity).
EC_FLOOR = 0.15                     # no demonstrated below-threshold scaling
EC_DEMONSTRATED = 1.0               # demonstrated below-threshold (e.g. Willow Lambda>1)

# LogicalCapacity log-map. effective_logical in [0, anchor]; mapped via
# log1p(effective)/log1p(anchor) so 0 -> 0 and a single real logical qubit is small but
# not flattened to zero. Physical qubits do NOT enter this term.
def _logical_capacity(effective_logical: float, anchor_logical: int) -> float:
    if effective_logical <= 0:
        return 0.0
    return math.log1p(effective_logical) / math.log1p(anchor_logical)


# --------------------------------------------------------------------------------------
# READINESS SUB-SCORE (Option A, signed off). A SEPARATE, ADDITIVE axis — structurally
# unlike the multiplicative threat score on purpose, so the two can never be confused.
#
#   Threat score : multiplicative GATE. Zero error-corrected logical qubits => 0.000.
#                  Answers "distance to a named RSA resource estimate". Brutally honest.
#   Readiness    : weighted SUM of preconditions a system has assembled. Answers ONLY
#                  "how far along the preconditions is this machine / what would move it".
#                  NEVER labeled as distance-to-breaking-RSA. Never gates anything.
#
# Readiness is the data behind the dashboard's "what would change this score" panel. It is
# explicitly NOT a threat number. A system can have meaningful readiness and a 0.000 threat
# score at the same time — that is the correct, honest state of the field today.
#
# Components (each in [0,1], summed with stated weights to [0,100]):
#   - fidelity_progress : how far 2Q fidelity sits relative to the FT threshold (sigmoid,
#                         same low-resolution gate — coarse by design).
#   - ec_progress       : 1.0 if below-threshold EC demonstrated, partial if a QEC demo
#                         exists (virtualization-layer), floor otherwise.
#   - scale_progress    : log-scaled physical-qubit count vs the anchor's physical figure.
#                         Physical scale belongs HERE (a precondition), never in the threat
#                         score (where, absent EC, it must not imply progress toward RSA).
# --------------------------------------------------------------------------------------

READINESS_WEIGHTS = {"fidelity": 0.40, "ec": 0.40, "scale": 0.20}


def _readiness(system: dict, anchor: Anchor, *, below_thr: bool,
               fidelity_gate_value: Optional[float]) -> Optional[dict]:
    """Additive readiness breakdown. None for analog (N/A on threat => N/A on readiness too,
    to avoid implying a gate-model trajectory where there is none)."""
    method = system.get("two_qubit_gate_fidelity_method")
    if method in ANALOG_METHODS or "analog_not_gate_model" in system.get("disclaimer_keys", []):
        return None

    # fidelity progress: reuse the coarse gate (or 0 if no 2Q and no demonstration)
    fidelity_progress = fidelity_gate_value if fidelity_gate_value is not None else 0.0

    # ec progress: demonstrated below-threshold = full; a QEC demo (virtualization) = partial
    keys = system.get("disclaimer_keys", [])
    if below_thr:
        ec_progress = 1.0
    elif "logical_qubits_are_demos" in keys and system.get("logical_qubits"):
        ec_progress = 0.4   # a real QEC demonstration exists, but not standing below-threshold
    else:
        ec_progress = 0.0

    # scale progress: log10(physical) / log10(anchor physical). A precondition, not a threat.
    pq = system.get("physical_qubits")
    scale_progress = (math.log10(pq) / math.log10(anchor.physical_qubits)) if pq else 0.0
    scale_progress = max(0.0, min(1.0, scale_progress))

    total = (READINESS_WEIGHTS["fidelity"] * fidelity_progress
             + READINESS_WEIGHTS["ec"] * ec_progress
             + READINESS_WEIGHTS["scale"] * scale_progress) * 100.0
    return {
        "readiness": total,
        "fidelity_progress": fidelity_progress,
        "ec_progress": ec_progress,
        "scale_progress": scale_progress,
        "_meaning": "progress toward preconditions; NOT distance to breaking RSA",
    }


def _fidelity_gate(two_qubit_fidelity: Optional[float],
                   *, below_threshold_demonstrated: bool) -> float:
    """
    Sigmoid gate around the FT threshold. Low-resolution by design.

    Special cases honored:
      - A system that has DEMONSTRATED below-threshold EC has, by definition, shown its
        physical error rate is on the right side of the threshold for that code. Its gate
        is treated as effectively open even if it doesn't headline an isolated 2Q number
        (Google/Willow leads with logical-error-per-cycle + XEB, 2Q is null by design).
      - A null 2Q WITHOUT a below-threshold demonstration cannot open the gate on faith.
        It returns 0.0 (no fault-tolerant path is evidenced). For analog systems this code
        path is never reached — they're routed to N/A upstream.
    """
    if below_threshold_demonstrated:
        return 1.0
    if two_qubit_fidelity is None:
        return 0.0
    # logistic centered at threshold; width keeps it coarse.
    return 1.0 / (1.0 + math.exp(-(two_qubit_fidelity - FT_THRESHOLD_FIDELITY) / FT_GATE_WIDTH))


# --------------------------------------------------------------------------------------
# Effective standing logical qubits. The honesty crux: vendor "logical qubit" claims that
# are QEC *demonstrations* (tagged logical_qubits_are_demos) are NOT standing capacity.
# Only a logical-qubit count backed by a real below-threshold demonstration counts.
# --------------------------------------------------------------------------------------

def _effective_logical(system: dict) -> float:
    raw = system.get("logical_qubits")
    if not raw:
        return 0.0
    keys = system.get("disclaimer_keys", [])
    demonstrated = system.get("error_correction_below_threshold") is True
    # If the only basis for the logical count is a QEC demo (virtualization-layer claim)
    # and there is no standing below-threshold demonstration, it is not standing capacity.
    if "logical_qubits_are_demos" in keys and not demonstrated:
        return 0.0
    return float(raw)


# --------------------------------------------------------------------------------------
# Input-confidence aggregation — surfaced alongside every score (plan §6, §8).
# --------------------------------------------------------------------------------------

_CONF_WEIGHT = {"peer_reviewed": 1.0, "vendor_published": 0.6, None: 0.0}
# Fields that actually feed the score; their provenance is what we aggregate.
_SCORED_FIELDS = ("logical_qubits", "two_qubit_gate_fidelity",
                  "error_correction_below_threshold", "physical_qubits")


def _input_confidence(system: dict) -> dict:
    present, weighted = 0, 0.0
    detail = {}
    for f in _SCORED_FIELDS:
        conf = system.get(f"{f}_confidence")
        detail[f] = conf
        if system.get(f) is not None:
            present += 1
            weighted += _CONF_WEIGHT.get(conf, 0.0)
    level = "none"
    if present:
        avg = weighted / present
        level = "high" if avg >= 0.85 else "medium" if avg >= 0.5 else "low"
    return {"level": level, "by_field": detail}


# --------------------------------------------------------------------------------------
# Scoring.
# --------------------------------------------------------------------------------------

@dataclass
class ScoredSystem:
    vendor: str
    system_name: str
    modality: str
    score: Optional[float]              # None == N/A (analog / out of category)
    na_reason: Optional[str]
    logical_capacity: Optional[float]
    fidelity_gate: Optional[float]
    ec_signal: Optional[float]
    effective_logical: float
    readiness: Optional[dict]           # SEPARATE axis: preconditions, NOT threat distance
    input_confidence: dict
    flags: list
    notes: str = ""


ANALOG_METHODS = {"analog_not_applicable"}


def score_system(system: dict, anchor: Anchor = ACTIVE_ANCHOR) -> ScoredSystem:
    vendor = system["vendor"]
    name = system["system_name"]
    modality = system.get("modality", "unknown")
    keys = system.get("disclaimer_keys", [])
    flags = []

    # --- Analog routing: explicit N/A, NOT a low score (plan §, dataset analog_not_gate_model)
    method = system.get("two_qubit_gate_fidelity_method")
    is_analog = method in ANALOG_METHODS or "analog_not_gate_model" in keys
    if is_analog:
        return ScoredSystem(
            vendor=vendor, system_name=name, modality=modality,
            score=None, na_reason="analog_not_gate_model",
            logical_capacity=None, fidelity_gate=None, ec_signal=None,
            effective_logical=0.0,
            readiness=None,
            input_confidence=_input_confidence(system),
            flags=["analog: no gate-model Shor pathway; N/A is a category difference, not a low score"],
            notes=system.get("notes", ""),
        )

    # --- Heron r2 weak-fidelity flag (Chat B open decision, resolved by sensitivity test below).
    if "calibration_snapshot_drifts" in keys and system.get("two_qubit_gate_fidelity") is not None:
        flags.append("2Q fidelity is a dated calibration-snapshot median, not a fixed per-device value")

    # --- Method heterogeneity flag: always surface that the raw 2Q column is not apples-to-apples.
    if method and system.get("two_qubit_gate_fidelity") is not None:
        flags.append(f"2Q fidelity method = {method}; not directly comparable across vendors")

    eff_logical = _effective_logical(system)
    below_thr = system.get("error_correction_below_threshold") is True

    lc = _logical_capacity(eff_logical, anchor.logical_qubits)
    fg = _fidelity_gate(system.get("two_qubit_gate_fidelity"), below_threshold_demonstrated=below_thr)
    ec = EC_DEMONSTRATED if below_thr else EC_FLOOR

    if below_thr:
        flags.append("below-threshold EC demonstrated (load-bearing signal; opens fidelity gate)")
    if system.get("two_qubit_gate_fidelity") is None and not below_thr:
        flags.append("no isolated 2Q fidelity and no below-threshold demonstration: fidelity gate = 0")

    score = lc * fg * ec * 100.0

    readiness = _readiness(system, anchor, below_thr=below_thr, fidelity_gate_value=fg)

    return ScoredSystem(
        vendor=vendor, system_name=name, modality=modality,
        score=score, na_reason=None,
        logical_capacity=lc, fidelity_gate=fg, ec_signal=ec,
        effective_logical=eff_logical,
        readiness=readiness,
        input_confidence=_input_confidence(system),
        flags=flags, notes=system.get("notes", ""),
    )


@dataclass
class FieldResult:
    anchor: dict
    hero_frontier_score: float          # the FIELD FRONTIER — leading-edge, NOT "the winner"
    hero_confidence_band: tuple
    composite_industry_score: float     # mean across scored (non-N/A) systems
    n_scored: int
    n_na: int
    scored: list                        # list[ScoredSystem] as dicts


def score_field(dataset: dict, anchor: Anchor = ACTIVE_ANCHOR) -> FieldResult:
    results = [score_system(s, anchor) for s in dataset["systems"]]
    scored = [r for r in results if r.score is not None]
    na = [r for r in results if r.score is None]

    numeric = [r.score for r in scored]
    # FIELD FRONTIER, not a crowned machine: the leading edge is the field's current
    # demonstrated reach. We report it as a value + a confidence band derived from the
    # spread of the top cluster, and we NEVER attach a vendor name to the hero number.
    frontier = max(numeric) if numeric else 0.0
    # confidence band: frontier is evidence-limited; band reflects how far the next systems
    # trail and the input-confidence of the frontier-defining evidence.
    spread = frontier - (sorted(numeric, reverse=True)[1] if len(numeric) > 1 else 0.0)
    band = (max(0.0, frontier - spread * 0.5), frontier)
    composite = sum(numeric) / len(numeric) if numeric else 0.0

    return FieldResult(
        anchor=asdict(anchor),
        hero_frontier_score=frontier,
        hero_confidence_band=band,
        composite_industry_score=composite,
        n_scored=len(scored),
        n_na=len(na),
        scored=[asdict(r) for r in results],
    )


# --------------------------------------------------------------------------------------
# INTERNAL projection model (plan §3: BUILD NOW, HOLD INTERNAL). Fit log-capability vs
# year to historical anchors. NOT wired to any public output. Conservative; caveats loud.
# Guarded behind an explicit opt-in so it can never accidentally publish.
# --------------------------------------------------------------------------------------

def _proxy_capability(system: dict) -> Optional[float]:
    """A crude, internal-only capability proxy for trajectory fitting: physical-qubit
    count scaled by whether below-threshold EC is demonstrated. Intentionally rough — the
    point is the *slope*, and the model is held back precisely because it is not yet
    hostile-researcher-proof."""
    pq = system.get("physical_qubits")
    if not pq:
        return None
    boost = 4.0 if system.get("error_correction_below_threshold") else 1.0
    return math.log10(pq) * boost


def fit_internal_projection(dataset: dict) -> dict:
    """INTERNAL ONLY. Returns a dict explicitly flagged do-not-publish. No year-range is
    emitted to any caller that prints to a public surface."""
    pts = []
    for s in dataset["systems"] + dataset.get("historical_anchors", []):
        y, cap = s.get("release_year"), _proxy_capability(s)
        if y and cap:
            pts.append((y, cap))
    pts.sort()
    slope = None
    if len(pts) >= 2:
        xs = [p[0] for p in pts]
        ys = [p[1] for p in pts]
        n = len(pts)
        mx, my = sum(xs) / n, sum(ys) / n
        denom = sum((x - mx) ** 2 for x in xs)
        slope = sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / denom if denom else None
    return {
        "_DO_NOT_PUBLISH": True,
        "_status": "INTERNAL — held back per plan §3 until the model is defensible. "
                   "No public year-range is emitted at launch.",
        "n_points": len(pts),
        "log_capability_slope_per_year": slope,
        "caveats": [
            "Proxy capability is rough (physical count x EC boost); not a logical-qubit forecast.",
            "Breakthroughs accelerate (cf. anchor moving 20x in 6 yrs on algorithm side alone).",
            "Error-correction threshold walls / stagnation can delay; both directions are live.",
        ],
    }


# --------------------------------------------------------------------------------------
# Heron sensitivity test (Chat B open decision): does the dated 2024-08 median 2Q move
# Heron's score? Run it with the value, and with it nulled, and report the delta.
# --------------------------------------------------------------------------------------

def heron_sensitivity(dataset: dict, anchor: Anchor = ACTIVE_ANCHOR) -> dict:
    heron = next((s for s in dataset["systems"]
                  if s["vendor"] == "IBM" and s["system_name"].startswith("Heron")), None)
    if heron is None:
        return {}
    with_val = score_system(heron, anchor).score
    nulled = dict(heron)
    nulled["two_qubit_gate_fidelity"] = None
    without_val = score_system(nulled, anchor).score
    return {
        "with_dated_median": with_val,
        "with_2Q_nulled": without_val,
        "delta": (with_val or 0) - (without_val or 0),
    }


def load_dataset(path: str | Path = "data/quantum_hardware.json") -> dict:
    return json.loads(Path(path).read_text())


if __name__ == "__main__":
    ds = load_dataset()
    result = score_field(ds)

    print("=" * 78)
    print("Q-DAY INDEX — RSA-2048 threat score (sample run, NOT a published artifact)")
    print("=" * 78)
    a = result.anchor
    print(f"Anchor: {a['label']} | {a['target']} | {a['physical_qubits']:,} phys, "
          f"{a['logical_qubits']:,} logical (OoM) | {a['runtime']} | {a['confidence']}")
    print(f"Source: {a['source']}")
    print("-" * 78)
    print(f"{'Vendor':14}{'System':26}{'Threat':>7} {'Ready':>6}  {'LC':>6} {'FG':>5} {'EC':>5}  conf")
    print("-" * 78)
    for r in result.scored:
        if r["score"] is None:
            print(f"{r['vendor']:14}{r['system_name']:26}{'N/A':>7} {'N/A':>6}  "
                  f"{'—':>6} {'—':>5} {'—':>5}  {r['input_confidence']['level']}   "
                  f"[{r['na_reason']}]")
        else:
            ready = r["readiness"]["readiness"] if r["readiness"] else 0.0
            print(f"{r['vendor']:14}{r['system_name']:26}{r['score']:>7.3f} {ready:>6.1f}  "
                  f"{r['logical_capacity']:>6.3f} {r['fidelity_gate']:>5.2f} "
                  f"{r['ec_signal']:>5.2f}  {r['input_confidence']['level']}")
    print("-" * 78)
    print(f"HERO — field frontier THREAT score : {result.hero_frontier_score:.3f}  "
          f"(band {result.hero_confidence_band[0]:.3f}–{result.hero_confidence_band[1]:.3f})")
    print(f"Composite industry THREAT score    : {result.composite_industry_score:.3f}")
    print(f"Scored: {result.n_scored}   N/A (analog/out-of-category): {result.n_na}")
    print("Threat = distance to a named RSA estimate (multiplicative gate; honest zeros).")
    print("Ready  = progress toward preconditions (additive; the 'what would change this').")
    print("Honest reading: threat is low single digits. The trajectory is the story.")
    print("=" * 78)

    print("\nHERON r2 SENSITIVITY (Chat B open decision):")
    hs = heron_sensitivity(ds)
    print(f"  score with dated 2024-08 median 2Q : {hs['with_dated_median']:.4f}")
    print(f"  score with 2Q nulled               : {hs['with_2Q_nulled']:.4f}")
    print(f"  delta                              : {hs['delta']:.4f}")

    print("\nINTERNAL PROJECTION (held back — not published):")
    proj = fit_internal_projection(ds)
    print(f"  _DO_NOT_PUBLISH = {proj['_DO_NOT_PUBLISH']}  | points = {proj['n_points']}  "
          f"| slope/yr = {proj['log_capability_slope_per_year']}")
