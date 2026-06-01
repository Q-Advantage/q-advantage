# Q-Day Index — Methodology (RSA-2048, launch)

**Status:** launch methodology, single target (RSA-2048). Source of truth for the
Q-Day Index scoring and for the dashboard's tooltips and disclaimers. The dashboard
links each technical term and each disclaimer to a definition **written once here**;
it does not duplicate this prose.

**What this document is for.** It states every assumption the score rests on, so the
number can be argued with rather than taken on faith. If you are a skeptical engineer
or a benchmarked vendor reading this to find a cheat: the assumptions are below, named,
with their sources. Where we made a judgment call, we say it was a judgment call.

> **One-line honesty statement.** Today's honest threat score is **low single digits**,
> and we say so. No machine in this dataset is close to breaking RSA-2048. The story is
> the *trajectory*, not the absolute digit — and even the trajectory we hold back until
> it is defensible (see §7).

---

## 1. What the Q-Day Index measures (and what it does not)

The Q-Day Index answers one question per machine:

> **How close is this system to a *named, published, point-in-time resource estimate*
> for factoring RSA-2048 with Shor's algorithm?**

It is a **distance-to-a-named-estimate** meter. It is explicitly **not**:

- a prediction of when RSA will break,
- a claim about RSA's abstract vulnerability,
- a vendor ranking or a "winner" (see §9, neutrality firewall),
- a measure of a machine's general quality or usefulness (a machine can be excellent and
  score zero here — the index asks one narrow question).

We publish **two distinct axes** for every gate-model machine. They are computed
differently on purpose so they can never be confused:

| Axis | What it answers | Shape | Honest state today |
|---|---|---|---|
| **Threat score** (0–100) | Distance to the named RSA estimate | **Multiplicative gate** — zero error-corrected logical qubits ⇒ **0.000** | Low single digits; mostly 0.000 |
| **Readiness** (0–100) | How far along the *preconditions* a machine is / "what would change the score" | **Additive** weighted sum of components | Clustered, low–mid; the visible climb |

A machine with meaningful readiness and a 0.000 threat score is the **correct, honest
state of the field today**. Readiness is never labeled as distance-to-breaking-RSA.

---

## 2. The target and its anchor (RSA-2048)

The launch target is **RSA-2048** — banking/TLS relevance, and the best-sourced published
resource estimates of any target. One target means one tight, defensible story on day one.
Bitcoin/ECDSA, Ethereum, and TLS are deferred to later work, each with its own anchor.

### 2.1 The anchor is a specific algorithm's resource estimate — not a law of physics

This is the most important caveat in the document, and it is a first-class methodology
element, not a footnote. **(Disclaimer key: `anchor_is_algorithm_specific`.)**

The anchor is the published resource estimate for factoring RSA-2048 with **Shor's
algorithm under a specific fault-tolerant compilation and a specific set of hardware
assumptions.** It is a *moving research target*:

