/**
 * The site's surface catalog — single source of truth for the header
 * dropdowns and the footer columns.
 *
 * Status is load-bearing, not decoration. `website-ia-spec.md §8` makes it a
 * hard rule that "coming" never dresses up as "live". Anything without an
 * `href` renders as plain text, never as a link to a 404.
 *
 * Two surfaces are deliberately dark, for different reasons:
 *  - PQC Readiness Index — built here, `notFound()` behind a PAUSED flag.
 *  - PQC Arena — no longer built here at all. It moved to its own private repo
 *    and deploys as a separate property at arena.qadvantage.io (ADR 0006). It
 *    keeps a row in this catalog because it is part of the product line and
 *    belongs in the nav; it gains an `href` to the subdomain once that is live.
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
    // Lives on its own property at arena.qadvantage.io, not on this site — a
    // comparative rating of named companies is kept at arm's length from the
    // measurement instruments. See docs/adr/0006. The absolute URL is what
    // makes SurfaceRow render it as an external link that opens in a new tab.
    name: "PQC Arena",
    href: "https://arena.qadvantage.io",
    blurb: "Published criteria for rating named vendor implementations",
    status: "live",
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
    name: "PQC Cost Calculator",
    href: "/calculator",
    blurb: "What post-quantum TLS costs at your traffic volume",
    status: "live",
  },
  {
    name: "P-CBOM",
    href: "/p-cbom",
    blurb: "Performance extension to the CycloneDX CBOM",
    status: "live",
  },
];

/** Everything demoted out of the primary nav in work-order 005. */
export const COMPANY_LINKS: { name: string; href: string }[] = [
  { name: "About", href: "/about" },
  { name: "Methodology", href: "/methodology" },
  // Glossary is deliberately absent for the same reason as Corrections below:
  // /glossary was taken down 2026-09-01 and now returns 404, and this list
  // feeds the footer on every page. lib/data/glossary.ts and its tests are
  // untouched. Restore this entry if the route comes back.
  // Corrections policy is deliberately absent: /corrections is paused
  // (`notFound()`), so linking it from every page in the site would put a
  // guaranteed 404 in the footer. Restore this entry when the route comes back.
  { name: "Data API", href: "/api" },
  { name: "Benchmark source", href: "https://github.com/Q-Advantage/q-advantage" },
  { name: "Privacy", href: "/privacy" },
  { name: "Contact", href: "/contact" },
];
