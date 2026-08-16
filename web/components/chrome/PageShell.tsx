import type { ReactNode } from "react";

/**
 * The container every page's content sits in.
 *
 * This exists because work-order 005 shipped the new design tokens globally
 * but applied the *treatment* — the panel and frame containers — inline on
 * only two routes. The result was a site where the palette and typeface had
 * changed everywhere and the layout had changed nowhere, which reads as
 * "nothing happened." One shell, used by every page, is what stops that
 * recurring the next time the treatment is revised.
 *
 * Two variants, matching ADR 0005:
 *
 * - `panel` — a floating rounded panel on the contoured ground. The company's
 *   editorial surfaces: home, blog, about, methodology, policy pages.
 * - `frame` — one continuous framed grid, tighter radii, denser. Product and
 *   tool surfaces: Q-Shield and its sub-views, the Q-Day Index.
 *
 * The split is deliberate and is the whole point: clicking from the company
 * site into an instrument should feel like arriving somewhere else, the way
 * ClusterMAX and InferenceX read as separate properties.
 */

type Variant = "panel" | "frame";
type Width = "wide" | "narrow";

const MAX_WIDTH: Record<Width, string> = {
  wide: "max-w-[1200px]",
  narrow: "max-w-[880px]",
};

export function PageShell({
  variant = "panel",
  width = "wide",
  className = "",
  children,
}: {
  variant?: Variant;
  width?: Width;
  /** Extra classes for the inner container — usually spacing between sections. */
  className?: string;
  children: ReactNode;
}) {
  const box =
    variant === "frame"
      ? "overflow-hidden rounded border border-border bg-bg-card p-5 md:p-7"
      : "rounded-2xl border border-border bg-bg-card/55 p-6 md:p-8";

  return (
    <main className="w-full flex-1 pb-10 pt-5">
      <div className={`mx-auto w-full px-4 md:px-6 ${MAX_WIDTH[width]}`}>
        <div className={`${box} ${className}`}>{children}</div>
      </div>
    </main>
  );
}
