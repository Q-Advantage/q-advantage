"""
What tooling that does not know ML-DSA does when handed an ML-DSA certificate.

WHY THIS IS THE MOST IMPORTANT OF THE COMPATIBILITY PROBES. Long before an
organisation migrates anything, it has to inventory what it has. Every scanner,
CMDB, certificate-lifecycle tool and CBOM emitter in that path is software built
against the algorithms that existed when it was written. If those tools cannot
read a post-quantum certificate at all, the inventory silently omits exactly the
certificates the migration is about -- and an inventory that is wrong in that
direction is worse than no inventory, because it reports completeness it does
not have.

THE DISTINCTION THAT MATTERS. There are three quite different outcomes and they
are routinely collapsed into "it doesn't support PQC":

  1. **Parses fully.** The tool reads subject, issuer, validity and serial, and
     reports the key algorithm as an OID it does not have a name for. An
     inventory built on this is complete; the unknown algorithm is a label
     problem, not a data problem.
  2. **Parses structurally, cannot identify the key.** The certificate is read
     but the public key is opaque. Most inventory questions are still
     answerable.
  3. **Refuses the file.** The tool reports a parse error and produces nothing.
     The certificate is invisible, and if the tool logs at anything less than
     debug the operator will not know it was skipped.

Only the third is a genuine inventory gap, and only measurement can tell them
apart. This probe records which one actually happens, per tool, with the tool's
own error text kept verbatim rather than summarised.

WHAT IS DELIBERATELY NOT CLAIMED. No statement about any product's roadmap or
intent, and no comparison between vendors as products. These are stock builds on
their default configuration, named and versioned, and that is all the result
claims them to be.
"""

from __future__ import annotations

import os
import subprocess
from pathlib import Path

#: Run OpenSSL with providers explicitly limited to the built-in default.
#:
#: The Layer B image carries oqs-provider, which is what makes it able to MINT
#: these certificates -- and would make it able to read them too, which is the
#: opposite of what this probe is for. Pointing OPENSSL_CONF at a minimal config
#: gives a stock stack from the same binary, so the result is about algorithm
#: support rather than about a difference between two installations.
DEFAULT_ONLY_CONF = """
openssl_conf = openssl_init
[openssl_init]
providers = provider_sect
[provider_sect]
default = default_sect
[default_sect]
activate = 1
"""

TIMEOUT_S = 30


def _default_only_env(tmpdir: Path) -> dict:
    conf = tmpdir / "default-only.cnf"
    conf.write_text(DEFAULT_ONLY_CONF)
    env = dict(os.environ)
    env["OPENSSL_CONF"] = str(conf)
    # Also clear any module path the image sets, so a provider cannot be picked
    # up from the filesystem despite the config.
    env.pop("OPENSSL_MODULES", None)
    return env


def _run(cmd: list[str], env: dict | None = None) -> tuple[int, str, str]:
    try:
        p = subprocess.run(
            cmd, capture_output=True, text=True, timeout=TIMEOUT_S, env=env, check=False
        )
        return p.returncode, p.stdout.strip(), p.stderr.strip()
    except subprocess.TimeoutExpired:
        return -1, "", "timed out after %ds" % TIMEOUT_S
    except FileNotFoundError as exc:
        return -2, "", str(exc)


def classify(fields: dict[str, str | None], key_readable: bool, refused: bool) -> str:
    """
    Which of the three outcomes this is.

    Ordered so the worst case cannot be reported as one of the better ones: a
    refusal wins over everything, and "parsed fully" requires every structural
    field to have actually come back.
    """
    if refused:
        return "refused_the_file"
    structural = all(fields.get(k) for k in ("subject", "not_after", "serial"))
    if structural and key_readable:
        return "parsed_fully"
    if structural:
        return "parsed_structure_key_opaque"
    return "parsed_partially"


