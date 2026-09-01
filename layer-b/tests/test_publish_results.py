"""
What may travel from a result file to the website.

`publish-results.py` is the gate between a measured artifact and the public
build. It grew a second and third result shape when work-orders 023 and 024
landed, and each shape carries a promise the file itself states in prose. This
asserts the promises are enforced rather than merely written down:

* the cross-library track publishes **no timings** -- its builds run on a
  shared CI runner, and a speed figure from there would undo the
  dedicated-measurement-host discipline every other number depends on;
* each track ships the scope note that stops a true observation being read as
  the wrong claim;
* per-library probes stay inputs to the merge rather than three files on the
  site saying less than the one that reconciles them.

Fixtures use obviously-fake values. Nothing here is a measurement.
"""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path

import pytest

MODULE_PATH = Path(__file__).resolve().parents[1] / "publish-results.py"

spec = importlib.util.spec_from_file_location("publish_results", MODULE_PATH)
assert spec and spec.loader
publish = importlib.util.module_from_spec(spec)
spec.loader.exec_module(publish)


def compat(**over) -> dict:
    base = {
        "schema": "app-compat/1",
        "track": "app-compat",
        "scope": {"defaults_not_limits": "configurable defaults, not limits"},
        "http_front_doors": [],
        "certificate_parsers": [],
    }
    base.update(over)
    return base


def crosslib_merged(**over) -> dict:
    base = {
        "schema": "crosslib-merged/1",
        "track": "crosslib",
        "scope": {"what_a_negative_means": "not observed in THIS build"},
        "libraries": {},
        "cross_validation": {"measurable": True, "corroborated": []},
    }
    base.update(over)
    return base


class TestKindDispatch:
    def test_each_schema_maps_to_its_own_family(self):
        assert publish.kind_of(compat()) == "app-compat"
        assert publish.kind_of(crosslib_merged()) == "crosslib-merged"
        assert publish.kind_of({"schema": "crosslib/1"}) == "crosslib-part"
        assert publish.kind_of({"schema": "layer-b/0.2.0"}) == "layer-b-scenario"

    def test_an_unknown_schema_is_treated_as_a_scenario(self):
        # Falling back to the strictest rules is the safe direction: a new
        # shape gets refused for missing identity/outcome rather than sailing
        # through unvalidated.
        assert publish.kind_of({"schema": "something-new/1"}) == "layer-b-scenario"


class TestCrossLibraryPublishesNoTimings:
    def test_a_clean_result_passes(self):
        assert publish.validate(crosslib_merged(), Path("x.json")) == []

    def test_a_leaked_timing_anywhere_in_the_tree_is_refused(self):
        leaked = crosslib_merged(
            libraries={"AWS-LC": {"primitives": [{"name": "ML-KEM-768", "median_us": 9999}]}}
        )
        problems = publish.validate(leaked, Path("x.json"))
        assert problems, "a timing reached a track that promises none"
        assert "median_us" in problems[0]
        assert "shared CI runner" in problems[0]

    def test_a_null_timing_field_is_not_a_leak(self):
        # A key present but empty is how a stripped field looks; refusing it
        # would make sanitise() and validate() contradict each other.
        assert publish.validate(
            crosslib_merged(libraries={"AWS-LC": {"median_us": None}}), Path("x.json")
        ) == []

    def test_the_negative_caveat_is_mandatory(self):
        problems = publish.validate(crosslib_merged(scope={}), Path("x.json"))
        assert any("what_a_negative_means" in p for p in problems)


class TestApplicationCompatibility:
    def test_a_clean_result_passes(self):
        assert publish.validate(compat(), Path("x.json")) == []

    def test_the_defaults_caveat_is_mandatory(self):
        problems = publish.validate(compat(scope={}), Path("x.json"))
        assert any("defaults_not_limits" in p for p in problems)

    def test_missing_probe_halves_are_reported(self):
        result = compat()
        del result["certificate_parsers"]
        problems = publish.validate(result, Path("x.json"))
        assert any("certificate_parsers" in p for p in problems)


class TestScenarioRulesAreUnchanged:
    def test_a_scenario_still_needs_wire_provenance_for_its_group(self):
        result = {
            "schema": "layer-b/0.2.0",
            "identity": {"label": "pairwise"},
            "outcome": {"outcome": "negotiated"},
            "wire": {"negotiated_group": {"name": "X25519MLKEM768", "source": "s_client said so"}},
        }
        problems = publish.validate(result, Path("x.json"))
        assert any("wire-bytes provenance" in p for p in problems)

    def test_an_unpublishable_duration_is_still_stripped(self):
        result = {
            "schema": "layer-b/0.2.0",
            "identity": {"label": "pairwise"},
            "outcome": {},
            "timing": {"publishable": False, "duration_seconds": 9999},
        }
        clean, stripped = publish.sanitise(result)
        assert clean["timing"]["duration_seconds"] is None
        assert "timing.duration_seconds" in stripped


class TestRealCommittedResults:
    """The files this repo actually ships must pass their own gate."""

    RESULTS = Path(__file__).resolve().parents[1] / "results"

    @pytest.mark.parametrize(
        "name",
        ["app-compat-2026-09-01-nogit.json", "crosslib-merged-2026-09-01.json"],
    )
    def test_committed_result_validates(self, name: str):
        path = self.RESULTS / name
        if not path.is_file():
            pytest.skip(f"{name} not present")
        result = json.loads(path.read_text(encoding="utf-8"))
        assert publish.validate(result, path) == []
