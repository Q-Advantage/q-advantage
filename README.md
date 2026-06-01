# Q-Advantage

> Independent benchmarks for the quantum era.
> Live at **<https://qadvantage.io>**.

The quantum industry runs on press releases and analyst PDFs. Q-Advantage
runs on GitHub Actions logs and peer-reviewed citations. We publish three
measurement products — every spec sourced, every run public, every result
auditable end-to-end in this repo.

---

## Status

| Product | What it measures | Status | Live |
| --- | --- | --- | --- |
| **Q-Shield** | Performance of NIST-standardized post-quantum cryptography (ML-KEM, ML-DSA, SLH-DSA). | Live, daily benchmarks at 06:00 UTC. | <https://qadvantage.io/q-shield> |
| **Q-Day Index** | A 0–100 score for how close today's quantum hardware is to breaking RSA-2048. | Live. 8 scored systems + 2 analog + 4 footnoted candidates. | <https://qadvantage.io/q-day-index> |
| **Q-Arena** | Real quantum algorithms run on real quantum hardware (Braket sim + IBM Quantum). | In design. Not yet running. | — |

---

## Repository layout

```
.
├── benchmark/                  Python — measurement code and scoring engine
│   ├── benchmark.py            Q-Shield PQC benchmark runner
│   ├── scoring.py              Q-Day Index threat-score engine
│   ├── build-q-day-index.py    Emits the dashboard's scored JSON
│   └── results/                Daily Q-Shield result files (one per run)
├── data/
│   └── quantum_hardware.json   Q-Day Index dataset (vendor-sourced)
├── docs/
│   └── q-day-methodology.md    Detailed Q-Day Index methodology source
├── web/                        Next.js 14 app — the qadvantage.io site
│   ├── app/                    Routes (home, q-shield, q-day-index, methodology, about)
│   ├── components/             React components
│   ├── lib/data/               Data loaders and types
│   └── scripts/copy-data.mjs   Prebuild — copies result files into the app
└── METHODOLOGY.md              Summary methodology; full version on the website
```

---

## How it works

**Q-Shield** runs on a self-hosted GitHub Actions runner on AWS EC2, daily
at 06:00 UTC. Each algorithm is benchmarked across keygen, encap/decap (KEMs),
and sign/verify (signatures) for 1,000 iterations with CPU pinning, GC
disabled, and full environment capture (CPU, kernel, liboqs version, git
SHA). Steal-time and load averages are recorded per run so burstable-instance
throttling is visible in the audit trail.

**Q-Day Index** is a multiplicative-gate score against the Gidney 2025
RSA-2048 resource estimate. It zeroes out for any system without
demonstrated standing logical qubits — which is nearly every machine today,
honestly. The hero number is the field frontier; the per-system table names
every machine and its score. Every input is vendor-published or
peer-reviewed, with measurement method and date attached.

**Q-Arena** is in design. Stub on the methodology page.

→ **Full methodology, with formal anchor caveats and the measurement-methods
glossary:** <https://qadvantage.io/methodology>

A summary lives in [`METHODOLOGY.md`](METHODOLOGY.md) in this repo.

---

## Reproduce the benchmarks

The whole point is that you don't have to take our word for it.

### Q-Shield (PQC benchmarks)

```bash
git clone https://github.com/Q-Advantage/q-advantage
cd q-advantage

# Install liboqs 0.15.0 + liboqs-python 0.15.0 (matching versions)
# See benchmark/README or docs for full setup instructions

python3 benchmark/benchmark.py
# → writes benchmark/results/results-YYYY-MM-DD-{short_sha}.json
```

### Q-Day Index (re-score the dataset)

```bash
python3 benchmark/build-q-day-index.py
# → writes web/lib/data/q-day-index.generated.json
# Output should match the website to the third decimal.
```

### Browse the live workflows

- **All workflow runs:** <https://github.com/Q-Advantage/q-advantage/actions>
- **Latest result files:** [benchmark/results/](benchmark/results/)

---

## Three pillars

1. **Every benchmark, public.** Source code, scoring engine, dataset, and
   results all live here. No paywall, no NDA, no proprietary harness.
2. **Every run, auditable.** Every Q-Shield workflow run is public. Every
   result commit is timestamped. Each data point on the dashboard
   deep-links to the Actions run that produced it.
3. **Every score, reproducible.** The Q-Day Index scoring engine is
   deterministic against the committed dataset. Q-Shield numbers
   reproduce within run-to-run variance on equivalent hardware.

---

## Challenge a result

Open an issue, a pull request, or use the feedback form on the Q-Day
Index page. Concrete corrections improve every subsequent run.

- [Open an issue](https://github.com/Q-Advantage/q-advantage/issues/new)
- Email: <hello@qadvantage.io>
- Feedback form: <https://qadvantage.io/q-day-index> (bottom of page)

---

## License & funding

Q-Advantage is built in public without external funding. No vendor pays
for placement, ranking, ordering, or early access on the Q-Day Index. If
that ever changes — sponsorship, subscriptions, customer engagements — it
will be announced publicly with the terms in writing, and affected rows
will be flagged.

---

*Receipts, not press releases.*
