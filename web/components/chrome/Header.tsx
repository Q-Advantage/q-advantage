"use client";

import Link from "next/link";
import { useState } from "react";

/**
 * Site header — sticky, blur backdrop, present on every page.
 *
 * Desktop (md+): Brand · About · Methodology · GitHub · Q-Day Index · Q-Shield · Subscribe
 * Mobile (<md):  Brand · Subscribe · Hamburger (opens dropdown with all nav)
 */
export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav
      className="sticky top-0 z-50 border-b border-border"
      style={{
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        background: "rgba(10, 10, 11, 0.7)",
      }}
    >
      <div className="mx-auto max-w-[1200px] px-6 md:px-8 py-[18px]">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-3 group flex-shrink-0"
            aria-label="Q-Advantage home"
          >
            <DiamondMark />
            <span className="font-serif text-[22px] sm:text-[26px] md:text-[32px] text-fg tracking-tight leading-none">
              Q-Advantage
            </span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-5 lg:gap-7">
            <Link href="/about" className="text-sm text-fg-muted hover:text-fg transition-colors">
              About
            </Link>
            <Link
              href="/methodology"
              className="text-sm text-fg-muted hover:text-fg transition-colors"
            >
              Methodology
            </Link>
            <a
              href="https://github.com/Q-Advantage"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-fg-muted hover:text-fg transition-colors"
            >
              GitHub
            </a>
            <Link
              href="/q-day-index"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md border border-accent/40 bg-accent/10 text-accent text-[13px] font-medium hover:bg-accent/15 hover:border-accent/60 transition-colors"
            >
              <span
                className="inline-block w-1.5 h-1.5 rounded-full bg-accent animate-pulse-soft flex-shrink-0"
                aria-hidden
              />
              Q-Day Index
            </Link>
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

          {/* Mobile: Subscribe + Hamburger */}
          <div className="flex md:hidden items-center gap-2">
            <Link
              href="/#subscribe"
              className="inline-flex items-center px-3 py-1.5 rounded-md bg-fg text-bg text-[12px] font-medium"
            >
              Subscribe
            </Link>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              className="inline-flex items-center justify-center w-9 h-9 rounded-md border border-border text-fg-muted hover:text-fg transition-colors"
            >
              {menuOpen ? <CloseIcon /> : <MenuIcon />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div
          className="md:hidden border-t border-border"
          style={{ background: "rgba(10, 10, 11, 0.95)" }}
        >
          <div className="mx-auto max-w-[1200px] px-6 py-3 flex flex-col gap-1">
            <Link
              href="/q-day-index"
              onClick={() => setMenuOpen(false)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-md border border-accent/40 bg-accent/10 text-accent text-sm font-medium"
            >
              <span
                className="inline-block w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0"
                aria-hidden
              />
              Q-Day Index
            </Link>
            <Link
              href="/q-shield"
              onClick={() => setMenuOpen(false)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-md border border-accent/40 bg-accent/10 text-accent text-sm font-medium"
            >
              <span
                className="inline-block w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0"
                aria-hidden
              />
              Q-Shield
            </Link>
            <Link
              href="/about"
              onClick={() => setMenuOpen(false)}
              className="px-3.5 py-2.5 text-sm text-fg-muted hover:text-fg"
            >
              About
            </Link>
            <Link
              href="/methodology"
              onClick={() => setMenuOpen(false)}
              className="px-3.5 py-2.5 text-sm text-fg-muted hover:text-fg"
            >
              Methodology
            </Link>
            <a
              href="https://github.com/Q-Advantage"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setMenuOpen(false)}
              className="px-3.5 py-2.5 text-sm text-fg-muted hover:text-fg"
            >
              GitHub
            </a>
          </div>
        </div>
      )}
    </nav>
  );
}

function MenuIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

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
