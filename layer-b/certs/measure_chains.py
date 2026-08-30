"""
Certificate-chain sizing.

WHAT THIS CLOSES. `qshield-update-spec.md` §16.2 marks CFDIR use case 3.5 (TLS
certificates) partial with a pointed gap: *"Timings yes; certificate-chain bytes
explicitly out of scope — and the chain **is** the cost here."* The methodology
page says the same thing about `bytes_total`: it is the key-exchange payload,
"not a full captured TLS record (no ClientHello extensions, no certificate
chain, no record-layer framing)."

That exclusion was a correct scoping decision for Layer A, which has no socket
and mints no certificates. It is not a reason the number cannot exist. This
measures it.

WHY THE SIZES ARE MEASURED AND NOT COMPUTED. A certificate is not its key plus
its signature. There is ASN.1 framing, subject and issuer names, validity dates,
a serial, extensions and an algorithm identifier, and the encoding overhead
differs between algorithms. Summing components would produce a confident number
wrong by an unpredictable amount. `generate-chains.sh` mints real chains; this
module sizes what came out.

WHAT THE FIGURES ARE. A **floor**, not a typical size. The generated chains
carry short names, one SAN, and no Certificate Transparency extensions, where a
real WebPKI certificate carries considerably more. Publishing a floor is the
honest option when the alternative is inventing a "typical" deployment nobody
has surveyed — and it is the conservative direction, since a real chain is
larger and the post-quantum penalty therefore larger too.
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

CHAIN_ORDER = ("leaf", "intermediate", "root")

#: TLS 1.3 sends each certificate in the Certificate message with a 3-byte
#: length prefix and a 2-byte extensions length (RFC 8446 §4.4.2). Counted so
#: the published figure is what the handshake carries rather than the bare sum
#: of DER blobs.
PER_CERT_TLS_OVERHEAD = 5

#: In the common WebPKI deployment the root is already in the client's trust
#: store and is NOT sent. Both figures are published because which one applies
#: depends on the deployment, and quoting only one would be a choice made on
#: the reader's behalf.
SENT_IN_TLS = ("leaf", "intermediate")


def measure_chain(directory: Path) -> dict:
    """Size one algorithm's chain from its DER files."""
    certs: dict[str, int] = {}
    missing: list[str] = []
    for name in CHAIN_ORDER:
        path = directory / ("%s.der" % name)
        if path.exists():
            certs[name] = path.stat().st_size
        else:
            missing.append(name)

    if missing:
        return {
            "algorithm": directory.name,
            "measured": False,
            "reason": "missing certificate(s): %s" % ", ".join(missing),
        }

    chain_der = sum(certs.values())
    sent_der = sum(certs[n] for n in SENT_IN_TLS)

    return {
        "algorithm": directory.name,
        "measured": True,
        "certificates_der_bytes": certs,
        "full_chain_der_bytes": chain_der,
        # What a handshake actually carries in the common case.
        "sent_in_handshake": {
            "certificates": list(SENT_IN_TLS),
            "der_bytes": sent_der,
            "tls_message_bytes": sent_der + PER_CERT_TLS_OVERHEAD * len(SENT_IN_TLS),
            "note": (
                "Leaf and intermediate only: in the common WebPKI deployment the root is already "
                "in the client's trust store and is not sent. The full chain is published too, "
                "because which figure applies depends on the deployment."
            ),
        },
    }


def compare(chains: list[dict], baseline: str) -> dict:
    """Post-quantum chains against a classical one, in bytes and multiples."""
    by_alg = {c["algorithm"]: c for c in chains if c.get("measured")}
    base = by_alg.get(baseline)
    if not base:
        return {
            "measurable": False,
            "reason": (
                "the %s baseline chain was not built, so there is nothing to compare against. "
                "An absolute chain size prices nothing on its own." % baseline
            ),
        }

    base_sent = base["sent_in_handshake"]["der_bytes"]
    rows = []
    for alg, c in sorted(by_alg.items()):
        if alg == baseline:
            continue
        sent = c["sent_in_handshake"]["der_bytes"]
        rows.append(
            {
                "algorithm": alg,
                "sent_der_bytes": sent,
                "delta_bytes": sent - base_sent,
                "multiple_of_baseline": round(sent / base_sent, 2) if base_sent else None,
            }
        )

    return {
        "measurable": True,
        "baseline": baseline,
        "baseline_sent_der_bytes": base_sent,
        "rows": rows,
        "note": (
            "Compared on what a handshake sends (leaf + intermediate), not the full chain, because "
            "that is the figure a per-connection cost multiplies."
        ),
    }


