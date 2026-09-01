"""
Structural checks on the LMS/XMSS verification workflow.

This workflow runs on the measurement hosts -- the same boxes the daily
benchmark runs on. That makes its blast radius the published record, so the
properties that keep it harmless are asserted rather than trusted to review:

* it can only be started by hand, never by a push or a schedule;
* it cannot write to the repository;
* it does not touch `benchmark.yml`, which is off-limits under CLAUDE.md
  guardrail 3.

A future edit that makes this workflow build, install or commit anything should
fail here first.
"""

from __future__ import annotations

from pathlib import Path

import pytest

yaml = pytest.importorskip("yaml", reason="pyyaml is a test-only dependency")

ROOT = Path(__file__).resolve().parents[2]
WORKFLOW = ROOT / ".github" / "workflows" / "liboqs-stfl-verify.yml"


@pytest.fixture(scope="module")
def wf() -> dict:
    return yaml.safe_load(WORKFLOW.read_text(encoding="utf-8"))


def test_workflow_exists() -> None:
    assert WORKFLOW.is_file(), f"{WORKFLOW} is missing"


def test_manual_dispatch_only(wf: dict) -> None:
    """No push, no schedule, no pull_request -- a human starts this or nothing does."""
    # PyYAML parses a bare `on:` key as the boolean True.
    triggers = wf.get("on", wf.get(True))
    assert triggers is not None, "workflow declares no triggers"
    assert set(triggers) == {"workflow_dispatch"}, (
        f"expected workflow_dispatch only, found {sorted(triggers)} — this workflow "
        "runs on the measurement hosts and must not start on its own"
    )


def test_runner_is_an_input_covering_both_boxes(wf: dict) -> None:
    """The rebuild is outstanding on both hosts, so both must be selectable."""
    options = wf.get("on", wf.get(True))["workflow_dispatch"]["inputs"]["runner"]["options"]
    assert "q-advantage-bench" in options
    assert "c7i-x86" in options


def test_cannot_write_to_the_repo(wf: dict) -> None:
    assert wf.get("permissions") == {"contents": "read"}, (
        "this workflow reports and must never commit; keep permissions read-only"
    )


def test_does_not_touch_the_daily_benchmark_workflow(wf: dict) -> None:
    """benchmark.yml may be discussed in a comment, never acted on in a step."""
    steps = wf["jobs"]["verify"]["steps"]
    body = "\n".join(s.get("run", "") for s in steps)
    assert "benchmark.yml" not in body, (
        "benchmark.yml is off-limits under CLAUDE.md guardrail 3 — no step may "
        "read, edit or dispatch it"
    )


def test_installs_and_builds_nothing(wf: dict) -> None:
    """A verification job that mutates the host is no longer a verification job."""
    steps = wf["jobs"]["verify"]["steps"]
    body = "\n".join(s.get("run", "") for s in steps)
    for forbidden in ("pip install", "cmake", "make ", "apt-get", "git commit", "git push"):
        assert forbidden not in body, (
            f"{forbidden!r} appears in a workflow that is supposed to only read state"
        )


def test_runs_on_a_self_hosted_measurement_host(wf: dict) -> None:
    runs_on = wf["jobs"]["verify"]["runs-on"]
    assert "self-hosted" in runs_on, (
        "the question this answers is about a specific box's liboqs build, so it "
        "is meaningless on a GitHub-hosted runner"
    )


def test_has_a_timeout(wf: dict) -> None:
    """An unbounded job on a self-hosted runner blocks the daily benchmark."""
    assert wf["jobs"]["verify"].get("timeout-minutes", 10**9) <= 30
