import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "@/components/chrome/Header";
import { Footer } from "@/components/chrome/Footer";
import { Breadcrumb } from "@/components/chrome/Breadcrumb";
import { getPQCReadinessIndex } from "@/lib/data/pqc-readiness";
import type { PQCEndpointResult } from "@/lib/data/pqc-readiness-types";

interface PageProps {
  params: { id: string };
}

export function generateStaticParams() {
  const data = getPQCReadinessIndex();
  return data.institutions.map((i) => ({ id: i.id }));
}

export function generateMetadata({ params }: PageProps): Metadata {
  const data = getPQCReadinessIndex();
  const inst = data.institutions.find((i) => i.id === params.id);
  if (!inst) return { title: "Institution not found" };
  return {
    title: `${inst.name} — PQC Readiness Index`,
    description: `Full endpoint-level TLS posture for ${inst.name}, sweep ${data.sweep_date}. Every negotiated parameter, per endpoint.`,
  };
}

const pct = (n: number | null): string => (n === null ? "—" : `${Math.round(n * 100)}%`);

// Paused, 2026-08-09 — see the matching note in ../page.tsx. Typed
// `boolean`, not the literal `true`, so TS doesn't drop narrowing below.
const PAUSED: boolean = true;

export default function InstitutionPage({ params }: PageProps) {
  if (PAUSED) notFound();

  const data = getPQCReadinessIndex();
  const inst = data.institutions.find((i) => i.id === params.id);
  if (!inst) notFound();

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 mx-auto max-w-[900px] px-6 md:px-8 py-10 md:py-12 w-full">
        <Breadcrumb back={{ label: "PQC Readiness Index", href: "/pqc-readiness-index" }} current={inst.name} />

        <div className="mt-6 mb-10">
          <h1 className="font-serif text-[clamp(28px,4.5vw,44px)] font-normal leading-[1.1] tracking-[-0.02em] text-fg mb-3">
            {inst.name}
          </h1>
          {inst.disputed && (
            <p className="text-sm text-status-warn mb-4">
              <strong>Disputed.</strong> A correction report is open and under review for this
              institution — see the{" "}
              <Link href="/corrections" className="underline decoration-status-warn/40 hover:decoration-status-warn">
                corrections process
              </Link>
              . The row below reflects our current data, pending that review.
            </p>
          )}
          {inst.unverified && (
            <p className="text-sm text-status-warn mb-4">
              This institution&apos;s inclusion is unverified against its category&apos;s primary
              source — see the{" "}
              <Link href="/methodology#pqc-readiness-index" className="underline decoration-status-warn/40 hover:decoration-status-warn">
                methodology
              </Link>
              . Do not treat this row as confirmed.
            </p>
          )}
          {inst.excluded ? (
            <p className="text-fg-muted">
              Excluded at the institution&apos;s request, {inst.excluded.date}. No score in
              either track. See{" "}
              <Link href="/methodology#pqc-readiness-index" className="text-fg-muted hover:text-accent underline decoration-border-strong hover:decoration-accent underline-offset-2">
                the exclusion policy
              </Link>
              .
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-4 border-t border-b border-border py-6 max-w-[480px]">
              <Stat label="KEX" value={pct(inst.kex_score)} />
              <Stat label="AUTH" value={pct(inst.auth_score)} />
              <Stat label="Measured" value={`${inst.measurable_endpoints}/${inst.total_endpoints}`} />
            </div>
          )}
        </div>

        {!inst.excluded && (
          <>
            <h2 className="font-serif text-2xl font-normal text-fg mb-4">Endpoints</h2>
            <div className="space-y-3 mb-12">
              {inst.endpoints.map((ep) => (
                <EndpointCard key={ep.hostname} ep={ep} />
              ))}
              {inst.endpoints.length === 0 && (
                <p className="text-fg-subtle text-sm">
                  No endpoints scanned yet for this institution.
                </p>
              )}
            </div>

            <div className="border-t border-border pt-6 text-xs text-fg-subtle flex flex-wrap items-center gap-x-4 gap-y-2">
              <span>
                Sweep {data.sweep_date} · methodology v{data.methodology_version} · client config{" "}
                <code className="font-mono">{data.client_config_hash}</code>
              </span>
              <Link href={`/corrections?institution=${inst.id}`} className="text-fg-muted hover:text-accent transition-colors underline decoration-border-strong hover:decoration-accent underline-offset-2">
                Request a correction →
              </Link>
            </div>
          </>
        )}

        <div className="mt-8">
          <Link href="/pqc-readiness-index" className="inline-flex items-center gap-2 text-sm text-accent hover:gap-3 transition-all">
            ← Back to the index
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}

function EndpointCard({ ep }: { ep: PQCEndpointResult }) {
  return (
    <div className="border border-border rounded-lg p-4 bg-bg-card">
      <div className="flex items-center justify-between gap-3 mb-2">
        <span className="font-mono text-sm text-fg">{ep.hostname}</span>
        <span className="text-2xs uppercase tracking-eyebrow text-fg-subtle font-mono">{ep.purpose}</span>
      </div>
      {ep.connected ? (
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
          <Field label="Protocol" value={ep.highest_negotiated_version ?? "—"} />
          <Field
            label="PQ key exchange"
            value={ep.kex_groups_supported.length > 0 ? ep.kex_groups_supported.join(", ") : "not supported"}
          />
          <Field label="Cert signature" value={ep.cert_signature_algorithm ?? "—"} />
          <Field label="Cert issuer" value={ep.cert_issuer ?? "—"} span />
        </dl>
      ) : (
        <p className="text-fg-subtle text-xs">Not measurable this sweep.</p>
      )}
    </div>
  );
}

function Field({ label, value, span }: { label: string; value: string; span?: boolean }) {
  return (
    <div className={span ? "col-span-2 sm:col-span-3" : ""}>
      <dt className="text-fg-subtle uppercase tracking-eyebrow text-2xs mb-0.5">{label}</dt>
      <dd className="text-fg-muted font-mono">{value}</dd>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-2xs uppercase tracking-eyebrow text-fg-subtle mb-1.5 font-mono">{label}</div>
      <div className="text-2xl font-serif text-fg">{value}</div>
    </div>
  );
}
