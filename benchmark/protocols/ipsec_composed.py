"""
Layer A — IKEv2 key-exchange composed crypto-cost.

WHY THIS TRACK EXISTS. `qshield-update-spec.md` §15 Tier 2 records a correction
worth keeping: `calculator-suite-spec.md` assumed a VPN/IPsec calculator would
be "cheap once Network exists… a reskin of the network calculator's layer 2."
Checked against the harness, it isn't a reskin — it's a missing track. Q-Shield
had `tls_composed` and `ssh_composed` and nothing for IKEv2, which is why CFDIR
use case 3.12 (Network layer) has been an empty cell.

WHAT IT MEASURES. The cryptographic cost of establishing an IKE SA: the
key-exchange primitives of IKE_SA_INIT, plus the additional post-quantum key
exchange that RFC 9370 carries in IKE_INTERMEDIATE. Authentication payloads
belong to the signature track and are not counted here.

AN HONEST FINDING, STATED UP FRONT. The crypto *multiplicity* of an IKEv2 key
establishment turns out to be identical to a TLS 1.3 handshake's: both sides
generate a classical keypair and both derive, and the KEM contributes one
keygen, one encapsulation and one decapsulation. So `HANDSHAKE_WEIGHTS` applies
unchanged, and this module does not invent a different weighting to look
distinct. What genuinely differs is the wire encoding (see `common.IKEV2_KEX`)
and the operational context — an IPsec tunnel rekeys on a timer or byte budget,
so the *rate* of key exchanges over its life is far higher than TLS's one per
connection. That multiplier is a property of a deployment's configuration, not
of the cryptography, so it belongs to whoever is costing the tunnel rather than
here.

Run:
    python3 benchmark/protocols/ipsec_composed.py [--quick]
"""

from __future__ import annotations

import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
import common  # noqa: E402

# suite -> (kem_alg | None, classical | None)
#
# Named for the key exchange rather than for an IKEv2 transform string, because
# a full transform ID also pins the encryption, integrity and PRF algorithms and
# this track measures none of those.
IKEV2_SUITES: dict[str, tuple[str | None, str | None]] = {
    "curve25519": (None, "x25519"),               # group 31, RFC 8031
    "ecp256": (None, "secp256r1"),                # group 19, RFC 5903
    "mlkem768": ("ML-KEM-768", None),             # pure PQC
    "curve25519+mlkem768": ("ML-KEM-768", "x25519"),
    "ecp256+mlkem768": ("ML-KEM-768", "secp256r1"),
}

#: The classical arm every delta is measured against.
#:
#: Curve25519 is chosen for consistency with the TLS and SSH tracks, so a
#: reader can compare across all three. It is NOT the most representative
#: baseline for deployed IPsec — group 19 (ECP-256) and group 14 (MODP-2048)
#: are far more common in the field. `ecp256` is measured in the same run for
#: exactly that reason, so a same-run delta against it is available to anyone
#: who wants the more realistic comparison.
BASELINE_SUITE = "curve25519"

#: A gap named rather than left to be discovered.
#:
#: MODP (finite-field) groups are absent, and group 14 in particular remains
#: extremely common in deployed IPsec — arguably the most representative
#: classical baseline of all. It is omitted because measuring it correctly
#: means using the exact RFC 3526 prime, and a prime transcribed wrongly would
#: still produce a working Diffie-Hellman and a plausible timing while
#: measuring something that is not group 14. That is a fabricated-identity
#: failure of the kind CLAUDE.md's sourcing standard exists to prevent, so the
#: row is left empty until the constant can be checked against the RFC.
MODP_GAP = (
    "MODP (finite-field) groups are not measured. Group 14 (MODP-2048) is still very common in "
    "deployed IPsec and is arguably the most representative classical baseline, but measuring it "
    "requires the exact RFC 3526 prime -- and a mistranscribed prime would still compute a shared "
    "secret and still produce a plausible timing while measuring a group that is not 14. Left "
    "unmeasured rather than measured wrongly."
)

#: The other half of what CFDIR 3.12 names.
MACSEC_GAP = (
    "MACsec is named in the same CFDIR use case (3.12) and is not measured here. This track's "
    "claim on that cell is IKEv2 key establishment only."
)

#: Why the composed weighting is the same as TLS's.
WEIGHTS_NOTE = (
    "The composed total uses the same phase weights as the TLS and SSH tracks, because the crypto "
    "multiplicity is the same: both peers generate a classical keypair and both derive, and the "
    "additional RFC 9370 key exchange contributes one KEM keygen, one encapsulation and one "
    "decapsulation. A different weighting was not invented to make this track look distinct."
)

