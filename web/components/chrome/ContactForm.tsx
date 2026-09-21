"use client";

import { useState } from "react";

/**
 * Universal contact form — mounted on /contact, linked from the header CTA.
 *
 * Same zero-infrastructure pattern as QDayFeedbackForm: submission opens the
 * visitor's mail client (mailto:) pre-filled with the structured fields,
 * addressed to hello@qadvantage.io. No server-side form handling, no new
 * secrets to provision.
 *
 * Reason defaults to the core customer job: building a migration cost model.
 */

const TO = "hello@qadvantage.io";
const MAX_MESSAGE = 2000;

const REASONS = [
  { value: "model", label: "Build a migration cost model" },
  { value: "budget", label: "Prepare a budget range" },
  { value: "evidence", label: "Understand benchmark evidence" },
  { value: "planning", label: "Plan a migration programme" },
  { value: "other", label: "Other" },
] as const;

type ReasonValue = (typeof REASONS)[number]["value"];

export function ContactForm() {
  const [reason, setReason] = useState<ReasonValue>("model");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [message, setMessage] = useState("");

  const remaining = MAX_MESSAGE - message.length;
  const overLimit = remaining < 0;
  const canSubmit = email.trim() !== "" && message.trim() !== "" && !overLimit;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    const reasonLabel = REASONS.find((r) => r.value === reason)?.label ?? reason;
    const subject = `[${reasonLabel}] ${name.trim() || email}`;
    const body =
      `Reason: ${reasonLabel}\n` +
      `Name: ${name.trim() || "(not provided)"}\n` +
      `Company: ${company.trim() || "(not provided)"}\n` +
      `From: ${email}\n\n` +
      `${message}\n\n` +
      `---\n` +
      `Sent from qadvantage.io/contact`;

    const mailto = `mailto:${TO}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;
  }

  return (
    <form onSubmit={handleSubmit} className="cp-contact-form">
      <label className="cp-contact-field">
        <span>What do you need to price?</span>
        <select
          value={reason}
          onChange={(e) => setReason(e.target.value as ReasonValue)}
        >
          {REASONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </label>

      <div className="cp-contact-field-row">
        <label className="cp-contact-field">
          <span>Your name</span>
          <input
            type="text"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="cp-contact-field">
          <span>Company</span>
          <input
            type="text"
            placeholder="Company name"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
          />
        </label>
      </div>

      <label className="cp-contact-field">
        <span>Work email</span>
        <input
          type="email"
          required
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>

      <label className="cp-contact-field">
        <div className="cp-contact-label-row">
          <span>What decision are you preparing for?</span>
          <span
            className={`cp-contact-count ${overLimit ? "is-over" : ""}`}
          >
            {remaining} / {MAX_MESSAGE}
          </span>
        </div>
        <textarea
          required
          rows={6}
          placeholder="Tell us about your cryptographic estate, planning horizon, or the budget question you need to answer."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
      </label>

      <div className="cp-contact-submit">
        <button
          type="submit"
          disabled={!canSubmit}
        >
          Talk to our team
          <span aria-hidden>→</span>
        </button>
        <span>
          Opens your email app, addressed to {TO}.
        </span>
      </div>
    </form>
  );
}
