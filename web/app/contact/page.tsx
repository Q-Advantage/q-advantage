import type { Metadata } from "next";
import { Header } from "@/components/chrome/Header";
import { Footer } from "@/components/chrome/Footer";
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
      <main className="flex-1 mx-auto max-w-[760px] px-6 md:px-8 py-12 md:py-16 w-full">
        <Breadcrumb back={{ label: "Home", href: "/" }} current="Contact" />

        <div className="mt-8 mb-4">
          <div className="eyebrow mb-4">Contact</div>
          <h1 className="font-serif text-[clamp(40px,6vw,64px)] font-normal leading-[1.05] tracking-[-0.02em] text-fg mb-5">
            Talk to us.
          </h1>
          <p className="text-lg text-fg-muted leading-[1.6] font-light">
            Product access, a custom benchmarking engagement, a partnership — or a correction
            to something we&apos;ve published. Tell us which, and what you need.
          </p>
        </div>

        <ContactForm />
      </main>
      <Footer />
      <GitHubStarPopup />
    </div>
  );
}
