"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Menu, X } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { PRODUCTS, TOOLS, type Surface } from "@/lib/nav";

/**
 * Site header — a full-bleed bar that owns its own row, detached from the
 * panels below it. InferenceX and ClusterMAX both do this; the previous
 * header read as fused to the first section.
 *
 * Desktop: Brand · Home · Blog · Products▾ · Tools▾ · [theme] [Contact us]
 * Mobile:  Brand · Contact us · hamburger, everything in the drawer.
 *
 * Work-order 005 cut About/Methodology/Q-Day Index out of the primary nav and
 * moved them to the footer, replacing a six-item flat list that had stopped
 * scaling.
 */

function StatusPill({ status }: { status: Surface["status"] }) {
  const live = status === "live";
  return (
    <span
      className={`rounded px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-eyebrow ${
        live ? "bg-status-ok/15 text-status-ok" : "bg-bg-surface text-fg-subtle"
      }`}
    >
      {live ? "Live" : "Coming"}
    </span>
  );
}

function SurfaceRow({ surface, onNavigate }: { surface: Surface; onNavigate?: () => void }) {
  const body = (
    <>
      <span className="flex items-center justify-between gap-3">
        <span className="text-[13.5px] font-bold text-fg">{surface.name}</span>
        <StatusPill status={surface.status} />
      </span>
      <span className="mt-0.5 block text-[11.5px] leading-snug text-fg-muted">
        {surface.blurb}
      </span>
    </>
  );

  // Unpublished surfaces are named but never linked — no route exists, and
  // linking one would send a visitor to a 404.
  if (!surface.href) {
    return <span className="block cursor-default rounded-lg px-3 py-2.5">{body}</span>;
  }

  return (
    <Link
      href={surface.href}
      onClick={onNavigate}
      className="block rounded-lg px-3 py-2.5 hover:bg-bg-surface"
    >
      {body}
    </Link>
  );
}

function NavDropdown({ label, items }: { label: string; items: Surface[] }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  // Close on outside click and on Escape, so the menu can't strand a keyboard
  // user or linger after focus has moved on.
  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: MouseEvent) {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div
      ref={wrap}
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false);
      }}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-fg-muted transition-colors hover:bg-bg-surface hover:text-fg"
      >
        {label}
        <ChevronDown className="h-3 w-3 opacity-65" aria-hidden />
      </button>

      {open && (
        // Anchored flush to the trigger (top-full) with the visual offset made
        // by internal padding instead of a `top` offset. The previous 7px gap
        // was dead space: moving the pointer from the button toward the menu
        // left the wrapper, fired onMouseLeave, and closed the menu before it
        // could be clicked.
        <div className="absolute left-0 top-full z-50 min-w-[296px] pt-2">
          <div className="rounded-xl border border-border bg-bg-elevated p-1.5 shadow-lg">
            {items.map((s) => (
              <SurfaceRow key={s.name} surface={s} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const close = () => setMenuOpen(false);

  return (
    // Translucent + blurred, so the bar sits in the same material language as
    // the panels below it rather than reading as a solid slab bolted on top.
    <nav
      className="sticky top-0 z-50 border-b border-border"
      style={{
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        background: "rgb(var(--color-bg-card) / 0.72)",
      }}
    >
      <div className="mx-auto max-w-[1200px] px-6 md:px-8">
        <div className="flex h-[64px] items-center justify-between gap-6">
          <Link
            href="/"
            className="flex flex-shrink-0 items-center gap-2.5"
            aria-label="Q-Advantage home"
          >
            <span className="text-[20px] font-bold tracking-[-0.028em] text-fg sm:text-[22px]">
              Q-Advantage
            </span>
          </Link>

          <div className="hidden items-center gap-1 md:flex">
            <Link
              href="/"
              className="rounded-lg px-3 py-2 text-sm font-bold text-fg transition-colors hover:bg-bg-surface"
            >
              Home
            </Link>
            <Link
              href="/blog"
              className="rounded-lg px-3 py-2 text-sm font-semibold text-fg-muted transition-colors hover:bg-bg-surface hover:text-fg"
            >
              Blog
            </Link>
            <NavDropdown label="Products" items={PRODUCTS} />
            <NavDropdown label="Tools" items={TOOLS} />
          </div>

          <div className="hidden flex-shrink-0 items-center gap-2 md:flex">
            <ThemeToggle />
            <Link
              href="/contact"
              className="inline-flex h-[34px] items-center rounded-lg bg-fg px-4 text-[12.5px] font-bold text-bg transition-opacity hover:opacity-90"
            >
              Contact us
            </Link>
          </div>

          <div className="flex items-center gap-2 md:hidden">
            <Link
              href="/contact"
              className="inline-flex items-center rounded-lg bg-fg px-3 py-1.5 text-xs font-bold text-bg"
            >
              Contact us
            </Link>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-fg-muted transition-colors hover:text-fg"
            >
              {menuOpen ? <X className="h-4 w-4" aria-hidden /> : <Menu className="h-4 w-4" aria-hidden />}
            </button>
          </div>
        </div>
      </div>

      {menuOpen && (
        <div className="border-t border-border bg-bg-elevated md:hidden">
          <div className="mx-auto flex max-w-[1200px] flex-col gap-1 px-6 py-4">
            <div className="pb-2">
              <ThemeToggle />
            </div>

            <Link href="/" onClick={close} className="px-3 py-2.5 text-sm font-bold text-fg">
              Home
            </Link>
            <Link href="/blog" onClick={close} className="px-3 py-2.5 text-sm text-fg-muted">
              Blog
            </Link>

            <div className="eyebrow mt-3 px-3">Products</div>
            {PRODUCTS.map((s) => (
              <SurfaceRow key={s.name} surface={s} onNavigate={close} />
            ))}

            <div className="eyebrow mt-3 px-3">Tools</div>
            {TOOLS.map((s) => (
              <SurfaceRow key={s.name} surface={s} onNavigate={close} />
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}

