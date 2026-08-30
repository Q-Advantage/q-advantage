"""
Cryptographic throughput under load (`qshield-update-spec.md` §15 Tier 2,
CFDIR's MIA line item).

The thing most worth protecting here is the LABEL. `layer-b-spec.md` §7 exists
because two different numbers were at risk of sharing one casual name, and this
module is one of them — Layer B publishes the other. A future edit that shortens
"cryptographic throughput under load" to "concurrency" would undo the whole
point, so several tests below assert the wording rather than the arithmetic.

Runs without liboqs. The scheduling, synchronisation and aggregation are the
risky parts and they are exercised through a synthetic CPU-bound operation that
lives in its own registry and can never reach a published result.

Durations are deliberately tiny: these test the machinery, not the machine.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "protocols"))

import concurrency  # noqa: E402

SPIN = concurrency.TEST_OP_PREFIX + "spin"


class TestTheLabelDiscipline:
    def test_the_label_is_not_the_word_concurrency(self):
        # spec section 7: neither number may be called "concurrency"
        # unqualified, because the other one has an equal claim to the word.
        assert concurrency.LABEL == "cryptographic throughput under load"
        assert concurrency.LABEL != "concurrency"

    def test_the_note_names_what_this_is_not(self):
        note = concurrency.LABEL_NOTE
        assert "NOT connections per core" in note
        assert "no sockets" in note
        assert "Layer B" in note

    def test_the_label_travels_in_every_operation_payload(self, monkeypatch):
        # Left to a page to add, it would go missing on the first surface that
        # forgot. It ships with the data.
        monkeypatch.setattr(concurrency, "OPERATIONS", {SPIN: concurrency._op_synthetic_spin})
        monkeypatch.setattr(concurrency, "QUICK_WORKERS", (1,))
        monkeypatch.setattr(concurrency, "QUICK_DURATION_S", 0.15)
        r = concurrency.run(quick=True)
        assert r["method"]["label"] == concurrency.LABEL
        for op in r["operations"].values():
            assert op["label"] == concurrency.LABEL
            assert "Layer B" in op["label_note"]


class TestSyntheticOpsCannotReachAResult:
    def test_the_test_registry_is_separate_from_the_real_one(self):
        assert SPIN not in concurrency.OPERATIONS
        assert SPIN in concurrency._TEST_OPERATIONS

    def test_run_iterates_only_the_real_registry(self):
        # `run()` reads OPERATIONS, so a synthetic operation cannot appear in a
        # published file even though a worker can resolve it.
        assert all(not k.startswith(concurrency.TEST_OP_PREFIX) for k in concurrency.OPERATIONS)

    def test_the_prefix_is_reserved_and_obvious(self):
        assert concurrency.TEST_OP_PREFIX.startswith("__")
        assert concurrency._resolve_op(SPIN) is concurrency._op_synthetic_spin


class TestMeasurement:
    def test_a_single_worker_point_measures(self):
        p = concurrency.measure_point(SPIN, 1, 0.15)
        assert p["measured"] is True
        assert p["n_workers"] == 1
        assert p["workers_reporting"] == 1
        assert p["ops_completed_total"] > 0
        assert p["aggregate_ops_per_sec"] > 0

    def test_every_worker_reports(self):
        p = concurrency.measure_point(SPIN, 3, 0.15)
        assert p["workers_reporting"] == 3

    def test_more_workers_complete_more_work_in_the_same_window(self):
        # The weakest claim that is still meaningful. Anything stronger would
        # be asserting a property of whatever machine the test runs on.
        one = concurrency.measure_point(SPIN, 1, 0.2)
        two = concurrency.measure_point(SPIN, 2, 0.2)
        assert two["ops_completed_total"] > one["ops_completed_total"]

    def test_per_worker_rates_are_ordered(self):
        p = concurrency.measure_point(SPIN, 2, 0.15)
        r = p["per_worker_ops_per_sec"]
        assert r["min"] <= r["median"] <= r["max"]

    def test_an_unknown_operation_is_reported_not_raised(self):
        p = concurrency.measure_point("does-not-exist", 1, 0.1)
        assert p["measured"] is False
        assert "KeyError" in p["reason"] or "reason" in p


class TestOversubscriptionIsNeverCalledScaling:
    @pytest.fixture()
    def result(self, monkeypatch):
        monkeypatch.setattr(concurrency, "OPERATIONS", {SPIN: concurrency._op_synthetic_spin})
        monkeypatch.setattr(concurrency, "QUICK_WORKERS", (1, 2))
        monkeypatch.setattr(concurrency, "QUICK_DURATION_S", 0.15)
        return concurrency.run(quick=True)

    def test_every_measured_point_records_whether_it_was_oversubscribed(self, result):
        for p in result["operations"][SPIN]["points"]:
            if p.get("measured"):
                assert "oversubscribed" in p

    def test_the_core_count_is_published_with_the_numbers(self, result):
        # A scaling figure without the core count it was taken on is not
        # interpretable, and section 15 Tier 2 flags the daily box's two vCPUs
        # as the limiting fact.
        assert result["environment"]["cpu_cores_logical"] >= 1
        assert "logical cores" in result["method"]["core_count_caveat"]

    def test_an_oversubscribed_point_says_so_in_its_own_note(self, monkeypatch):
        # A single summary sentence is the thing that gets quoted without its
        # qualifier, so the caveat is attached per point.
        monkeypatch.setattr(concurrency, "OPERATIONS", {SPIN: concurrency._op_synthetic_spin})
        monkeypatch.setattr(concurrency, "QUICK_WORKERS", (1, 2))
        monkeypatch.setattr(concurrency, "QUICK_DURATION_S", 0.15)
        monkeypatch.setattr(concurrency.os, "cpu_count", lambda: 1)
        r = concurrency.run(quick=True)
        two = next(p for p in r["operations"][SPIN]["points"] if p["n_workers"] == 2)
        assert two["oversubscribed"] is True
        assert "oversubscribed" in two["efficiency_note"]
        assert "rather than parallel scaling" in two["efficiency_note"]

    def test_a_point_within_the_core_count_says_that_instead(self, monkeypatch):
        monkeypatch.setattr(concurrency, "OPERATIONS", {SPIN: concurrency._op_synthetic_spin})
        monkeypatch.setattr(concurrency, "QUICK_WORKERS", (1, 2))
        monkeypatch.setattr(concurrency, "QUICK_DURATION_S", 0.15)
        monkeypatch.setattr(concurrency.os, "cpu_count", lambda: 8)
        r = concurrency.run(quick=True)
        two = next(p for p in r["operations"][SPIN]["points"] if p["n_workers"] == 2)
        assert two["oversubscribed"] is False
        assert "fits within the host" in two["efficiency_note"]


class TestMethodIsDisclosed:
    @pytest.fixture()
    def method(self, monkeypatch):
        monkeypatch.setattr(concurrency, "OPERATIONS", {SPIN: concurrency._op_synthetic_spin})
        monkeypatch.setattr(concurrency, "QUICK_WORKERS", (1,))
        monkeypatch.setattr(concurrency, "QUICK_DURATION_S", 0.15)
        return concurrency.run(quick=True)["method"]

    def test_it_states_why_processes_rather_than_threads(self, method):
        # A threaded version would measure the GIL and report it as
        # cryptographic scaling.
        assert "GIL" in method["parallelism"]

    def test_it_states_why_a_fixed_duration_rather_than_a_fixed_count(self, method):
        assert "partly-idle" in method["timing"] or "idle" in method["timing"]

    def test_it_states_that_workers_start_together(self, method):
        # Without it the first-spawned worker runs alone while its peers start,
        # inflating exactly the number under test.
        assert "wall-clock" in method["synchronisation"]

    def test_it_says_this_is_additive_to_the_isolated_benchmarks(self, method):
        assert "never a replacement" in method["relationship_to_single_op_track"]
