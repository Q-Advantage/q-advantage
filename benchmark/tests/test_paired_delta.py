"""
The paired baseline delta (work-order 028).

What is pinned here is the method, never a figure: the delta is taken per pair
before aggregation, a slowdown shared by both sides of a pair cancels, the timed
handshake performs the operations the composed total counts, the order within a
pair alternates, and the new block sits beside `pct_over_classical` without
changing it.

Needs no liboqs. Inputs are sentinel nanosecond counts built from 9_999, never
measurements; the one loop that runs for real asserts only on structure.
"""

from __future__ import annotations

import json
import sys
import types
from collections import Counter
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "protocols"))

import common  # noqa: E402

SCHEMA_PATH = Path(__file__).resolve().parents[2] / "schema" / "protocol_result.schema.json"


class TestPairedDeltaStats:
    def test_a_slowdown_shared_by_both_sides_of_a_pair_cancels(self):
        # Half the run on one level, half on a level three times slower. A ratio
        # of two separately taken medians depends on which loop caught which
        # level; per pair, the suite is exactly twice the baseline every time.
        base = [9_999] * 500 + [9_999 * 3] * 500
        suite = [2 * b for b in base]
        out = common.paired_delta_stats(suite, base)
        assert out["pct_over_classical"] == 100.0
        assert out["ci95_low_pct"] == 100.0
        assert out["ci95_high_pct"] == 100.0

    def test_the_interval_brackets_the_median_and_narrows_with_more_pairs(self):
        def spread(n: int) -> dict:
            base = [9_999] * n
            suite = [9_999 + (i % 100) for i in range(n)]
            return common.paired_delta_stats(suite, base)

        small, large = spread(100), spread(10_000)
        for out in (small, large):
            assert out["ci95_low_pct"] <= out["pct_over_classical"] <= out["ci95_high_pct"]
        width = lambda o: o["ci95_high_pct"] - o["ci95_low_pct"]  # noqa: E731
        assert width(large) < width(small)

    def test_refuses_a_figure_for_fewer_than_two_pairs(self):
        out = common.paired_delta_stats([9_999], [9_999])
        assert out["n_pairs"] == 1
        assert out["pct_over_classical"] is None
        assert out["ci95_low_pct"] is None
        assert "at least two pairs" in out["ci_note"]

    def test_a_non_positive_baseline_is_dropped_not_divided_by(self):
        out = common.paired_delta_stats([9_999, 9_999, 9_999], [0, 9_999, 9_999])
        assert out["n_pairs"] == 2
        assert out["pct_over_classical"] == 0.0


class TestTheTimedHandshake:
    def test_performs_the_operations_the_composed_total_counts(self, monkeypatch):
        # If the paired handshake did different work from the composed total,
        # the two figures would differ for a reason that has nothing to do with
        # pairing, and the comparison the daily runs exist to make would be void.
        calls: Counter = Counter()

        class FakeKem:
            def __init__(self, alg):
                pass

            def generate_keypair(self):
                calls["kem_keygen"] += 1
                return b"fake-pub"

            def encap_secret(self, pub):
                calls["kem_encaps"] += 1
                return (b"fake-ct", b"fake-ss")

            def decap_secret(self, ct):
                calls["kem_decaps"] += 1
                return b"fake-ss"

            def free(self):
                pass

        stub = types.ModuleType("oqs")
        stub.get_enabled_kem_mechanisms = lambda: ["FAKE-KEM"]
        stub.KeyEncapsulation = FakeKem
        monkeypatch.setitem(sys.modules, "oqs", stub)

        def keygen():
            calls["classical_keygen"] += 1
            return object()

        def derive(priv, peer):
            calls["classical_derive"] += 1
            return b""

        fake = common.ClassicalKex("fake", keygen, lambda k: object(), derive)
        monkeypatch.setattr(common, "_classical_registry", lambda: {"fake": fake})

        setup, handshake, close = common._handshake_ops("FAKE-KEM", "fake")
        prepared = setup()
        calls.clear()  # construction and setup are off the clock
        handshake(prepared)
        close()
        assert dict(calls) == common.HANDSHAKE_WEIGHTS

    def test_a_classical_only_pair_needs_no_liboqs(self, monkeypatch):
        monkeypatch.setitem(sys.modules, "oqs", None)  # any import of it now raises
        setup, handshake, close = common._handshake_ops(None, "x25519")
        handshake(setup())
        close()

    def test_an_unavailable_kem_is_reported_the_way_the_tracks_expect(self, monkeypatch):
        stub = types.ModuleType("oqs")
        stub.get_enabled_kem_mechanisms = lambda: []
        monkeypatch.setitem(sys.modules, "oqs", stub)
        with pytest.raises(RuntimeError, match="not enabled"):
            common._handshake_ops("FAKE-KEM", None)


