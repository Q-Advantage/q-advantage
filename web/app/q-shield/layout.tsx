import { ProductHeader, type ProductTab } from "@/components/chrome/ProductHeader";
import { Footer } from "@/components/chrome/Footer";

/**
 * Q-Shield's shell. Every route under /q-shield gets the product header
 * instead of the company one, so the instrument reads as its own property
 * rather than as a section of the marketing site.
 */
const TABS: ProductTab[] = [
  { label: "Overview", href: "/q-shield" },
  { label: "Compare", href: "/q-shield/compare" },
  { label: "Protocols", href: "/q-shield/protocols" },
  { label: "Methodology", href: "/methodology" },
];

// TAKEN OFFLINE 2026-08-30, deliberately, and not by deleting the code.
//
//   { label: "Layer B", href: "/q-shield/layer-b" },
//   { label: "CFDIR",   href: "/q-shield/cfdir"   },
//
// Both routes still build, still load their data and still pass their tests.
// What they lack is a reason for a reader to be on them.
//
// LAYER B is an internal architecture name on a public tab. Nobody outside
// this repo knows what "Layer B" is, and the page went on to explain itself in
// our own working vocabulary rather than in a customer's. It comes back when it
// has a name that means something to a stranger and a page that reads top to
// bottom.
//
// CFDIR is not coming back as a tab at all. Scoring ourselves against someone
// else's framework, in public, reads as derivative — the opposite of the
// impression the measurements themselves make. Its two real findings
// (certificate-chain sizing and JOSE token sizing) belong on Protocols, in our
// own voice, as things we measured because they matter.

export default function QShieldLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <ProductHeader name="Q-Shield" accentSplit="-" tabs={TABS} />
      {children}
      <Footer />
    </div>
  );
}
