#!/usr/bin/env bash
# Generate real root -> intermediate -> leaf certificate chains, one per
# signature algorithm, and write them where measure_chains.py can size them.
#
# WHY THIS NEEDS THE LAYER B CONTAINER. The measurement host runs OpenSSL
# 3.0.13 with no oqs-provider, so it cannot mint an ML-DSA certificate at all.
# The Layer B image already carries OpenSSL + liboqs + oqs-provider for the
# live-handshake work, so certificate generation is a second use of an
# investment already made rather than a new dependency.
#
# WHY REAL CERTIFICATES RATHER THAN ARITHMETIC. The size of a certificate is
# not the size of the key plus the size of the signature. There is ASN.1
# framing, a subject and issuer DN, validity dates, serial numbers, extensions,
# and an algorithm identifier -- and the encoding overhead is not constant
# across algorithms. Adding up components would produce a confident number that
# is wrong by an amount nobody could predict. These are minted and measured.
#
# Chains are DELIBERATELY MINIMAL: short DNs, no SANs beyond one, no CT
# extensions. A real WebPKI certificate carries more, so every figure here is a
# FLOOR rather than a typical size, and the result file says so. A floor is the
# honest thing to publish when the alternative is inventing a "typical"
# deployment we have not surveyed.
set -uo pipefail

OUT="${OUT_DIR:-/out/certs}"
DAYS=365
mkdir -p "$OUT"

# algorithm-key -> openssl keygen arguments
#
# The classical arms exist so the post-quantum figures have something to be read
# against; a chain size in isolation prices nothing.
declare -A ALGS=(
  ["mldsa44"]="-algorithm mldsa44"
  ["mldsa65"]="-algorithm mldsa65"
  ["mldsa87"]="-algorithm mldsa87"
  ["ecdsa-p256"]="-algorithm EC -pkeyopt ec_paramgen_curve:prime256v1"
  ["rsa-2048"]="-algorithm RSA -pkeyopt rsa_keygen_bits:2048"
  ["rsa-3072"]="-algorithm RSA -pkeyopt rsa_keygen_bits:3072"
)

genkey() {
  local alg="$1" path="$2"
  # shellcheck disable=SC2086 -- the args are a deliberate word-split
  openssl genpkey ${ALGS[$alg]} -out "$path" 2>/dev/null
}

build_chain() {
  local alg="$1"
  local d="$OUT/$alg"
  mkdir -p "$d"

  if ! genkey "$alg" "$d/root.key"; then
    echo "  $alg: key generation unsupported by this build — skipped"
    rm -rf "$d"
    return 1
  fi
  genkey "$alg" "$d/intermediate.key" || return 1
  genkey "$alg" "$d/leaf.key" || return 1

  # Root: self-signed CA.
  openssl req -x509 -new -key "$d/root.key" -out "$d/root.crt" \
    -days "$DAYS" -subj "/CN=qa-root-$alg" \
    -addext "basicConstraints=critical,CA:TRUE" \
    -addext "keyUsage=critical,keyCertSign,cRLSign" 2>/dev/null || return 1

  # Intermediate: signed by the root.
  openssl req -new -key "$d/intermediate.key" -out "$d/intermediate.csr" \
    -subj "/CN=qa-intermediate-$alg" 2>/dev/null || return 1
  openssl x509 -req -in "$d/intermediate.csr" -CA "$d/root.crt" -CAkey "$d/root.key" \
    -out "$d/intermediate.crt" -days "$DAYS" -CAcreateserial \
    -extfile <(printf "basicConstraints=critical,CA:TRUE,pathlen:0\nkeyUsage=critical,keyCertSign,cRLSign\n") \
    2>/dev/null || return 1

  # Leaf: signed by the intermediate.
  openssl req -new -key "$d/leaf.key" -out "$d/leaf.csr" \
    -subj "/CN=leaf.example" 2>/dev/null || return 1
  openssl x509 -req -in "$d/leaf.csr" -CA "$d/intermediate.crt" -CAkey "$d/intermediate.key" \
    -out "$d/leaf.crt" -days "$DAYS" -CAcreateserial \
    -extfile <(printf "basicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature\nsubjectAltName=DNS:leaf.example\nextendedKeyUsage=serverAuth\n") \
    2>/dev/null || return 1

  # DER is what goes on the wire. PEM is base64 of the same bytes and would
  # overstate every figure by a third.
  for c in root intermediate leaf; do
    openssl x509 -in "$d/$c.crt" -outform DER -out "$d/$c.der" 2>/dev/null || return 1
  done

  rm -f "$d"/*.csr "$d"/*.srl
  echo "  $alg: root $(stat -c%s "$d/root.der")B, intermediate $(stat -c%s "$d/intermediate.der")B, leaf $(stat -c%s "$d/leaf.der")B"
  return 0
}

echo "openssl: $(openssl version)"
echo "providers:"
openssl list -providers 2>/dev/null | sed 's/^/  /' || true
echo
echo "building chains into $OUT"

built=0
for alg in "${!ALGS[@]}"; do
  if build_chain "$alg"; then
    built=$((built + 1))
  fi
done

echo
echo "built $built chain(s)"
# A build that produced nothing is a failure worth surfacing; one that produced
# some is a partial result the measurement step will report honestly.
[ "$built" -gt 0 ]
