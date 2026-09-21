"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";

type NavItem = { label: string; href: string; description: string; featured?: boolean };
const GROUPS: Array<{ label: string; items: NavItem[] }> = [
  { label: "Products", items: [
    { label: "Migration Model", href: "/model/how-it-works", description: "The core Coldproof product: from measured change to migration budget.", featured: true },
    { label: "PQC Arena", href: "/pqc-arena", description: "Public measurement evidence." },
    { label: "PQC Cost Calculator", href: "/calculator", description: "Explore a migration-cost scenario." },
    { label: "P-CBOM", href: "/p-cbom", description: "Add performance context to cryptographic inventory." },
  ] },
  { label: "Research", items: [
    { label: "Latest research", href: "/blog", description: "Technical and economic analysis." },
    { label: "How we measure", href: "/blog/how-we-measure", description: "The run protocol, sourcing bar and known limits." },
    { label: "P-CBOM explainer", href: "/blog/cbom-vs-p-cbom", description: "Why inventory needs performance and cost context." },
  ] },
  { label: "Resources", items: [
    { label: "Methodology", href: "/methodology", description: "How Coldproof produces its evidence." },
    { label: "Data API", href: "/api", description: "Public measurement data, without a login." },
    { label: "Contact", href: "/contact", description: "Talk with the Coldproof team." },
  ] },
];

function MegaGroup({ group }: { group: typeof GROUPS[number] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => { if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); ref.current?.querySelector<HTMLButtonElement>("button")?.focus(); }
    };
    document.addEventListener("mousedown", close); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", escape); };
  }, [open]);
  return <div ref={ref} className="cp-mega-group" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}
    onFocus={() => setOpen(true)} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false); }}>
    <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-haspopup="true" className="cp-mega-trigger">{group.label}</button>
    <div className={`cp-mega-panel ${open ? "is-open" : ""}`}>
      <div className="cpv2-wrap cp-mega-inner" role="menu" aria-label={group.label}>
        <p className="cp-mono">{group.label}</p>
        <div className="cp-mega-links">{group.items.map((item, index) => <Link role="menuitem" key={item.label} href={item.href} onClick={() => setOpen(false)} className={`cp-mega-link ${item.featured ? "is-featured" : ""}`}>
          <span className="cp-mono">0{index + 1}{item.featured ? " / Core product" : ""}</span><strong>{item.label}</strong><small>{item.description}</small>
        </Link>)}</div>
      </div>
    </div>
  </div>;
}

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    let previous = window.scrollY; let frame = 0;
    const update = () => { frame = 0; const current = window.scrollY; setHidden(current > previous && current > 120 && !menuOpen); previous = current; };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); if (frame) cancelAnimationFrame(frame); };
  }, [menuOpen]);
  useEffect(() => {
    if (!menuOpen) return;
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setMenuOpen(false); };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [menuOpen]);
  return <header className={`coldproof-chrome cp-site-header ${hidden ? "is-hidden" : ""}`}>
    <div className="cpv2-wrap cp-header-row">
      <Link href="/" aria-label="Coldproof home" className="cp-wordmark">Coldproof</Link>
      <nav className="cp-desktop-nav" aria-label="Primary navigation">{GROUPS.map((group) => <MegaGroup key={group.label} group={group} />)}</nav>
      <div className="cp-header-actions">
        <Link href="/contact" className="cp-talk">Talk to us <span aria-hidden>→</span></Link>
        <button type="button" onClick={() => setMenuOpen((value) => !value)} className="cp-menu-button" aria-expanded={menuOpen} aria-controls="mobile-menu" aria-label={menuOpen ? "Close menu" : "Open menu"}>{menuOpen ? <X aria-hidden /> : <Menu aria-hidden />}</button>
      </div>
    </div>
    <div id="mobile-menu" className={`cp-mobile-sheet ${menuOpen ? "is-open" : ""}`}>
      <nav className="cpv2-wrap" aria-label="Mobile navigation">{GROUPS.map((group) => {
        const isOpen = expanded === group.label;
        return <div key={group.label} className="cp-mobile-group"><button type="button" onClick={() => setExpanded(isOpen ? null : group.label)} aria-expanded={isOpen}><span>{group.label}</span><span aria-hidden>{isOpen ? "−" : "+"}</span></button>
          {isOpen && <div>{group.items.map((item) => <Link key={item.label} href={item.href} onClick={() => setMenuOpen(false)} className={item.featured ? "is-featured" : ""}><strong>{item.label}</strong><small>{item.description}</small></Link>)}</div>}
        </div>;
      })}<Link href="/contact" onClick={() => setMenuOpen(false)} className="cp-mobile-contact">Talk to us <span aria-hidden>→</span></Link></nav>
    </div>
  </header>;
}
