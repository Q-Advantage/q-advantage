import type { Metadata } from "next";
import { Inter_Tight, Instrument_Serif } from "next/font/google";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

const interTight = Inter_Tight({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
  weight: ["300", "400", "500", "600"],
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-serif",
  weight: "400",
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://qadvantage.io"),
  title: {
    default: "Q-Advantage — The intelligence layer for the quantum era",
    template: "%s · Q-Advantage",
  },
  description:
    "Q-Advantage builds independent, public benchmarks for the quantum era. Q-Day Index, Q-Shield, Q-Arena — measurable signal, transparent methodology, daily on GitHub.",
  openGraph: {
    type: "website",
    siteName: "Q-Advantage",
    title: "Q-Advantage — The intelligence layer for the quantum era",
    description: "Daily benchmarks. Open methodology. Auditable on GitHub.",
    url: "https://qadvantage.io",
  },
  twitter: {
    card: "summary_large_image",
    title: "Q-Advantage — The intelligence layer for the quantum era",
    description: "Daily benchmarks. Open methodology. Auditable on GitHub.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${interTight.variable} ${instrumentSerif.variable} ${GeistMono.variable} dark`}
    >
      <body className="font-sans bg-bg text-fg antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
