import { ProductHeader } from "@/components/chrome/ProductHeader";
import { Footer } from "@/components/chrome/Footer";
import { BrandClose } from "@/components/chrome/BrandClose";

export default function CalculatorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <ProductHeader name="PQC Cost Calculator" tabs={[]} homeHref="/calculator" />
      {children}
      <Footer />
      <BrandClose />
    </div>
  );
}