class TestTheLoop:
    def test_order_within_a_pair_alternates_and_every_pair_is_kept(self, monkeypatch):
        order: list[str] = []

        def fake_ops(kem_alg, classical):
            label = "suite" if kem_alg else "baseline"

            def handshake(_prepared):
                order.append(label)
                sum(range(2_000))  # a non-zero duration on coarse clocks

            return (lambda: None), handshake, (lambda: None)

        monkeypatch.setattr(common, "_handshake_ops", fake_ops)
        out = common.time_paired_delta(
            suite=("FAKE-KEM", "fake"), baseline=(None, "fake"), iterations=4, warmup=0
        )
        assert order == ["suite", "baseline", "baseline", "suite"] * 2
        assert out["n_pairs"] == 4
        assert out["method"] == "interleaved"


def built(**overrides) -> dict:
    kwargs = dict(
        protocol="tls",
        mode="composed",
        suite="X25519MLKEM768",
        timing=common.compute_stats([9_999_000, 9_999_000]),
        size=common.keyshare_size(common.TLS_KEYSHARE, "X25519MLKEM768"),
        toolchain=common.ToolchainVersions(liboqs="0", liboqs_python="0"),
        host=common.HostInfo(arch="x86_64"),
    )
    kwargs.update(overrides)
    return common.build_result(**kwargs)


class TestTheRecord:
    def test_the_paired_block_sits_beside_the_existing_field_without_changing_it(self):
        paired = common.paired_delta_stats([2 * 9_999] * 3, [9_999] * 3)
        rec = built(baseline_suite="X25519", pct_over_classical=-1.0, paired_delta=paired)
        assert rec["baseline"]["pct_over_classical"] == -1.0
        assert rec["baseline"]["baseline_suite"] == "X25519"
        assert rec["baseline"]["paired"]["pct_over_classical"] == 100.0

    def test_it_is_absent_rather_than_null_when_not_measured(self):
        assert "paired" not in built()["baseline"]

    def test_the_schema_accepts_it(self):
        jsonschema = pytest.importorskip("jsonschema")
        schema = json.loads(SCHEMA_PATH.read_text())
        paired = common.paired_delta_stats([2 * 9_999] * 3, [9_999] * 3)
        jsonschema.validate(built(baseline_suite="X25519", paired_delta=paired), schema)
        jsonschema.validate(
            built(baseline_suite="X25519", paired_delta=common.paired_delta_stats([], [])), schema
        )

    def test_the_schema_still_refuses_a_typo_inside_it(self):
        jsonschema = pytest.importorskip("jsonschema")
        schema = json.loads(SCHEMA_PATH.read_text())
        paired = common.paired_delta_stats([2 * 9_999] * 3, [9_999] * 3)
        paired["n_pair"] = 3  # deliberate typo
        with pytest.raises(jsonschema.ValidationError):
            jsonschema.validate(built(baseline_suite="X25519", paired_delta=paired), schema)


class TestTheTracksEmitIt:
    def test_ipsec_pairs_every_measured_suite_and_not_the_baseline(self, monkeypatch):
        # Classical arms measure without liboqs, so this exercises the track's
        # real seam on a machine with no KEMs: ecp256 is paired against
        # curve25519; the baseline has nothing to pair against; the KEM suites
        # are unavailable and therefore unpaired rather than faked.
        stub = types.ModuleType("oqs")
        stub.get_enabled_kem_mechanisms = lambda: []
        monkeypatch.setitem(sys.modules, "oqs", stub)
        import ipsec_composed

        r = ipsec_composed.run(iterations=5, warmup=1)
        assert r["suites"]["ecp256"]["baseline"]["paired"]["method"] == "interleaved"
        assert r["suites"]["ecp256"]["baseline"]["paired"]["n_pairs"] == 5
        assert "paired" not in r["suites"]["curve25519"]["baseline"]
        assert r["suites"]["ecp256"]["baseline"]["pct_over_classical"] is not None
