import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

/**
 * Typography — DM Sans is the single typeface for the whole site (matching
 * the InferenceX register). It serves BOTH --font-sans AND --font-serif so
 * every existing `font-serif` className keeps resolving to the intended
 * typeface without site-wide find/replace.
 *
 * Geist Mono is unchanged — used for numbers, mono cells, eyebrow labels.
 */
const dmSans = DM_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
  weight: ["300", "400", "500", "600", "700"],
  style: ["normal", "italic"],
});

// Alias the same font to --font-serif. next/font won't load it twice — this is
// just a CSS-variable alias declared in globals.css. See `@layer base` there.

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
      className={`${dmSans.variable} ${GeistMono.variable} dark`}
    >
      <body className="font-sans bg-bg text-fg antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
