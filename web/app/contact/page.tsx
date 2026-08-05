import type { Metadata } from "next";
import { Header } from "@/components/chrome/Header";
import { Footer } from "@/components/chrome/Footer";
import { Breadcrumb } from "@/components/chrome/Breadcrumb";
import { ContactForm } from "@/components/chrome/ContactForm";
import { GitHubStarPopup } from "@/components/chrome/GitHubStarPopup";

export const metadata: Metadata = {
  title: "Contact — Q-Advantage",
  description:
    "Get in touch with Q-Advantage — questions, corrections, partnership or press inquiries.",
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
            Get in touch.
          </h1>
          <p className="text-lg text-fg-muted leading-[1.6] font-light">
            Questions, corrections, partnership or press inquiries — tell us what you need.
            We read every message and reply from a real inbox, not a ticketing queue.
          </p>
        </div>

        <ContactForm />
      </main>
      <Footer />
      <GitHubStarPopup />
    </div>
  );
}
