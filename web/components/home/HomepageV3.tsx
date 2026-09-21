"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";

type Evidence = { date: string; commit: string; instance: string; handshake: string; throughput: string; wireDelta: string; wireRatio: string };
type Post = { slug: string; title: string; date: string; category: string; summary: string };
type Stage = { label: string; title: string; body: string; kind: "photo" | "model" | "decision"; image?: typeof IMAGES[number] };

const IMAGES = [
  { src: "/images/coldproof/hero-fiber.jpg", alt: "Illuminated fibre-optic strands carrying network traffic" },
  { src: "/images/coldproof/hero-ethernet.jpg", alt: "Enterprise network switch populated with Ethernet connections" },
  { src: "/images/coldproof/hero-servers.jpg", alt: "Enterprise server racks and overhead network cabling" },
  { src: "/images/coldproof/hero-storage.jpg", alt: "Large-scale enterprise storage infrastructure" },
];

const STAGES: Stage[] = [
  { label: "Measure", title: "Measure the real performance impact of post-quantum cryptography.", body: "Real benchmark and protocol evidence.", kind: "photo", image: IMAGES[0] },
  { label: "Map", title: "Place measured cryptographic change in the systems you actually operate.", body: "Your estate, dependencies and thresholds.", kind: "photo", image: IMAGES[1] },
  { label: "Model", title: "Turn infrastructure change into migration economics.", body: "One-time work, recurring impact and uncertainty.", kind: "model" },
  { label: "Decide", title: "Give security and finance a budget they can defend.", body: "A decision-ready range with clear provenance.", kind: "decision" },
];

const STAGE_LINKS = ["measure", "map", "model", "decide"] as const;

const SYSTEMS = ["HSMs", "PKI", "Certificates", "TLS", "APIs", "Identity", "Applications", "Databases", "Networks", "Cloud Infrastructure", "Code Signing", "Software Supply Chain", "IoT", "Blockchains", "Dual-Stack Operation", "Validation"];

export function HomepageV3({ evidence, posts }: { evidence: Evidence; posts: Post[] }) {
  return <main><Hero /><Introduction /><CinematicSequence /><Arena evidence={evidence} /><SystemsRail /><ModelOutputs /><Tools /><Research posts={posts} /><Conversion /></main>;
}

function Hero() {
  const [active, setActive] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setActive((value) => (value + 1) % IMAGES.length), 5600);
    return () => window.clearInterval(timer);
  }, []);
  return <header className="cpv2-hero" id="top">
    <div className="cpv2-hero-media" aria-hidden>{IMAGES.map((image, index) => <Image key={image.src} src={image.src} alt="" fill priority={index === 0} sizes="100vw" className={index === active ? "active" : ""} />)}</div>
    <div className="cpv2-hero-overlay" aria-hidden />
    <div className="cpv2-hero-content"><h1><span>Know what PQC will cost.</span><span>Before you migrate.</span></h1></div>
    <div className="cpv2-hero-kicker cp-mono">Post-quantum migration economics</div>
    <div className="cpv2-hero-scroll cp-mono"><span>Scroll</span><i aria-hidden>↓</i></div>
  </header>;
}

function Introduction() {
  return <section className="cpv2-intro"><div className="cpv2-wrap cpv2-intro-grid">
    <h2>Cryptography is changing. The budget has to change with it.</h2>
    <div><p>Coldproof turns measured post-quantum performance, your cryptographic estate, and migration assumptions into a defensible financial model for the transition.</p><Link href="#migration-model" className="cpv2-text-link">See how the model works <ArrowRight aria-hidden /></Link></div>
  </div></section>;
}

function StageVisual({ stage, cinematic = false }: { stage: Stage; cinematic?: boolean }) {
  if (stage.kind === "model") return <FinancialModelVisual compact={cinematic} />;
  if (stage.kind === "decision") return <DecisionOutput />;
  return <>{stage.image && <Image src={stage.image.src} alt={stage.image.alt} fill sizes={cinematic ? "70vw" : "100vw"} className="object-cover" />}<div className="cpv2-image-shade" aria-hidden /></>;
}

