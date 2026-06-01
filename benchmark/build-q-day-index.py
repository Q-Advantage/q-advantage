#!/usr/bin/env python3
"""
Q-Day Index — dashboard data emitter.

Runs benchmark/scoring.py (the single source of truth for the math) against
data/quantum_hardware.json, joins the per-system PROVENANCE the dashboard needs,
and writes web/lib/data/q-day-index.generated.json for the Next.js app to render.

NO MATH is re-derived here or in the frontend — this only SELECTS and RESHAPES
scoring.py output for rendering.

This mirrors the Q-Shield data pattern, with one deliberate difference: Vercel does
NOT run Python. You run THIS locally (where your Python env lives), commit the emitted
JSON (your repo already commits generated data, e.g. benchmark/results/*.json), and
Vercel's `next build` just renders the committed JSON. Run from the repo root:

    python3 benchmark/build-q-day-index.py

Re-run it whenever data/quantum_hardware.json or benchmark/scoring.py changes, then
commit the regenerated JSON alongside.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

# repo root = parent of benchmark/
ROOT = Path(__file__).resolve().parent.parent
# import scoring.py as a library from benchmark/
sys.path.insert(0, str(ROOT / "benchmark"))
import scoring  # noqa: E402

DATASET_PATH = ROOT / "data" / "quantum_hardware.json"
OUT_PATH = ROOT / "web" / "lib" / "data" / "q-day-index.generated.json"

# Presentation-only flags that are NOT score inputs (accessibility is not a threat input).
PRESENTATION_FLAGS = {
    ("USTC (Zuchongzhi)", "Zuchongzhi 3.0"): {
        "region_gated": True,
        "region_note": (
            "Cloud access reported via China Telecom's Tianyan platform and may be "
            "region-constrained. Accessibility is not a threat input — it does not "
            "affect the score; shown here as a presentation-layer flag only."
        ),
    },
}

PROVENANCE_FIELDS = [
    "physical_qubits", "logical_qubits", "two_qubit_gate_fidelity",
    "single_qubit_gate_fidelity", "t1_coherence_us", "t2_coherence_us",
    "error_correction_below_threshold", "cloud_available",
]


def _provenance(raw_system: dict) -> dict:
    out = {}
    for f in PROVENANCE_FIELDS:
        out[f] = {
            "value": raw_system.get(f),
            "source": raw_system.get(f"{f}_source"),
            "confidence": raw_system.get(f"{f}_confidence"),
            "method": raw_system.get(f"{f}_method"),
            "as_of": raw_system.get(f"{f}_as_of"),
            "notes": raw_system.get(f"{f}_notes"),
        }
    return out


def main() -> None:
    dataset = scoring.load_dataset(DATASET_PATH)
    field = scoring.score_field(dataset)
    raw_by_key = {(s["vendor"], s["system_name"]): s for s in dataset["systems"]}

    systems_out = []
    for r in field.scored:
        key = (r["vendor"], r["system_name"])
        raw = raw_by_key.get(key, {})
        systems_out.append({
            "vendor": r["vendor"],
            "system_name": r["system_name"],
            "modality": r["modality"],
            "threat_score": r["score"],
            "na_reason": r["na_reason"],
            "threat_components": None if r["score"] is None else {
                "logical_capacity": r["logical_capacity"],
                "fidelity_gate": r["fidelity_gate"],
                "ec_signal": r["ec_signal"],
                "effective_logical": r["effective_logical"],
            },
            "readiness": r["readiness"],
            "input_confidence": r["input_confidence"],
            "flags": r["flags"],
            "disclaimer_keys": raw.get("disclaimer_keys", []),
            "provenance": _provenance(raw),
            "release_year": raw.get("release_year"),
            "topology": raw.get("topology"),
            "notes": r["notes"],
            "presentation": PRESENTATION_FLAGS.get(key, {}),
        })

    out = {
        "_generated_by": "benchmark/build-q-day-index.py via benchmark/scoring.py (source of truth)",
        "_do_not_edit": "Regenerate: python3 benchmark/build-q-day-index.py — never hand-edit.",
        "anchor": field.anchor,
        "hero": {
            "frontier_threat_score": field.hero_frontier_score,
            "confidence_band": list(field.hero_confidence_band),
            "composite_industry_score": field.composite_industry_score,
            "n_scored": field.n_scored,
            "n_na": field.n_na,
        },
        "anchor_prior": {
            "label": scoring.ANCHOR_RSA2048_2019.label,
            "physical_qubits": scoring.ANCHOR_RSA2048_2019.physical_qubits,
            "runtime": scoring.ANCHOR_RSA2048_2019.runtime,
            "source": scoring.ANCHOR_RSA2048_2019.source,
            "as_of": scoring.ANCHOR_RSA2048_2019.as_of,
        },
        "systems": systems_out,
        "announced_not_scored": dataset.get("announced_not_scored", []),
        "historical_anchors": [
            {"vendor": h["vendor"], "system_name": h["system_name"],
             "release_year": h.get("release_year"),
             "physical_qubits": h.get("physical_qubits"),
             "modality": h.get("modality")}
            for h in dataset.get("historical_anchors", [])
        ],
        "disclaimer_keys_present": sorted({
            k for s in systems_out for k in s["disclaimer_keys"]
        }),
    }

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(out, indent=2))
    print(f"wrote {OUT_PATH.relative_to(ROOT)}")
    print(f"  hero frontier threat = {out['hero']['frontier_threat_score']:.3f}  "
          f"band {out['hero']['confidence_band'][0]:.3f}-{out['hero']['confidence_band'][1]:.3f}")
    print(f"  composite = {out['hero']['composite_industry_score']:.3f}  "
          f"scored={out['hero']['n_scored']} na={out['hero']['n_na']}")
    print(f"  anchor (active) = {out['anchor']['label']} @ "
          f"{out['anchor']['physical_qubits']:,} physical")


if __name__ == "__main__":
    main()
