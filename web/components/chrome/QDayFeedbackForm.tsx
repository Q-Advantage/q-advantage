"use client";

import { useState } from "react";

/**
 * Q-Day Index feedback form.
 *
 * Submission opens the visitor's mail client (mailto:) pre-filled with the
 * structured fields. Zero new infrastructure; can be swapped for an API
 * route + transactional provider later without breaking the UX.
 *
 * Char limit on the message is enforced client-side AND surfaced as a
 * live counter. Long-form arguments are directed to GitHub Issues, which
 * is the right venue for traceable, public critique.
 *
 * Mounted at the bottom of /q-day-index.
 */

const TO = "hello@qadvantage.io";
const ISSUES_URL = "https://github.com/Q-Advantage/q-advantage/issues/new";
const MAX_MESSAGE = 1000;

const TOPICS = [
  { value: "critique", label: "Critique — challenge a number or claim" },
  { value: "question", label: "Question — ask us to clarify something" },
  { value: "suggestion", label: "Suggestion — propose a system, source, or method change" },
] as const;

type TopicValue = (typeof TOPICS)[number]["value"];

export function QDayFeedbackForm() {
  const [topic, setTopic] = useState<TopicValue>("critique");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  const remaining = MAX_MESSAGE - message.length;
  const overLimit = remaining < 0;
  const canSubmit = email.trim() !== "" && message.trim() !== "" && !overLimit;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    const topicLabel = TOPICS.find((t) => t.value === topic)?.label ?? topic;
    const subject = `[Q-Day Index] ${TOPICS.find((t) => t.value === topic)?.label.split(" — ")[0] ?? topic}`;
    const body =
      `Topic: ${topicLabel}\n` +
      `From: ${email}\n\n` +
      `${message}\n\n` +
      `---\n` +
      `Sent from qadvantage.io/q-day-index`;

    const mailto = `mailto:${TO}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;
  }

  return (
    <section className="mt-16 border-t border-border pt-12">
      <div className="max-w-2xl">
        <div className="eyebrow mb-3">Invite scrutiny</div>
        <h2 className="font-serif text-[clamp(28px,3.5vw,40px)] font-normal leading-[1.1] tracking-[-0.02em] text-fg">
          See a number you disagree with?
        </h2>
        <p className="mt-3 text-base text-fg-muted leading-relaxed font-light">
          This index is only as good as the scrutiny it survives. If a spec is wrong, a source is weak, a
          method tag is misapplied, or a system is missing — tell us. Concrete corrections improve every
          subsequent run. For long-form critique or anything you want a public record of,{" "}
          <a
            href={ISSUES_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:text-fg transition-colors underline decoration-accent/40 underline-offset-2"
          >
            open a GitHub Issue
          </a>{" "}
          instead.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-fg-muted font-medium">Topic</span>
              <select
                value={topic}
                onChange={(e) => setTopic(e.target.value as TopicValue)}
                className="bg-bg-card border border-border-strong rounded-md px-3 py-2.5 text-sm text-fg focus:outline-none focus:border-accent transition-colors"
              >
                {TOPICS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
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
              rows={6}
              placeholder="Be specific. Cite a row, a number, a source URL — the more concrete, the more useful."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="bg-bg-card border border-border-strong rounded-md px-3 py-2.5 text-sm text-fg placeholder:text-fg-subtle focus:outline-none focus:border-accent transition-colors resize-y font-sans"
              style={{ minHeight: "140px" }}
            />
          </label>

          <div className="flex items-center gap-4 flex-wrap">
            <button
              type="submit"
              disabled={!canSubmit}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-fg text-bg text-sm font-medium hover:opacity-90 hover:-translate-y-px transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            >
              Send via your mail client
              <span aria-hidden>→</span>
            </button>
            <span className="text-xs text-fg-subtle">
              Opens your email app with the message pre-filled. We never store form data on this site.
            </span>
          </div>
        </form>
      </div>
    </section>
  );
}
