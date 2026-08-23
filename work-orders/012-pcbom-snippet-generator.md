# 012 — P-CBOM web tool, Capability 1: algorithm snippet generator

**Status:** open — dispatched for autonomous overnight run
**Opened:** 2026-08-23 (dictated via the vault, Josh's instruction — he will be offline; plan-approval
gate below is pre-authorized for this run only, see "Autonomy note")
**Related:** vault `10-strategy/pcbom-web-tool-spec.md` (full two-capability spec; not on the
`context/` bridge because it lives in `10-strategy/`, not `50-technical/` — this work-order restates
everything from it needed to build Capability 1 so nothing is missing). `web/lib/nav.ts`'s `TOOLS`
array already carries a "P-CBOM" entry with `status: "coming"` and no `href` — that's the placeholder
this ships against.

---

## What's wanted

P-CBOM (`Q-Advantage/p-cbom`, v0.1, CC0 spec / Apache-2.0 tooling — public repo, confirmed reachable
at github.com/Q-Advantage/p-cbom, default branch `main`, has `schema/`, `tools/`, `examples/`,
`reference-data/`) is a published, real spec with a working Python reference implementation. It has no
front end. This work-order ships the smaller of the two planned capabilities: a page where a visitor
picks an algorithm Q-Shield measures and gets back a live, cited, downloadable P-CBOM record —
without cloning anything.

