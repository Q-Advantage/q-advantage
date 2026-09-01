# Q-Advantage Methodology

> **Canonical version on the website:** <https://qadvantage.io/methodology>
>
> This file is a summary of the canonical methodology, kept in the repo for
> people who prefer to read Markdown alongside the code. When methodology
> changes, the website is updated first and this file follows. If you spot a
> drift between the two, the website wins.

Q-Advantage is an independent, vendor-neutral benchmarking platform for the
quantum era. It publishes two measurement products:

- **Q-Shield** — performance benchmarks for the NIST-standardized
  post-quantum cryptographic algorithms.
- **Q-Day Index** — a 0–100 score measuring how close today's quantum
  hardware is to breaking RSA-2048.

Everything below is verifiable. Clone the repo, run the workflow, and you
should reproduce our numbers within run-to-run variance.

---

## Three pillars

1. **Every benchmark, public.** Source code, test parameters, scoring engine,
   dataset, and full result sets are all in this public repository. No
   paywall, no NDA, no proprietary harness.

2. **Every run, auditable.** Q-Shield benchmarks execute on scheduled GitHub
   Actions, daily at 06:00 UTC, on dedicated self-hosted hardware. Every
   workflow log is public. Every result commit is timestamped and signed by
   `github-actions[bot]`. Each data point on the dashboard links back to the
   run that produced it.

3. **Every score, reproducible.** The Q-Day Index scoring engine is
   deterministic against the committed dataset — same inputs produce
   identical scores to the third decimal. Q-Shield numbers are reproducible
   within run-to-run variance on equivalent hardware. If you can't
   reproduce, that's a bug worth filing.

---

## Q-Shield methodology (summary)

Q-Shield measures the wall-clock performance of the NIST-standardized
post-quantum algorithms — key generation, encapsulation/decapsulation for
KEMs; key generation, signing, verification for signatures.

**Algorithms covered:**

- KEMs (FIPS 203 — ML-KEM): ML-KEM-512, ML-KEM-768, ML-KEM-1024
- Lattice signatures (FIPS 204 — ML-DSA): ML-DSA-44, ML-DSA-65, ML-DSA-87
- Hash-based signatures (FIPS 205 — SLH-DSA): SLH_DSA_PURE_SHAKE_128S,
  SLH_DSA_PURE_SHAKE_128F

