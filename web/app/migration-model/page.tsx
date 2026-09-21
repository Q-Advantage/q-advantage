import type { Metadata } from "next";
import { Header } from "@/components/chrome/Header";
import { Footer } from "@/components/chrome/Footer";
import { BrandClose } from "@/components/chrome/BrandClose";
import { Conversion, ModelOutputs } from "@/components/home/HomepageV3";
import Link from "next/link";

export const metadata: Metadata = {
  title: { absolute: "Post-Quantum Migration Model — Coldproof" },
  description:
    "Turn measured post-quantum performance, estate scope and migration assumptions into a decision-ready financial model.",
};

export default function MigrationModelPage() {
  return (
    <div className="coldproof-site min-h-screen bg-white text-[#101114]">
      <Header />
      <main className="cp-migration-page">
        <section className="cp-model-route-intro">
          <div className="cpv2-wrap">
            <div className="cp-mono">Coldproof Migration Model</div>
            <h1>From cryptographic change to a budget you can defend.</h1>
            <p>Follow the evidence from measurement, through your estate, into a multi-year financial decision.</p>
            <nav aria-label="How the migration model works">
              {[
                ["01", "Measure", "measure"],
                ["02", "Map", "map"],
                ["03", "Model", "model"],
                ["04", "Decide", "decide"],
              ].map(([number, label, anchor]) => (
                <Link key={anchor} href={`/model/how-it-works#${anchor}`}>
                  <span className="cp-mono">{number}</span><strong>{label}</strong><i aria-hidden>→</i>
                </Link>
              ))}
            </nav>
          </div>
        </section>
        <ModelOutputs />
        <Conversion />
      </main>
      <Footer />
      <BrandClose />
    </div>
  );
}
