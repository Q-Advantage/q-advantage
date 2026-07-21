# Q-Advantage

> Independent measurement and intelligence layer for the post-quantum cryptography transition.
> Live at **https://qadvantage.io** · Book a call: **https://cal.com/qadvantage/intro**

The PQC migration market runs on vendor claims and analyst PDFs. Q-Advantage runs on GitHub Actions logs and peer-reviewed citations. Every benchmark is public, every run is auditable, every score is reproducible.

---

## Products

| Product | What it measures | Status | Live |
|---------|-----------------|--------|------|
| **Q-Shield** | Performance of NIST-standardized PQC algorithms (ML-KEM, ML-DSA, SLH-DSA) — keygen, sign, verify, encap, decap. Daily runs on x86_64 and ARM (Graviton3). | Live, 06:00 UTC daily | https://qadvantage.io/q-shield |
| **Q-Day Index** | 0–100 score for how close today's quantum hardware is to breaking RSA-2048. Gidney 2025 anchor. 8 scored systems + 2 analog + 4 footnoted. | Live | https://qadvantage.io/q-day-index |
| **P-CBOM** | Performance-Cryptographic Bill of Materials. Open spec extending CycloneDX CBOM with live, referenced, auditable benchmark data. CC0 spec / Apache-2.0 tooling. | v0.1 published | https://github.com/Q-Advantage/p-cbom |

---

## What's been built (Month 1–2)

- Q-Shield benchmark harness — liboqs 0.15.0, self-hosted GHA runner on AWS EC2, daily cron, full environment capture (CPU, kernel, git SHA, steal-time)
- Protocol benchmarks — TLS composed (ML-KEM + X25519MLKEM768), SSH composed, signature track
- Cross-architecture — x86_64 (c7i.large) and ARM Graviton3 (c7g.large), results side by side
- eBACS / liboqs cross-validation — three-pattern story locked, ML-KEM-768 −46.9% x86 / −47.7% ARM vs reference
- Q-Day Index scoring engine — multiplicative-gate, Gidney 2025 RSA-2048 resource estimate anchor
- P-CBOM v0.1 — published at Q-Advantage/p-cbom, CC0 spec, Apache-2.0 tooling, CycloneDX 1.6+ compatible
- Marketing and content engine — voice, personas, playbook locked
- Launch machinery — runbook, outreach wave plan (7 sectors, ~70 named targets)

---

## Repository layout

```
.
├── benchmark/                  Python — measurement code and scoring engine
│   ├── benchmark.py            Q-Shield PQC benchmark runner
│   ├── tls_composed.py         TLS handshake benchmarks (ML-KEM + hybrid)
│   ├── ssh_composed.py         SSH handshake benchmarks
│   ├── sig_track.py            Signature track (ML-DSA worst-case analysis)
│   ├── scoring.py              Q-Day Index threat-score engine
│   ├── build-q-day-index.py    Emits the dashboard scored JSON
│   └── results/                Daily result files (one per run)
├── data/
│   └── quantum_hardware.json   Q-Day Index dataset (vendor-sourced, peer-reviewed)
├── docs/
│   └── q-day-methodology.md    Q-Day Index methodology source
├── web/                        Next.js 14 — qadvantage.io
│   ├── app/                    Routes: / · /q-shield · /q-shield/protocols · /q-day-index · /methodology · /about
│   ├── components/             React components including Header
│   ├── lib/data/                Data loaders and types
│   └── scripts/copy-data.mjs   Prebuild — copies result files into app
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