All measured via [liboqs](https://github.com/open-quantum-safe/liboqs) 0.15.0
from the Open Quantum Safe project, with `liboqs-python` pinned to the
matching 0.15.0 in Python 3.12.

**Run protocol.** Each operation runs for 1,000 timed iterations (preceded
by 50 untimed warmups). Timing uses `time.perf_counter_ns()` with the
garbage collector disabled and the process pinned to a single CPU core.
For each operation we record mean, median, p95, p99, standard deviation,
min, max, and operations per second.

**Result-file layout.** Each run writes
`benchmark/results/results-YYYY-MM-DD-{short_sha}.json`. Every run is its
own file, named by date and the git commit SHA. The dashboard reads the
full series.

**Runtime metrics.** Every result file includes a `runtime_metrics` block
capturing wall-clock duration, CPU steal-time (delta of Linux kernel steal
jiffies across the timed loop), and load averages at start and end. On
burstable cloud instances this makes throttling visible in the audit trail
rather than silently corrupting numbers.

**Hardware.** The x86 measurement host is AWS EC2 t3.medium in us-east-1,
a burstable instance class. A c7i.large overlap has run in parallel since
2026-08-27, writing to a separate result path; it has **not** been cut
over, and t3.medium remains the host every published x86 figure is
measured on.

The instance type is recorded in every result file, and the site derives
its hardware **eras** from that field rather than from a date written by
hand. When the host changes, the historical runs remain available, the
change is dated from the data itself, and the trend chart **breaks the
line** at that point rather than drawing across it — a change of machine
is not a performance trend. Results are not silently migrated.

**A caveat this document previously got wrong.** Until 2026-08-30 this
section attributed the x86 baseline's run-to-run movement to burstable
CPU steal, citing around 0.24% on representative runs. From 2026-08-17
the X25519 baseline's floor became bimodal — `min_us` had sat at
160.2–160.8 µs for 68 consecutive runs, then began alternating with a
~186–193 µs floor — and **steal time does not correlate with it**:
affected runs report 0.0–0.5% steal while several unaffected runs report
3–4%. The cause is `#unverified` and under investigation against the c7i
overlap data. Comparisons between algorithms measured in the same run
remain sound; an x86 classical-baseline percentage from an affected run
does not, and the site now withholds any comparison that is structurally
impossible rather than publishing it.

**CI discipline.** Workflow at `.github/workflows/benchmark.yml` has two
triggers only: scheduled (daily at 06:00 UTC) and manual
`workflow_dispatch`. No `pull_request` trigger by design. A concurrency
group serializes runs. `permissions: contents: write` is scoped per
workflow. The bot's commit message includes `[skip ci]` to prevent
recursion.

**Access.** Runner access via AWS SSM Session Manager (no port 22 open to
the public). The runner is registered as a systemd-managed self-hosted
runner so it survives reboots.

→ **Full Q-Shield methodology:**
<https://qadvantage.io/methodology#q-shield>

---

## Live handshakes, measured on the wire (summary)

Everything above is measured **in process**: the harness calls the library
directly and times it. That is the right way to compare algorithms, and it is
structurally incapable of answering some of the questions a migration actually
raises — a composed harness has no socket, so it cannot count packets, observe
fragmentation, or watch two stacks fail to agree.

So since 30 August 2026 there is a second kind of measurement: real TLS
handshakes between two stacks we control, over real sockets, captured with
`tcpdump`.

**Every negotiation fact is parsed from the wire bytes**, never from a client's
own report of what it negotiated. The negotiated group is read out of the
ServerHello `key_share` extension. A tool that reports its own behaviour is
reporting its belief about its behaviour; the packets are the evidence.

**Structural facts are portable; timings are not.** Packets per handshake, wire
bytes, the negotiated group, fragmentation and outcome are properties of the
protocol exchange — they hold wherever the capture was taken, and anyone with
Docker can reproduce them. Durations are properties of the machine. A capture
taken anywhere other than the measurement host carries `publishable: false` and
its timing is stripped before it reaches the site, rather than shown and
disclaimed.

**Scenarios:** a baseline pairwise handshake; a deliberate group mismatch, which
succeeds by *not* negotiating; concurrency; injected round-trip latency; and a
middlebox case with nginx and HAProxy in the path.

**A control every probe carries.** When a probe reports that something failed,
the first question is whether the instrument works. Every probe runs a classical
arm alongside the post-quantum one: **a failing classical baseline points at the
instrument, not at post-quantum.** Two probes were built without that control
and each produced a false finding about third-party software before it was
added. Both were caught before publication; the control is now a requirement
rather than a habit.

---

## Q-Day Index methodology (summary)

The Q-Day Index is a 0–100 score measuring how close today's quantum
hardware is to breaking RSA-2048 with Shor's algorithm.

**The anchor.** The score is distance to the Gidney 2025 estimate
([arXiv:2505.15917](https://arxiv.org/abs/2505.15917)): roughly 1,000,000
physical qubits, under a week of runtime, to factor RSA-2048. This is a
peer-reviewed resource estimate, **not a law of physics**. The target fell
~20× in six years on algorithmic and error-correction progress alone (from
the 2019 Gidney & Ekera figure of 20M qubits / 8 hours), and it will move
again. When it does, every score moves with it and the new anchor is cited.

**The formula.** A multiplicative gate:

```
Threat = LogicalCapacity
       × FidelityGate
       × ECSignal
       × 100
```

- **LogicalCapacity** — standing error-corrected logical qubits, divided
  by what the anchor demands. Today this is zero for every scored system.
- **FidelityGate** — multiplier on whether the system's two-qubit gate
  fidelity clears the fault-tolerance threshold.
- **ECSignal** — multiplier rewarding a publicly demonstrated
  below-threshold error-correction result.

The multiplicative structure is the point: any component going to zero
takes the score to zero. There is no "mostly there" halfway state. Breaking
RSA requires all of these.

**The below-threshold rule.** A system earns the ECSignal multiplier only
with a publicly reported demonstration that adding error-correction code
distance reduces logical error rate. This is a rule, not editorial — the
score reflects what has been demonstrated, not what is plausible or
claimed. At the time of writing, one scored system clears this bar.

**Field frontier, not a winner.** The hero number is the field frontier —
the highest score currently held — not a named machine. The per-system
table beneath names every machine and its score. The reader concludes; we
don't crown.

**The readiness axis.** Because the threat score is uncompromising
(zero everywhere a system lacks standing logical qubits), the dashboard
also surfaces a separate **readiness** axis — fidelity progress,
error-correction progress, scale progress — rendered as stacked bars
(structurally different from the threat gauge). Readiness is **not** the
threat score and does not measure distance to breaking RSA. It tracks
preconditions assembled. A system can have 80% readiness and zero threat
simultaneously; that's the honest state of most of the field today.

**Sourcing bar.** Every numeric input comes from either a peer-reviewed
publication or an official vendor technical document. Press releases and
secondary aggregators do not clear the bar. Where they conflict with
published figures, the published figure wins — for example, Google's blog
says coherence "approaching 100 µs", the Nature paper says 68 µs; the
dataset cites the paper. Every field carries its source URL, confidence
level, measurement method, and the date it was true.

**Cross-method fidelity.** The raw two-qubit gate fidelity column on the
dashboard is **deliberately not displayed as a ranking** — a 99.4% from
Google measured via XEB is not the same physical quantity as a 99.2% from
IBM measured via median ECR error. Each value carries its measurement
method as a tag; the scoring formula treats fidelity through the
FidelityGate term against the fault-tolerance threshold, not as a ranked
comparison.

**Analog systems.** Analog Hamiltonian simulators (QuEra Aquila, Pasqal
Orion Alpha) have no gate-model two-qubit fidelity and no gate-model
pathway to Shor's. Marked **N/A** — a category difference, not a low score.

**Input confidence.** Each scored system carries an aggregate
input-confidence rating (High / Medium / Low) computed mechanically from
the per-field confidence tags, not hand-assigned.

**Neutrality.** No vendor pays for placement, ranking, ordering, or early
access. If we ever take vendor sponsorship of any kind, it will be
announced publicly with terms in writing, and affected rows will be
flagged.

**On projecting a Q-Day year.** We do not publish a projected Q-Day year.
A projection is only as good as its trajectory model, and we have not built
one that survives hostile inspection. Historical entries (Sycamore 2019,
Eagle 2021, Condor 2023) exist so a future trajectory model has data to
fit, but the model itself is held internal until defensible.

→ **Full Q-Day Index methodology, with the formal anchor caveats and the
methods glossary:** <https://qadvantage.io/methodology#q-day-index>

---

## CFDIR alignment

The CFDIR migration-cost framework is **use-case shaped** — fourteen named use
cases, applied per use case rather than system-wide. Q-Shield's output is
**algorithm shaped**. A cost model cannot consume the second directly, so each
composed track declares which CFDIR use case it prices, in the result record
itself:

- `tls_composed` prices **3.4, TLS cipher suites**. Deliberately not 3.5, TLS
  certificates: the certificate chain is out of scope for this measurement, and
  the chain is the cost in 3.5.
- `ssh_composed` prices **3.13, SSH/SFTP distributed**. Not 3.14, which needs a
  key-management dimension this track does not have.

Declaring it per track is what makes de-duplication mechanical. CFDIR's own
assumption 8 warns that redundant costs may be counted in different line items
and leaves it to the reader to avoid; once anything sums several tracks, that is
a live arithmetic risk rather than a hypothetical one.

The framework version is pinned in the record (`cfdir_framework`), the same way
liboqs and OpenSSL versions are. Their document is dated and states it will be
reviewed annually, so a revision to it is a methodology event here.

**Both TLS arms are TLS 1.3, and this is recorded explicitly rather than implied
by the suite name.** CFDIR notes that PQC migration may also require moving from
TLS 1.2 to 1.3, and that this uplift is *independent* of quantum-safe migration.
A classical arm measured on 1.2 would silently bundle that uplift into every
delta published as the PQC increment.

**No blended overhead figure is published.** The CPU and wire components of the
cost delta can have opposite signs — pure ML-KEM is faster than X25519 on CPU
while being heavier on the wire — so collapsing them into one number requires a
price for microseconds against bytes. That price belongs to whoever is doing the
costing. Components are published signed and separate.

Coverage against the framework is derived internally, from which tracks actually
produced data, and is **not published as a scorecard**. Scoring ourselves in
public against someone else's framework says less than the measurements do. The
findings that came out of that alignment work — certificate-chain sizing and
token sizing — are published on their own terms at
<https://qadvantage.io/q-shield/protocols>.

## Statistical reporting

Every operation records mean, median, p95, p99, standard deviation, min, max and
iteration count. From 2026-08-30 each also carries a **95% confidence interval
on the mean**, and the site derives the same interval for every earlier run from
the fields those runs already published.

The two are different quantities and are routinely confused, in one direction:

- **Standard deviation** says how far individual samples scattered. On a shared
  host that number is large and mostly describes the machine.
- **The confidence interval** says how precisely the *average* is pinned down.
  It is built from the standard error, which shrinks with the square root of the
  iteration count — at n=1000 it is roughly 3% of the standard deviation.

A large standard deviation therefore does not mean the mean is imprecise. It is
a prediction interval that would be wide; the interval on the mean is narrow.
Neither figure is withheld, because dropping the standard deviation would hide
the host noise this project publishes on purpose.

Where two measured means sit inside each other's intervals, the difference
between them is not distinguishable from noise on this host and is not quoted as
a finding.

## Known limitations

- **t3.medium is burstable**, and since 2026-08-17 its X25519 baseline has
  been bimodal for reasons steal time does not explain (`#unverified`).
  Same-run comparisons between algorithms remain sound; a classical-baseline
  percentage from an affected run does not, and the site withholds any that
  is structurally impossible. A c7i.large overlap is running; migration to
  that fixed instance class has not been cut over.
- **One live architecture.** x86_64 runs daily. There is a single aarch64
  (Graviton3) run, from 2026-07-11 — one historical data point, not a second
  series. Where both appear side by side, the ARM column is that July run and
  is not contemporaneous with the x86 figures next to it. Treat a
  cross-architecture comparison as indicative, not as a same-day measurement.
- **`liboqs` is a prototyping library**, not a production cryptographic
  implementation. Q-Shield numbers are representative of the algorithms
  but should not be cited as authoritative for a specific production
  deployment. Since 2026-08-30 liboqs is no longer the sole implementation
  consulted: BoringSSL, AWS-LC and wolfSSL are each built from a pinned tag
  and asked what post-quantum primitives they expose. ML-KEM-768 and
  ML-KEM-1024 are corroborated by all three. That track publishes **no
  timings** — those builds run on a shared CI runner, and a speed figure from
  there would undo the dedicated-measurement-host discipline every other
  number depends on.
- **Hash-based signatures (LMS/XMSS) have no measurements yet.** The
  measurement host's liboqs was built without the stateful-signature schemes
  compiled in. The harness reports that rather than fabricating, and the site
  says so where the numbers would otherwise sit.
- **Live-capture timings are not published.** Handshake captures record
  packets, wire bytes, the negotiated group, fragmentation and outcome — all
  properties of the protocol exchange, portable to any machine. Durations from
  a capture taken anywhere other than the measurement host are withheld rather
  than shown, because a timing is a property of the machine.
- **Q-Day Index dataset depth.** Currently 8 scored systems plus 2 analog
  N/A entries and 4 footnoted candidates. Coverage will grow as more
  vendors publish qualifying specs.
- **No projected Q-Day year.** Held internal until the trajectory model is
  defensible.

---

## How to challenge a result

Open a [GitHub issue](https://github.com/Q-Advantage/q-advantage/issues),
a pull request, or use the feedback form at the bottom of the
[Q-Day Index page](https://qadvantage.io/q-day-index).

Every Q-Shield run logs `git_commit`, `cpu_model`, and full environment in
its result file. Every Q-Day Index figure has its source URL, measurement
method, and date attached. If you can reproduce a Q-Shield discrepancy of
more than 2 standard deviations on equivalent hardware, or have a sourced
correction for a Q-Day Index value, we want to hear about it.

→ **Live methodology, full depth:** <https://qadvantage.io/methodology>
