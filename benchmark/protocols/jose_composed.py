"""
Layer A — JWT/JOSE composed signing cost, and the token size that comes with it.

WHY THIS TRACK EXISTS. `qshield-update-spec.md` §15 Tier 2 names "JWT signing,
ML-DSA vs RSA-PSS" with two stated dependencies. The first — RSA-PSS not being
benchmarked at all — was closed by `classical_sig.py`. The second is this file:
a composition layer that signs and verifies a real JOSE-shaped token rather than
a bare message, because that is where a cost appears that the primitive numbers
cannot show.

WHAT THE PRIMITIVE NUMBERS MISS. The signature track publishes ML-DSA-65's
signature as 3,309 bytes. In a JWS Compact Serialization that signature is
base64url-encoded, so it arrives on the wire as 4,412 characters, and it arrives
inside an HTTP header. Header and cookie size limits are small, fixed, and
enforced by software nobody in a migration controls. That expansion is a
property of the ENCODING, not of the algorithm, and it is invisible in every
number this repo published before this track existed.

WHAT IT DOES NOT CLAIM.

  * **No registered JOSE `alg` identifier is asserted for any post-quantum
    scheme.** The `alg` header here carries the scheme's own name as a
    NON-STANDARD value, and every record says so. This module does not name,
    cite or anticipate a standardisation draft — an uncited identity claim is
    the same failure mode as a fabricated benchmark. The measurement does not
    depend on which identifier is eventually registered: the token's size is
    driven by the signature and the encoding, and the `alg` string contributes
    a handful of bytes that are counted honestly as part of the header.
  * **No verdict on whether a given token "fits".** Limits are configurable and
    stack-specific. This module publishes the measured token size against
    several widely-defaulted limits, names each limit's source, and leaves the
    judgement to a reader who knows their own stack.

WHY BOTH ARMS RUN IN ONE PASS. Same reason as `classical_sig.py`: on 2026-08-16
a two-pass comparison on this host published a sign-flipped delta. Classical and
post-quantum tokens are built, signed and verified inside a single run.
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
import common  # noqa: E402

#: The payload of a token that looks like something real.
#:
#: Deliberately modest: an iss/sub/aud/exp/iat set plus a couple of scope
#: claims, which is close to what an OAuth2 access token carries. A larger
#: payload would inflate every arm equally and make the signature's share look
#: smaller than it is; a smaller one would flatter the post-quantum arm the same
#: way in reverse. The exact payload is published with the numbers because it is
#: an input to them.
CLAIMS = {
    "iss": "https://issuer.example",
    "sub": "01J0000000000000000000000",
    "aud": "https://api.example",
    "exp": 1893456000,
    "iat": 1893452400,
    "scope": "read:metrics write:metrics",
    "jti": "00000000-0000-4000-8000-000000000000",
}

#: Size limits a token has to live inside, with the source for each.
#:
#: These are DEFAULTS, every one of them configurable. They are published so a
#: measured token size means something to a reader, not so this module can
#: declare a pass or a fail.
SIZE_LIMITS = [
    {
        "name": "HTTP cookie value",
        "bytes": 4096,
        "source": "RFC 6265 section 6.1 - servers SHOULD support at least 4096 bytes per cookie.",
    },
    {
        "name": "nginx large_client_header_buffers (one header)",
        "bytes": 8192,
        "source": "nginx default: 4 buffers of 8k. A single header line must fit within one buffer.",
    },
    {
        "name": "Node.js --max-http-header-size (whole header block)",
        "bytes": 16384,
        "source": "Node.js default since 12.x, applied to the total header block rather than one line.",
    },
]

#: base64url expands by 4 bytes of output per 3 bytes of input, unpadded.
#:
#: Present for the explanatory note only. Every published size comes from
#: encoding the real token, never from multiplying by this.
B64_EXPANSION = 4 / 3


def b64u(raw: bytes) -> bytes:
    """base64url without padding, as JOSE requires (RFC 7515 section 2)."""
    return base64.urlsafe_b64encode(raw).rstrip(b"=")


def signing_input(alg: str) -> tuple[bytes, bytes]:
    """
    The JWS Signing Input: BASE64URL(header) || "." || BASE64URL(payload).

    Returns the encoded header alongside it so the header's own contribution can
    be reported separately. A post-quantum alg string is longer than "ES256",
    and that difference should be visible rather than silently folded into the
    signature's share.
    """
    header = b64u(json.dumps({"alg": alg, "typ": "JWT"}, separators=(",", ":")).encode())
    payload = b64u(json.dumps(CLAIMS, separators=(",", ":")).encode())
    return header + b"." + payload, header


def compose(signing_bytes: bytes, signature: bytes) -> bytes:
    """A JWS Compact Serialization token (RFC 7515 section 7.1)."""
    return signing_bytes + b"." + b64u(signature)


def size_accounting(token: bytes, header: bytes, signature: bytes) -> dict:
    """
    Where the bytes in a token actually are.

    The split matters because two of the three parts are chosen by the
    application and one is fixed by the algorithm. A reader deciding whether a
    migration is affordable needs to know which part they can shrink.
    """
    encoded_sig = len(b64u(signature))
    return {
        "token_bytes": len(token),
        "header_bytes": len(header),
        # Two "." separators in a compact serialization.
        "payload_bytes": len(token) - len(header) - encoded_sig - 2,
        "signature_raw_bytes": len(signature),
        "signature_encoded_bytes": encoded_sig,
        "encoding_overhead_bytes": encoded_sig - len(signature),
        "signature_share_pct": round(100.0 * encoded_sig / len(token), 1),
        "note": (
            "The signature is base64url-encoded in the compact serialization, so it costs about "
            "a third more on the wire than its raw length. The payload is this module's choice "
            "and is published with the result; the signature length is not a choice."
        ),
    }


def against_limits(token_bytes: int) -> list[dict]:
    """Measured size against each documented default, with no verdict attached."""
    return [
        {
            "limit": limit["name"],
            "limit_bytes": limit["bytes"],
            "token_bytes": token_bytes,
            "headroom_bytes": limit["bytes"] - token_bytes,
            "within_default": token_bytes <= limit["bytes"],
            "source": limit["source"],
        }
        for limit in SIZE_LIMITS
    ]


def _pq_signer(scheme: str):
    """(sign, verify, alg, handle) for a post-quantum scheme, or None if absent."""
    import oqs

    if scheme not in oqs.get_enabled_sig_mechanisms():
        return None
    sig = oqs.Signature(scheme)
    pub = sig.generate_keypair()
    return (lambda m: sig.sign(m)), (lambda m, s: sig.verify(m, s, pub)), scheme, sig


def _classical_signer(scheme: str):
    """(sign, verify, alg, handle) for a classical scheme."""
    from cryptography.hazmat.primitives import hashes
    from cryptography.hazmat.primitives.asymmetric import ec, padding, rsa

    if scheme.startswith("RSA-"):
        bits = int(scheme.split("-")[1])
        key = rsa.generate_private_key(public_exponent=65537, key_size=bits)
        pss = padding.PSS(mgf=padding.MGF1(hashes.SHA256()), salt_length=hashes.SHA256.digest_size)
        # PS256 is the registered identifier for RSASSA-PSS with SHA-256
        # (RFC 7518 section 3.1). It is used because it is registered - and the
        # contrast with the post-quantum arms, which have no registered
        # identifier available to them, is part of what this track shows.
        return (
            (lambda m: key.sign(m, pss, hashes.SHA256())),
            (lambda m, s: key.public_key().verify(s, m, pss, hashes.SHA256())),
            "PS256",
            None,
        )

    if scheme.startswith("ECDSA-P"):
        curve, digest, alg = (
            (ec.SECP256R1(), hashes.SHA256(), "ES256")
            if "P256" in scheme
            else (ec.SECP384R1(), hashes.SHA384(), "ES384")
        )
        key = ec.generate_private_key(curve)
        return (
            (lambda m: key.sign(m, ec.ECDSA(digest))),
            (lambda m, s: key.public_key().verify(s, m, ec.ECDSA(digest))),
            alg,
            None,
        )

    raise ValueError("unknown classical scheme %r" % scheme)


#: What gets measured, and which arm each belongs to.
ARMS: list[tuple[str, str]] = [
    ("ECDSA-P256", "classical"),
    ("RSA-2048", "classical"),
    ("RSA-3072", "classical"),
    ("ML-DSA-44", "post-quantum"),
    ("ML-DSA-65", "post-quantum"),
    ("ML-DSA-87", "post-quantum"),
    ("Falcon-512", "post-quantum"),
]

#: The baseline every delta is taken against.
#:
#: ECDSA-P256 rather than RSA-2048, because ES256 is the most widely deployed
#: JWT signing algorithm and produces the smallest classical token - the
#: comparison a reader is most likely to actually be facing.
BASELINE = "ECDSA-P256"

ALG_NOTE = (
    "The alg header for a post-quantum scheme carries the scheme's own name as a NON-STANDARD "
    "value. No registered JOSE algorithm identifier is asserted for it, and no standardisation "
    "draft is named or anticipated here. The measurement does not depend on which identifier is "
    "eventually registered: a token's size is driven by the signature and by base64url, and the "
    "alg string's own contribution is counted in header_bytes where a reader can see it."
)


def bench_arm(scheme: str, kind: str, iterations: int, warmup: int) -> dict:
    """
    One scheme, signing and verifying a real JOSE token end to end.

    Returns an `unavailable` record rather than raising when a scheme is not
    enabled in this build of liboqs, or when `cryptography` is missing: an arm
    we could not measure is a gap to report, not a reason the track fails.
    """
    handle = None
    try:
        if kind == "post-quantum":
            built = _pq_signer(scheme)
            if built is None:
                return {
                    "scheme": scheme,
                    "kind": kind,
                    "status": "unavailable",
                    "reason": (
                        "%s is not enabled in this build of liboqs, so no token could be signed "
                        "with it." % scheme
                    ),
                }
            sign, verify, alg, handle = built
            alg_is_registered = False
        else:
            sign, verify, alg, handle = _classical_signer(scheme)
            alg_is_registered = True
    except ImportError as exc:
        return {
            "scheme": scheme,
            "kind": kind,
            "status": "unavailable",
            "reason": "a required library is not installed on this host: %s" % exc,
        }
    except Exception as exc:  # noqa: BLE001 - report, never fabricate
        return {
            "scheme": scheme,
            "kind": kind,
            "status": "failed",
            "error": "%s: %s" % (type(exc).__name__, exc),
        }

    try:
        signing_bytes, header = signing_input(alg)

        # Timed as the operations an application actually performs: sign the
        # signing input and assemble the token; split the token and verify it.
        # Composing and splitting are part of the cost of issuing and checking
        # one, so they sit inside the timed region rather than hoisted out.
        def sign_token() -> bytes:
            return compose(signing_bytes, sign(signing_bytes))

        def verify_token(token: bytes) -> None:
            si, _, encoded = token.rpartition(b".")
            pad = b"=" * (-len(encoded) % 4)
            verify(si, base64.urlsafe_b64decode(encoded + pad))

        res_before = common._rusage()
        sign_ns = common._time_loop(sign_token, iterations, warmup)
        verify_ns = common._time_loop_with_setup(sign_token, verify_token, iterations, warmup)
        resources = common.resource_delta(res_before, common._rusage(), iterations * 2)

        signature = sign(signing_bytes)
        token = compose(signing_bytes, signature)
        # A token that does not verify is a broken measurement, not a slow one.
        verify_token(token)
    except Exception as exc:  # noqa: BLE001
        return {
            "scheme": scheme,
            "kind": kind,
            "status": "failed",
            "error": "%s: %s" % (type(exc).__name__, exc),
        }
    finally:
        if handle is not None:
            handle.free()

    return {
        "scheme": scheme,
        "kind": kind,
        "status": "ok",
        "alg": alg,
        "alg_is_registered": alg_is_registered,
        "alg_note": None if alg_is_registered else ALG_NOTE,
        "sign": common.compute_stats(sign_ns),
        "verify": common.compute_stats(verify_ns),
        "size": size_accounting(token, header, signature),
        "limits": against_limits(len(token)),
        "resources": resources,
    }


def compare(arms: dict[str, dict], baseline: str = BASELINE) -> dict:
    """
    Token sizes and signing costs against a classical baseline.

    Refuses rather than substitutes when the baseline is missing: an absolute
    token size prices nothing, and silently picking a different baseline would
    change what every row means without saying so.
    """
    base = arms.get(baseline)
    if not base or base.get("status") != "ok":
        return {
            "measurable": False,
            "reason": (
                "%s did not produce a token, and an absolute token size prices nothing. Rather "
                "than substitute another baseline - which would change what every row means "
                "without saying so - no comparison is published." % baseline
            ),
        }

    base_bytes = base["size"]["token_bytes"]
    base_sign = base["sign"]["mean_us"]
    rows = []
    for name, rec in arms.items():
        if name == baseline or rec.get("status") != "ok":
            continue
        rows.append(
            {
                "scheme": name,
                "kind": rec["kind"],
                "token_bytes": rec["size"]["token_bytes"],
                "token_delta_bytes": rec["size"]["token_bytes"] - base_bytes,
                "token_multiple_of_baseline": round(rec["size"]["token_bytes"] / base_bytes, 2),
                "sign_delta_pct": round(100.0 * (rec["sign"]["mean_us"] - base_sign) / base_sign, 1),
            }
        )

    return {
        "measurable": True,
        "baseline": baseline,
        "baseline_token_bytes": base_bytes,
        "rows": sorted(rows, key=lambda r: -r["token_bytes"]),
        "note": (
            "Size and speed are reported separately and never blended. They move independently "
            "here - a scheme can sign faster while producing a token that no longer fits a "
            "header - and a single figure would erase exactly that."
        ),
    }


def run(iterations: int, warmup: int) -> dict:
    toolchain = common.capture_toolchain()
    host = common.capture_host()
    sampler = common.StealTimeSampler()

    arms: dict[str, dict] = {}
    for scheme, kind in ARMS:
        arms[scheme] = bench_arm(scheme, kind, iterations, warmup)

    return {
        "schema": "jose-composed/1",
        "track": "jose-composed",
        "label": "JWT/JOSE composed signing",
        "environment": {
            "iso_timestamp": common.utc_timestamp(),
            "liboqs_version": toolchain.liboqs,
            "liboqs_python_version": toolchain.liboqs_python,
            "git_commit": common.git_commit(),
            "cpu_model": host.cpu_model,
            "arch": host.arch,
            "ec2_instance_type": host.ec2_instance_type,
            "steal_time_pct": sampler.result_pct(),
        },
        "claims": CLAIMS,
        "claims_note": (
            "The payload is this module's choice, close in shape to an OAuth2 access token. It "
            "is published because it is an input: a larger payload would make the signature's "
            "share of the token look smaller than it is, and a smaller one would do the reverse."
        ),
        "alg_note": ALG_NOTE,
        "size_limits": SIZE_LIMITS,
        "limits_note": (
            "Every limit above is a configurable default, not a protocol constant. They are "
            "published so a measured token size means something, not so this track can declare a "
            "pass or a fail - that judgement needs a reader who knows their own stack."
        ),
        "arms": arms,
        "comparison": compare(arms),
        # 3.9 (SSO / SAML), whose gap text named exactly two blockers: RSA-PSS
        # not being benchmarked at all, and nothing composing a sign/verify
        # timing into a JWT-shaped budget. This track is the second of those.
        # It is not 3.7 (code-signing service), which needs a different
        # composition entirely.
        "cfdir_use_cases": ["3.9"],
        "cfdir_framework": common.CFDIR_FRAMEWORK_VERSION,
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--quick", action="store_true")
    ap.add_argument("--output-dir", default=None)
    args = ap.parse_args()

    iterations, warmup = (50, 5) if args.quick else (1000, 50)
    results = run(iterations, warmup)
    out = json.dumps(results, indent=2)

    if args.output_dir:
        os.makedirs(args.output_dir, exist_ok=True)
        date = results["environment"]["iso_timestamp"][:10]
        gh = (results["environment"]["git_commit"] or "nogit")[:7]
        path = os.path.join(args.output_dir, "jose-composed-%s-%s.json" % (date, gh))
        with open(path, "w") as fh:
            fh.write(out)
        print("wrote %s" % path)
    else:
        print(out)


if __name__ == "__main__":
    main()
