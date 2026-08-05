import type { Metadata } from "next";
import { Inter_Tight, Instrument_Serif } from "next/font/google";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

/**
 * Typography — two distinct faces, not one face doing double duty.
 *
 * Inter Tight for body/UI text; Instrument Serif (italic for editorial
 * signature phrases — "measured.", "a commit hash.") for display headings.
 * Geist Mono for numbers, mono cells, eyebrow labels.
 */
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

// Runs before first paint so the stored theme choice (dark/light/navy)
// applies immediately — otherwise the page would flash the default dark
// theme and then jump to the visitor's saved choice.
const THEME_INIT_SCRIPT = `
(function () {
  try {
    var t = localStorage.getItem("qadv-theme");
    if (t === "light" || t === "navy") {
      document.documentElement.setAttribute("data-theme", t);
    }
  } catch (e) {}
})();
`;

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
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="font-sans bg-bg text-fg antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
