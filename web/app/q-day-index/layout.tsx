import { ProductHeader, type ProductTab } from "@/components/chrome/ProductHeader";
import { Footer } from "@/components/chrome/Footer";

/**
 * Q-Day Index shell — same standalone treatment as Q-Shield. A tool is its
 * own property; stacking the company nav above it made it read as a section
 * of the marketing site.
 */
const TABS: ProductTab[] = [
  { label: "Index", href: "/q-day-index" },
  { label: "Methodology", href: "/methodology" },
];

export default function QDayLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <ProductHeader name="Q-Day Index" tabs={TABS} />
      {children}
      <Footer />
    </div>
  );
}
