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
    default: "Q-Advantage — The intelligence layer for post-quantum cryptography",
    template: "%s · Q-Advantage",
  },
  description:
    "Independent, vendor-neutral benchmarks and analysis for the post-quantum transition. Q-Shield measures how the standardized PQC algorithms actually perform, every day.",
  openGraph: {
    type: "website",
    siteName: "Q-Advantage",
    title: "Q-Advantage — The intelligence layer for post-quantum cryptography",
    description: "Independent, vendor-neutral benchmarks and analysis for the post-quantum transition. Q-Shield measures standardized PQC algorithms every day; the Q-Day Index tracks quantum threat readiness.",
    url: "https://qadvantage.io",
  },
  twitter: {
    card: "summary_large_image",
    title: "Q-Advantage — The intelligence layer for post-quantum cryptography",
    description: "Independent, vendor-neutral benchmarks and analysis for the post-quantum transition. Q-Shield measures standardized PQC algorithms every day; the Q-Day Index tracks quantum threat readiness.",
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
