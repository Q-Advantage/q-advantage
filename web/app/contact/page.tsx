import type { Metadata } from "next";
import { Header } from "@/components/chrome/Header";
import { Footer } from "@/components/chrome/Footer";
import { PageShell } from "@/components/chrome/PageShell";
import { Breadcrumb } from "@/components/chrome/Breadcrumb";
import { ContactForm } from "@/components/chrome/ContactForm";
import { GitHubStarPopup } from "@/components/chrome/GitHubStarPopup";

export const metadata: Metadata = {
  title: "Contact — Q-Advantage",
  description:
    "Talk to Q-Advantage about product access, benchmarking engagements, partnerships, press, or a correction to published data.",
};

export default function ContactPage() {
  return (
    <div className="marketing-bg min-h-screen flex flex-col">
      <Header />
      <PageShell variant="panel" width="narrow">
        <Breadcrumb back={{ label: "Home", href: "/" }} current="Contact" />

        <div className="mt-8 mb-4">
          <div className="eyebrow mb-4">Contact</div>
          <h1 className="text-[clamp(40px,6vw,64px)] font-bold leading-[1.05] tracking-[-0.028em] text-fg mb-5">
            Talk to us.
          </h1>
          <p className="text-lg text-fg-muted leading-[1.6] font-medium">
            Product access, a custom benchmarking engagement, a partnership — or a correction
            to something we&apos;ve published. Tell us which, and what you need.
          </p>
        </div>

        <ContactForm />
      </PageShell>
      <Footer />
      <GitHubStarPopup />
    </div>
  );
}
