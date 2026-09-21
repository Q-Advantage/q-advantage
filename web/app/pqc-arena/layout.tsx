import { ProductHeader, type ProductTab } from "@/components/chrome/ProductHeader";
import { BrandClose } from "@/components/chrome/BrandClose";
import { Footer } from "@/components/chrome/Footer";

const TABS: ProductTab[] = [
  { label: "Overview", href: "/pqc-arena" },
  { label: "Compare", href: "/pqc-arena/compare" },
  { label: "Protocols", href: "/pqc-arena/protocols" },
  { label: "Trends", href: "/pqc-arena/trends" },
  { label: "Methodology", href: "/methodology" },
];

export default function PqcArenaLayout({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen flex-col"><ProductHeader name="PQC Arena" tabs={TABS} homeHref="/pqc-arena" />{children}<Footer /><BrandClose /></div>;
}
