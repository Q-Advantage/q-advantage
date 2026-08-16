import type { ReactNode } from "react";

/**
 * Article typography.
 *
 * Written as explicit small components rather than a `prose` plugin so the
 * measure, rhythm and colour all resolve through the site's own tokens — an
 * article should read as the same publication as the dashboard, not as a
 * bolted-on blog theme.
 */

export function Prose({ children }: { children: ReactNode }) {
  return <div className="max-w-[68ch] text-[16px] leading-[1.72] text-fg-muted">{children}</div>;
}

export function P({ children }: { children: ReactNode }) {
  return <p className="mb-5">{children}</p>;
}

export function H2({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-3 mt-10 text-balance text-[22px] font-bold leading-tight tracking-[-0.02em] text-fg">
      {children}
    </h2>
  );
}

/** Inline emphasis that should read as the author's voice, not as a shout. */
export function Strong({ children }: { children: ReactNode }) {
  return <strong className="font-bold text-fg">{children}</strong>;
}

export function Code({ children }: { children: ReactNode }) {
  return (
    <code className="rounded border border-border-subtle bg-bg-surface px-1.5 py-0.5 font-code text-[13.5px] text-fg">
      {children}
    </code>
  );
}

export function A({ href, children }: { href: string; children: ReactNode }) {
  const external = href.startsWith("http");
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className="font-semibold text-link underline underline-offset-2 hover:no-underline"
    >
      {children}
    </a>
  );
}

/**
 * A pulled-out caveat. Used where a number is soft and the reader deserves to
 * know before they quote it.
 */
export function Note({ children }: { children: ReactNode }) {
  return (
    <aside className="my-7 rounded-lg border border-border border-l-[3px] border-l-accent bg-bg-card px-5 py-4 text-[14.5px] leading-relaxed">
      {children}
    </aside>
  );
}

export function UL({ children }: { children: ReactNode }) {
  return <ul className="mb-5 list-disc space-y-2 pl-5 marker:text-fg-faint">{children}</ul>;
}
