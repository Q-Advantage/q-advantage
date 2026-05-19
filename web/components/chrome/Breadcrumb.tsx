import Link from "next/link";
import { ChevronLeft } from "lucide-react";

interface BreadcrumbProps {
  /** Where to go back to (label + href) */
  back: { label: string; href: string };
  /** Optional current-page label shown after a separator */
  current?: string;
}

/**
 * Simple top-left back navigation for dashboard pages.
 * Mirrors the InferenceX pattern: tiny chevron + back-link label, optionally
 * with a separator and the current page name.
 */
export function Breadcrumb({ back, current }: BreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs">
      <Link
        href={back.href}
        className="inline-flex items-center gap-1 text-fg-muted hover:text-fg transition-colors"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
        <span>{back.label}</span>
      </Link>
      {current && (
        <>
          <span className="text-fg-faint">/</span>
          <span className="text-fg-subtle">{current}</span>
        </>
      )}
    </nav>
  );
}
