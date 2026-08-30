"""
Kernel socket accounting: what a thin sample is allowed to claim.

The discipline under test is refusal. Sampling SYN_RECV under honest
concurrency catches the state briefly and rarely, so most of these assert that
a figure is withheld rather than published from too little data.
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "capture"))

from sockstat import MIN_SAMPLES, PAGE_BYTES, parse_samples, summarise  # noqa: E402

HEADER = "ts,tcp_inuse,tcp_orphan,tcp_tw,tcp_alloc,tcp_mem_pages,syn_recv,established"


def csv_of(rows: list[tuple]) -> str:
    lines = [HEADER]
    for i, (mem, syn, est) in enumerate(rows):
        lines.append("%d.0,10,0,0,10,%d,%d,%d" % (1700000000 + i, mem, syn, est))
    return "\n".join(lines) + "\n"


class TestParsing:
    def test_reads_well_formed_samples(self):
        s = parse_samples(csv_of([(100, 0, 0), (140, 2, 10)]))
        assert len(s) == 2
        assert s[1]["tcp_mem_pages"] == 140
        assert s[1]["established"] == 10

    def test_skips_a_truncated_final_row_rather_than_guessing(self):
        # Normal when the sampler is stopped mid-write.
        text = csv_of([(100, 0, 0)]) + "1700000009.0,10,0,0,10,"
        assert len(parse_samples(text)) == 1

    def test_empty_input_is_empty_not_an_error(self):
        assert parse_samples("") == []
        assert parse_samples(HEADER + "\n") == []


class TestSummarise:
    def test_no_samples_is_reported_as_unmeasurable(self):
        r = summarise([])
        assert r["measurable"] is False
        assert "No sockstat samples" in r["reason"]

    def test_reports_peaks_from_what_was_observed(self):
        r = summarise(parse_samples(csv_of([(100, 0, 0), (180, 3, 20), (150, 1, 12)])))
        assert r["peak_syn_recv"] == 3
        assert r["peak_established"] == 20
        assert r["peak_tcp_mem_pages"] == 180
        assert r["peak_tcp_mem_bytes"] == 180 * PAGE_BYTES

    def test_per_connection_memory_needs_an_idle_baseline(self):
        # Every sample loaded, so there is nothing to subtract.
        rows = [(200, 0, 10)] * 10
        r = summarise(parse_samples(csv_of(rows)))
        assert r["bytes_per_established_connection"] is None
        assert "idle baseline" in r["bytes_per_established_reason"]

    def test_per_connection_memory_is_computed_when_the_evidence_supports_it(self):
        rows = [(100, 0, 0)] + [(200, 0, 10)] * 8
        r = summarise(parse_samples(csv_of(rows)))
        b = r["bytes_per_established_connection"]
        assert b is not None
        # (200 - 100) pages over 10 connections = 10 pages each.
        assert b["median"] == 10 * PAGE_BYTES
        assert b["samples"] == 8

    def test_half_open_is_refused_on_a_thin_sample(self):
        # The expected case: SYN_RECV is genuinely brief under honest load.
        rows = [(100, 0, 0)] + [(150, 1, 5)] + [(150, 0, 5)] * 8
        r = summarise(parse_samples(csv_of(rows)))
        assert r["bytes_per_half_open_connection"] is None
        assert "too few" in r["bytes_per_half_open_reason"]
        # And the reason says why we do not simply manufacture more.
        assert "SYN flood" in r["bytes_per_half_open_reason"]

    def test_half_open_is_computed_once_enough_samples_catch_it(self):
        rows = [(100, 0, 0)] + [(150, 2, 5)] * MIN_SAMPLES
        r = summarise(parse_samples(csv_of(rows)))
        h = r["bytes_per_half_open_connection"]
        assert h is not None
        assert h["samples"] == MIN_SAMPLES
        # It is honest about being an upper bound, not an isolated struct size.
        assert "upper bound" in h["note"]

    def test_the_method_is_always_stated_alongside_the_numbers(self):
        r = summarise(parse_samples(csv_of([(100, 0, 0), (150, 1, 5)])))
        assert "no synthetic half-open connections are manufactured" in r["method_note"]
