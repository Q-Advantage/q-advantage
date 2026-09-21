import type { Metadata } from "next";
import { Header } from "@/components/chrome/Header";
import { Footer } from "@/components/chrome/Footer";
import { ContactForm } from "@/components/chrome/ContactForm";
import { BrandClose } from "@/components/chrome/BrandClose";

export const metadata: Metadata = {
  title: { absolute: "Talk to our team — Coldproof" },
  description:
    "Talk to Coldproof about building a defensible cost model and budget for post-quantum migration.",
};

export default function ContactPage() {
  return (
    <div className="coldproof-site min-h-screen bg-white text-[#101114]">
      <Header />
      <main className="cp-contact-page">
        <section className="cp-contact-hero cpv2-wrap" aria-labelledby="contact-title">
          <div className="cp-mono">Talk to our team</div>
          <h1 id="contact-title">Price the transition<br />before it starts.</h1>
          <p>
            Tell us what you operate, what has to change, and which decision needs a number.
            We’ll start with the migration economics.
          </p>
        </section>

        <div className="cpv2-wrap cp-contact-grid">
          <section className="cp-contact-card cp-contact-main" aria-labelledby="contact-form-title">
            <div className="cp-mono">Build the budget case</div>
            <h2 id="contact-form-title">Talk to us.</h2>
            <p className="cp-contact-intro">
              Start with your estate, your planning horizon and the financial question your team
              needs to answer.
            </p>
            <ContactForm />
          </section>

          <aside className="cp-contact-card cp-contact-panel">
            <div>
              <span className="cp-mono">For CISOs who need a number</span>
              <h2>Give finance a migration budget, not another risk memo.</h2>
              <p>
                Coldproof builds a seven-year cost model from measured cryptographic performance,
                estate scope, migration sequencing and operating assumptions.
              </p>
            </div>
            <ul className="cp-contact-outcomes">
              <li><span>01</span><strong>Low, base and high migration cost</strong></li>
              <li><span>02</span><strong>One-time and recurring spend</strong></li>
              <li><span>03</span><strong>Sensitivities, confidence and provenance</strong></li>
            </ul>
          </aside>
        </div>
      </main>
      <Footer />
      <BrandClose />
    </div>
  );
}
