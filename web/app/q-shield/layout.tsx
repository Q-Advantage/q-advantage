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
  { label: "Layer B", href: "/q-shield/layer-b" },
  { label: "CFDIR", href: "/q-shield/cfdir" },
  { label: "Methodology", href: "/methodology" },
];

export default function QShieldLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <ProductHeader name="Q-Shield" accentSplit="-" tabs={TABS} />
      {children}
      <Footer />
    </div>
  );
}
