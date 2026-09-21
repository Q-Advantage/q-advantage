import { ProductHeader } from "@/components/chrome/ProductHeader";
import { Footer } from "@/components/chrome/Footer";
import { BrandClose } from "@/components/chrome/BrandClose";

export default function PcbomLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <ProductHeader name="P-CBOM" accentSplit="-" tabs={[]} homeHref="/p-cbom" />
      {children}
      <Footer />
      <BrandClose />
    </div>
  );
}
