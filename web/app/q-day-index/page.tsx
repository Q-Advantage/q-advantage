import type { Metadata } from "next";
import { PageShell } from "@/components/chrome/PageShell";
import { GitHubStarPopup } from "@/components/chrome/GitHubStarPopup";
import { StatBand } from "@/components/chrome/ProductNav";
import { QDayFeedbackForm } from "@/components/chrome/QDayFeedbackForm";
import {
  AuditBand,
  Caveat,
  DataTable,
  ExportRow,
  RowName,
  Section,
  Tag,
} from "@/components/product/kit";
import { getQDayIndex } from "@/lib/data/q-day";

export const metadata: Metadata = {
  title: "Q-Day Index — how close quantum hardware is to breaking RSA-2048",
  description:
    "An independent 0–100 score for how close today's quantum hardware is to breaking RSA-2048, anchored to a published resource estimate and scored from vendor specifications rather than press releases.",
};

/**
 * Q-Day Index, rebuilt on components/product/kit.
 *
 * Previously this route rendered a large bespoke view with its own scoped
 * palette and literal colours, which is why it stayed stale while the rest of
 * the site moved. It is now assembled from the same kit as Q-Shield, so it
 * inherits the treatment automatically from here on.
 */
export default function QDayIndexPage() {
  const q = getQDayIndex();
  const hero = q.hero;
  const anchor = q.anchor;
  const [bandLow, bandHigh] = hero.confidence_band;

  const scored = q.systems.filter((s) => s.na_reason == null);
  const analog = q.systems.filter((s) => s.na_reason != null);

  // Highest threat first; the frontier is the story, so it sits at the top.
  const ranked = [...scored].sort((a, b) => (b.threat_score ?? 0) - (a.threat_score ?? 0));

  const pct = (v: number | null | undefined) =>
    v == null ? "—" : `${(v * 100).toFixed(0)}%`;

  return (
    <>
      <PageShell variant="frame" className="space-y-8">
        <div className="flex flex-col gap-3">
          <div className="eyebrow">Quantum threat timeline · continuously refreshed</div>
          <h1 className="max-w-[22ch] text-balance text-[clamp(28px,3.6vw,40px)] font-bold leading-[1.08] tracking-[-0.03em] text-fg">
            How close is quantum hardware to breaking RSA-2048?
          </h1>
          <p className="max-w-[66ch] text-[15px] font-medium leading-relaxed text-fg-muted">
            A 0–100 score measuring distance to a published resource estimate, computed from vendor
            specifications and peer-reviewed papers rather than press releases. The headline is the
            field frontier — the highest score anyone currently holds — not a named winner. The
            table names every machine and its own score.
          </p>
        </div>

        <AuditBand
          cells={[
            { k: "Anchor", v: anchor.label, tone: "link" },
            { k: "Target", v: anchor.target },
            { k: "Logical qubits", v: anchor.logical_qubits.toLocaleString() },
            { k: "Physical qubits", v: anchor.physical_qubits.toLocaleString() },
            { k: "Runtime", v: anchor.runtime },
            { k: "Confidence", v: anchor.confidence.replace(/_/g, " ") },
          ]}
        />

        <StatBand
          items={[
            {
              k: "Frontier threat score",
              v: hero.frontier_threat_score.toFixed(2),
              unit: "/100",
              d: `Confidence band ${bandLow.toFixed(2)}–${bandHigh.toFixed(2)}`,
            },
            {
              k: "Systems scored",
              v: String(hero.n_scored),
              d: `Plus ${analog.length} marked N/A — a category difference, not a low score`,
            },
            {
              k: "Composite industry",
              v: hero.composite_industry_score.toFixed(2),
              unit: "/100",
              d: "Mean across every scored system, not the frontier",
            },
            {
              k: "Below threshold",
              v: String(scored.filter((s) => (s.threat_components?.ec_signal ?? 0) >= 1).length),
              d: "Systems with a demonstrated below-threshold error-correction result",
            },
          ]}
        />

        <Caveat label="Why the number is this low, and why that is the honest answer">
          The score is a <strong className="font-bold text-fg">multiplicative gate</strong>: logical
          capacity × fidelity gate × error-correction signal. Any component at zero takes the whole
          score to zero, because breaking RSA requires all of them — there is no
          &ldquo;mostly there.&rdquo; Today no system holds standing, error-corrected logical qubits,
          so the threat column reads near zero across the board.{" "}
          <strong className="font-bold text-fg">
            Readiness is a separate axis and is not distance to breaking RSA
          </strong>{" "}
          — it tracks preconditions assembled. A machine can sit at 80% readiness and zero threat at
          the same time, which is the honest state of most of the field. We do not publish a
          projected Q-Day year; a projection is only as good as its trajectory model, and ours is not
          yet defensible enough to publish.
        </Caveat>

        <Section
          eyebrow="Per-system scoring"
          title="Every machine, named, with its own inputs."
          hint="Fidelity is deliberately not presented as a ranking — an XEB figure and a median-ECR figure are not the same physical quantity."
        >
          <DataTable
            head={[
              "System",
              "Modality",
              "Threat",
              "Readiness",
              "Fidelity gate",
              "EC signal",
              "Input confidence",
            ]}
            rows={ranked.map((s) => ({
              key: `${s.vendor}-${s.system_name}`,
              cells: [
                <RowName
                  key="n"
                  name={`${s.vendor} ${s.system_name ?? ""}`.trim()}
                  note={s.release_year ? `Released ${s.release_year}` : undefined}
                />,
                <Tag key="m">{s.modality}</Tag>,
                (s.threat_score ?? 0).toFixed(2),
                s.readiness ? `${s.readiness.readiness.toFixed(1)}%` : "—",
                pct(s.threat_components?.fidelity_gate),
                pct(s.threat_components?.ec_signal),
                <Tag key="c">{s.input_confidence?.level ?? "—"}</Tag>,
              ],
            }))}
          />
        </Section>

        {analog.length > 0 && (
          <Section
            eyebrow="Not scored"
            title="Systems outside the gate model."
            hint="Analog simulators have no gate-model two-qubit fidelity and no gate-model path to Shor's. Marked N/A rather than scored zero."
          >
            <DataTable
              head={["System", "Modality", "Why not scored"]}
              rows={analog.map((s) => ({
                key: `${s.vendor}-${s.system_name}`,
                cells: [
                  <RowName key="n" name={`${s.vendor} ${s.system_name ?? ""}`.trim()} />,
                  <Tag key="m">{s.modality}</Tag>,
                  <span key="r" className="text-fg-muted">
                    {s.na_reason}
                  </span>,
                ],
              }))}
            />
          </Section>
        )}

        <Section
          eyebrow="Sourcing"
          title="Where every figure comes from."
          hint="Peer-reviewed publications and official vendor technical documents only. Where a press release disagrees with a published figure, the published figure wins."
        >
          <ExportRow
            items={[
              { label: "Full methodology →", href: "/methodology", primary: true },
              { label: "Anchor paper", href: anchor.source },
              { label: "Dataset source", href: "https://github.com/Q-Advantage/q-advantage" },
            ]}
          />
        </Section>

        <Section
          eyebrow="Corrections"
          title="Challenge a number."
          hint="A sourced correction improves every subsequent refresh. Concrete beats polite."
        >
          <QDayFeedbackForm />
        </Section>
      </PageShell>
      <GitHubStarPopup />
    </>
  );
}
