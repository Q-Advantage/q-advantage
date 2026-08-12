"""Q-Shield symmetric baseline — AES-256-GCM (Layer A reference line).

The symmetric operation every TLS/SSH session actually spends most of its
bytes on once the asymmetric handshake is done. Contextualizes every
asymmetric number this repo publishes: "here's what a boring, fast,
everyone-already-uses-this operation costs." Deliberately narrow scope —
one algorithm (AES-256-GCM), one mode, one payload size — not a new
benchmark category (qshield-update-spec.md §3's own scope discipline).

Payload size is 16384 bytes: the maximum TLSPlaintext record length per
RFC 8446 §5.2 (https://www.rfc-editor.org/rfc/rfc8446#section-5.2), not a
guessed "typical" size.

Run:
    python3 benchmark/protocols/aes_baseline.py [--quick]
"""

from __future__ import annotations

import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
import common  # noqa: E402

PAYLOAD_BYTES = 16384  # RFC 8446 §5.2 — max TLSPlaintext record length
KEY_BITS = 256
NONCE_BYTES = 12  # GCM standard nonce size
TAG_BYTES = 16  # GCM standard authentication tag size


def run(iterations: int, warmup: int) -> dict:
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM

    toolchain = common.capture_toolchain()
    host = common.capture_host()
    sampler = common.StealTimeSampler()

    key = AESGCM.generate_key(bit_length=KEY_BITS)
    aead = AESGCM(key)
    plaintext = os.urandom(PAYLOAD_BYTES)
    nonce = os.urandom(NONCE_BYTES)
    ciphertext = aead.encrypt(nonce, plaintext, None)  # fixed, valid ciphertext for decrypt timing

    encrypt_ns = common._time_loop(lambda: aead.encrypt(nonce, plaintext, None), iterations, warmup)
    decrypt_ns = common._time_loop(lambda: aead.decrypt(nonce, ciphertext, None), iterations, warmup)

    steal = sampler.result_pct()

    return {
        "environment": {
            "iso_timestamp": common.utc_timestamp(),
            "liboqs_version": toolchain.liboqs,  # not used, captured for consistency with other tracks
            "git_commit": common.git_commit(),
            "cpu_model": host.cpu_model,
            "arch": host.arch,
            "build_path": host.build_path,
            "steal_time_pct": steal,
        },
        "baseline": {
            "algorithm": "AES-256-GCM",
            "payload_bytes": PAYLOAD_BYTES,
            "payload_bytes_source": "RFC 8446 §5.2 — max TLSPlaintext record length",
            "key_bytes": KEY_BITS // 8,
            "nonce_bytes": NONCE_BYTES,
            "tag_bytes": TAG_BYTES,
            "encrypt": common.compute_stats(encrypt_ns),
            "decrypt": common.compute_stats(decrypt_ns),
        },
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
        path = os.path.join(args.output_dir, f"aes-baseline-{date}-{gh}.json")
        with open(path, "w") as fh:
            fh.write(out)
        print(f"wrote {path}")
    else:
        print(out)


if __name__ == "__main__":
    main()
