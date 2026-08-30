"""
Cross-library diversity (`qshield-update-spec.md` §15 Tier 2, work-order 024).

Runs without any of the three libraries built: what is under test is what the
probe is willing to CLAIM, not what BoringSSL, AWS-LC or wolfSSL can do. The
libraries are exercised in CI.

This track publishes statements about other people's software, from builds this
repo controls. That makes the claim boundary the whole substance of the tests
below: a negative result must never read as "this library does not support it",
and a library that failed to build must never read as a library that reported
nothing.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "crosslib"))

import merge_crosslib  # noqa: E402
import probe_crosslib as probe  # noqa: E402


class TestNamingIsNotAssumed:
    """Post-quantum spelling is unsettled, and a miss would be a false negative."""

    def test_the_fips_name_is_recognised(self):
        assert "ML-KEM-768" in probe.find_algorithms("ML-KEM-768 keygen 1000 ops")

    def test_the_pre_fips_name_is_recognised_too(self):
        # A library still shipping "Kyber768" supports the same algorithm. A
        # probe matching only the new spelling would report it as lacking one
        # it ships, which is exactly the false claim this file guards.
        assert "ML-KEM-768" in probe.find_algorithms("Did 1000 Kyber768 operations")

    def test_matching_is_case_insensitive(self):
        assert "ML-DSA-65" in probe.find_algorithms("DILITHIUM3 sign")

    def test_the_matched_spelling_is_published_not_just_the_canonical_name(self):
        # The spelling is itself informative about how current a build is.
        found = probe.find_algorithms("Did 10 Kyber768 operations")
        assert found["ML-KEM-768"] == ["kyber768"]

    def test_an_unrelated_string_matches_nothing(self):
        assert probe.find_algorithms("RSA 2048 signing, AES-256-GCM") == {}


class TestTheClaimBoundary:
    def test_a_missing_binary_is_a_fact_about_the_image_not_the_library(self):
        # The single most important assertion in this file. "We did not build
        # it" and "it does not support it" are different statements, and only
        # one of them is ours to make.
        rec = probe.probe_library("wolfSSL")
        if rec["status"] == "not_built":
            assert "says nothing about what it supports" in rec["reason"]
            assert "exposed" not in rec
            assert "not_exposed" not in rec

    def test_a_probed_library_publishes_what_a_negative_means(self):
        rec = probe.probe_library("BoringSSL")
        if rec["status"] == "probed":
            assert "not the same as the library not supporting it" in rec["claim"]

    def test_the_build_flags_travel_with_every_result(self):
        # A negative is only readable against what was actually asked for.
        for name in probe.LIBRARIES:
            assert probe.probe_library(name)["build_flags"]

    def test_the_scope_refuses_timings_in_writing(self):
        # The discipline this track most needs stated: these builds run on a
        # shared runner, and a speed comparison measured there would undo the
        # dedicated-host story every other number in this repo rests on.
        assert "NO timings" in probe.SCOPE["no_timings"]
        assert "dedicated" in probe.SCOPE["no_timings"]

    def test_the_scope_separates_availability_from_equivalence(self):
        # Two libraries exposing ML-KEM-768 is not two libraries agreeing on
        # what ML-KEM-768 produces.
        assert "not a check that two implementations produce identical output" in (
            probe.SCOPE["availability_not_equivalence"].lower()
        )


class TestTheImageMustSayWhichLibraryItCarries:
    def test_an_unknown_library_is_refused(self):
        with pytest.raises(KeyError):
            probe.probe_library("OpenSSL")

    def test_every_declared_library_has_a_probe_command_and_a_source(self):
        # A version command is optional: `bssl` has no version subcommand, and
        # asking for one prints usage text -- which the first CI run published
        # as a version string. Where there is no reliable version to read, the
        # pinned source tag in build_flags is the honest identifier.
        for name, lib in probe.LIBRARIES.items():
            assert lib["probe_cmd"], name
            assert lib["source"].startswith("https://"), name
            assert lib["build_flags"], name


class TestABrokenProbeCannotPublishNegatives:
    """
    The rule the first CI run was missing.

    That run reported BoringSSL and AWS-LC as exposing nothing at all. That is
    false -- BoringSSL ships X25519MLKEM768 in production Chrome. The probe
    command had produced no output, and the probe turned that silence into
    seven negative claims about somebody else's software.
    """

    def test_output_naming_no_known_primitive_is_inconclusive(self, monkeypatch):
        monkeypatch.setattr(probe, "run", lambda cmd: (0, "Usage: bssl COMMAND"))
        rec = probe.probe_library("BoringSSL")
        assert rec["status"] == "inconclusive"

    def test_an_inconclusive_probe_publishes_no_negative_at_all(self, monkeypatch):
        # Not "an empty list of negatives" -- no key. A consumer must not be
        # able to read absence out of it.
        monkeypatch.setattr(probe, "run", lambda cmd: (0, ""))
        rec = probe.probe_library("AWS-LC")
        assert "not_exposed" not in rec
        assert "exposed" not in rec
        assert "false claim" in rec["reason"]

    def test_it_keeps_what_the_command_actually_printed(self, monkeypatch):
        # Otherwise the next person debugging it has nothing to go on.
        monkeypatch.setattr(probe, "run", lambda cmd: (0, "Usage: bssl COMMAND"))
        assert probe.probe_library("BoringSSL")["raw_output_head"]

    def test_a_real_inventory_passes_the_control_and_publishes_negatives(self, monkeypatch):
        out = "RSA 2048 signing 100 ops\nDid 1000 Kyber768 operations"
        monkeypatch.setattr(probe, "run", lambda cmd: (0, out))
        rec = probe.probe_library("wolfSSL")
        assert rec["status"] == "probed"
        assert rec["exposed"] == ["ML-KEM-768"]
        assert "ML-DSA-65" in rec["not_exposed"]
        assert rec["control_markers_seen"]

    def test_usage_text_is_not_published_as_a_version(self, monkeypatch):
        monkeypatch.setattr(probe, "run", lambda cmd: (0, "Usage: bssl COMMAND\nrsa"))
        assert probe.probe_library("AWS-LC")["version"] is None

    def test_an_inconclusive_library_is_not_counted_as_having_reported(self):
        # A probe that could not ask the question contributes no opinion.
        # Counting it would turn a broken invocation into corroborating silence.
        cv = merge_crosslib.cross_validate(
            [{"library": "BoringSSL", "status": "inconclusive", "reason": "no output"}]
        )
        assert cv["measurable"] is False

    def test_the_merged_view_names_which_probes_were_inconclusive(self):
        cv = merge_crosslib.cross_validate([
            {"library": "wolfSSL", "status": "probed", "exposed": ["ML-KEM-768"]},
            {"library": "BoringSSL", "status": "inconclusive", "reason": "no output"},
        ])
        assert cv["libraries_whose_probe_was_inconclusive"] == ["BoringSSL"]
        assert "BoringSSL" not in cv["libraries_that_reported"]


class TestEvidenceIsCarried:
    def test_a_positive_classification_carries_the_lines_it_came_from(self):
        out = "noise\nDid 1000 Kyber768 operations\nmore noise"
        found = probe.find_algorithms(out)
        ev = probe.excerpt(out, found)
        assert any("Kyber768" in line for line in ev)
        assert not any(line == "noise" for line in ev)

    def test_a_negative_classification_carries_what_the_tool_did_say(self):
        # Otherwise "we found nothing" is indistinguishable from "we ran
        # nothing", and the reader cannot tell a real negative from a broken
        # probe.
        out = "usage: bssl [command]\nunknown option"
        ev = probe.excerpt(out, {})
        assert ev
        assert "usage: bssl [command]" in ev


class TestMergingCopesWithMissingOpinions:
    def _row(self, name: str, exposed: list[str]) -> dict:
        return {"library": name, "status": "probed", "exposed": exposed}

    def test_corroboration_is_counted_only_over_libraries_that_reported(self):
        cv = merge_crosslib.cross_validate([self._row("BoringSSL", ["ML-KEM-768"])])
        row = next(r for r in cv["corroborated"] if r["algorithm"] == "ML-KEM-768")
        assert row["also_exposed_by"] == ["BoringSSL"]

    def test_a_library_that_did_not_report_is_named_as_missing(self):
        # Not silently absent: a reader has to know the sample is incomplete
        # before reading anything into what is not corroborated.
        cv = merge_crosslib.cross_validate([self._row("BoringSSL", ["ML-KEM-768"])])
        assert set(cv["libraries_that_did_not"]) == {"AWS-LC", "wolfSSL"}

    def test_no_reports_at_all_is_a_broken_build_not_a_finding(self):
        cv = merge_crosslib.cross_validate([])
        assert cv["measurable"] is False
        assert "broken build rather than a finding" in cv["reason"]

    def test_a_not_built_row_is_not_counted_as_having_reported(self):
        cv = merge_crosslib.cross_validate(
            [{"library": "wolfSSL", "status": "not_built", "reason": "no binary"}]
        )
        assert cv["measurable"] is False

    def test_uncorroborated_says_why_that_might_mean_nothing(self):
        cv = merge_crosslib.cross_validate([self._row("BoringSSL", [])])
        assert cv["not_corroborated_here"]
        assert "nothing to do with the algorithms" in cv["note"]

    def test_the_merged_file_is_not_read_back_in_as_a_library_result(self, tmp_path):
        # It lands in the same directory on a re-run and has no `library` key;
        # reading it back would double-count or crash.
        (tmp_path / "crosslib-boringssl-2026-08-30.json").write_text(
            json.dumps({"library": self._row("BoringSSL", ["ML-KEM-768"])})
        )
        (tmp_path / "crosslib-merged-2026-08-30.json").write_text(
            json.dumps({"libraries": []})
        )
        rows = merge_crosslib.load(str(tmp_path))
        assert [r["library"] for r in rows] == ["BoringSSL"]

    def test_an_empty_directory_produces_a_result_rather_than_a_crash(self, tmp_path):
        assert merge_crosslib.build(str(tmp_path))["cross_validation"]["measurable"] is False
