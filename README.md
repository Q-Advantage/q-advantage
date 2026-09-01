# Q-Advantage

> Independent measurement and intelligence layer for the post-quantum cryptography transition.
> Live at **https://qadvantage.io** · Contact: **https://qadvantage.io/contact**

The PQC migration market runs on vendor claims and analyst PDFs. Q-Advantage runs on GitHub Actions logs and peer-reviewed citations. Every benchmark is public, every run is auditable, every score is reproducible.

---

## Products

| Product | What it measures | Status | Live |
|---------|-----------------|--------|------|
| **Q-Shield** | Performance of NIST-standardized PQC algorithms (ML-KEM, ML-DSA, SLH-DSA) — keygen, sign, verify, encaps, decaps — plus composed protocol tracks (TLS 1.3, SSH, IKEv2, JOSE) and live handshakes captured on the wire. | Live, daily on x86_64 | https://qadvantage.io/q-shield |
| **Q-Day Index** | 0–100 score for how close today's quantum hardware is to breaking RSA-2048. Gidney 2025 anchor. 8 scored systems + 2 analog + 4 footnoted. | Live | https://qadvantage.io/q-day-index |
| **P-CBOM** | Performance-Cryptographic Bill of Materials. Open spec extending CycloneDX CBOM with live, referenced, auditable benchmark data. CC0 spec / Apache-2.0 tooling. | v0.1 published · snippet generator live · upload-and-enrich not built | [spec](https://github.com/Q-Advantage/p-cbom) · [tool](https://qadvantage.io/p-cbom) |
| **Network calculator** | What a PQC migration costs on your own traffic profile — latency, bytes, egress — from measured figures rather than assumed ones. | Live | https://qadvantage.io/calculator |

---

## What's been built

**Measurement — in process, on the measurement host**

- Q-Shield benchmark harness — liboqs 0.15.0, self-hosted GHA runner on AWS EC2, daily cron, full environment capture (CPU, kernel, git SHA, steal-time)
- Composed protocol tracks — TLS 1.3, SSH, IKEv2 (RFC 9370), and JOSE/JWT signing, each measuring the key exchange or signature *inside* the protocol rather than beside it
- Classical baselines measured in the same run — X25519, SecP256r1, RSA-PSS, ECDSA-P256/P384, AES-256-GCM — so every delta is same-run rather than cross-run
- Certificate-chain sizing — real chains minted with `oqs-provider` and measured on the wire; an ML-DSA-87 chain is 16.8× the ECDSA-P256 one it replaces
- Concurrency track — throughput under parallel load, not just single-op latency
- Per-operation secret-key size, CPU and RSS; 95% confidence intervals on every mean, derived retroactively across the whole record

**Measurement — on the wire, over live sockets**

- Real TLS handshakes between stacks we control, captured on the wire: packets per handshake, wire bytes, negotiated group read from the ServerHello `key_share` rather than from a client's own report, fragmentation, and downgrade behaviour
- Scenarios: pairwise, deliberate group mismatch, concurrency, injected RTT, and middlebox (nginx and HAProxy in the path)
- Application compatibility — nginx, HAProxy and Node against real post-quantum token and certificate sizes on their default configuration
- Cross-library corroboration — BoringSSL, AWS-LC and wolfSSL each built from a pinned tag, giving liboqs its first independent second opinion in this repo

**Product surfaces**

- Q-Shield: overview, compare, protocol tracks, historical record, per-algorithm pages
- Q-Day Index scoring engine — multiplicative-gate, Gidney 2025 RSA-2048 resource estimate anchor
- P-CBOM v0.1 published at `Q-Advantage/p-cbom`, plus a live snippet generator at `/p-cbom`
- Network cost calculator, glossary (every entry cited or explicitly `#unverified`), public JSON API

**Measurement hosts.** The x86 host is a `t3.medium`; a `c7i.large` overlap is running in parallel and **has not been cut over**. Instance type is recorded per run and shown on every page that publishes a number.

**Architecture coverage, stated plainly:** x86_64 runs daily. There is **one** aarch64 (Graviton3) run, from 2026-07-11 — it is a single historical data point, not a second daily series, and should not be read as current.

---

## Repository layout

```
.
├── benchmark/                  Python — in-process measurement and scoring
│   ├── benchmark.py            Q-Shield PQC benchmark runner
│   ├── protocols/              Composed tracks — tls, ssh, ipsec, jose, sig,
│   │                           concurrency, aes baseline, classical sigs, lms/xmss
│   ├── scripts/                Operational scripts (liboqs stateful-sig rebuild)
│   ├── scoring.py              Q-Day Index threat-score engine
│   ├── build-q-day-index.py    Emits the dashboard scored JSON
│   ├── tests/                  Harness and workflow-shape tests
│   └── results/                Daily result files (one per run)
├── layer-b/                    Live handshakes over real sockets, in Docker
│   ├── compose.yml             Scenario topologies (pairwise, mismatch, rtt, middlebox…)
│   ├── capture/                pcap capture and wire-bytes parsing
│   ├── certs/                  Chain generation and sizing
│   ├── compat/                 Application-compatibility probes
│   ├── crosslib/               BoringSSL / AWS-LC / wolfSSL second opinion
│   └── results/                Captured results (committed, not regenerated on build)
├── data/
│   └── quantum_hardware.json   Q-Day Index dataset (vendor-sourced, peer-reviewed)
├── docs/                       architecture · runbook · standards · q-day-methodology · adr/
├── work-orders/                Intent documents — one per change, NNN-short-name.md
├── web/                        Next.js 14 — qadvantage.io
│   ├── app/                    / · /q-shield{,/compare,/protocols,/trends,/[algorithm]}
│   │                           /q-day-index · /calculator · /p-cbom · /glossary
│   │                           /methodology · /api · /blog · /about · /contact · /corrections
│   ├── components/             Product kit, chrome, data components
│   ├── lib/                    Data loaders, derivations and their tests
│   └── public/data/            Result files copied into the build
├── schema/                     P-CBOM schema (mirrors Q-Advantage/p-cbom)
└── METHODOLOGY.md              Summary — full version at qadvantage.io/methodology
```

---

## Positioning

**Q-Advantage is the independent measurement layer over the PQC migration.** We don't sell migration tools — ever. Selling them would compromise the only thing the market needs from us: independence.

The CISO's real question isn't which algorithm — vendors and regulators decide that. It's what turning it on costs them specifically: latency budget, connections-per-core, bytes-on-wire, hardware refresh, SLAs, dollars — on their actual stack. eBACS cycle counts don't answer that. Vendor marketing can't answer it honestly. We do.

**Vendors will tell you what to buy. We'll tell you what's true.**

---

## Reproduce the benchmarks

```bash
git clone https://github.com/Q-Advantage/q-advantage
cd q-advantage

# Install liboqs 0.15.0 + liboqs-python 0.15.0 (versions must match)
# See benchmark/ for full setup

python3 benchmark/benchmark.py
# → writes benchmark/results/results-YYYY-MM-DD-{short_sha}.json
```

Re-score the Q-Day Index:
```bash
python3 benchmark/build-q-day-index.py
# → writes web/lib/data/q-day-index.generated.json
# Should match the website to the third decimal.
```

Run a live handshake yourself — this needs only Docker, no EC2 and no credentials:
```bash
cd layer-b
docker build -t q-advantage/layer-b:dev .
bash ./run-scenario.sh pairwise      # or: mismatch · concurrency · rtt · middlebox
python assert-scenario.py pairwise
```

**Structural facts are portable; timings are not.** Packets, wire bytes, the negotiated group,
fragmentation and outcome are properties of the protocol exchange and will match ours anywhere.
Timings are properties of the machine, so a capture carries `publishable: false` unless it ran on
the measurement host — your handshake is capability evidence, never a Q-Shield figure.

All workflow runs: https://github.com/Q-Advantage/q-advantage/actions
Latest results: benchmark/results/

---

## Three pillars

1. **Every benchmark, public.** Source code, scoring engine, dataset, results — all here. No paywall, no NDA.
2. **Every run, auditable.** Every workflow run is public. Every result commit is timestamped. Every data point deep-links to the Actions run that produced it.
3. **Every score, reproducible.** Clone the repo, run the workflow, get the same numbers.

---

## Challenge a result

Open an issue, submit a pull request, or email hello@qadvantage.io. Concrete corrections improve every subsequent run.

- Issues: https://github.com/Q-Advantage/q-advantage/issues/new
- Email: hello@qadvantage.io
- Feedback form: https://qadvantage.io/q-day-index

---

## License & independence

Built in public. No vendor pays for placement, ranking, or early access. If that ever changes it will be announced publicly with terms in writing and affected rows flagged.

MIT license · © 2026 Q-Advantage

---

*Receipts, not press releases.*
