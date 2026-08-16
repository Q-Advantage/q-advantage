import type { Metadata } from "next";
import { Header } from "@/components/chrome/Header";
import { Footer } from "@/components/chrome/Footer";
import { PageShell } from "@/components/chrome/PageShell";
import { Breadcrumb } from "@/components/chrome/Breadcrumb";
import { GitHubStarPopup } from "@/components/chrome/GitHubStarPopup";
import { ProtocolsView } from "@/components/protocols/ProtocolsView";
import { loadProtocolsData } from "@/lib/protocols/load";

export const metadata: Metadata = {
  title: "Q-Shield — Protocol benchmarks",
  description:
    "Post-quantum TLS and SSH handshake cost measured in real protocol context: bytes on the wire, phase-by-phase decomposition, cross-checked against liboqs and eBACS. Measured on x86 and ARM. Re-run daily, every number linked to its commit.",
};

export default function ProtocolsPage() {
  const data = loadProtocolsData();

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <PageShell variant="frame" className="space-y-10">
        <Breadcrumb back={{ label: "Q-Shield", href: "/q-shield" }} current="Protocols" />

        <div className="flex flex-col gap-3">
          <div className="eyebrow">Q-Shield · Protocol benchmarks</div>
          <h1 className="text-[clamp(36px,5vw,56px)] font-bold leading-[1.05] tracking-[-0.028em] text-fg">
            The handshake, in context.
          </h1>
          <p className="text-base text-fg-muted max-w-2xl leading-relaxed font-medium">
            Reference benchmarks like eBACS and liboqs measure PQC primitives in
            isolation &mdash; one operation, one cycle count. This is different: it
            shows how post-quantum cryptography actually behaves inside the
            protocols people run every day, TLS and SSH, rather than as raw numbers
            on a spec sheet.
          </p>
          <p className="text-base text-fg-muted max-w-2xl leading-relaxed font-medium">
            A handshake isn&apos;t one operation &mdash; it&apos;s key exchange
            composed with authentication, and what actually ships is the whole
            thing: how many microseconds it costs and how many bytes it puts on the
            wire. So that&apos;s what gets measured here. Real suites &mdash;
            X25519+ML-KEM-768, the NIST-curve variant, the classical baseline
            &mdash; decomposed phase by phase, sized to the byte, and cross-checked
            against the liboqs speed tools and eBACS reference cycles so the numbers
            can be verified against the canonical ones. Measured on both x86 (Intel
            Xeon Platinum) and ARM (AWS Graviton3) so the numbers travel. Re-run
            daily; every figure links back to the commit that produced it.
          </p>
        </div>

        <ProtocolsView data={data} />
      </PageShell>
      <Footer />
      <GitHubStarPopup />
    </div>
  );
}
