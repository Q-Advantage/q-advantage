"use client";
// web/components/data/ShareButton.tsx
//
// Shares/copies the current URL (including query state, e.g. ?a=&b=&op=).
// Web Share API where available (mobile), clipboard fallback otherwise —
// matches the InferenceX-parity ask in qshield-update-spec.md §5.

import { useState } from "react";
import { Share2, Check } from "lucide-react";

export function ShareButton({ title }: { title?: string }) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // User cancelled or Web Share unsupported for this context — fall
        // through to clipboard.
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API blocked (e.g. insecure context) — nothing more to do
      // gracefully; the button simply doesn't visibly respond.
    }
  }

  return (
    <button
      onClick={handleShare}
      className="inline-flex items-center gap-1.5 text-xs text-fg-muted hover:text-accent transition-colors border border-border rounded px-2.5 py-1.5"
    >
      {copied ? <Check className="size-3.5" /> : <Share2 className="size-3.5" />}
      {copied ? "Copied" : "Share"}
    </button>
  );
}
