"""
The composed-result schema, checked against the record it describes.

Two directions, and both matter. Backward: every suite already committed must
still validate, or a schema change has silently invalidated the published
history. Forward: a record carrying the fields the harness now emits must
validate too, or the next daily run writes something the schema rejects.

`protocol_result.schema.json` sets `additionalProperties: false` throughout,
which is deliberate and is exactly why this test exists — under that rule a new
harness field is a breaking change until the schema is told about it.
"""

from __future__ import annotations

import glob
import json
from pathlib import Path

import pytest

jsonschema = pytest.importorskip(
    "jsonschema",
    reason="jsonschema is optional for the harness; common.validate_result no-ops without it",
)

REPO = Path(__file__).resolve().parents[2]
SCHEMA = json.loads((REPO / "schema" / "protocol_result.schema.json").read_text())


def committed_suites(pattern: str, limit: int = 4):
    files = sorted(glob.glob(str(REPO / "benchmark" / "results" / "protocols" / pattern)))[-limit:]
    for path in files:
        data = json.loads(Path(path).read_text())
        for name, suite in data.get("suites", {}).items():
            yield Path(path).name, name, suite


class TestTheCommittedRecordStillValidates:
    @pytest.mark.parametrize("pattern", ["tls-composed-*.json", "ssh-composed-*.json"])
    def test_recent_committed_suites_validate(self, pattern):
        checked = 0
        for filename, suite_name, suite in committed_suites(pattern):
            try:
                jsonschema.validate(suite, SCHEMA)
            except jsonschema.ValidationError as exc:  # pragma: no cover - failure path
                pytest.fail(
                    "%s / %s no longer validates: %s\n"
                    "A schema change must never invalidate already-published results."
                    % (filename, suite_name, exc.message)
                )
            checked += 1
        assert checked > 0, "no committed suites found to check %r against" % pattern


class TestTheFieldsTheHarnessNowEmits:
    """Forward compatibility: additionalProperties is false, so these must be declared."""

    def _minimal(self) -> dict:
        return {
            "identity": {"protocol": "tls", "mode": "composed", "suite": "fixture"},
            # Sentinel values, per CLAUDE.md guardrail 1. The repo's other
            # sentinel (-1) is unusable here: the schema puts `minimum: 0` on
            # every timing field, correctly, since a duration cannot be
            # negative. 9999 is the sanctioned alternative and is equally
            # impossible to mistake for a measurement.
            "timing": {
                "mean_us": 9999, "median_us": 9999, "p95_us": 9999, "p99_us": 9999,
                "stdev_us": 0, "min_us": 9999, "max_us": 9999,
                "ops_per_sec": 1, "n_iterations": 1,
            },
            "size": {
                "bytes_client_to_server": 0,
                "bytes_server_to_client": 0,
                "bytes_total": 0,
            },
            "toolchain": {"liboqs": "0.0.0", "liboqs_python": "0.0.0"},
            "host": {"arch": "x86_64"},
            "audit": {"git_commit": "0" * 40, "timestamp_utc": "2026-01-01T00:00:00Z"},
        }

    def test_the_minimal_fixture_is_itself_valid(self):
        jsonschema.validate(self._minimal(), SCHEMA)

    def test_confidence_interval_fields_are_accepted(self):
        rec = self._minimal()
        rec["timing"].update({
            "ci95_low_us": 9999, "ci95_high_us": 9999, "std_error_us": 0,
            "ci_note": "fixture",
        })
        jsonschema.validate(rec, SCHEMA)

    def test_a_null_interval_is_accepted(self):
        # n < 2 emits nulls rather than a zero-width interval.
        rec = self._minimal()
        rec["timing"].update({
            "ci95_low_us": None, "ci95_high_us": None, "std_error_us": None,
            "ci_note": "A confidence interval needs at least two samples.",
        })
        jsonschema.validate(rec, SCHEMA)

    def test_secret_key_bytes_is_accepted(self):
        rec = self._minimal()
        rec["size"]["secret_key_bytes"] = 9999
        jsonschema.validate(rec, SCHEMA)

    def test_the_resources_block_is_accepted(self):
        rec = self._minimal()
        rec["resources"] = {
            "measured": True,
            "cpu_us_per_op": 9999,
            "cpu_seconds_total": 9999,
            "max_rss_delta_bytes": 0,
            "max_rss_bytes": 9999,
            "cpu_note": "fixture",
            "rss_note": "fixture",
            "rss_unit_note": "fixture",
        }
        jsonschema.validate(rec, SCHEMA)

    def test_an_unmeasured_resources_block_is_accepted(self):
        rec = self._minimal()
        rec["resources"] = {"measured": False, "reason": "fixture"}
        jsonschema.validate(rec, SCHEMA)

    def test_the_instance_type_is_accepted_on_the_host_block(self):
        # Without it, two hosts sharing an architecture collapse into one
        # bucket and a hardware change becomes invisible.
        rec = self._minimal()
        rec["host"]["ec2_instance_type"] = "c7i.large"
        jsonschema.validate(rec, SCHEMA)


class TestTheSchemaStillRefusesWhatItShould:
    def test_an_undeclared_field_is_still_rejected(self):
        # additionalProperties:false is the reason this test file exists. If it
        # ever loosened, a typo in a harness field name would ship silently.
        rec = TestTheFieldsTheHarnessNowEmits()._minimal()
        rec["size"]["secert_key_bytes"] = 1  # deliberate typo
        with pytest.raises(jsonschema.ValidationError):
            jsonschema.validate(rec, SCHEMA)

    def test_a_missing_required_block_is_rejected(self):
        rec = TestTheFieldsTheHarnessNowEmits()._minimal()
        del rec["audit"]
        with pytest.raises(jsonschema.ValidationError):
            jsonschema.validate(rec, SCHEMA)
