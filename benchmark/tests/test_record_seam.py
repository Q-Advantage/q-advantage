"""
End-to-end: fields declared in the schema must actually reach a record.

WHY THIS FILE EXISTS. Three fields shipped on 2026-08-30 — `secret_key_bytes`,
the `resources` block, and `host.ec2_instance_type` — were added to the schema,
computed correctly by the harness, and unit-tested in isolation. None of them
reached a composed record. The first real daily run had them all absent.

Nothing was broken in any of the tested pieces. `resource_delta()` worked;
`confidence_interval()` worked; the schema accepted the fields. What did not
exist was the seam: `time_hybrid_kex()` computed the values, `build_result()`
had no parameter to receive them, and the tracks never passed them.

The tests that existed could not have caught it. They tested the parts. This
file tests the join, which is the thing that was actually missing — a record
built the way the tracks build one must contain what the schema says it can.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "protocols"))

import common  # noqa: E402


def built(**overrides) -> dict:
    """A record built exactly the way a composed track builds one."""
    kwargs = dict(
        protocol="tls",
        mode="composed",
        suite="X25519MLKEM768",
        # Sentinel timings: the schema forbids negatives on timing fields, so
        # 9999 is the sanctioned impossible value here.
        timing=common.compute_stats([9_999_000, 9_999_000]),
        size=common.keyshare_size(common.TLS_KEYSHARE, "X25519MLKEM768"),
        toolchain=common.ToolchainVersions(liboqs="0", liboqs_python="0"),
        host=common.HostInfo(arch="x86_64"),
    )
    kwargs.update(overrides)
    return common.build_result(**kwargs)


class TestSecretKeyBytesReachesTheRecord:
    def test_it_appears_in_the_size_block_when_measured(self):
        # Blocking for the TCM's Expansion & Retention line item: storage for
        # larger private keys cannot be priced from public key sizes alone.
        rec = built(secret_key_bytes=2400)
        assert rec["size"]["secret_key_bytes"] == 2400

    def test_it_is_absent_rather_than_zero_when_there_is_none(self):
        # A classical-only suite has no KEM secret key. Zero would read as a
        # measurement; absence reads as absence.
        rec = built()
        assert "secret_key_bytes" not in rec["size"]

    def test_the_wire_sizes_are_untouched_by_its_presence(self):
        with_key = built(secret_key_bytes=2400)["size"]
        without = built()["size"]
        for field in ("bytes_client_to_server", "bytes_server_to_client", "bytes_total"):
            assert with_key[field] == without[field], field


class TestResourcesReachTheRecord:
    def test_the_block_appears_when_the_caller_measured_it(self):
        rec = built(resources={"measured": True, "cpu_us_per_op": 9999})
        assert rec["resources"]["measured"] is True

    def test_it_is_omitted_entirely_when_nothing_was_measured(self):
        # An absent block reads as "not measured", which is true. A block of
        # nulls reads as "measured as nothing", which is not.
        assert "resources" not in built()
        assert "resources" not in built(resources=None)
        assert "resources" not in built(resources={})


class TestTheHostRecordsWhichMachineItWas:
    def test_the_field_exists_on_HostInfo(self):
        # Two hosts can share an architecture and a CPU model string. Without
        # this they collapse into one bucket and a hardware change is invisible
        # — which is exactly what work-order 013's era layer needs it for.
        assert hasattr(common.HostInfo(), "ec2_instance_type")

    def test_it_travels_into_the_record(self):
        rec = built(host=common.HostInfo(arch="x86_64", ec2_instance_type="t3.medium"))
        assert rec["host"]["ec2_instance_type"] == "t3.medium"

    def test_the_lookup_returns_None_off_ec2_rather_than_a_placeholder(self):
        # "unknown" would look like a machine we had identified. None does not.
        # This also asserts it fails fast: a hanging metadata call inside
        # capture_host() would stall every run on a non-EC2 machine.
        import time

        t0 = time.perf_counter()
        value = common._ec2_instance_type()
        elapsed = time.perf_counter() - t0
        assert value is None or isinstance(value, str)
        assert elapsed < 10, "the IMDS lookup must fail fast off EC2, took %.1fs" % elapsed


class TestTheWholeRecordStillValidates:
    def test_a_fully_populated_record_passes_the_schema(self):
        jsonschema = pytest.importorskip("jsonschema")
        import json

        schema = json.loads(
            (Path(__file__).resolve().parents[2] / "schema" / "protocol_result.schema.json")
            .read_text()
        )
        rec = built(
            secret_key_bytes=2400,
            resources={
                "measured": True,
                "cpu_us_per_op": 9999,
                "max_rss_delta_bytes": 0,
                "cpu_note": "fixture",
                "rss_note": "fixture",
            },
            host=common.HostInfo(arch="x86_64", ec2_instance_type="t3.medium"),
            tls_version="1.3",
        )
        jsonschema.validate(rec, schema)

    def test_a_minimal_record_still_validates(self):
        jsonschema = pytest.importorskip("jsonschema")
        import json

        schema = json.loads(
            (Path(__file__).resolve().parents[2] / "schema" / "protocol_result.schema.json")
            .read_text()
        )
        jsonschema.validate(built(), schema)


class TestTheTracksActuallyPassThemThrough:
    """The specific omission that caused this: the tracks did not forward them."""

    @pytest.mark.parametrize(
        "module", ["tls_composed", "ssh_composed", "ipsec_composed"]
    )
    def test_each_composed_track_forwards_both_fields(self, module):
        source = (
            Path(__file__).resolve().parents[1] / "protocols" / ("%s.py" % module)
        ).read_text(encoding="utf-8")
        assert "secret_key_bytes=" in source, (
            "%s does not forward the secret key size, so it will be computed and discarded" % module
        )
        assert "resources=" in source, (
            "%s does not forward the resource accounting, so it will be sampled and discarded"
            % module
        )
