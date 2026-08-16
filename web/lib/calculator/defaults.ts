// web/lib/calculator/defaults.ts
//
// Every default the calculator ships with, and the source for each.
//
// The governing rule, from the vault's calculator-suite spec and restated in
// work-order 009: an input the customer does not give us ships as an editable
// field with a CITED default, never an invented constant. Where no public
// proxy exists the field carries an honest range and an #unverified tag rather
// than false precision.
//
// Nothing in this file is a number we made up. If you add a field here without
// a `source`, you have broken the only rule this surface has.
//
// All figures sourced 2026-08-16 — see the vault's
// network-calculator-defaults-research.md for the full research pass.

/** Reused from tcm-spec §6 rather than inventing a second scheme. */
export type Provenance = "measured" | "public-default" | "bounded-estimate" | "customer-input";

export const PROVENANCE_LABEL: Record<Provenance, string> = {
  measured: "Measured",
  "public-default": "Public default",
  "bounded-estimate": "Bounded estimate",
  "customer-input": "Your input",
};

export interface Citation {
  /** What the source is, in words a reader can judge. */
  text: string;
  url: string;
  retrieved: string;
  /**
   * Set when the figure is real and cited but should not be treated as
   * settled — rendered inline next to the number, not hidden in a footnote.
   */
  caveat?: string;
}

export interface DefaultField<T> {
  value: T;
  provenance: Provenance;
  citation: Citation;
}

/* ------------------------------------------------------------- archetypes */

export interface Archetype {
  id: string;
  label: string;
  /** Handshakes per second. `null` where no honest point default exists. */
  perSecond: number | null;
  /** Honest range where a point estimate would be false precision. */
  range?: { low: number; high: number };
  provenance: Provenance;
  citation: Citation;
  /** Shown under the selector — what kind of number this actually is. */
  note: string;
}

export const ARCHETYPES: Archetype[] = [
  {
    id: "bank-gateway",
    label: "Bank core-banking gateway",
    perSecond: 1500,
    provenance: "public-default",
    citation: {
      text: "Kotak Mahindra Bank — up to 1,500 transactions/sec at peak (AWS Industries case study)",
      url: "https://aws.amazon.com/blogs/industries/kotak-bank-modernizes-microledgers-using-amazon-dynamodb-for-predictable-low-latency-at-scale/",
      retrieved: "2026-08-16",
      caveat:
        "One bank's one product mix in production, not a sector norm. Vendor benchmarks reach far higher — Infosys Finacle/IBM published 29,010 effective tx/sec — but those are stress tests, not steady state.",
    },
    note: "Real production case study — the most defensible single figure in this list.",
  },
  {
    id: "api-gateway",
    label: "Public API gateway",
    perSecond: null,
    range: { low: 10, high: 10000 },
    provenance: "bounded-estimate",
    citation: {
      text: "AWS API Gateway default account throttle: 10,000 req/sec sustained (upper bound); small/mid SaaS API rate limits ~8–10 req/sec (lower-bound proxy)",
      url: "https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-request-throttling.html",
      retrieved: "2026-08-16",
      caveat:
        "#unverified — no authoritative 'typical' figure exists. These are a platform ceiling and a rate-limit proxy, not measurements of anyone's actual traffic. Enter your own number.",
    },
    note: "A range, deliberately. A point default here would be false precision.",
  },
  {
    id: "service-mesh",
    label: "Internal service mesh (mTLS)",
    perSecond: 70000,
    provenance: "bounded-estimate",
    citation: {
      text: "Istio scale test — 1,000 services, 2,000 pods, 70,000 mesh-wide requests/sec",
      url: "https://istio.io/latest/docs/ops/deployment/performance-and-scalability/",
      retrieved: "2026-08-16",
      caveat:
        "Istio's own scale test, not a typical deployment. Evidence that internal mesh traffic routinely exceeds edge traffic by 1–3 orders of magnitude — not a figure to adopt unedited.",
    },
    note: "Internal mTLS churn is where handshake cost actually concentrates.",
  },
];

/* --------------------------------------------------------- session reuse */

export const SESSION_REUSE: DefaultField<number> = {
  value: 53,
  provenance: "public-default",
  citation: {
    text: "Cloudflare TLS Post-Quantum Experiment — ~53% of connections were resumptions (mobile ~25%, desktop 40–70%)",
    url: "https://blog.cloudflare.com/the-tls-post-quantum-experiment/",
    retrieved: "2026-08-16",
    caveat:
      "#unverified-current — the experiment predates this by several years and TLS 1.3 resumption behaviour has likely shifted. Real and cited, but due a refresh.",
  },
};