function CinematicSequence() {
  const section = useRef<HTMLElement>(null);
  const [stage, setStage] = useState(0);
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      if (!section.current || window.matchMedia("(max-width: 920px)").matches) return;
      const rect = section.current.getBoundingClientRect();
      const distance = Math.max(1, rect.height - window.innerHeight);
      const next = Math.min(1, Math.max(0, -rect.top / distance));
      setProgress(next); setStage(Math.min(3, Math.round(next * 3)));
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    update(); window.addEventListener("scroll", onScroll, { passive: true }); window.addEventListener("resize", onScroll);
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); if (frame) cancelAnimationFrame(frame); };
  }, []);
  const slidePosition = progress * 3;
  return <section ref={section} className="cpv2-cinematic" id="model" aria-labelledby="cinematic-title">
    <div className="cpv2-cinematic-sticky">
      <div className="cpv2-cinema-label cp-mono">Cryptographic change → financial decision</div>
      <div className="cpv2-cinema-stage">
        {STAGES.map((item, index) => {
          const offset = index - slidePosition;
          const slideStyle = { "--slide-x": `${offset * 108}%`, "--slide-opacity": Math.max(.12, 1 - Math.abs(offset) * .62) } as React.CSSProperties;
          return <div key={item.label} style={slideStyle} className={`cpv2-cinema-image ${stage === index ? "active" : ""}`} aria-hidden={stage !== index}><StageVisual stage={item} cinematic /></div>;
        })}
      </div>
      <div className="cpv2-cinema-copy">{STAGES.map((item, index) => <div key={item.label} className={stage === index ? "active" : ""} aria-hidden={stage !== index}>
        <div><p className="cp-mono">0{index + 1} / {item.label}</p><h2 id={index === 0 ? "cinematic-title" : undefined}>{item.title}</h2></div><div><p className="body">{item.body}</p><Link className="cpv2-stage-link" href={`/model/how-it-works#${STAGE_LINKS[index]}`}>Explore {item.label} <span aria-hidden>→</span></Link></div>
      </div>)}</div>
      <div className="cpv2-cinema-meter" aria-hidden>{STAGES.map((_, index) => <i key={index} className={index <= stage ? "active" : ""} />)}</div>
    </div>
    <div className="cpv2-mobile-scenes"><div className="cp-mono">Cryptographic change → financial decision</div>{STAGES.map((item, index) => <article key={item.label}>
      <div className={`image ${item.kind !== "photo" ? "generated" : ""}`}><StageVisual stage={item} cinematic /></div><p className="cp-mono">0{index + 1} / {item.label}</p><h2>{item.title}</h2><p>{item.body}</p>
      <Link className="cpv2-stage-link" href={`/model/how-it-works#${STAGE_LINKS[index]}`}>Explore {item.label} <span aria-hidden>→</span></Link></article>)}</div>
  </section>;
}

