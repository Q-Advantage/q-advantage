"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";

/**
 * Corrections intake form — /corrections, linked from every PQC Readiness
 * Index page. Same zero-infrastructure mailto: pattern as ContactForm and
 * QDayFeedbackForm: no server-side handling, no new secrets.
 *
 * Institution ID pre-fills from a ?institution= query param when arriving
 * via a per-institution page's "Request a correction" link.
 */

const TO = "corrections@qadvantage.io";
const MAX_DESCRIPTION = 2000;

export function CorrectionForm() {
  const searchParams = useSearchParams();
  const prefillInstitution = searchParams.get("institution") ?? "";

  const [institution, setInstitution] = useState(prefillInstitution);
  const [claimedValue, setClaimedValue] = useState("");
  const [description, setDescription] = useState("");
  const [contact, setContact] = useState("");

  const remaining = MAX_DESCRIPTION - description.length;
  const overLimit = remaining < 0;
  const canSubmit = description.trim() !== "" && !overLimit;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    const subject = `[Correction] ${institution.trim() || "index-wide"}`;
    const body =
      `Institution/row: ${institution.trim() || "(not specified)"}\n` +
      `What you believe the correct value is: ${claimedValue.trim() || "(not specified)"}\n` +
      `Reporter contact (optional): ${contact.trim() || "(not provided)"}\n\n` +
      `${description}\n\n` +
      `---\n` +
      `Sent from qadvantage.io/corrections`;

    window.location.href = `mailto:${TO}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-5 max-w-xl">
      <label className="flex flex-col gap-1.5">
        <span className="text-xs text-fg-muted font-medium">Institution or row (if applicable)</span>
        <input
          type="text"
          placeholder="e.g. the institution's name, or leave blank for an index-wide issue"
          value={institution}
          onChange={(e) => setInstitution(e.target.value)}
          className="bg-bg-card border border-border-strong rounded-md px-3 py-2.5 text-sm text-fg placeholder:text-fg-subtle focus:outline-none focus:border-accent transition-colors"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs text-fg-muted font-medium">What you believe is wrong</span>
        <div className="flex items-baseline justify-between">
          <span />
          <span className={`font-mono text-2xs tracking-eyebrow ${overLimit ? "text-status-warn" : "text-fg-subtle"}`}>
            {remaining} / {MAX_DESCRIPTION}
          </span>
        </div>
        <textarea
          required
          rows={5}
          placeholder="What's wrong, and how you know — a hostname that's not theirs, a stale scan, anything else."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="bg-bg-card border border-border-strong rounded-md px-3 py-2.5 text-sm text-fg placeholder:text-fg-subtle focus:outline-none focus:border-accent transition-colors resize-y font-sans"
          style={{ minHeight: "120px" }}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs text-fg-muted font-medium">What you believe the correct value should be (optional)</span>
        <input
          type="text"
          placeholder="Optional, if you know it"
          value={claimedValue}
          onChange={(e) => setClaimedValue(e.target.value)}
          className="bg-bg-card border border-border-strong rounded-md px-3 py-2.5 text-sm text-fg placeholder:text-fg-subtle focus:outline-none focus:border-accent transition-colors"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs text-fg-muted font-medium">Your contact (optional)</span>
        <input
          type="text"
          placeholder="Optional — you don't need to be the rated institution, or identify yourself at all"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          className="bg-bg-card border border-border-strong rounded-md px-3 py-2.5 text-sm text-fg placeholder:text-fg-subtle focus:outline-none focus:border-accent transition-colors"
        />
      </label>

      <div className="flex items-center gap-4 flex-wrap">
        <button
          type="submit"
          disabled={!canSubmit}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-accent text-accent-fg text-sm font-medium hover:opacity-90 hover:-translate-y-px transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
        >
          Send report
          <span aria-hidden>→</span>
        </button>
        <span className="text-xs text-fg-subtle">Opens your email app, addressed to {TO}.</span>
      </div>
    </form>
  );
}
