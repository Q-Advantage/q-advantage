import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";

/**
 * Typography — one face, doing every job.
 *
 * DM Sans carries display, body, data and numerals alike. That is not a
 * shortcut: it is what InferenceX does, checked directly against their live
 * stylesheet, and it is the right call for a measurement brand where the
 * digits ARE the product and a second family would make them read as a
 * different voice. Tabular figures come from `font-variant-numeric` in
 * globals.css, not from a monospace fallback.
 *
 * Loaded as a variable font so every weight from 100–1000 is available
 * without shipping a face per weight.
 */
const dmSans = DM_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
  axes: ["opsz"],
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

// Runs before first paint so a stored "dark" choice applies immediately —
// otherwise the page flashes the light default and then jumps. Light needs no
// attribute: it is the bare :root palette.
//
// "navy" was retired in work-order 005; anyone still holding it in
// localStorage falls through to the light default rather than a broken theme.
const THEME_INIT_SCRIPT = `
(function () {
  try {
    if (localStorage.getItem("qadv-theme") === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
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
    <html lang="en" className={dmSans.variable}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="font-sans bg-bg text-fg antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
