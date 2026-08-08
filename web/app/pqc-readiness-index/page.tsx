import type { Metadata } from "next";
import { Header } from "@/components/chrome/Header";
import { Footer } from "@/components/chrome/Footer";
import { Breadcrumb } from "@/components/chrome/Breadcrumb";
import { GitHubStarPopup } from "@/components/chrome/GitHubStarPopup";
import { getPQCReadinessIndex } from "@/lib/data/pqc-readiness";
import PQCReadinessIndexView from "@/components/data/PQCReadinessIndexView";

export const metadata: Metadata = {
  title: "PQC Readiness Index — key exchange vs. authentication, named",
  description:
    "Weekly-measured post-quantum TLS posture of named financial institutions, exchanges, " +
    "card networks, and certificate authorities. Two tracks, never merged: key exchange has " +
    "moved; authentication hasn't. Receipts, not press releases.",
};

export default function PQCReadinessIndexPage() {
  const data = getPQCReadinessIndex();
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 mx-auto max-w-[1200px] px-6 md:px-8 py-10 md:py-12 w-full">
        <Breadcrumb back={{ label: "Home", href: "/" }} current="PQC Readiness Index" />
        <div className="mt-6">
          <PQCReadinessIndexView data={data} />
        </div>
      </main>
      <Footer />
      <GitHubStarPopup />
    </div>
  );
}
