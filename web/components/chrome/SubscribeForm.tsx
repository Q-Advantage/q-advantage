"use client";

import { useState, FormEvent } from "react";

/**
 * Subscribe form for the briefing.
 *
 * Posts to /api/subscribe which forwards to Beehiiv. The serverless route
 * owns the API key — never exposed to the client.
 *
 * UX is deliberately minimal: single email field, button, inline status line.
 * The form retains state on error so retries don't lose the typed email.
 */
export function SubscribeForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState<string>("");

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;

    setStatus("loading");
    setMessage("");

    try {
      const response = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        setStatus("success");
        setMessage("\u2713 Subscribed. Check your inbox to confirm.");
        setEmail("");
      } else {
        setStatus("error");
        setMessage(
          data?.error ||
            (response.status === 429
              ? "Too many requests. Try again in a minute."
              : "Something went wrong. Try again."),
        );
      }
    } catch {
      setStatus("error");
      setMessage("Network error. Email hello@qadvantage.io and we'll add you.");
    }
  }

  return (
    <>
      <form
        onSubmit={onSubmit}
        className="flex flex-col sm:flex-row gap-2 bg-bg-card border border-border-strong rounded-lg p-1.5 focus-within:border-fg-muted transition-colors"
      >
        <label htmlFor="subscribe-email" className="sr-only">
          Email address
        </label>
        <input
          id="subscribe-email"
          type="email"
          name="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          required
          autoComplete="email"
          className="flex-1 bg-transparent border-0 text-fg px-3.5 py-3 text-[15px] font-sans outline-none placeholder:text-fg-subtle"
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className="bg-fg text-bg border-0 px-5 py-3 rounded-md font-sans text-sm font-medium cursor-pointer transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto w-full"
        >
          {status === "loading" ? "Subscribing\u2026" : "Subscribe"}
        </button>
      </form>

      <noscript>
        <div className="mt-5 text-sm text-fg-muted">
          JavaScript is required to subscribe. Email{" "}
          <a href="mailto:hello@qadvantage.io" className="text-fg">
            hello@qadvantage.io
          </a>{" "}
          and we&apos;ll add you.
        </div>
      </noscript>

      {message && (
        <div
          role={status === "error" ? "alert" : "status"}
          aria-live="polite"
          className={`mt-4 text-sm transition-opacity ${
            status === "error" ? "text-status-err" : "text-accent"
          }`}
        >
          {message}
        </div>
      )}
    </>
  );
}
