import type { Metadata } from "next";
import { PageShell } from "@/components/chrome/PageShell";
import { AuditBand, Caveat, DataTable, RowName, Section, type KitRow } from "@/components/product/kit";
import { loadProtocolsData } from "@/lib/protocols/load";
import {
  CFDIR_FRAMEWORK_DATED,
  CFDIR_FRAMEWORK_VERSION,
  LINE_ITEMS,
  coverageSentence,
  tally,
  useCaseCoverage,
  type Coverage,
  type UseCaseCoverage,
} from "@/lib/data/cfdir";
import { fileOperatingCostDeltas, formatSignedDelta, mixedSignDeltas } from "@/lib/protocols/ocd";

export const metadata: Metadata = {
  title: "CFDIR coverage | Q-Shield",
  description:
    "Q-Shield's measurements arranged by the CFDIR migration-cost framework's own use cases and line items, with the uncovered cells shown as empty.",
};

const COVERAGE_STYLE: Record<Coverage, { label: string; cls: string }> = {
  covered: { label: "Covered", cls: "font-bold text-status-ok" },
  partial: { label: "Partial", cls: "font-bold text-status-warn" },
  none: { label: "Not covered", cls: "text-fg-subtle" },
  "not-applicable": { label: "n/a", cls: "text-fg-subtle/70" },
};

function useCaseRows(rows: UseCaseCoverage[]): KitRow[] {
  return rows.map((r) => {
    const style = COVERAGE_STYLE[r.coverage];
    return {
      key: r.id,
      cells: [
        <span key="id" className="tabular-nums text-fg-subtle">
          {r.id}
        </span>,
        <RowName key="n" name={r.name} note={r.gap} />,
        <span key="t" className="text-fg-muted">
          {r.track ?? <span className="text-fg-subtle">&mdash;</span>}
        </span>,
        <span key="c" className={style.cls}>
          {style.label}
          {r.trackMissing && (
            <span className="ml-1.5 text-2xs uppercase tracking-eyebrow text-status-warn">
              track produced no data
            </span>
          )}
        </span>,
      ],
    };
  });
}

