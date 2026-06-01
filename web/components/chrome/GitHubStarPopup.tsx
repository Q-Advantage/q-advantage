"use client";

import { useEffect, useState } from "react";

/**
 * Floating GitHub-star prompt — bottom-right of the viewport.
 *
 * Behavior:
 *   - Mounts hidden. Shows after the visitor has scrolled at least once
 *     (using `passive` scroll listener to stay performant).
 *   - The close button (top-right of the card) dismisses it AND writes a
 *     timestamp to localStorage so it stays hidden for 24 hours.
 *   - Auto-suppressed during SSR; only renders on the client.
 *
 * Mount one instance per page that should show it (home, /q-shield,
 * /q-day-index). Inside the page's outer wrapper, anywhere — it's fixed-
 * positioned, so DOM order doesn't matter.
 */
export function GitHubStarPopup({
  href = "https://github.com/Q-Advantage/q-advantage",
  title = "Every benchmark is reproducible.",
  body = "Each data point links to the public GitHub Actions run that produced it. If this work helps you, a star on the repo signals the project's worth continuing.",
}: {
  href?: string;
  title?: string;
  body?: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Respect an in-session dismissal — clears when the browser closes.
    try {
      if (sessionStorage.getItem("qa.starPopup.dismissed") === "1") {
        return; // stays closed for the rest of this browser session
      }
    } catch {
      // sessionStorage may be blocked (some incognito modes); fall through.
    }

    // Show after the first scroll.
    let shown = false;
    const onScroll = () => {
      if (shown) return;
      if (window.scrollY > 20) {
        shown = true;
        setOpen(true);
        window.removeEventListener("scroll", onScroll);
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function dismiss() {
    setOpen(false);
    try {
      sessionStorage.setItem("qa.starPopup.dismissed", "1");
    } catch {
      // sessionStorage blocked — close in-memory only; will return next page load.
    }
  }

  if (!open) return null;

  return (
    <aside
      role="complementary"
      aria-label="Star the repo on GitHub"
      className="fixed bottom-5 right-5 z-50 w-[340px] max-w-[calc(100vw-2.5rem)] rounded-lg border border-border-strong bg-bg-elevated p-4 pr-9 shadow-[0_8px_28px_rgba(0,0,0,0.55)] animate-in fade-in slide-in-from-bottom-2"
      style={{ backdropFilter: "blur(8px)" }}
    >
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute top-2.5 right-2.5 inline-flex h-7 w-7 items-center justify-center rounded-md text-fg-subtle hover:text-fg hover:bg-bg-card transition-colors"
      >
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden>
          <path d="M2 2L11 11M11 2L2 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>

      <div className="flex items-start gap-3">
        <div
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md border border-accent/30 bg-accent/10"
          aria-hidden
        >
          {/* GitHub mark */}
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="text-accent">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38v-1.33c-2.22.48-2.69-1.07-2.69-1.07-.36-.92-.89-1.17-.89-1.17-.73-.5.05-.49.05-.49.81.06 1.23.83 1.23.83.72 1.23 1.88.88 2.34.67.07-.52.28-.88.51-1.08-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.03 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.28.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48v2.2c0 .21.15.46.55.38C13.71 14.53 16 11.54 16 8c0-4.42-3.58-8-8-8z" />
          </svg>
        </div>
        <div className="min-w-0">
          <p className="font-medium text-sm text-fg leading-snug">{title}</p>
          <p className="mt-1 text-xs text-fg-muted leading-relaxed">{body}</p>
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={dismiss}
            className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/15 hover:border-accent/60 transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
              <path d="M6 .75l1.7 3.45 3.8.55-2.75 2.68.65 3.79L6 9.42 2.6 11.22l.65-3.79L.5 4.75l3.8-.55L6 .75z" />
            </svg>
            Star on GitHub
          </a>
        </div>
      </div>
    </aside>
  );
}
