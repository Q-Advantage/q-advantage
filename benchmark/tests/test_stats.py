"""
Statistics and per-operation resource accounting.

Two things land here from `qshield-update-spec.md` §14 and §15 Tier 1, and both
are about what a number is allowed to claim rather than about arithmetic.

The confidence interval is on the MEAN. `stdev_us` describes how far individual
samples scattered, which on a shared host mostly describes the machine; the
interval describes how precisely the average is pinned down, and at n=1000 it
is roughly 3% of the stdev. Publishing the first without the second invites the
wrong arithmetic, so the tests below pin the distinction rather than the digits.

Needs no liboqs: these are pure functions over numbers the harness already
collects.
"""

from __future__ import annotations

import math
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "protocols"))

import common  # noqa: E402


class TestConfidenceInterval:
    def test_is_built_from_the_standard_error_not_the_deviation(self):
        # stdev 30 over n=900 is a standard error of 1, so the interval is
        # +/- 1.96 -- not +/- 30. This is the confusion the field exists to end.
        ci = common.confidence_interval(mean=100.0, stdev=30.0, n=900)
        assert ci["std_error_us"] == pytest.approx(1.0, abs=1e-6)
        assert ci["ci95_low_us"] == pytest.approx(100 - common.Z_95, abs=1e-3)
        assert ci["ci95_high_us"] == pytest.approx(100 + common.Z_95, abs=1e-3)

    def test_narrows_with_the_square_root_of_n(self):
        few = common.confidence_interval(mean=100.0, stdev=30.0, n=100)
        many = common.confidence_interval(mean=100.0, stdev=30.0, n=10_000)
        assert many["std_error_us"] == pytest.approx(few["std_error_us"] / 10, rel=1e-6)

    def test_refuses_an_interval_for_a_single_sample(self):
        # A one-sample "interval" would be zero-width, which reads as certainty
        # rather than as an absence of evidence.
        ci = common.confidence_interval(mean=100.0, stdev=0.0, n=1)
        assert ci["ci95_low_us"] is None
        assert ci["ci95_high_us"] is None
        assert "at least two samples" in ci["ci_note"]

    def test_refuses_when_the_mean_is_not_positive(self):
        assert common.confidence_interval(mean=0.0, stdev=1.0, n=1000)["ci95_low_us"] is None

    def test_a_perfectly_stable_measurement_has_a_zero_width_interval(self):
        ci = common.confidence_interval(mean=100.0, stdev=0.0, n=1000)
        assert ci["ci95_low_us"] == 100.0
        assert ci["ci95_high_us"] == 100.0

    def test_the_note_never_lets_it_read_as_a_prediction_interval(self):
        ci = common.confidence_interval(mean=100.0, stdev=10.0, n=1000)
        assert "on the MEAN" in ci["ci_note"]
        assert "not a prediction interval" in ci["ci_note"]


class TestComputeStatsCarriesTheInterval:
    def test_every_stats_block_gains_the_interval_fields(self):
        s = common.compute_stats([1000 * i for i in range(1, 1001)])
        for key in ("ci95_low_us", "ci95_high_us", "std_error_us", "ci_note"):
            assert key in s

    def test_the_interval_brackets_the_mean(self):
        s = common.compute_stats([1000 * i for i in range(1, 1001)])
        assert s["ci95_low_us"] < s["mean_us"] < s["ci95_high_us"]

    def test_the_interval_is_far_narrower_than_the_deviation(self):
        # The whole point: at n=1000 these are different by ~30x, and a reader
        # shown only the deviation concludes the measurement is imprecise.
        s = common.compute_stats([1000 * i for i in range(1, 1001)])
        half_width = s["ci95_high_us"] - s["mean_us"]
        assert half_width < s["stdev_us"] / 10

    def test_the_existing_fields_are_untouched(self):
        # This function has always mirrored benchmark.py's. A change to the
        # established fields would silently alter every published figure.
        s = common.compute_stats([1000, 2000, 3000, 4000, 5000])
        assert s["mean_us"] == 3.0
        assert s["median_us"] == 3.0
        assert s["min_us"] == 1.0
        assert s["max_us"] == 5.0
        assert s["n_iterations"] == 5

    def test_a_single_measurement_still_produces_a_stats_block(self):
        s = common.compute_stats([4200])
        assert s["n_iterations"] == 1
        assert s["stdev_us"] == 0.0
        assert s["ci95_low_us"] is None


class TestResourceAccounting:
    def test_reports_unmeasured_rather_than_zero_where_unsupported(self):
        # Zero CPU and zero memory would be a confident, false claim. The
        # measurement host is Linux; this path is local development only.
        r = common.resource_delta(None, None, 100)
        assert r["measured"] is False
        assert "cpu_us_per_op" not in r
        assert "resource module" in r["reason"]

    def test_divides_cpu_time_by_iterations(self):
        r = common.resource_delta((1.0, 1000), (2.5, 4000), 100)
        assert r["measured"] is True
        assert r["cpu_us_per_op"] == pytest.approx(15_000.0)
        assert r["cpu_seconds_total"] == pytest.approx(1.5)

    def test_does_NOT_divide_peak_memory_by_iterations(self):
        # ru_maxrss is a high-water mark that never falls. Dividing it would
        # produce a confident, meaningless per-operation footprint.
        r = common.resource_delta((1.0, 1000), (2.5, 4000), 100)
        assert r["max_rss_delta_bytes"] == 3000
        assert "not divided by the iteration count" in r["rss_note"]
        assert "per_op" not in r["rss_note"]

    def test_never_reports_negative_memory_growth(self):
        # ru_maxrss should not fall, but a sampling artefact must not surface
        # as a negative footprint.
        r = common.resource_delta((1.0, 5000), (2.0, 4000), 10)
        assert r["max_rss_delta_bytes"] == 0

    def test_states_that_cpu_reads_near_wall_time_by_construction(self):
        # spec section 15 Tier 1 asks for this to be said in the output, not
        # just known by whoever wrote it.
        r = common.resource_delta((1.0, 1000), (2.0, 2000), 10)
        assert "by construction" in r["cpu_note"]
        assert "contention" in r["cpu_note"]

    def test_records_the_unit_it_read_maxrss_in(self):
        # ru_maxrss is kilobytes on Linux and bytes on macOS. A figure without
        # its unit is a 1024x error waiting to be quoted.
        r = common.resource_delta((1.0, 1000), (2.0, 2000), 10)
        assert "kilobytes" in r["rss_unit_note"]

    def test_zero_iterations_is_unmeasured_not_a_division_by_zero(self):
        assert common.resource_delta((1.0, 1000), (2.0, 2000), 0)["measured"] is False
