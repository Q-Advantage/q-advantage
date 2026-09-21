import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import localFont from "next/font/local";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import "./coldproof-v2.css";

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

const hostGrotesk = localFont({
  src: "./fonts/HostGrotesk-Variable.ttf",
  display: "swap",
  variable: "--font-host",
  weight: "100 900",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://qadvantage.io"),
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: "/favicon.ico",
  },
  title: {
    default: "Coldproof — Know the cost of post-quantum migration",
    template: "%s — Coldproof",
  },
  description:
    "Coldproof turns measured post-quantum cryptography performance into migration economics for enterprises, governments, and infrastructure operators.",
  openGraph: {
    type: "website",
    siteName: "Coldproof",
    title: "Coldproof — Know the cost of post-quantum migration",
    description: "Know the cost of post-quantum migration before you migrate.",
    url: "https://qadvantage.io",
  },
  twitter: {
    card: "summary_large_image",
    title: "Coldproof — Know the cost of post-quantum migration",
    description: "Know the cost of post-quantum migration before you migrate.",
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
    <html lang="en" className={`${dmSans.variable} ${hostGrotesk.variable} ${GeistMono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="font-sans bg-bg text-fg antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
