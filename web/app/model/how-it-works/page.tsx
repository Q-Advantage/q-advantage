import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/chrome/Header";
import { Footer } from "@/components/chrome/Footer";
import { BrandClose } from "@/components/chrome/BrandClose";
import { ContactCta } from "@/components/chrome/ContactCta";
import { DecisionOutput, FinancialModelVisual } from "@/components/home/HomepageV3";
import { getHomeMetrics } from "@/lib/data/home-metrics";
import { formatDuration, formatOpsPerSec } from "@/lib/format";

export const metadata: Metadata = {
  title: { absolute: "How the Coldproof Migration Model Works — Coldproof" },
  description:
    "How Coldproof turns measured post-quantum cryptography performance and infrastructure context into a defensible migration-cost model.",
};

const ESTATE = ["PKI", "HSMs", "Certificates", "TLS", "APIs", "Applications", "Databases", "Identity", "Networks", "IoT", "Blockchains"];
const COSTS = ["Discovery and inventory", "Application remediation", "PKI transition", "HSM refresh", "Infrastructure changes", "Testing and validation", "Parallel classical/PQC operation", "Recurring operating-cost differences"];
const OUTPUTS = ["Low / Base / High scenarios", "Annual migration spend", "CapEx / OpEx", "Recurring infrastructure delta", "Cash-flow profile", "NPV", "Sensitivity analysis", "Threshold-driven cost changes"];
const QUESTIONS = ["How much should we budget?", "When will the largest costs occur?", "Which assumptions change the answer most?", "Where could infrastructure capacity force a step-change in cost?", "What should we measure next before committing the budget?"];

