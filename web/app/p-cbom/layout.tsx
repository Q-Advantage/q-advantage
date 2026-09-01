import { ProductHeader, type ProductTab } from "@/components/chrome/ProductHeader";
import { Footer } from "@/components/chrome/Footer";

/**
 * P-CBOM's shell.
 *
 * It had none. The root layout renders bare children, and only /q-shield/*
 * carried a header — so this page arrived with no navigation, no footer and no
 * way back, which is why it read as a different site from the rest of the
 * product surface rather than as part of it.
 */
const TABS: ProductTab[] = [
  { label: "Generator", href: "/p-cbom" },
  { label: "The data behind it", href: "/q-shield" },
  { label: "Methodology", href: "/methodology" },
];

export default function PcbomLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <ProductHeader name="P-CBOM" accentSplit="-" tabs={TABS} homeHref="/p-cbom" />
      {children}
      <Footer />
    </div>
  );
}
