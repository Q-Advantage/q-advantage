"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

/**
 * Light / dark switch.
 *
 * Light is the default and carries no `data-theme` attribute — it is the bare
 * :root palette in globals.css. Only "dark" is ever stamped or stored, which
 * keeps the pre-paint init script in layout.tsx to a single comparison.
 *
 * The third "navy" theme was retired in work-order 005. A stored "navy" value
 * from before that simply reads as not-dark, so those visitors land on light
 * rather than on a theme that no longer has tokens behind it.
 */

export type Theme = "light" | "dark";
export const THEME_STORAGE_KEY = "qadv-theme";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme");
    setTheme(current === "dark" ? "dark" : "light");
    setMounted(true);
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Private browsing / storage disabled — the theme still applies for
      // this page view, it just won't persist. Not worth surfacing.
    }

    if (next === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
  }

  const Icon = theme === "dark" ? Sun : Moon;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      title={theme === "dark" ? "Light" : "Dark"}
      // Hidden until mounted so the icon can't contradict the painted theme
      // for a frame on hydration.
      style={{ visibility: mounted ? "visible" : "hidden" }}
      className={`inline-flex h-[34px] w-[34px] items-center justify-center rounded-lg border border-border text-fg-muted transition-colors hover:text-fg ${className}`}
    >
      <Icon className="h-4 w-4" aria-hidden />
    </button>
  );
}
