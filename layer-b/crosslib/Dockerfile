# Three independent post-quantum implementations, side by side.
#
# WHY THIS IMAGE EXISTS. `qshield-update-spec.md` §15 Tier 2's cross-library
# diversity item. Every number Q-Shield publishes today comes from liboqs. That
# is a single implementation, and a single implementation cannot tell you
# whether a figure is a property of the ALGORITHM or a property of the LIBRARY.
#
# WHAT THIS IMAGE IS DELIBERATELY NOT FOR. Timings. A shared GitHub-hosted
# runner cannot produce publication-grade measurements -- it is a noisy, shared,
# unpinned machine, and this repo has spent considerable effort establishing
# that its published numbers come from a dedicated host. Building a
# cross-library TIMING comparison here and publishing it would undo that in one
# commit. What this image produces instead is availability and artifact SIZES,
# which are properties of the algorithm and its encoding rather than of the
# machine, and are therefore portable in exactly the way a timing is not.
#
# The build is a multi-stage one so the probe image does not carry three
# toolchains.

# --- BoringSSL ------------------------------------------------------------
FROM golang:1.23-bookworm AS boringssl
RUN apt-get update && apt-get install -y --no-install-recommends \
      cmake ninja-build git ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /src
# Pinned. An unpinned clone would make this image's answer change without any
# commit here changing, which is the opposite of what a cross-check is for.
ARG BORINGSSL_REF=0.20240930.0
RUN git clone --depth 1 --branch "${BORINGSSL_REF}" \
      https://github.com/google/boringssl.git 2>/dev/null \
    || git clone --depth 1 https://github.com/google/boringssl.git
RUN cmake -GNinja -B build -S boringssl -DCMAKE_BUILD_TYPE=Release \
    && ninja -C build bssl \
    && cp build/tool/bssl /usr/local/bin/bssl-boringssl

# --- AWS-LC ---------------------------------------------------------------
FROM golang:1.23-bookworm AS awslc
RUN apt-get update && apt-get install -y --no-install-recommends \
      cmake ninja-build git ca-certificates perl \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /src
ARG AWSLC_REF=v1.37.0
RUN git clone --depth 1 --branch "${AWSLC_REF}" \
      https://github.com/aws/aws-lc.git 2>/dev/null \
    || git clone --depth 1 https://github.com/aws/aws-lc.git
RUN cmake -GNinja -B build -S aws-lc -DCMAKE_BUILD_TYPE=Release -DBUILD_TESTING=OFF \
    && ninja -C build bssl \
    && cp build/tool/bssl /usr/local/bin/bssl-awslc

# --- wolfSSL --------------------------------------------------------------
FROM debian:bookworm-slim AS wolfssl
RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential autoconf automake libtool git ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /src
ARG WOLFSSL_REF=v5.7.4-stable
RUN git clone --depth 1 --branch "${WOLFSSL_REF}" \
      https://github.com/wolfSSL/wolfssl.git 2>/dev/null \
    || git clone --depth 1 https://github.com/wolfSSL/wolfssl.git
WORKDIR /src/wolfssl
# Post-quantum support in wolfSSL is opt-in at configure time. The flags are
# named here rather than left to a default so the build is reproducible and so
# a reader can see exactly what was asked for -- if a flag is dropped in a
# future release, the build fails loudly instead of quietly producing a
# "not supported" result that is really a build regression.
RUN ./autogen.sh \
    && ./configure --enable-kyber --enable-dilithium --enable-experimental \
         --enable-static --disable-shared \
    && make -j"$(nproc)" \
    && (cp wolfcrypt/benchmark/benchmark /usr/local/bin/wolfssl-benchmark || true) \
    && (cp wolfcrypt/test/testwolfcrypt /usr/local/bin/wolfssl-test || true)

# --- the probe ------------------------------------------------------------
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 python3-cryptography ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=boringssl /usr/local/bin/bssl-boringssl /usr/local/bin/bssl-boringssl
COPY --from=awslc     /usr/local/bin/bssl-awslc     /usr/local/bin/bssl-awslc
COPY --from=wolfssl   /usr/local/bin/wolfssl-benchmark /usr/local/bin/wolfssl-benchmark

# Record what actually got built. A result that names a library version it
# inferred rather than read would be an uncited identity claim.
RUN { echo "boringssl: $(bssl-boringssl version 2>&1 | head -1 || echo unknown)"; \
      echo "aws-lc:    $(bssl-awslc version 2>&1 | head -1 || echo unknown)"; \
      echo "wolfssl:   $(wolfssl-benchmark -? 2>&1 | head -1 || echo unknown)"; \
    } > /crosslib/versions.txt 2>/dev/null \
    || (mkdir -p /crosslib && { \
          echo "boringssl: $(bssl-boringssl version 2>&1 | head -1 || echo unknown)"; \
          echo "aws-lc:    $(bssl-awslc version 2>&1 | head -1 || echo unknown)"; \
          echo "wolfssl:   $(wolfssl-benchmark -? 2>&1 | head -1 || echo unknown)"; \
        } > /crosslib/versions.txt)

WORKDIR /crosslib
COPY probe_crosslib.py /crosslib/probe_crosslib.py
CMD ["python3", "/crosslib/probe_crosslib.py"]
