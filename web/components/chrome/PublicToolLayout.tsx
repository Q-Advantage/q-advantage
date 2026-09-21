import type { ReactNode } from "react";
import { BrandClose } from "./BrandClose";
import { Footer } from "./Footer";
import { Header } from "./Header";

export function PublicToolLayout({ children }: { children: ReactNode }) {
  return (
    <div className="coldproof-site cp-public-tool min-h-screen">
      <Header />
      <div className="cp-public-tool-content">{children}</div>
      <Footer />
      <BrandClose />
    </div>
  );
}
