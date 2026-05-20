import Link from "next/link";

/**
 * Site header — sticky, blur backdrop, present on every page.
 *
 * Nav structure (left to right):
 *   - Brand: diamond mark + serif wordmark, links to /
 *   - Products (anchor): jumps to /#products on the home page
 *   - Methodology (anchor): jumps to /#methodology on the home page
 *   - GitHub (external)
 *   - Q-Shield: prominent button — the live product
 *   - Subscribe: primary CTA
 *
 * The diamond mark is the same shape as the favicon (lib/icon-generator).
 */
export function Header() {
  return (
    <nav
      className="sticky top-0 z-50 border-b border-border"
      style={{
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        background: "rgba(10, 10, 11, 0.7)",
      }}
    >
      <div className="mx-auto max-w-[1200px] flex items-center justify-between px-6 md:px-8 py-[18px]">
        <Link
          href="/"
          className="flex items-center gap-3 group flex-shrink-0"
          aria-label="Q-Advantage home"
        >
          <DiamondMark />
          <span className="font-serif text-[26px] md:text-[32px] text-fg tracking-tight leading-none">
            Q-Advantage
          </span>
        </Link>

        <div className="flex items-center gap-5 md:gap-7">
          <Link
            href="/#products"
            className="hidden md:inline text-sm text-fg-muted hover:text-fg transition-colors"
          >
            Products
          </Link>
          <Link
            href="/methodology"
            className="hidden md:inline text-sm text-fg-muted hover:text-fg transition-colors"
          >
            Methodology
          </Link>
          <a
            href="https://github.com/Q-Advantage"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden md:inline text-sm text-fg-muted hover:text-fg transition-colors"
          >
            GitHub
          </a>
          <Link
            href="/q-shield"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md border border-accent/40 bg-accent/10 text-accent text-[13px] font-medium hover:bg-accent/15 hover:border-accent/60 transition-colors"
          >
            <span
              className="inline-block w-1.5 h-1.5 rounded-full bg-accent animate-pulse-soft flex-shrink-0"
              aria-hidden
            />
            Q-Shield
          </Link>
          <Link
            href="/#subscribe"
            className="inline-flex items-center px-4 py-2 rounded-md bg-fg text-bg text-[13px] font-medium hover:opacity-90 hover:-translate-y-px transition-all"
          >
            Subscribe
          </Link>
        </div>
      </div>
    </nav>
  );
}

/**
 * The Q-Advantage diamond mark.
 *
 * 26px square rotated 45°, accent-green border, with an inner corner
 * indicating a stylized "Q". Drawn in CSS so it scales cleanly and stays
 * sharp on every screen. The favicon (app/icon.tsx) reproduces this shape
 * as a 32×32 PNG.
 */
function DiamondMark() {
  return (
    <span
      className="relative inline-block w-[26px] h-[26px] border-[1.5px] border-accent rounded-[4px] flex-shrink-0"
      style={{ transform: "rotate(45deg)" }}
      aria-hidden
    >
      <span
        className="absolute"
        style={{
          inset: "5px",
          borderLeft: "1.5px solid #4ade80",
          borderBottom: "1.5px solid #4ade80",
        }}
      />
    </span>
  );
}