export default function HowItWorksPage() {
  const metrics = getHomeMetrics();
  const evidence = {
    date: metrics.run.date,
    commit: metrics.run.shortSha,
    instance: metrics.run.instanceType,
    handshake: metrics.handshake ? formatDuration(metrics.handshake.hybridMeanUs) : "Unavailable",
    throughput: metrics.handshake ? formatOpsPerSec(metrics.handshake.hybridOpsPerSec) : "Unavailable",
    wireDelta: metrics.wire ? `+${metrics.wire.deltaBytes.toLocaleString()} B` : "Unavailable",
    wireRatio: metrics.wire ? `${metrics.wire.ratio.toFixed(1)}×` : "Unavailable",
  };

  return (
    <div className="coldproof-site cp-model-explainer min-h-screen bg-white text-[#101114]">
      <Header />
      <main>
        <header className="cp-model-explainer-hero">
          <div className="cpv2-wrap">
            <div className="cp-mono">How the model works</div>
            <h1>How Coldproof turns post-quantum change into a migration budget</h1>
            <p>From measured cryptographic performance to a financial model security and finance can use.</p>
            <nav aria-label="Explainer sections">
              {[["01", "Measure", "measure"], ["02", "Map", "map"], ["03", "Model", "model"], ["04", "Decide", "decide"]].map(([n, label, id]) => (
                <Link key={id} href={`#${id}`}><span className="cp-mono">{n}</span><strong>{label}</strong></Link>
              ))}
            </nav>
          </div>
        </header>

        <ExplainerSection id="measure" number="01" label="Measure" title="Measure what actually changes.">
          <div className="cp-explainer-prose">
            <p>Post-quantum cryptography changes more than an algorithm name. It can change operation time, handshake behavior, signatures and keys, certificate sizes, protocol overhead, throughput and the way infrastructure behaves under load.</p>
            <p>Coldproof starts with measured evidence from PQC Arena rather than a generic performance assumption. The run, machine and software environment stay attached to the number so the evidence can be inspected.</p>
          </div>
          <div className="cp-explainer-measurement" aria-label="Current PQC Arena measurement">
            <div className="head"><span className="cp-mono">PQC Arena / Measurement receipt</span><span className="cp-mono">{evidence.date} · {evidence.commit}</span></div>
            <div className="primary"><div><span>Hybrid TLS handshake</span><strong>{evidence.handshake}</strong><small>Measured on {evidence.instance}</small></div><dl><div><dt>Per core</dt><dd>{evidence.throughput}</dd></div><div><dt>Wire delta</dt><dd>{evidence.wireDelta}</dd></div><div><dt>Wire ratio</dt><dd>{evidence.wireRatio}</dd></div></dl></div>
            <Link href="/pqc-arena/protocols">Inspect the underlying protocol measurements <span aria-hidden>→</span></Link>
          </div>
          <p className="cp-explainer-conclusion">Measurement tells us what changed. It does not yet tell us what that change costs your organization.</p>
        </ExplainerSection>

        <ExplainerSection id="map" number="02" label="Map" title="Put those changes inside your estate.">
          <div className="cp-explainer-prose">
            <p>A benchmark alone cannot price a specific organization’s transition. The same cryptographic change can land very differently in a payments gateway, an internal service mesh, a certificate authority or an embedded device fleet.</p>
            <p>Coldproof maps measured effects onto the systems that create work and cost. Customer inputs may include certificate volumes, HSM footprint, application estate, connection volumes, infrastructure profile and migration timing. These are explicit inputs—not claims of fully automated estate discovery.</p>
          </div>
          <blockquote>Where does a cryptographic change become an operational change?</blockquote>
          <div className="cp-estate-map" aria-label="Cryptographic estate cost surfaces">
            <div className="core"><span className="cp-mono">Measured change</span><strong>PQC performance<br />and protocol effects</strong></div>
            <div className="surfaces">{ESTATE.map((item, index) => <span key={item} style={{ "--estate-index": index } as React.CSSProperties}>{item}</span>)}</div>
            <div className="flow cp-mono">Evidence → estate context → operational effect</div>
          </div>
        </ExplainerSection>

        <ExplainerSection id="model" number="03" label="Model" title="Turn infrastructure effects into money.">
          <div className="cp-explainer-prose">
            <p>Measured effects and customer inputs feed a multi-year migration model. The model separates the transition project from the infrastructure and operating-cost differences that can remain after implementation.</p>
          </div>
          <div className="cp-explainer-lists"><ListBlock title="Cost categories" items={COSTS} /><ListBlock title="Decision outputs" items={OUTPUTS} /></div>
          <div className="cp-provenance-strip"><span className="cp-mono">Provenance</span>{["Measured", "Customer supplied", "Public default", "Bounded estimate"].map((item) => <strong key={item}>{item}</strong>)}</div>
          <div className="cp-explainer-workbook"><FinancialModelVisual /></div>
        </ExplainerSection>

        <ExplainerSection id="decide" number="04" label="Decide" title="Give security and finance the same number.">
          <div className="cp-explainer-prose">
            <p>The purpose is a decision-ready migration view, not another technical report. Security can see what drives the estimate; finance can see when cash is required, what remains uncertain and which assumptions deserve another measurement.</p>
          </div>
          <ol className="cp-decision-questions">{QUESTIONS.map((question, index) => <li key={question}><span className="cp-mono">0{index + 1}</span><strong>{question}</strong></li>)}</ol>
          <div className="cp-explainer-decision"><DecisionOutput /></div>
        </ExplainerSection>

        <div className="cpv2-wrap cp-explainer-final"><ContactCta /></div>
      </main>
      <Footer />
      <BrandClose />
    </div>
  );
}

function ExplainerSection({ id, number, label, title, children }: { id: string; number: string; label: string; title: string; children: React.ReactNode }) {
  return <section id={id} className="cp-explainer-section"><div className="cpv2-wrap"><div className="cp-explainer-heading"><span className="cp-mono">{number} / {label}</span><h2>{title}</h2></div>{children}</div></section>;
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  return <div><span className="cp-mono">{title}</span><ul>{items.map((item) => <li key={item}><i aria-hidden>→</i>{item}</li>)}</ul></div>;
}