**Capability 2 (upload-and-enrich a user's own CycloneDX CBOM) is deliberately not in this
work-order** — see "Not in this work-order" below.

### What it does

- A page (route TBD by you — `/p-cbom` is the obvious slug, matching the nav entry's eventual `href`)
  with a dropdown of every algorithm Q-Shield currently measures, plus an operation
  (keygen / sign / verify / encaps / decaps).
- Output: a live-rendered P-CBOM v0.1 record for that pick, toggleable between **native form** and
  **CycloneDX-compatible form**, using the real schema — not a paraphrase of it.
- Actions: download (JSON), copy-to-clipboard, native/CDX toggle.
- A visible citation line under the generated record (`performance.source`, `performance.ref_url`,
  `performance.last_measured`, `performance.commit`) — not only inside the downloadable JSON — plus a
  static "Sources & Citations" section: the P-CBOM CC0 spec + GitHub repo, the CycloneDX 1.6+
  specification, EO 14412 (June 2026).
- A short, prominent standards-position line: *"P-CBOM extends CycloneDX's Cryptographic Bill of
  Materials — the standard EO 14412 (June 2026) already names in federal PQC work — rather than
  forking it."* **Do not claim any formal CycloneDX/OWASP endorsement or relationship** — none exists.

### Where the real logic and schema live — port, don't reinvent

`Q-Advantage/p-cbom`'s `tools/` directory has the reference emitter (function names per the vault
spec: `normalize_name`, `infer_type`, `infer_standard`, `build_record`, `to_cdx`) and `schema/` has
the actual field definitions (`p-cbom-0.1.json` native form, `p-cbom-0.1.cdx.json` CycloneDX-overlay
form — exact filenames unconfirmed, read the real directory listing, don't assume). **Fetch and read
the real files from that repo before writing any schema-shaped code.** The shape below (from the vault
spec) is illustrative of the fields, not a substitute for the real schema:

```jsonc
// native form
{
  "cbom_version": "1.6",
  "p_cbom_extension": "0.1",
  "algorithm": { "name": "ML-KEM-768", "type": "key-encapsulation", "standard": "NIST FIPS 203" },
  "implementation": { "library": "liboqs", "version": "0.15.0" },
  "performance": {
    "source": "q-advantage/q-shield",
    "measurement_id": "ml-kem-768/encaps/x86_64/2026-08-13",
    "ref_url": "https://raw.githubusercontent.com/Q-Advantage/q-advantage/main/benchmark/results/...",
    "last_measured": "2026-08-13T06:00:00Z",
    "commit": "35374ab",
    "snapshot": {
      "operation": "encaps", "platform": "…", "median_us": 18.9, "p95_us": "…",
      "baseline": { "classical_algorithm": "X25519", "pct_over_classical": -63.3 }
    }
  }
}
```

In CDX form the same fields ride as namespaced `q-advantage:p-cbom:*` properties on a
`cryptographic-asset` component. `baseline.pct_over_classical` is **negative when the PQC/hybrid
asset is faster** than the classical one it replaces — already the right convention, don't flip it.

The reference tooling is Python; this is a Next.js/TypeScript app (`web/`) and the spec's own privacy
reasoning for Capability 2 (client-side only, no server round-trip) applies here too, for the same
reason — this needs a **TypeScript port of the emitter logic**, not a Python subprocess call from a
Vercel serverless function. Port the logic faithfully (same normalization rules, same field names, same
output shape); this repo has no `tools/emit_pcbom.py` of its own (see this repo's `CLAUDE.md` §"The
stack" — `schema/` here only currently holds `protocol_result.schema.json`, nothing P-CBOM-shaped yet).

### Live algorithm list, not hard-coded

The dropdown must read from whatever Q-Shield currently measures, not a fixed list that drifts stale.
`web/lib/data/normalize.ts`'s `parseAlgorithmKey`/`normalizeAlgorithm` is the existing, tested source
of truth for algorithm identity (ML-KEM/ML-DSA/SLH-DSA families, NIST levels) — reuse it rather than
re-deriving algorithm names. `web/lib/data/load.ts` shows the existing pattern for reading benchmark
result data at build time. Wire the dropdown to real measured algorithms via this existing data layer,
not a copy-pasted list.

### Design pattern

Match the existing calculator page's (`web/app/calculator/`) layout conventions where they overlap —
action bar (Share / Reset / Download, no "Save" — there is nothing server-side to save by design),
footnoted caveats distinct from the Sources & Citations section, results rendered immediately below
the input on the same page. Flip `web/lib/nav.ts`'s `P-CBOM` entry from `status: "coming"` to
`status: "live"` with `href: "/p-cbom"` (or whatever route you land on) as part of this PR.

---

## What "done" looks like

- New route/page live in `web/`, wired to a real, ported TypeScript emitter that produces schema-valid
  P-CBOM v0.1 records (both native and CDX form) for every algorithm+operation Q-Shield measures.
- `nav.ts`'s P-CBOM entry updated to `live` + real `href`.
- Citation line + Sources & Citations section rendered per above, using real values, not placeholders.
- `npm run type-check && npm run lint && npm run build && npm run smoke` all green, in `web/`.
- New tests covering the emitter port (does it produce the same shape/values the real Python
  reference would, for a handful of known algorithms) — this is exactly the kind of thing this repo's
  testing standard calls out: "P-CBOM emission correctness and CycloneDX schema validity... if/when
  that tooling moves into this repo," which this work-order is doing.
- PR opened against `main` (never pushed to `main` directly), referencing this work-order, with a
  description Josh can review in minutes.

## Not in this work-order

- **Capability 2 (upload-and-enrich a user's own CBOM)** — bigger lift (CycloneDX-schema-validator
  dependency to pick, client-side processing design), deliberately deferred to its own work-order so
  this one stays small and reviewable. File it as a follow-on (013) rather than folding it in here.
- Anything under `benchmark/results/**` or `data/quantum_hardware.json` — do not touch, per this
  repo's benchmark-data-integrity firewall. If this task somehow seems to require it, stop and flag
  rather than crossing that line.
- `.env*`, credentials, or any secret — this task shouldn't need any; if it seems to, stop and ask.
- LMS/XMSS in the dropdown — contingent on that algorithm expansion shipping in Q-Shield first
  (vault: `qshield-update-spec.md §3`); include only what's actually measured today.
- Merging the PR or deploying — Josh does both, when he's back.

## Autonomy note

Josh dictated this work-order and gave standing approval to run the full plan → branch → build → test
→ PR lifecycle unattended overnight, because he won't be at the keyboard to approve the plan step
live. That covers the approval gate in `.claude/agents/work-order-runner.md` Step 2 **for this
work-order only** — it is not a standing instruction to skip that gate on future work-orders.

It does **not** relax anything else: still no push to `main`, no merge, no touching secrets or
benchmark data, and if the real P-CBOM schema/tooling turns out to be structured differently than this
document assumes (see the "unconfirmed" flags above), or any other genuine ambiguity comes up, stop
and write up the blocker in the PR (or as a comment on this work-order) rather than guessing at a
schema shape — a wrong guess here is exactly the kind of unsourced-claim risk `CLAUDE.md`'s sourcing
standard exists to prevent.
