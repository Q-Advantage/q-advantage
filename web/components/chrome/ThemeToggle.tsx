"use client";

import { useEffect, useState } from "react";
import { Moon, Sun, Waves } from "lucide-react";

/**
 * Three-way theme switch — dark (default), light, navy.
 *
 * Persists to localStorage; the actual paint happens via `data-theme` on
 * <html>, read by the CSS custom properties in globals.css. A synchronous
 * inline script in layout.tsx sets the attribute before first paint so
 * there's no flash of the wrong theme on load.
 */

export type Theme = "dark" | "light" | "navy";
export const THEME_STORAGE_KEY = "qadv-theme";

const THEMES: { value: Theme; label: string; Icon: typeof Sun }[] = [
  { value: "dark", label: "Default", Icon: Moon },
  { value: "light", label: "Light", Icon: Sun },
  { value: "navy", label: "Navy", Icon: Waves },
];

export function ThemeToggle({ className = "" }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme") as Theme | null;
    setTheme(current ?? "dark");
    setMounted(true);
  }, []);

  function applyTheme(next: Theme) {
    setTheme(next);
    window.localStorage.setItem(THEME_STORAGE_KEY, next);
    document.documentElement.setAttribute("data-theme", next);
  }

  return (
    <div
      role="radiogroup"
      aria-label="Color theme"
      className={`inline-flex items-center gap-0.5 rounded-md border border-border-strong p-0.5 ${className}`}
      style={{ visibility: mounted ? "visible" : "hidden" }}
    >
      {THEMES.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={theme === value}
          aria-label={label}
          title={label}
          onClick={() => applyTheme(value)}
          className={`inline-flex items-center justify-center w-7 h-7 rounded transition-colors ${
            theme === value
              ? "bg-accent text-accent-fg"
              : "text-fg-muted hover:text-fg hover:bg-bg-elevated"
          }`}
        >
          <Icon className="w-3.5 h-3.5" aria-hidden />
        </button>
      ))}
    </div>
  );
}