def component_arithmetic(chains: list[dict]) -> dict:
    """
    What each part of a chain costs, so a proposal to remove one can be priced.

    THE POINT. `qshield-update-spec.md` §13's third pass records that Merkle
    Tree Certificates are an IETF-draft mechanism for shrinking post-quantum
    certificate chains, that the third-party post which raised it "contains no
    byte counts at all", and that publishing those counts is "the cheapest
    differentiated output on this entire list."

    This publishes the arithmetic and nothing more. It states what a chain
    costs and what removing a component would save. It makes **no claim about
    what any particular draft specifies** -- the MTC draft's exact name, version
    and status are unconfirmed here, so naming its mechanics would be an
    uncited identity claim of exactly the kind the sourcing standard forbids.
    The arithmetic is ours and is measured; the mapping onto a named proposal is
    for whoever cites the draft.
    """
    by_alg = {c["algorithm"]: c for c in chains if c.get("measured")}
    rows = []
    for alg, c in sorted(by_alg.items()):
        certs = c["certificates_der_bytes"]
        sent = c["sent_in_handshake"]["der_bytes"]
        rows.append(
            {
                "algorithm": alg,
                "sent_der_bytes": sent,
                # A mechanism that let the client omit the issuing certificate
                # would save exactly this, whatever mechanism that is.
                "saved_if_intermediate_omitted": certs["intermediate"],
                "remaining_if_intermediate_omitted": certs["leaf"],
                "intermediate_share_pct": (
                    round(certs["intermediate"] / sent * 100, 1) if sent else None
                ),
            }
        )
    return {
        "rows": rows,
        "claim_boundary": (
            "This is arithmetic over chains we minted and measured. It says what a chain costs and "
            "what omitting a component would save. It does not describe, endorse or specify any "
            "particular proposal for doing so -- mapping these numbers onto a named IETF draft "
            "requires citing that draft, which is not done here."
        ),
    }


def openssl_version() -> str | None:
    try:
        out = subprocess.run(
            ["openssl", "version"], capture_output=True, text=True, timeout=10
        )
        return out.stdout.strip() or None
    except Exception:  # noqa: BLE001
        return None


def git_commit() -> str | None:
    try:
        out = subprocess.run(
            ["git", "rev-parse", "HEAD"], capture_output=True, text=True, timeout=10
        )
        return out.stdout.strip() or None
    except Exception:  # noqa: BLE001
        return None


def build(certs_dir: Path, baseline: str) -> dict:
    directories = sorted(d for d in certs_dir.iterdir() if d.is_dir()) if certs_dir.exists() else []
    chains = [measure_chain(d) for d in directories]

    return {
        "schema": "cert-chain/0.1.0",
        "environment": {
            "iso_timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "openssl": openssl_version(),
            "git_commit": git_commit(),
        },
        "scope": {
            "measures": (
                "DER sizes of real root/intermediate/leaf chains, one per signature algorithm, "
                "minted with OpenSSL and oqs-provider."
            ),
            "floor_not_typical": (
                "These chains carry short names, one SAN and no Certificate Transparency "
                "extensions. A real WebPKI certificate carries more, so every figure here is a "
                "FLOOR rather than a typical size -- and the post-quantum penalty on a real chain "
                "is therefore larger, not smaller."
            ),
            "why_measured": (
                "A certificate is not its key plus its signature: ASN.1 framing, names, validity, "
                "serial, extensions and the algorithm identifier all contribute, and the overhead "
                "differs between algorithms. Summing components would be confidently wrong."
            ),
            "not_measured": (
                "Chain validation cost in situ, issuance and rotation cost (CFDIR 3.3), and "
                "anything about how often a chain is re-sent versus resumed."
            ),
        },
        "chains": chains,
        "comparison": compare(chains, baseline),
        "components": component_arithmetic(chains),
    }


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--certs-dir", type=Path, default=Path("/out/certs"))
    ap.add_argument("--baseline", default="ecdsa-p256")
    ap.add_argument("--output-dir", type=Path, default=None)
    args = ap.parse_args(argv)

    result = build(args.certs_dir, args.baseline)
    text = json.dumps(result, indent=2)

    if args.output_dir:
        os.makedirs(args.output_dir, exist_ok=True)
        date = result["environment"]["iso_timestamp"][:10]
        gh = (result["environment"]["git_commit"] or "nogit")[:7]
        path = args.output_dir / ("cert-chain-%s-%s.json" % (date, gh))
        path.write_text(text)
        print("wrote %s" % path)
    else:
        print(text)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
