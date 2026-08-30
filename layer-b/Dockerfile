# Layer B reference stack: OpenSSL + liboqs + oqs-provider.
#
# WHY A CONTAINER AND NOT THE HOST. layer-b-spec.md section 3a calls for a
# pinned image rather than the measurement host's own install, and the reason
# is concrete: the production box runs OpenSSL 3.0.13, which predates the
# TLS-level PQC group support Layer B needs to negotiate. Building it into an
# image also makes the whole stack reproducible by anyone reading this file,
# which is the same property METHODOLOGY.md already claims for Layer A.
#
# It has a second use. Layer A's LMS/XMSS harness has reported "unavailable"
# since 2026-08-14 because the runner's liboqs was not built with the stateful
# signature flags, and rebuilding the production runner is a change to the box
# that produces the entire product's data. This image sets those flags, so the
# flags, the KAT vectors and the harness path can all be proven correct here
# BEFORE anyone touches the measurement host.
#
# Ubuntu 24.04 matches the runner's OS, so a difference between this stack and
# Layer A's is a difference in the crypto build, not in the distribution.
FROM ubuntu:24.04

ARG DEBIAN_FRONTEND=noninteractive

# Pinned deliberately. liboqs matches Layer A exactly (0.15.0) so the two
# layers measure the same implementation; a drift here would make Layer B's
# findings inapplicable to Layer A's numbers.
#
# The oqs-provider tag is #unverified against a primary source at the time of
# writing -- it is the pairing the build is asserted to work with, and the CI
# job that builds this image is what confirms it. If the build fails on this
# tag, change the tag; do not unpin it.
ARG LIBOQS_VERSION=0.15.0
ARG OQS_PROVIDER_VERSION=0.10.0

RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential \
      cmake \
      ninja-build \
      git \
      ca-certificates \
      libssl-dev \
      openssl \
      python3 \
      python3-pip \
      tcpdump \
      iproute2 \
    && rm -rf /var/lib/apt/lists/*

# liboqs.
#
# OQS_ENABLE_SIG_STFL_LMS / _XMSS compile the stateful hash-based signature
# schemes. The third, related flag -- OQS_HAZARDOUS_EXPERIMENTAL_ENABLE_SIG_
# STFL_KEY_SIG_GEN, which enables key generation and signing -- is deliberately
# NOT set. Upstream explicitly discourages it, and verification is the
# operation that matters for the firmware-signing use case anyway: a signature
# is produced once and checked on every boot. See docs/runbook.md, "Enabling
# LMS / XMSS stateful signatures", Option A.
RUN git clone --depth 1 --branch ${LIBOQS_VERSION} https://github.com/open-quantum-safe/liboqs.git /src/liboqs \
    && cmake -S /src/liboqs -B /src/liboqs/build -GNinja \
         -DCMAKE_INSTALL_PREFIX=/usr/local \
         -DBUILD_SHARED_LIBS=ON \
         -DOQS_ENABLE_SIG_STFL_LMS=ON \
         -DOQS_ENABLE_SIG_STFL_XMSS=ON \
    && cmake --build /src/liboqs/build --parallel \
    && cmake --install /src/liboqs/build \
    && ldconfig

# oqs-provider: the OpenSSL 3 provider that exposes liboqs groups at the TLS
# layer, which is what makes a real PQC handshake possible at all.
RUN git clone --depth 1 --branch ${OQS_PROVIDER_VERSION} https://github.com/open-quantum-safe/oqs-provider.git /src/oqs-provider \
    && cmake -S /src/oqs-provider -B /src/oqs-provider/build -GNinja \
         -DCMAKE_INSTALL_PREFIX=/usr/local \
         -Dliboqs_DIR=/usr/local/lib/cmake/liboqs \
    && cmake --build /src/oqs-provider/build --parallel \
    && cmake --install /src/oqs-provider/build \
    && ldconfig

COPY openssl.cnf /etc/ssl/layer-b-openssl.cnf
ENV OPENSSL_CONF=/etc/ssl/layer-b-openssl.cnf

WORKDIR /layer-b
COPY capture/ /layer-b/capture/
COPY scripts/ /layer-b/scripts/
RUN chmod +x /layer-b/scripts/*.sh

# Recording what this image actually built, so a result file can carry its
# provenance rather than asserting a version from the Dockerfile's ARGs.
RUN openssl version -a > /layer-b/openssl-version.txt \
    && (openssl list -providers -provider oqsprovider > /layer-b/providers.txt 2>&1 || true)

CMD ["/bin/bash"]