def probe_openssl_default(cert_der: Path, tmpdir: Path) -> dict:
    """
    Stock OpenSSL, default provider only, against one certificate.

    Each field is asked for separately rather than in one command, because a
    single command that fails tells you only that something failed. Asking for
    the subject, the expiry, the serial and the key independently is what
    separates "cannot read this file" from "cannot read the key in this file".
    """
    env = _default_only_env(tmpdir)
    base = ["openssl", "x509", "-in", str(cert_der), "-inform", "DER", "-noout"]

    fields: dict[str, str | None] = {}
    errors: dict[str, str] = {}
    for name, flag in (("subject", "-subject"), ("not_after", "-enddate"), ("serial", "-serial")):
        rc, out, err = _run(base + [flag], env)
        fields[name] = out if rc == 0 and out else None
        if rc != 0:
            errors[name] = err

    rc_key, key_out, key_err = _run(base + ["-pubkey"], env)
    key_readable = rc_key == 0 and "BEGIN PUBLIC KEY" in key_out
    if rc_key != 0:
        errors["public_key"] = key_err

    # A file is refused when nothing structural could be read at all.
    refused = not any(fields.values())

    rc_v, ver_out, _ = _run(["openssl", "version"], env)
    return {
        "tool": "openssl (default provider only)",
        "version": ver_out if rc_v == 0 else None,
        "outcome": classify(fields, key_readable, refused),
        "fields_read": {k: v for k, v in fields.items() if v},
        "public_key_readable": key_readable,
        # Kept verbatim. A summarised error is exactly what an operator cannot
        # search for when they hit this in their own logs.
        "errors": errors,
    }


def probe_python_cryptography(cert_der: Path) -> dict:
    """
    A second, independent parser against the same file.

    `cryptography` is not a wrapper around the OpenSSL CLI's provider
    configuration -- it carries its own X.509 parser -- so agreement between the
    two is evidence about the certificate, and disagreement is evidence about
    the tooling. One implementation would not let a reader tell those apart.
    """
    try:
        from cryptography import x509
        from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat
    except ImportError as exc:
        return {
            "tool": "python cryptography",
            "version": None,
            "outcome": "not_installed",
            "errors": {"import": str(exc)},
        }

    import cryptography

    raw = cert_der.read_bytes()
    fields: dict[str, str | None] = {}
    errors: dict[str, str] = {}
    key_readable = False

    try:
        cert = x509.load_der_x509_certificate(raw)
    except Exception as exc:  # noqa: BLE001 - the error text is the result
        return {
            "tool": "python cryptography",
            "version": cryptography.__version__,
            "outcome": "refused_the_file",
            "fields_read": {},
            "public_key_readable": False,
            "errors": {"load": "%s: %s" % (type(exc).__name__, exc)},
        }

    for name, get in (
        ("subject", lambda: cert.subject.rfc4514_string()),
        ("not_after", lambda: cert.not_valid_after_utc.isoformat()),
        ("serial", lambda: hex(cert.serial_number)),
    ):
        try:
            fields[name] = get()
        except Exception as exc:  # noqa: BLE001
            fields[name] = None
            errors[name] = "%s: %s" % (type(exc).__name__, exc)

    try:
        cert.public_key().public_bytes(Encoding.DER, PublicFormat.SubjectPublicKeyInfo)
        key_readable = True
    except Exception as exc:  # noqa: BLE001
        errors["public_key"] = "%s: %s" % (type(exc).__name__, exc)

    return {
        "tool": "python cryptography",
        "version": cryptography.__version__,
        "outcome": classify(fields, key_readable, refused=not any(fields.values())),
        "fields_read": {k: v for k, v in fields.items() if v},
        "public_key_readable": key_readable,
        "errors": errors,
    }


def probe_algorithm(cert_dir: Path, tmpdir: Path) -> dict:
    """Every parser against one algorithm's leaf certificate."""
    leaf = cert_dir / "leaf.der"
    if not leaf.exists():
        return {
            "algorithm": cert_dir.name,
            "measured": False,
            "reason": "no leaf.der was generated for this algorithm",
        }

    tools = [probe_openssl_default(leaf, tmpdir), probe_python_cryptography(leaf)]
    return {
        "algorithm": cert_dir.name,
        "measured": True,
        "leaf_der_bytes": leaf.stat().st_size,
        "tools": tools,
        "invisible_to": [t["tool"] for t in tools if t["outcome"] == "refused_the_file"],
        "inventoriable_by": [
            t["tool"]
            for t in tools
            if t["outcome"] in ("parsed_fully", "parsed_structure_key_opaque")
        ],
    }