export function FinancialModelVisual({ compact = false }: { compact?: boolean }) {
  const rows = [
    ["Discovery / inventory", ".45", ".35", ".20", "—", "—", "—", "—", "1.00"],
    ["PKI transition", ".10", ".40", ".70", ".70", ".40", ".25", ".15", "2.70"],
    ["HSM refresh", ".10", ".25", ".45", ".50", ".30", ".15", ".05", "1.80"],
    ["Application remediation", ".10", ".50", "1.10", "1.60", "1.45", "1.05", ".60", "6.40"],
    ["Network / infrastructure", ".05", ".20", ".35", ".45", ".40", ".35", ".30", "2.10"],
    ["Validation / testing", ".05", ".15", ".30", ".40", ".35", ".30", ".15", "1.70"],
    ["Parallel classical + PQC", "—", ".15", ".40", ".65", ".70", ".50", ".30", "2.70"],
    ["Total CapEx", ".35", ".75", "1.35", "1.55", "1.05", ".70", ".45", "6.20"],
    ["Total OpEx", ".45", "1.25", "2.05", "2.65", "2.65", "1.85", "1.30", "12.20"],
  ];
  const outputs = [["7-year undiscounted", "$18.4M"], ["NPV of migration cost", "$15.8M"], ["One-time migration spend", "$8.1M"], ["Recurring infra delta", "$1.47M/yr"], ["Peak annual spend", "2029 / $4.2M"], ["Parallel operation", "18 months"]];
  return <div className={`cp-financial-model ${compact ? "is-compact" : ""}`}>
    <div className="cp-model-top"><div><span className="cp-mono">Coldproof / Financial model / v1.4</span><strong>Post-Quantum Migration Workbook</strong></div><span className="cp-model-status cp-mono">Base case / USD M</span></div>
    <div className="cp-workbook-output">{outputs.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
    <div className="cp-workbook-body"><div className="cp-workbook-main">
      <div className="cp-sheet-section"><span>1</span><strong>Migration spend schedule</strong><em>Annual cash flow / USD millions</em></div>
      <div className="cp-model-table"><div className="head"><span>Cost category</span>{["2027", "2028", "2029", "2030", "2031", "2032", "2033", "Total"].map((year) => <span key={year}>{year}</span>)}</div>{rows.map((row) => <div className={row[0].startsWith("Total") ? "subtotal" : ""} key={row[0]}>{row.map((cell, index) => <span key={`${row[0]}-${index}`}>{cell}</span>)}</div>)}<div className="total"><span>Annual cash flow</span>{[".80", "2.00", "3.40", "4.20", "3.70", "2.55", "1.75", "18.40"].map((value, index) => <span key={`${value}-${index}`}>{value}</span>)}</div></div>
      <div className="cp-sheet-section assumptions"><span>2</span><strong>Core assumptions</strong><em>Highlighted cells are editable model inputs</em></div>
      <div className="cp-model-assumptions"><span>Discount rate <strong>8.5%</strong></span><span>Migration duration <strong>7 years</strong></span><span>App remediation <strong>$34.4K / app</strong></span><span>HSM replacement rate <strong>64%</strong></span><span>Migration start <strong>Q2 2027</strong></span><span>Applications <strong>186</strong></span></div>
    </div><aside className="cp-workbook-side">
      <div className="cp-scenarios-title"><span className="cp-mono">Scenario cases</span><small>7-year cost</small></div><div className="cp-model-scenarios"><div><span>Low</span><strong>$12.9M</strong></div><div className="active"><span>Base</span><strong>$18.4M</strong></div><div><span>High</span><strong>$27.2M</strong></div></div>
      <div className="cp-sensitivity"><span className="cp-mono">Sensitivity / Application remediation</span><div className="labels"><span>Duration</span><span>−15%</span><span>Base</span><span>+20%</span></div>{[["4 yr", "$14.9", "$16.1", "$18.0"], ["6 yr", "$16.8", "$18.4", "$21.2"], ["8 yr", "$18.6", "$20.7", "$24.1"]].map((row) => <div key={row[0]}>{row.map((cell) => <span key={cell}>{cell}</span>)}</div>)}</div>
      <div className="cp-provenance"><span className="cp-mono">Model provenance</span><p><i /> Measured inputs</p><p><i /> Customer assumptions</p><p><i /> Bounded defaults</p></div>
    </aside></div>
    <div className="cp-workbook-tabs">{["Summary", "Assumptions", "Migration Schedule", "PKI + HSM", "Applications", "Sensitivity"].map((tab, index) => <span className={index === 0 ? "active" : ""} key={tab}>{tab}</span>)}</div>
    <div className="cp-model-disclaimer">Illustrative model output — not a customer estimate</div>
  </div>;
}

export function DecisionOutput() {
  return <div className="cp-decision-output"><div className="cp-decision-bar"><span className="cp-mono">Post-Quantum Migration Budget</span><span className="cp-mono">Executive decision brief / Base case</span></div><div className="cp-decision-main"><div className="cp-decision-number"><span className="cp-mono">Recommended planning case</span><strong>$18.4M</strong><p>Seven-year undiscounted migration cost</p></div><div className="cp-decision-facts"><div><span>7-year NPV</span><strong>$15.8M</strong></div><div><span>Peak spend</span><strong>2029 / $4.2M</strong></div><div><span>Largest driver</span><strong>Application remediation</strong></div><div><span>Parallel operation</span><strong>18 months</strong></div></div></div><div className="cp-decision-lower"><div className="cp-decision-range"><span>Low <strong>$12.9M</strong></span><i /><span>Base <strong>$18.4M</strong></span><i /><span>High <strong>$27.2M</strong></span></div><div className="cp-confidence"><span>Confidence</span><strong>72%</strong><i><b /></i></div><div className="cp-decision-sensitivities"><span className="cp-mono">Top sensitivities</span><p>Application scope · Migration duration · HSM refresh timing</p></div></div><div className="cp-decision-foot"><span>Measured inputs</span><span>Customer assumptions</span><span>Confidence bounds</span></div><p className="cp-model-disclaimer">Illustrative output — not a customer estimate</p></div>;
}

function Arena({ evidence }: { evidence: Evidence }) {
  return <section className="cpv2-arena" id="arena"><div className="cpv2-wrap"><div className="cp-mono">PQC Arena</div><div className="cpv2-arena-grid">
    <h2>Built on measurements, not assumptions.</h2><div><p>PQC Arena is Coldproof&apos;s public measurement layer for the post-quantum transition. It measures cryptographic primitives, protocol behavior and deployment effects — the evidence underneath our migration models.</p><Link href="/pqc-arena" className="cpv2-arena-cta">Explore PQC Arena <ArrowRight aria-hidden /></Link></div>
  </div><div className="cpv2-receipt"><div className="cpv2-receipt-head"><span className="cp-mono">Measurement receipt</span><span className="cp-mono">{evidence.date} · {evidence.commit}</span></div><div className="cpv2-receipt-body"><div><span className="cp-mono">Protocol / algorithm</span><strong>{evidence.handshake}</strong><small>Measured on {evidence.instance}</small></div><dl><div><dt>Per core</dt><dd>{evidence.throughput}</dd></div><div><dt>Wire delta</dt><dd>{evidence.wireDelta}</dd></div><div><dt>Wire ratio</dt><dd>{evidence.wireRatio}</dd></div></dl></div><div className="cpv2-receipt-foot cp-mono">Dated, reproducible evidence · underlying benchmark data unchanged</div></div>
  </div></section>;
}

function SystemsRail() {
  const entries = [...SYSTEMS, ...SYSTEMS];
  return <section className="cpv2-rail-section" id="systems" aria-label="Cost surfaces across the cryptographic estate"><div className="cpv2-wrap cpv2-rail-label"><span className="cp-mono">Across the cryptographic estate</span><p>Coldproof can price the post-quantum transition across the systems that create cost.</p></div><div className="cpv2-rail">{entries.map((item, index) => <span key={`${item}-${index}`} aria-hidden={index >= SYSTEMS.length}>{item}<i aria-hidden>·</i></span>)}</div></section>;
}

export function ModelOutputs() {
  const outputs = [["Output 01", "Migration cost range", "Low, base, and high cases with the inputs that drive the spread."], ["Output 02", "Recurring infrastructure delta", "What remains after the transition project is complete."], ["Output 03", "Critical cost thresholds", "Step changes in capacity, transport, validation, and parallel operation."], ["Output 04", "Confidence and provenance", "Measured inputs, customer inputs, public defaults, and bounded assumptions."]];
  return <section className="cpv2-outputs" id="migration-model"><div className="cpv2-wrap"><div className="cp-mono">Coldproof Migration Model</div><h2>Measured cryptography becomes a migration budget security and finance can use.</h2><Link href="/model/how-it-works" className="cpv2-text-link cpv2-model-explainer-link">See how the model works <ArrowRight aria-hidden /></Link><div className="cpv2-model-feature" id="workbook"><FinancialModelVisual /></div><div className="cpv2-output-list">{outputs.map(([label, title, copy]) => <Link href="/model/how-it-works#model" className="cpv2-output-row" key={label}><span className="cp-mono">{label}</span><h3>{title}</h3><p>{copy}</p><i aria-hidden>→</i></Link>)}</div></div></section>;
}

type ProductCardProps = { id: string; title: string; copy: string; href: string; cta: string; accent: string };
function EditorialProductCard({ id, title, copy, href, cta, accent }: ProductCardProps) {
  return <Link href={href} className={`cpv2-tool-card ${accent}`}><span className="cp-mono">{id}</span><h3>{title}</h3><div className="lower"><p>{copy}</p><span>{cta} <i aria-hidden>→</i></span></div></Link>;
}
function Tools() {
  const cards: ProductCardProps[] = [
    { id: "01 / PQC Arena", title: "Measure the technical reality.", copy: "Open, dated benchmark and protocol evidence for post-quantum cryptography.", href: "/pqc-arena", cta: "Explore PQC Arena", accent: "accent-blue" },
    { id: "02 / Calculator", title: "Explore one cost scenario.", copy: "A focused calculator for seeing how measured TLS changes translate into a cost case.", href: "/calculator", cta: "Open calculator", accent: "accent-moss" },
    { id: "03 / P-CBOM", title: "Add context to inventory.", copy: "Enrich a cryptographic bill of materials with migration and performance context.", href: "/p-cbom", cta: "Explore P-CBOM", accent: "accent-clay" },
  ];
  return <section className="cpv2-tools" id="resources"><div className="cpv2-wrap"><div className="cp-mono">Public tools</div><h2>Evidence and context beneath the model.</h2><div className="cpv2-tool-grid">{cards.map((card) => <EditorialProductCard key={card.id} {...card} />)}</div></div></section>;
}

function Research({ posts }: { posts: Post[] }) {
  const [featured, ...rest] = posts;
  return <section className="cpv2-research" id="research"><div className="cpv2-wrap"><div className="cp-mono">Research</div><h2>The economics of the post-quantum transition.</h2>{featured && <Link href={`/blog/${featured.slug}`} className="cpv2-research-feature"><div><span className="cp-mono">Featured / {featured.category}</span><h3>{featured.title}</h3><p>{featured.summary}</p></div><span>Read research <i aria-hidden>→</i></span></Link>}<div className="cpv2-research-list">{rest.slice(0, 3).map((post) => <Link href={`/blog/${post.slug}`} key={post.slug}><span className="cp-mono">{post.category}</span><h3>{post.title}</h3><time>{post.date}</time><i aria-hidden>→</i></Link>)}</div></div></section>;
}

export function Conversion() { return <section className="cpv2-conversion" id="contact"><div className="cpv2-wrap cpv2-conversion-grid"><div><div className="cp-mono">Design partners</div><h2>Price your migration.</h2><p>We’re working with a small number of organizations to model the economics of their post-quantum transition.</p></div><Link href="/contact">Request a migration model <ArrowRight aria-hidden /></Link></div></section>; }
