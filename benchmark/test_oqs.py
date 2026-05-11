"""Smoke test: confirm liboqs-python loads and lists expected algorithms."""
import oqs

print(f"liboqs version:        {oqs.oqs_version()}")
print(f"liboqs-python version: {oqs.oqs_python_version()}")
print()

kems = oqs.get_enabled_kem_mechanisms()
sigs = oqs.get_enabled_sig_mechanisms()

print(f"Total KEMs available:       {len(kems)}")
print(f"Total signatures available: {len(sigs)}")
print()

# Check our target algorithms are present
targets = {
    "KEM": ["ML-KEM-512", "ML-KEM-768", "ML-KEM-1024"],
    "Signature": [
        "ML-DSA-44", "ML-DSA-65", "ML-DSA-87",
        "SLH-DSA-SHAKE-128s", "SLH-DSA-SHAKE-128f",
    ],
}

print("Q-Advantage target algorithm check:")
all_present = True
for kind, names in targets.items():
    pool = kems if kind == "KEM" else sigs
    for name in names:
        status = "✓" if name in pool else "✗ MISSING"
        if name not in pool:
            all_present = False
        print(f"  [{status}] {kind:10s}  {name}")

print()
print("RESULT:", "ALL TARGETS PRESENT" if all_present else "MISSING ALGORITHMS — see above")