#: What a tunnel's real cost depends on, and why it is not measured here.
REKEY_NOTE = (
    "An IPsec tunnel rekeys on a timer or byte budget, so the number of key exchanges over its "
    "life is far higher than TLS's one per connection. That multiplier is a property of a "
    "deployment's configuration rather than of the cryptography, so it belongs to whoever is "
    "costing the tunnel. This track measures the cost of one key establishment."
)


def run(iterations: int, warmup: int) -> dict:
    toolchain = common.capture_toolchain()
    host = common.capture_host()
    sampler = common.StealTimeSampler()

    # Single pass. The baseline delta must come from measurements taken in the
    # same pass as the suite it describes -- the two-pass shape compared across
    # passes and published a sign-flipped delta on 2026-08-16.
    measured: dict[str, dict] = {}
    for suite, (kem_alg, classical) in IKEV2_SUITES.items():
        try:
            measured[suite] = common.time_hybrid_kex(
                kem_alg=kem_alg, classical=classical, iterations=iterations, warmup=warmup
            )
        except RuntimeError as exc:
            # A mechanism this liboqs build does not carry is a gap to report,
            # not a reason the whole track fails.
            measured[suite] = {"unavailable": str(exc)}

    baseline_median: float | None = None
    base = measured.get(BASELINE_SUITE)
    if base and "composed" in base:
        baseline_median = base["composed"]["median_us"]

    records: dict[str, dict] = {}
    unavailable: dict[str, str] = {}
    for suite, kex in measured.items():
        if "unavailable" in kex:
            unavailable[suite] = kex["unavailable"]
            continue

        composed = kex["composed"]
        pct = None
        if baseline_median and suite != BASELINE_SUITE:
            pct = round((composed["median_us"] - baseline_median) / baseline_median * 100.0, 1)

        cv = common.reference_delta(
            composed["median_us"], ebacs_cycles=None, cpu_hz=host.cpu_hz_nominal
        )
        rec = common.build_result(
            protocol="ipsec",
            mode="composed",
            suite=suite,
            timing=composed,
            size=common.keyshare_size(common.IKEV2_KEX, suite),
            phases=kex["phases"],
            baseline_suite=None if suite == BASELINE_SUITE else BASELINE_SUITE,
            pct_over_classical=pct,
            cross_validation=cv,
            toolchain=toolchain,
            host=host,
        )
        records[suite] = rec

    steal = sampler.result_pct()
    for rec in records.values():
        rec["host"]["steal_time_pct"] = steal

    return {
        "environment": {
            "iso_timestamp": common.utc_timestamp(),
            "liboqs_version": toolchain.liboqs,
            "liboqs_python_version": toolchain.liboqs_python,
            "git_commit": common.git_commit(),
            "cpu_model": host.cpu_model,
            "arch": host.arch,
            "build_path": host.build_path,
            "steal_time_pct": steal,
        },
        "scope": {
            "measures": "IKEv2 key establishment (IKE_SA_INIT, plus RFC 9370 IKE_INTERMEDIATE).",
            "excludes": "Authentication payloads, which belong to the signature track.",
            "weights_note": WEIGHTS_NOTE,
            "rekey_note": REKEY_NOTE,
            "modp_gap": MODP_GAP,
            "macsec_gap": MACSEC_GAP,
            "baseline_note": (
                "Deltas are against %s for consistency with the TLS and SSH tracks. ecp256 is "
                "measured in the same run because it is the more representative classical "
                "baseline for deployed IPsec, so a same-run delta against it is also available."
                % BASELINE_SUITE
            ),
        },
        "unavailable": unavailable,
        "suites": records,
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--quick", action="store_true")
    ap.add_argument("--output-dir", default=None)
    args = ap.parse_args()

    iterations, warmup = (50, 5) if args.quick else (1000, 50)
    results = run(iterations, warmup)

    schema = os.path.join(
        os.path.dirname(__file__), "..", "..", "schema", "protocol_result.schema.json"
    )
    for rec in results["suites"].values():
        common.validate_result(rec, schema)

    out = json.dumps(results, indent=2)
    if args.output_dir:
        os.makedirs(args.output_dir, exist_ok=True)
        date = results["environment"]["iso_timestamp"][:10]
        gh = (results["environment"]["git_commit"] or "nogit")[:7]
        path = os.path.join(args.output_dir, f"ipsec-composed-{date}-{gh}.json")
        with open(path, "w") as fh:
            fh.write(out)
        print(f"wrote {path}")
    else:
        print(out)


if __name__ == "__main__":
    main()
