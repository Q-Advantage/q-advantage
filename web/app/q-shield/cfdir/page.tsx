import type { Metadata } from "next";
import { PageShell } from "@/components/chrome/PageShell";
import { AuditBand, Caveat, DataTable, RowName, Section, type KitRow } from "@/components/product/kit";
import { loadProtocolsData } from "@/lib/protocols/load";
import { formatBytes } from "@/lib/format";
import {
  CFDIR_FRAMEWORK_DATED,
  CFDIR_FRAMEWORK_VERSION,
  lineItemsFor,
  coverageSentence,
  tally,
  coverageByUseCase,
  type Coverage,
  type UseCaseCoverage,
} from "@/lib/data/cfdir";
import { fileOperatingCostDeltas, formatSignedDelta, mixedSignDeltas } from "@/lib/protocols/ocd";
import {
  congestionIsComposed,
  hasChainSizing,
  loadCertChain,
  measuredChains,
  overTheWindow,
  worstMultiple,
} from "@/lib/data/cert-chain";

export const metadata: Metadata = {
  // Unlinked and de-indexed 2026-08-30 — see app/q-shield/layout.tsx for why.
  // Orphaning a page without this leaves it in search results, reachable by
  // exactly the people we least want landing on it cold.
  robots: { index: false, follow: false },
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

/** The arch the rest of this page reads, chosen once. */
function primaryBucket(data: ReturnType<typeof loadProtocolsData>) {
  return data.byArch["x86_64"] ?? data.byArch[Object.keys(data.byArch)[0]];
}

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
  const chainFile = loadCertChain();
  const chains = measuredChains(chainFile);
  const rows = coverageByUseCase(data, { chainSizing: hasChainSizing(chainFile) });
  const overWindow = overTheWindow(chainFile);
  const jose = primaryBucket(data)?.jose ?? null;
  const joseArms = Object.values(jose?.arms ?? {}).filter((a) => a.status === "ok" && a.size);
  const worst = worstMultiple(chainFile);
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

      {chains.length > 0 && (
        <Section
          eyebrow="3.5 · TLS certificates"
          title={
            worst
              ? `The chain, not the key exchange, is where the bytes are: ${worst.multiple.toFixed(2)}× at ${worst.algorithm}.`
              : "Certificate chains, measured rather than summed."
          }
          hint="Chains minted with oqs-provider and measured as DER. Only the leaf and intermediate count as sent — in the common deployment the root is already in the client's trust store, and counting it would overstate every handshake."
        >
          <DataTable
            head={["Certificate", "Leaf", "Intermediate", "Sent on the wire", "vs ECDSA-P256"]}
            rows={chains.map((c) => {
              const cmp = chainFile?.comparison?.rows?.find((r) => r.algorithm === c.algorithm);
              return {
                key: c.algorithm,
                cells: [
                  <RowName key="n" name={c.algorithm} />,
                  <span key="l" className="tabular-nums text-fg-muted">
                    {formatBytes(c.certificates_der_bytes?.leaf ?? 0)}
                  </span>,
                  <span key="i" className="tabular-nums text-fg-muted">
                    {formatBytes(c.certificates_der_bytes?.intermediate ?? 0)}
                  </span>,
                  <span key="s" className="tabular-nums font-bold text-fg">
                    {formatBytes(c.sent_in_handshake?.der_bytes ?? 0)}
                  </span>,
                  <span key="m" className="tabular-nums text-fg-muted">
                    {cmp?.multiple_of_baseline != null ? (
                      `${cmp.multiple_of_baseline.toFixed(2)}×`
                    ) : (
                      <span className="text-fg-subtle">baseline</span>
                    )}
                  </span>,
                ],
              };
            })}
          />
          <p className="mt-3 text-[11px] leading-relaxed text-fg-muted">
            These are a <strong className="font-bold text-fg">floor</strong>. The generated
            certificates carry short names, one SAN and no Certificate Transparency extensions, where
            a real WebPKI certificate carries more &mdash; which makes a real chain larger, and the
            post-quantum penalty on a real chain larger still.
          </p>
        </Section>
      )}

      {chainFile?.congestion && (
        <Section
          eyebrow="The consequence"
          title={
            overWindow.length > 0
              ? "Put one of those chains in a first flight and the congestion window stops being theoretical."
              : "Composed against the initial congestion window."
          }
          hint={`Against ${formatBytes(chainFile.congestion.assumed_initcwnd_bytes)} — 10 segments at a 1460-byte MSS, the RFC 6928 default. Tunable per route, so the assumption is published with the verdict.`}
        >
          <DataTable
            head={["Certificate", "Composed first flight", "Against the window"]}
            rows={chainFile.congestion.rows.map((r) => ({
              key: r.certificate_algorithm,
              cells: [
                <RowName key="n" name={r.certificate_algorithm} />,
                <span key="b" className="tabular-nums font-bold text-fg">
                  {formatBytes(r.composed_first_flight_bytes)}
                </span>,
                <span
                  key="v"
                  className={
                    r.exceeds_initcwnd ? "font-bold text-status-warn" : "tabular-nums text-fg-muted"
                  }
                >
                  {r.exceeds_initcwnd
                    ? `over by ${formatBytes(-r.headroom_bytes)}`
                    : `fits, ${formatBytes(r.headroom_bytes)} spare`}
                </span>,
              ],
            }))}
          />
        </Section>
      )}

      {congestionIsComposed(chainFile) && (
        <Caveat label="This corrects something published earlier on this site">
          Layer B measured a real TLS first flight at{" "}
          <strong className="font-bold text-fg">1,762 bytes</strong> and we said the congestion-window
          cliff was not binding. That measurement is correct; the conclusion drawn from it was too
          broad. Layer B&rsquo;s testbed serves a throwaway classical certificate by design, so its
          flight contains no post-quantum certificate at all.
          {" "}
          {overWindow.length > 0 && (
            <>
              With one in it, the larger parameter sets cross the window. The cliff{" "}
              <strong className="font-bold text-fg">is</strong> binding &mdash; just not where it was
              first looked for.
            </>
          )}
          {" "}The table above is a <strong className="font-bold text-fg">composition</strong> over
          measured components, not a captured flight: every term is measured, but the flight&rsquo;s
          structure is assumed, with no OCSP stapling, client authentication or session ticket &mdash;
          all of which push the total up rather than down. The honest way to settle it is to make that
          testbed serve a post-quantum chain and capture the flight directly.
        </Caveat>
      )}

      {joseArms.length > 0 && (
        <Section
          eyebrow="3.9 · SSO and token-based auth"
          title="A signature that fits in a handshake does not necessarily fit in a header."
          hint="Real JOSE tokens, signed and verified end to end. The signature is base64url-encoded in a compact serialization, so it costs about a third more in a header than its raw length — an expansion that belongs to the encoding, not the algorithm, and is invisible in a primitive benchmark."
        >
          <DataTable
            head={["Scheme", "alg", "Token", "Signature share", "4 KB cookie default"]}
            rows={joseArms
              .slice()
              .sort((a, b) => (b.size!.token_bytes ?? 0) - (a.size!.token_bytes ?? 0))
              .map((a) => {
                const cookie = a.limits?.find((l) => l.limit_bytes === 4096);
                return {
                  key: a.scheme,
                  cells: [
                    <RowName key="n" name={a.scheme} />,
                    <span key="a" className="text-fg-muted">
                      {a.alg}
                      {a.alg_is_registered === false && (
                        <span className="ml-1.5 text-2xs uppercase tracking-eyebrow text-fg-subtle">
                          not registered
                        </span>
                      )}
                    </span>,
                    <span key="t" className="tabular-nums font-bold text-fg">
                      {formatBytes(a.size!.token_bytes)}
                    </span>,
                    <span key="s" className="tabular-nums text-fg-muted">
                      {a.size!.signature_share_pct.toFixed(1)}%
                    </span>,
                    <span
                      key="c"
                      className={
                        cookie && !cookie.within_default
                          ? "font-bold text-status-warn"
                          : "tabular-nums text-fg-muted"
                      }
                    >
                      {cookie
                        ? cookie.within_default
                          ? `fits, ${formatBytes(cookie.headroom_bytes)} spare`
                          : `over by ${formatBytes(-cookie.headroom_bytes)}`
                        : "—"}
                    </span>,
                  ],
                };
              })}
          />
          <p className="mt-3 text-[11px] leading-relaxed text-fg-muted">
            <strong className="font-bold text-fg">No registered JOSE algorithm identifier is
            asserted</strong> for any post-quantum scheme. The <code>alg</code> header carries the
            scheme&rsquo;s own name as a non-standard value, and no standardisation draft is named or
            anticipated here. The measurement does not depend on which identifier eventually wins:
            a token&rsquo;s size is driven by the signature and by base64url, and the{" "}
            <code>alg</code> string&rsquo;s own contribution is counted in the header where it can be
            seen.
          </p>
          {jose?.limits_note && (
            <p className="mt-2 text-[11px] leading-relaxed text-fg-muted">{jose.limits_note}</p>
          )}
        </Section>
      )}

      <Section
        eyebrow="Line items"
        title="Five of the eleven need a measurement. The rest are procurement and labour."
        hint="Where a line item is blocked, what blocks it is named rather than left as an empty cell — the blocker is more useful than the gap."
      >
        <DataTable
          head={["Code", "Line item", "What Q-Shield must emit", "Status"]}
          rows={lineItemsFor(data).map((li) => ({
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
