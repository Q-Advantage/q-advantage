"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";

/**
 * A product's own header — replaces the company header entirely on product
 * routes.
 *
 * Stacking the company nav above a product nav made Q-Shield read as a page
 * inside the marketing site. It is an instrument, and it should feel like its
 * own property, which is how ClusterMAX and InferenceX are set up. The only
 * thing pointing back is a single "Q-Advantage" link on the left — the
 * equivalent of InferenceX's "by SemiAnalysis" lockup.
 *
 * This is the layout-level version of what a `qshield.qadvantage.io`
 * subdomain would buy, without splitting the deploy, the analytics, or the
 * theme preference across origins.
 */

export interface ProductTab {
  label: string;
  href: string;
}

export function ProductHeader({
  name,
  accentSplit,
  tabs,
  homeHref = "/q-shield",
}: {
  /** Product name, e.g. "Q-Shield". */
  name: string;
  /** Character to tint with the brand accent, e.g. the hyphen. */
  accentSplit?: string;
  tabs: ProductTab[];
  /**
   * Where the wordmark points — a product's own front door.
   *
   * Defaults to Q-Shield because it was the only product with a header when
   * this was written. P-CBOM has one now, and a wordmark that navigated to a
   * different product would be a small betrayal of the reader's expectation.
   */
  homeHref?: string;
}) {
  const pathname = usePathname();

  // Longest matching href wins, so /q-shield/compare doesn't also light up
  // the /q-shield overview tab.
  const activeHref = tabs
    .filter((t) => pathname === t.href || pathname.startsWith(`${t.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  const [before, after] = accentSplit ? name.split(accentSplit) : [name, ""];

  return (
    <header
      className="sticky top-0 z-50 border-b border-border"
      style={{
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        background: "rgb(var(--color-bg-card) / 0.78)",
      }}
    >
      <div className="mx-auto max-w-[1240px] px-4 md:px-6">
        <div className="flex h-[58px] items-center justify-between gap-5">
          <div className="flex min-w-0 items-baseline gap-2">
            <Link href={homeHref} className="flex-none text-[21px] font-bold tracking-[-0.025em] text-fg">
              {before}
              {accentSplit && <span className="text-accent-ink">{accentSplit}</span>}
              {after}
            </Link>
            <span className="hidden flex-none text-[11.5px] font-semibold text-fg-subtle sm:inline">
              by{" "}
              <Link href="/" className="border-b border-border text-fg-muted hover:text-fg">
                Q-Advantage
              </Link>
            </span>
          </div>

          <nav className="hidden items-center gap-1 md:flex">
            {tabs.map((t) => (
              <Link
                key={t.href}
                href={t.href}
                aria-current={t.href === activeHref ? "page" : undefined}
                className={`rounded-lg px-3 py-1.5 text-[13px] transition-colors ${
                  t.href === activeHref
                    ? "bg-bg-surface font-bold text-fg"
                    : "font-semibold text-fg-muted hover:bg-bg-surface hover:text-fg"
                }`}
              >
                {t.label}
              </Link>
            ))}
          </nav>

          <div className="flex flex-none items-center gap-2">
            <ThemeToggle />
            <Link
              href="/"
              className="inline-flex h-[32px] items-center gap-1.5 rounded-lg border border-border px-3 text-[12px] font-semibold text-fg-muted transition-colors hover:text-fg"
            >
              <ArrowLeft className="h-3 w-3" aria-hidden />
              <span className="hidden sm:inline">Q-Advantage</span>
            </Link>
          </div>
        </div>

        {/* Tabs drop to their own scrollable row on narrow screens rather than
            disappearing — they are the product's only navigation. */}
        <nav className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-2 md:hidden">
          {tabs.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className={`flex-none rounded-lg px-3 py-1.5 text-[13px] ${
                t.href === activeHref
                  ? "bg-bg-surface font-bold text-fg"
                  : "font-semibold text-fg-muted"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
