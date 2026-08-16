import type { Metadata } from "next";
import { PageShell } from "@/components/chrome/PageShell";
import { GitHubStarPopup } from "@/components/chrome/GitHubStarPopup";
import { QDayFeedbackForm } from "@/components/chrome/QDayFeedbackForm";
import { getQDayIndex } from "@/lib/data/q-day";
import QDayIndexView from "@/components/data/QDayIndexView";

export const metadata: Metadata = {
  title: "Q-Day Index — distance to breaking RSA-2048",
  description:
    "A 0–100 measure of how close today's quantum hardware is to breaking RSA-2048, " +
    "scored against a named, published resource estimate. Threat today is low single " +
    "digits; the trajectory is the story. Receipts, not press releases.",
};

export default function QDayIndexPage() {
  const data = getQDayIndex();
  return (
    <>
      <PageShell variant="frame">
        <div className="mt-6">
          <QDayIndexView data={data} />
        </div>
        <QDayFeedbackForm />
      </PageShell>
      <GitHubStarPopup />
    </>
  );
}
