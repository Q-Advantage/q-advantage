import { NextResponse } from "next/server";

/**
 * POST /api/subscribe
 *
 * Forwards the email to the Beehiiv API. Configured via env vars:
 *  - BEEHIIV_API_KEY      — secret bearer token for Beehiiv API
 *  - BEEHIIV_PUBLICATION_ID — publication ID (format: "pub_<uuid>")
 *
 * Returns 200 on success, 4xx/5xx on validation or upstream errors.
 * The API key never reaches the browser.
 *
 * Carries over the same shape used by the original marketing-site /api/subscribe.js
 * so existing Vercel env vars work without renaming.
 */
export const runtime = "edge"; // fast cold-start, no Node-specific APIs

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface SubscribeRequest {
  email?: string;
}

export async function POST(request: Request) {
  let body: SubscribeRequest;
  try {
    body = (await request.json()) as SubscribeRequest;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json(
      { error: "Please enter a valid email address." },
      { status: 400 },
    );
  }

  const apiKey = process.env.BEEHIIV_API_KEY;
  const publicationId = process.env.BEEHIIV_PUB_ID;

  if (!apiKey || !publicationId) {
    // Fail loudly in dev, gracefully in prod. In prod the env vars must be set
    // in Vercel; missing them is a deployment misconfiguration, not a user
    // problem, so we don't leak the cause to the client.
    console.error("[/api/subscribe] Missing BEEHIIV_API_KEY or BEEHIIV_PUB_ID");
    return NextResponse.json(
      { error: "Subscription service is temporarily unavailable. Email hello@qadvantage.io to subscribe." },
      { status: 503 },
    );
  }

  const beehiivUrl = `https://api.beehiiv.com/v2/publications/${publicationId}/subscriptions`;

  try {
    const upstream = await fetch(beehiivUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        email,
        reactivate_existing: true,
        send_welcome_email: true,
        utm_source: "qadvantage.io",
        utm_medium: "website",
        utm_campaign: "landing-page",
      }),
    });

    if (!upstream.ok) {
      // Beehiiv returns useful errors; surface a sanitized version
      const errBody = (await upstream.json().catch(() => null)) as { errors?: { message?: string }[] } | null;
      const detail = errBody?.errors?.[0]?.message;
      console.error(`[/api/subscribe] Beehiiv ${upstream.status}: ${detail ?? "unknown error"}`);
      return NextResponse.json(
        { error: detail || "Subscription failed. Try again or email hello@qadvantage.io." },
        { status: upstream.status },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[/api/subscribe] Network error:", err);
    return NextResponse.json(
      { error: "Network error. Try again or email hello@qadvantage.io." },
      { status: 502 },
    );
  }
}
