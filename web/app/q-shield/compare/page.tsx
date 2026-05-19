import type { Metadata } from "next";
import { Header } from "@/components/chrome/Header";
import { Footer } from "@/components/chrome/Footer";
import { Breadcrumb } from "@/components/chrome/Breadcrumb";
import { AuditStrip } from "@/components/data/AuditStrip";
import { CompareView } from "@/components/data/CompareView";
import { getLatestRun } from "@/lib/data/load";

export const metadata: Metadata = {
  title: "Compare algorithms",
  description:
    "Side-by-side comparison of post-quantum cryptography algorithms. ML-KEM, ML-DSA, and SLH-DSA measured on identical hardware.",
};

// Force static generation — the client component handles URL state at runtime
export const dynamic = "force-static";

export default function ComparePage() {
  const run = getLatestRun();

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 mx-auto max-w-[1200px] px-6 md:px-8 py-10 md:py-12 w-full space-y-10">
        <Breadcrumb back={{ label: "Q-Shield", href: "/q-shield" }} current="Compare" />

        <div className="flex flex-col gap-3">
          <div className="eyebrow">Q-Shield · Compare</div>
          <h1 className="font-serif text-[clamp(32px,4.5vw,48px)] font-normal leading-[1.05] tracking-[-0.02em] text-fg">
            Side by <em className="italic">side.</em>
          </h1>
          <p className="text-base text-fg-muted max-w-2xl leading-relaxed font-light">
            Pick any two PQC algorithms and an operation. Numbers come from
            the latest weekly run, same hardware, same iteration count.
          </p>
        </div>

        <AuditStrip run={run} />

        <CompareView algorithms={run.algorithms} />
      </main>
      <Footer />
    </div>
  );
}
