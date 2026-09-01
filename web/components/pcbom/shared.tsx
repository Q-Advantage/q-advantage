"use client";

/** Controls shared by both P-CBOM capabilities, so the two tabs match. */

export const inputClass =
  "h-9 w-full min-w-0 rounded border border-border bg-bg-surface px-2.5 text-[13px] font-semibold text-fg " +
  "transition-colors hover:border-border-strong focus:outline-none focus:ring-1 focus:ring-accent";

export function ActionButton({
  onClick,
  children,
  primary,
  disabled,
}: {
  onClick: () => void;
  children: React.ReactNode;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`h-8 shrink-0 rounded border px-2.5 text-[12px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        primary
          ? "border-accent bg-accent/10 text-fg hover:bg-accent/20"
          : "border-border bg-bg-surface text-fg-muted hover:border-border-strong hover:text-fg"
      }`}
    >
      {children}
    </button>
  );
}

export function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