export default function CfdirPage() {
  const data = loadProtocolsData();
  const rows = useCaseCoverage(data);
  const t = tally(rows);

  const primary = data.byArch["x86_64"] ?? data.byArch[Object.keys(data.byArch)[0]];
  const deltas = fileOperatingCostDeltas(primary?.tls?.suites);
  const mixed = mixedSignDeltas(deltas);

  return (
    <PageShell variant="frame" className="space-y-8">
      <div className="flex flex-col gap-3">
        <div className="eyebrow">Q-Shield · CFDIR coverage</div>
        <h1 className="max-w-[26ch] text-balance text-[clamp(28px,3.6vw,40px)] font-bold leading-[1.08] tracking-[-0.03em] text-fg">
          The same measurements, in the shape a cost model can read.
        </h1>
        <p className="max-w-[68ch] text-[15px] font-medium leading-relaxed text-fg-muted">
          The CFDIR migration-cost framework is <strong className="font-bold text-fg">use-case shaped</strong>:
          fourteen named use cases, each expressed as a subset of eleven line items, applied on a
          per-use-case basis rather than system-wide. Q-Shield&rsquo;s output is{" "}
          <strong className="font-bold text-fg">algorithm shaped</strong> &mdash; algorithm, operation,
          timing. A cost model cannot consume the second directly.
        </p>
        <p className="max-w-[68ch] text-[15px] font-medium leading-relaxed text-fg-muted">
          This page is the join. It is a rendering, not a new benchmark: every cell is filled from data
          already published elsewhere on this site. The empty cells are not an omission &mdash; they are
          the roadmap, and showing them is the point.
        </p>
      </div>

      <AuditBand
        cells={[
          { k: "Framework", v: `CFDIR ${CFDIR_FRAMEWORK_VERSION}` },
          { k: "Dated", v: CFDIR_FRAMEWORK_DATED },
          { k: "Use cases covered", v: `${t.covered} of ${t.scorable}` },
          { k: "Partial", v: String(t.partial) },
          { k: "Not covered", v: String(t.none) },
        ]}
      />

      <Section
        eyebrow="Use-case coverage"
        title={coverageSentence(t)}
        hint="Coverage is computed from the tracks that actually produced data in this build, not from a hand-maintained table — a track that stops running downgrades its own row."
      >
        <DataTable
          head={["§", "CFDIR use case", "Q-Shield track", "Coverage"]}
          rows={useCaseRows(rows)}
        />
      </Section>

      <Section
        eyebrow="Line items"
        title="Five of the eleven need a measurement. The rest are procurement and labour."
        hint="Where a line item is blocked, what blocks it is named rather than left as an empty cell — the blocker is more useful than the gap."
      >
        <DataTable
          head={["Code", "Line item", "What Q-Shield must emit", "Status"]}
          rows={LINE_ITEMS.map((li) => ({
            key: li.code,
            cells: [
              <span key="c" className="font-bold tabular-nums text-fg">
                {li.code}
              </span>,
              <RowName key="n" name={li.name} note={li.cfdirUse} />,
              <span key="r" className="text-fg-muted">
                {li.requirement ?? (
                  <span className="text-fg-subtle">
                    Not a measurement &mdash; sourced through procurement.
                  </span>
                )}
              </span>,
              <span
                key="s"
                className={
                  li.status === "met"
                    ? "font-bold text-status-ok"
                    : li.status === "partial"
                      ? "font-bold text-status-warn"
                      : li.status === "blocked"
                        ? "font-bold text-status-warn"
                        : "text-fg-subtle"
                }
              >
                {li.status === "not-measurement" ? "n/a" : li.status}
                {li.blocker && (
                  <span className="mt-1 block text-2xs font-normal leading-relaxed text-fg-subtle">
                    {li.blocker}
                  </span>
                )}
              </span>,
            ],
          }))}
        />
      </Section>

      {deltas.length > 0 && (
        <Section
          eyebrow="Operating cost delta"
          title="Published per component, with the signs kept."
          hint="A cost model needs the components, not a verdict. Collapsing them requires a price for microseconds against bytes, and that price belongs to whoever is doing the costing."
        >
          <div className="space-y-4">
            {deltas.map((d) => (
              <div key={d.suite} className="rounded border border-border bg-bg-surface p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="font-bold text-fg">{d.suite}</div>
                  <div className="text-2xs text-fg-subtle">against {d.baselineSuite}</div>
                </div>
                <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                  {d.components.map((c) => (
                    <div key={c.component}>
                      <dt className="text-[10px] font-bold uppercase tracking-eyebrow text-fg-subtle">
                        {c.label}
                      </dt>
                      <dd
                        className={`mt-0.5 text-[18px] font-bold tabular-nums ${
                          c.direction === "saving" ? "text-status-ok" : "text-fg"
                        }`}
                      >
                        {formatSignedDelta(c)}
                        {c.deltaPct != null && (
                          <span className="ml-2 text-[12px] font-semibold text-fg-subtle">
                            {c.deltaPct > 0 ? "+" : ""}
                            {c.deltaPct.toFixed(1)}%
                          </span>
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>
                {d.mixedSigns && (
                  <p className="mt-3 text-[11px] leading-relaxed text-fg-muted">
                    <strong className="font-bold text-fg">
                      These components point in opposite directions.
                    </strong>{" "}
                    Cheaper on one axis, dearer on the other. Any single blended figure has to choose
                    a weighting between them, and whichever it picks, this is the finding it erases.
                  </p>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {mixed.length > 0 && (
        <Caveat label="Why there is no single overhead number on this page">
          {deltas[0]?.blendedTotalReason}
          {" "}The framework itself allows for negative costs; a model that cannot represent one
          cannot consume ours.
        </Caveat>
      )}

      <Caveat label="What this page is, and what it is not">
        It is a <strong className="font-bold text-fg">rendering</strong> of measurements published
        elsewhere on this site, arranged against someone else&rsquo;s taxonomy. It is not a cost
        model, it does not price anything, and it produces no figure that is not already visible on{" "}
        <a
          href="/q-shield/protocols"
          className="font-semibold underline decoration-border-strong underline-offset-2 hover:text-accent"
        >
          the protocol tracks
        </a>
        .
        <br />
        <br />
        The framework version is pinned like a library version. CFDIR {CFDIR_FRAMEWORK_VERSION} is
        dated {CFDIR_FRAMEWORK_DATED} and its authors state it will be reviewed annually &mdash; so a
        revision to their document is a methodology event here, not a silent update. The use-case
        definitions are theirs; the coverage judgements are ours, and are computed from what actually
        loaded rather than asserted.
      </Caveat>
    </PageShell>
  );
}
