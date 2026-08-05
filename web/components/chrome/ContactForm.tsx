"use client";

import { useState } from "react";

/**
 * Universal contact form — mounted on /contact, linked from the header CTA.
 *
 * Same zero-infrastructure pattern as QDayFeedbackForm: submission opens the
 * visitor's mail client (mailto:) pre-filled with the structured fields,
 * addressed to hello@qadvantage.io. No server-side form handling, no new
 * secrets to provision.
 */

const TO = "hello@qadvantage.io";
const MAX_MESSAGE = 2000;

export function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  const remaining = MAX_MESSAGE - message.length;
  const overLimit = remaining < 0;
  const canSubmit = email.trim() !== "" && message.trim() !== "" && !overLimit;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    const subject = `[Contact] ${name.trim() || email}`;
    const body =
      `Name: ${name.trim() || "(not provided)"}\n` +
      `From: ${email}\n\n` +
      `${message}\n\n` +
      `---\n` +
      `Sent from qadvantage.io/contact`;

    const mailto = `mailto:${TO}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-5 max-w-xl">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-fg-muted font-medium">Your name</span>
          <input
            type="text"
            placeholder="Jane Doe"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="bg-bg-card border border-border-strong rounded-md px-3 py-2.5 text-sm text-fg placeholder:text-fg-subtle focus:outline-none focus:border-accent transition-colors"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-fg-muted font-medium">Your email</span>
          <input
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="bg-bg-card border border-border-strong rounded-md px-3 py-2.5 text-sm text-fg placeholder:text-fg-subtle focus:outline-none focus:border-accent transition-colors"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between">
          <span className="text-xs text-fg-muted font-medium">Message</span>
          <span
            className={`font-mono text-2xs tracking-eyebrow ${
              overLimit ? "text-status-warn" : "text-fg-subtle"
            }`}
          >
            {remaining} / {MAX_MESSAGE}
          </span>
        </div>
        <textarea
          required
          rows={7}
          placeholder="What can we help with?"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="bg-bg-card border border-border-strong rounded-md px-3 py-2.5 text-sm text-fg placeholder:text-fg-subtle focus:outline-none focus:border-accent transition-colors resize-y font-sans"
          style={{ minHeight: "160px" }}
        />
      </label>

      <div className="flex items-center gap-4 flex-wrap">
        <button
          type="submit"
          disabled={!canSubmit}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-accent text-bg text-sm font-medium hover:opacity-90 hover:-translate-y-px transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
        >
          Send via your mail client
          <span aria-hidden>→</span>
        </button>
        <span className="text-xs text-fg-subtle">
          Opens your email app addressed to {TO}. We never store form data on this site.
        </span>
      </div>
    </form>
  );
}