| Estimate | Physical qubits | Runtime | Logical qubits (OoM) | Source |
|---|---|---|---|---|
| Gidney & Ekerå 2019 | ~20,000,000 | ~8 hours | ~thousands | [arXiv:1905.09749](https://arxiv.org/abs/1905.09749) |
| Gidney 2025 | < 1,000,000 | < 1 week | ~thousands | [arXiv:2505.15917](https://arxiv.org/abs/2505.15917) |

The physical-qubit requirement fell **~20× in six years** — and crucially, that reduction
came **almost entirely from the algorithm and error-correction side**, not from hardware
progress. Gidney 2025 holds the hardware assumptions *identical* to 2019 (square grid,
nearest-neighbour connectivity, 0.1% uniform gate error, 1 µs surface-code cycle, 10 µs
reaction time) and still cut the count 20× — via approximate residue arithmetic, yoked
surface codes for idle logical qubits, and magic-state cultivation.

**Why this matters for the score:**

- The score measures distance to a *named estimate*, and names which one (Gidney 2025 at
  launch). It does **not** claim to know the "true" qubit count to break RSA, because no
  such fixed number exists — it is a function of the best known algorithm.
- A future Shor variant, a better code, or a better arithmetic could move the anchor again,
  in either direction. We do not try to predict that. We track the published estimate and
  update the anchor with a citation when it moves.
- The anchor is implemented as a **swappable, sourced data object** (`Anchor` in
  `scoring.py`), carrying both published estimates. Retargeting to Bitcoin/ECDSA later is a
  config change with a new citation, not a formula rewrite.

This inoculates the index against both failure modes at once: against "you're
fear-mongering, RSA is fine" (we anchor to a dated, peer-tracked paper and report a tiny
score), and against "you're underestimating, someone could find a shortcut" (we state, on
the record, that the anchor is algorithm-specific and has already moved 20×).

The active launch anchor is **Gidney 2025**. The logical-qubit order of magnitude is held
at ~thousands across both estimates because the 2025 win was in *physical* overhead; we do
not lurch the score on a logical count the paper did not restate cleanly.

---

## 3. The threat-score formula

```
Q-Day Threat Score = LogicalCapacity × FidelityGate × ECSignal × 100
```

A **capability-gated product**, not a linear blend. We rejected the v1 linear formula
(`(LogicalQ / 4000) × fidelity_wt × depth_wt × 100`) because it is linear in logical
qubits across a 3.5-order-of-magnitude gap and ignores error-correction threshold dynamics
— a linear score moves misleadingly. The product structure means a system with **no
error-corrected logical capacity scores zero**, which is the honest answer.

### 3.1 LogicalCapacity — effective *standing* logical qubits vs. the anchor

- Runs on **effective standing logical qubits**, not physical count. Physical qubits do
  **not** enter this term. A 1,180-physical-qubit machine with no error correction is not
  "closer" to RSA than a 105-qubit machine with one demonstrated logical qubit.
- Vendor "logical qubit" claims that are **QEC demonstrations** (often via a partner
  virtualization layer) do **not** count as standing capacity. Tagged
  `logical_qubits_are_demos` in the dataset; see §10. Only a logical-qubit count backed by
  a real standing below-threshold result counts.
- Mapped to [0,1] **logarithmically** against the anchor's logical-qubit figure
  (`log1p(effective) / log1p(anchor)`), so a single real logical qubit stays visibly
  nonzero but tiny, rather than being flattened to zero by a linear map. The log map is a
  *presentation* choice to keep real progress visible; it does not inflate the number
  (1 logical qubit against ~4,000 still yields a small fraction).

### 3.2 FidelityGate — a deliberately low-resolution threshold gate

This is the load-bearing honesty problem. See §4 for the full cross-method argument.

- A **sigmoid centered on the fault-tolerance threshold** (`FT_THRESHOLD_FIDELITY = 0.99`,
  i.e. the ~0.1% physical gate error the anchor itself assumes — so "the threshold" in the
  score is the threshold the *target estimate* used, not one we invented).
- The sigmoid width is **wide on purpose** (`FT_GATE_WIDTH = 0.0075`). A machine at 99.0%
  and one at 99.84% both read as "early but over the line." We **refuse to rank the third
  decimal of fidelity**, because the underlying numbers are not the same measurement (§4).
- A system that has **demonstrated below-threshold error correction** has, by definition,
  shown its error rate is on the right side of the threshold for that code; its gate is
  treated as effectively open even if it does not headline an isolated 2-qubit number
  (Google/Willow leads with logical-error-per-cycle and XEB; its 2Q fidelity is `null` by
  design). A `null` 2Q **without** a below-threshold demonstration cannot open the gate on
  faith — it returns 0.

### 3.3 ECSignal — rewarding a demonstrated below-threshold result

- A demonstrated below-threshold error-correction result is the strongest signal in the
  set and the formula rewards it (`EC_DEMONSTRATED = 1.0`). Everyone else sits at a
  documented floor (`EC_FLOOR = 0.15`).
- At launch, **Google Willow** is the only system with `error_correction_below_threshold:
  true` (Λ = 2.14 ± 0.02 per +2 code distance, d=3→5→7). This is *why* it is the only
  nonzero threat score — on a **stated evidence rule**, not vendor preference. The rule is
  public and applies identically to any vendor that demonstrates the same thing. (USTC's
  Zuchongzhi 3.2 successor reportedly demonstrates below-threshold QEC and would qualify in
  a future dataset; the 3.0 entry scored here does not.)

### 3.4 Why the highest scorer is not "crowned"

The single nonzero threat score belongs to one vendor today purely because it is the only
one to clear a public evidence bar. The **hero number is the field frontier** (§9), not
that machine, and the methodology states the rule openly so the result is auditable rather
than editorial.

---

## 4. Cross-method fidelity normalization (the load-bearing honesty problem)

`two_qubit_gate_fidelity` is **not one comparable quantity** across the dataset:

| Vendor | Method (`_method` tag) |
|---|---|
| Google | XEB + logical-error-per-cycle |
| IBM | median ECR error |
| Quantinuum | randomized benchmarking |
| IonQ | direct RB |
| USTC (Zuchongzhi) | simultaneous-gate fidelity |
| Rigetti | median iSWAP fidelity |

These methods measure different things and are not interchangeable to three decimals.
**Our response is to refuse to pretend they are comparable on a continuous scale.**

- The FidelityGate uses fidelity only to answer a **coarse, robust question**: is this
  system *below, near, or above* the fault-tolerance threshold? That question survives the
  method differences, because the gap between (say) 99.0% and the ~99% threshold is within
  the noise of method-to-method differences anyway.
- We do **not** rank 99.62% above 99.6% above 99.0% as if those orderings were real signal.
  The wide sigmoid is the mechanism that enforces this.
- Every score carries a **method-heterogeneity flag**, and the raw 2Q column is never shown
  as a ranking without surfacing each value's `_method`. This is a stated design choice, not
  an oversight — the apples-to-oranges hazard is converted into a disclosed limitation.

---

## 5. Analog and out-of-category systems: explicit N/A, never a low score

Analog Hamiltonian simulators / field-programmable qubit arrays (e.g. **QuEra Aquila**)
have **no discrete two-qubit gate fidelity** and no gate-model Shor pathway. Scoring them
0.0 would misread a **category difference** as **poor quality**.

- Such systems receive an explicit **N/A** on both axes, with the reason
  `analog_not_gate_model`, and appear in the table labeled as a category difference.
- The same treatment is reserved for the photonic CV systems in the dataset's
  `announced_not_scored` footnotes (PsiQuantum, Xanadu) if they are ever scored.

---

## 6. Input-confidence, surfaced alongside every score

Every score is shown with an **aggregate input-confidence** level (high / medium / low),
derived from the provenance of the fields that feed the score (`peer_reviewed` weighted
above `vendor_published`; absent fields lower it). A high threat or readiness number built
on low-confidence inputs is flagged as such. The sourcing bar for inclusion is
**vendor-published or peer-reviewed only**; press estimates and content-mill sources are
barred.

### 6.1 Resolved sourcing judgment calls

- **Heron r2's 2Q fidelity** is the weakest-sourced number in the dataset — a dated
  (2024-08) peer-reviewed median ECR snapshot, not a fixed per-device value
  (`calibration_snapshot_drifts`). **Sensitivity test result: it does not move the score.**
  Heron has no standing logical qubits, so the LogicalCapacity term zeroes the product
  regardless of fidelity (threat score = 0.000 whether the value is kept or nulled,
  delta = 0.000). We **keep** the value with its caveat: nulling data we have is worse than
  flagging it, and it still does visible, honest work in the readiness fidelity component.
- **Zuchongzhi cloud availability** may be region-gated (Tianyan platform). Accessibility
  is **not** a threat-capability input, so it does not affect the score; it is surfaced as a
  presentation-layer flag only.

---

## 7. The projection layer is built but held internal

A trajectory model (log-capability vs. year, fit to the historical anchors:
Sycamore→Willow, Eagle→Heron, Condor as a scale point) **exists in the codebase but is not
wired to any public output at launch.** A projection is only as credible as its model, and
we will not have a hostile-researcher-proof model by launch day. It ships in later work,
conservative and sourced, with caveats loud in both directions (breakthroughs accelerate —
cf. the anchor moving 20× in six years; error-correction threshold walls or stagnation
delay). Launch carries on the score plus the *visible* climb (readiness), not a projected
year-range. On brand: we publish the year-range when we can show the work.

---

## 8. Stated assumptions (the checklist a researcher will poke)

- **Target:** RSA-2048 (single launch target).
- **Anchor:** Gidney 2025 (<1M physical, <1 week), [arXiv:2505.15917]; 2019 estimate
  retained for context. Anchor is algorithm-specific and a moving target (§2.1).
- **Fault-tolerance threshold used in the gate:** ~99.0% (1 − 0.1% physical gate error, the
  anchor's own hardware assumption).
- **Physical-to-logical ratio:** not hard-coded into the threat score; we score standing
  *logical* capacity directly and treat physical scale as a readiness precondition only.
- **Logical-qubit accounting:** QEC demonstrations are not standing capacity (§3.1, §10).
- **Fidelity resolution:** deliberately coarse; the third decimal is not signal (§4).
- **Hero number:** field frontier, not highest single machine (§9).
- **Nothing auto-runs or auto-publishes;** the projection is held internal (§7).

---

## 9. Neutrality firewall

- The **hero number is the field frontier** — the leading-edge threat score with a
  confidence band — **not** "the highest single machine." Reporting the highest machine as
  the headline would accidentally crown a vendor; we do not.
- The composite industry score (mean across scored systems) sits beneath the hero.
- The per-vendor table presents each number and its inputs; **the reader concludes.** We
  never name a winner, never imply favorable coverage, and never sell ranking position.
- Where a verified value differs from a rounded press number, the verified value wins and
  the gap is noted. We cite the journal-of-record over the preprint where they differ.

---

## 10. Disclaimer keys (definitions — single source for dashboard tooltips)

The dataset tags each system with `disclaimer_keys`. Each is defined once here; the
dashboard links the tag to this definition.

- **`analog_not_gate_model`** — The system is an analog Hamiltonian simulator / field-
  programmable qubit array, not a gate-model machine. It has no two-qubit *gate* fidelity in
  the discrete-gate sense. An RSA-breaking (Shor) score is a gate-model question; an N/A
  here is a **category difference, not a quality knock**.
- **`press_vs_paper`** — The peer-reviewed or vendor-spec value differs from (usually is
  lower than) the rounded number in press coverage. This dataset cites the verified value.
- **`aq_not_qubit_count`** — IonQ's #AQ (Algorithmic Qubits) is an application-level
  benchmark **score**, not a count of physical or logical qubits. Forte's #AQ 36 coinciding
  with its 36 physical qubits is a coincidence that invites misreading.
- **`logical_qubits_are_demos`** — Reported "logical qubits" for this system come from a
  quantum-error-correction **demonstration** (often via a partner virtualization layer), not
  a standing always-on hardware property. These do not count as standing logical capacity in
  the score.
- **`milestone_not_cloud`** — Published as a scale / yield / advantage milestone, not as a
  generally-available cloud machine at announcement. Full per-device calibration may never
  have been released.
- **`readout_preprint_vs_published`** — A spec value differs between the arXiv preprint and
  the published journal version. This dataset cites the published journal-of-record value.
- **`calibration_snapshot_drifts`** — The vendor publishes this metric as live calibration
  data that drifts daily, or as a dated median in a paper. The value used is a fixed dated
  snapshot (`_as_of`), not a live readout, and will not match a calibration page pulled on a
  different day.
- **`modality_not_comparable`** — Cross-modality caveat: qubit counts and fidelities across
  superconducting, trapped-ion, neutral-atom, and photonic systems are not directly
  comparable (e.g. all-to-all trapped-ion connectivity vs. a fixed superconducting lattice;
  56 trapped-ion qubits are not "100 fewer" than 156 superconducting qubits in any simple
  sense).
- **`historical_anchor`** — Included primarily as a prior-generation time-series point for
  the (internal, held-back) trajectory model — not presented as a current frontier machine.
- **`anchor_is_algorithm_specific`** *(methodology-level, see §2.1)* — The score is
  benchmarked against a named Shor resource estimate, which is itself improving over time
  (2019: 20M physical → 2025: <1M physical, same hardware assumptions). Algorithmic progress
  is a separate axis from hardware progress that the score deliberately does not predict.

---

## 11. Glossary (plain-language definitions — single source for dashboard tooltips)

- **physical_qubits** — The raw number of qubits on the device. Not a measure of usable,
  error-corrected computing power on its own.
- **logical_qubits** — Error-corrected qubits assembled from many physical qubits. Breaking
  RSA needs thousands of these; today's standing count is 0 or 1 for the machines here.
- **two_qubit_gate_fidelity** — How often a two-qubit operation executes correctly. The
  two-qubit number is the one that gates fault tolerance. **Not one comparable quantity
  across vendors** (see §4 and the method terms below).
- **single_qubit_gate_fidelity** — How often a one-qubit operation executes correctly;
  typically much higher than two-qubit fidelity and rarely the limiting factor.
- **T1_coherence** — How long a qubit holds its energy state (microseconds) before relaxing
  — an "amplitude" lifetime.
- **T2_coherence** — How long a qubit holds its phase relationship (microseconds) before
  dephasing. Reported very differently across modalities; often not given in µs for
  trapped-ion / neutral-atom systems.
- **error_correction_below_threshold** — A demonstration that adding more physical qubits
  per logical qubit *reduces* the logical error rate (the error-correction code is "working").
  The single strongest signal in this dataset; the load-bearing input for the threat score.
- **XEB** (cross-entropy benchmarking) — Google's method of estimating gate performance from
  random-circuit sampling. Not directly convertible to an isolated two-qubit RB fidelity.
- **randomized_benchmarking** (RB) — A standard protocol that estimates average gate error by
  running random sequences of gates; method details vary by vendor.
- **direct_RB** — A randomized-benchmarking variant (used by IonQ) measuring gate error more
  directly across gate pairs.
- **median_ECR_error** — IBM's two-qubit metric: the median error of the echoed cross-
  resonance gate across the device. Drifts with daily calibration.
- **iSWAP_gate** — A general-purpose two-qubit gate; Rigetti's universal-gate fidelity is
  reported on iSWAP (the figure relevant to a Shor-type circuit).
- **fSim_gate** — A specialized two-qubit gate family (useful for random-circuit sampling);
  a higher fSim fidelity does not imply the same general-purpose fidelity as iSWAP.
- **layer_fidelity** — IBM's whole-device metric (EPLG) characterizing a layer of
  simultaneous gates, rather than a single isolated two-qubit number.
- **algorithmic_qubits_AQ** (#AQ) — IonQ's application-level benchmark score. **Not** a count
  of qubits (see `aq_not_qubit_count`).
- **QCCD** (quantum charge-coupled device) — The trapped-ion architecture (Quantinuum) that
  shuttles ions to achieve all-to-all connectivity.
- **FPQA_analog** (field-programmable qubit array) — The reconfigurable neutral-atom analog
  architecture (QuEra Aquila); an analog Hamiltonian simulator, not a gate-model machine.
- **all_to_all_connectivity** — Any qubit can interact directly with any other (typical of
  trapped-ion systems), versus a fixed lattice where only neighbours interact. Connectivity
  trades against raw qubit count, which is why cross-modality count comparisons mislead.
- **heavy_hex_lattice** — IBM's qubit connectivity layout (a hexagonal pattern); determines
  which qubits can directly interact.
- **fault_tolerance_threshold** — The physical error rate below which error correction starts
  *reducing* logical error as you scale. The dividing line the FidelityGate is built around.
- **RSA_2048** — A 2048-bit RSA public-key, widely used in banking and TLS. The single launch
  target of the index.
- **Shor_algorithm** — The quantum algorithm that factors large integers efficiently, and so
  threatens RSA. The resource estimate the index anchors to is an estimate of Shor's cost
  (see §2.1).
