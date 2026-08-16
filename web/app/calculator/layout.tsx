import { ProductHeader, type ProductTab } from "@/components/chrome/ProductHeader";
import { Footer } from "@/components/chrome/Footer";

/**
 * The calculator's shell. It is a product in its own right — it has its own
 * row in the site's product catalog — so it gets product chrome rather than
 * reading as a page of the marketing site.
 */
const TABS: ProductTab[] = [
  { label: "Calculator", href: "/calculator" },
  { label: "The data", href: "/q-shield/protocols" },
  { label: "Methodology", href: "/methodology" },
  { label: "Talk to us", href: "/contact" },
];

export default function CalculatorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <ProductHeader name="PQC Cost Calculator" tabs={TABS} />
      {children}
      <Footer />
    </div>
  );
}
