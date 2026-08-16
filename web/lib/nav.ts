/**
 * The site's surface catalog — single source of truth for the header
 * dropdowns and the footer columns.
 *
 * Status is load-bearing, not decoration. `website-ia-spec.md §8` makes it a
 * hard rule that "coming" never dresses up as "live", and two of these
 * surfaces are deliberately dark right now: PQC Arena and the Readiness Index
 * both `notFound()` until the entity is formed. Anything without an `href`
 * renders as plain text, never as a link to a 404.
 */

export type SurfaceStatus = "live" | "coming";

export interface Surface {
  name: string;
  /** Omitted while the surface is unpublished — renders unlinked. */
  href?: string;
  blurb: string;
  status: SurfaceStatus;
}

/** Measurement instruments and ratings — the things that produce verdicts. */
export const PRODUCTS: Surface[] = [
  {
    name: "Q-Shield",
    href: "/q-shield",
    blurb: "Daily algorithm and protocol benchmarks on real silicon",
    status: "live",
  },
  {
    name: "PQC Arena",
    blurb: "Ratings of named vendor implementations",
    status: "coming",
  },
  {
    name: "PQC Readiness Index",
    blurb: "Weekly posture of named institutions",
    status: "coming",
  },
];

/** Utilities built on top of the instruments. */
export const TOOLS: Surface[] = [
  {
    name: "Q-Day Index",
    href: "/q-day-index",
    blurb: "How close quantum hardware is to breaking RSA-2048",
    status: "live",
  },
  {
    name: "Network Calculator",
    blurb: "Handshake cost priced across your estate",
    status: "coming",
  },
  {
    name: "P-CBOM",
    blurb: "Performance extension to the CycloneDX CBOM",
    status: "coming",
  },
];

/** Everything demoted out of the primary nav in work-order 005. */
export const COMPANY_LINKS: { name: string; href: string }[] = [
  { name: "About", href: "/about" },
  { name: "Methodology", href: "/methodology" },
  { name: "Corrections policy", href: "/corrections" },
  { name: "Benchmark source", href: "https://github.com/Q-Advantage/q-advantage" },
  { name: "Privacy", href: "/privacy" },
  { name: "Contact", href: "/contact" },
];
