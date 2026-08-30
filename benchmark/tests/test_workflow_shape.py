"""
Structural checks on the daily benchmark workflow.

`benchmark.yml` is singled out in CLAUDE.md as not to be modified, and the
reason is concrete rather than ceremonial: it pushes results straight to `main`,
its steps run sequentially, and a failing step aborts the job **before** the
commit step. So a bug in any newly-added track does not merely fail that track —
it stops the whole daily record from being committed.

New tracks are therefore added with `continue-on-error: true`, and this file
asserts that. It is a small test guarding a large blast radius.

The `continue-on-error` marks are meant to be temporary: the comment in the
workflow invites removing one once a track has weeks of clean runs behind it.
When that happens this test should fail, which is the point — the removal
becomes a conscious edit here rather than a silent change in what a failure
costs.
"""

from __future__ import annotations

from pathlib import Path

import pytest

yaml = pytest.importorskip("yaml", reason="pyyaml is a test-only dependency")

WORKFLOW = Path(__file__).resolve().parents[2] / ".github" / "workflows" / "benchmark.yml"

#: Tracks added after the workflow's original set. Each must stay isolated
#: until it has earned its way out of this list.
PROVISIONAL_TRACKS = (
    "IPsec/IKEv2 composed",
    "cryptographic throughput under load",
    "JWT/JOSE composed signing",
)


@pytest.fixture(scope="module")
def steps() -> list[dict]:
    doc = yaml.safe_load(WORKFLOW.read_text(encoding="utf-8"))
    return doc["jobs"]["benchmark"]["steps"]


@pytest.fixture(scope="module")
def names(steps) -> list[str]:
    return [s.get("name", "") for s in steps]


class TestTheCommitStepIsProtected:
    def test_the_commit_step_still_exists(self, names):
        assert "Commit results" in names

    def test_every_provisional_track_runs_before_the_commit(self, names):
        # A track that ran after the commit would write a file nobody commits.
        commit = names.index("Commit results")
        for track in PROVISIONAL_TRACKS:
            idx = next(i for i, n in enumerate(names) if track in n)
            assert idx < commit, track

    def test_every_provisional_track_is_failure_isolated(self, steps, names):
        # The whole reason this file exists. Without continue-on-error, a bug
        # in one of these aborts the job before "Commit results" and the daily
        # record silently stops.
        for track in PROVISIONAL_TRACKS:
            step = next(s for s, n in zip(steps, names) if track in n)
            assert step.get("continue-on-error") is True, (
                "%s is not failure-isolated. Without it, a failure in this track stops the "
                "established tracks from being committed." % track
            )

    def test_the_established_tracks_are_NOT_isolated(self, steps, names):
        # Deliberate asymmetry. The original tracks are the product; if one of
        # them breaks, the run should fail loudly rather than commit a partial
        # record that looks complete.
        for established in ("TLS composed", "SSH composed", "primitives"):
            step = next(s for s, n in zip(steps, names) if established in n)
            assert not step.get("continue-on-error"), (
                "%s must fail the run rather than commit a partial record" % established
            )


class TestTheManifestSeesTheNewTracks:
    def test_the_manifest_is_built_after_every_track(self, names):
        # build_manifest.py copies the newest file per track into web/. A track
        # running after it would not reach the site until the following day.
        manifest = names.index("Build protocol manifest for web")
        for track in PROVISIONAL_TRACKS:
            idx = next(i for i, n in enumerate(names) if track in n)
            assert idx < manifest, track


class TestSilentFailureIsVisible:
    def test_a_status_step_reports_new_track_output(self, steps, names):
        # continue-on-error buys pipeline safety at the cost of quiet failure.
        # This is the other half of that trade.
        status = next((s for s, n in zip(steps, names) if "New tracks" in n), None)
        assert status is not None, "no step reports whether the new tracks produced output"
        assert status.get("if") == "always()"
        assert "GITHUB_STEP_SUMMARY" in status["run"]

    def test_the_status_step_covers_every_provisional_track(self, steps, names):
        status = next(s for s, n in zip(steps, names) if "New tracks" in n)
        for slug in ("ipsec-composed", "concurrency", "jose-composed"):
            assert slug in status["run"], slug


class TestTheWorkflowStillDoesWhatItDid:
    def test_it_runs_on_the_self_hosted_benchmark_runner(self):
        doc = yaml.safe_load(WORKFLOW.read_text(encoding="utf-8"))
        assert doc["jobs"]["benchmark"]["runs-on"] == ["self-hosted", "q-advantage-bench"]

    def test_the_schedule_and_dispatch_triggers_are_intact(self):
        doc = yaml.safe_load(WORKFLOW.read_text(encoding="utf-8"))
        # `on` parses as the boolean True in YAML 1.1 unless quoted.
        triggers = doc.get("on", doc.get(True))
        assert "schedule" in triggers
        assert "workflow_dispatch" in triggers

    def test_concurrency_serialisation_is_intact(self):
        # Two runs writing benchmark/results/ at once would corrupt history.
        doc = yaml.safe_load(WORKFLOW.read_text(encoding="utf-8"))
        assert doc["concurrency"]["cancel-in-progress"] is False