/* ------------------------------------------------------------- cost inputs */

export const VCPU_HOUR: DefaultField<number> = {
  value: 0.0448,
  provenance: "public-default",
  citation: {
    text: "AWS c7i.xlarge on-demand, Linux, us-east-1 — $0.179/hr ÷ 4 vCPU",
    url: "https://instances.vantage.sh/aws/ec2/c7i.xlarge",
    retrieved: "2026-08-16",
    caveat:
      "Third-party aggregator mirroring AWS published pricing; AWS's own page is JS-rendered. Re-verify against your negotiated rate — pricing pages move without notice.",
  },
};

export const EGRESS_GB: DefaultField<number> = {
  value: 0.09,
  provenance: "public-default",
  citation: {
    text: "AWS data transfer out to internet — $0.09/GB up to 10TB, after a 100GB/month free allowance",
    url: "https://egresscost.com/aws/data-transfer-pricing/",
    retrieved: "2026-08-16",
    caveat:
      "Tiers down to $0.05/GB above 150TB; some regions start higher. AWS only — GCP and Azure are not sourced and are not assumed equivalent.",
  },
};

/* -------------------------------------------------------------- horizons */

export interface Horizon {
  id: string;
  label: string;
  months: number;
  citation?: Citation;
}

export const HORIZONS: Horizon[] = [
  { id: "1m", label: "1 month", months: 1 },
  { id: "3m", label: "3 months", months: 3 },
  { id: "6m", label: "6 months", months: 6 },
  { id: "1y", label: "1 year", months: 12 },
  { id: "3y", label: "3 years", months: 36 },
  {
    id: "ceg-critical",
    label: "To 2030 (G7 CEG, critical systems)",
    months: 52,
    citation: {
      text: "G7 Cyber Expert Group — critical-systems PQC transition window, 2030–2032",
      url: "https://home.treasury.gov/news/press-releases/jy2609",
      retrieved: "2026-08-16",
      caveat: "A window, not a fixed date. Months counted from 2026-08 to the start of the range.",
    },
  },
  {
    id: "ceg-noncritical",
    label: "To 2035 (G7 CEG, remaining systems)",
    months: 112,
    citation: {
      text: "G7 Cyber Expert Group — remaining-systems PQC transition target, 2035",
      url: "https://home.treasury.gov/news/press-releases/jy2609",
      retrieved: "2026-08-16",
    },
  },
];

/* ---------------------------------------------------------- static refs */

/** Always shown, regardless of input state — the spec's §9b requirement. */
export const STATIC_REFERENCES: Citation[] = [
  ARCHETYPES[0].citation,
  ARCHETYPES[1].citation,
  ARCHETYPES[2].citation,
  SESSION_REUSE.citation,
  VCPU_HOUR.citation,
  EGRESS_GB.citation,
  {
    text: "Q-Shield methodology — how these handshakes are measured, and what they are not",
    url: "https://qadvantage.io/methodology",
    retrieved: "2026-08-16",
  },
  {
    text: "Q-Shield benchmark source and every committed result file",
    url: "https://github.com/Q-Advantage/q-advantage/tree/main/benchmark/results",
    retrieved: "2026-08-16",
  },
];

/**
 * The TCP initial-window effect, surfaced as a qualitative callout only.
 *
 * A handshake that no longer fits the initial congestion window costs an extra
 * round trip — a step change, not a smooth curve. Detecting it byte-for-byte
 * needs packet capture (Layer B), which is not built. So the number is never
 * modelled here; the reader is told the effect exists and roughly where it
 * bites. Promoting this to a computed step-function is a Layer-B item.
 */
export const CLIFF_NOTE = {
  approxThresholdBytes: 14600, // ~10 × 1460-byte MSS, the common initcwnd
  text:
    "A handshake larger than roughly 14.6KB — about ten packets at a typical MSS — may not fit TCP's " +
    "initial congestion window, costing an extra round trip on some connections. That is a latency " +
    "step change, not a smooth curve, and it is not modelled in the figures above: detecting it " +
    "precisely needs live packet capture, which this platform does not do yet.",
};
