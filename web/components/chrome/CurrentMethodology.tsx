import Link from "next/link";
import { PageShell } from "./PageShell";
import { PublicToolLayout } from "./PublicToolLayout";

const PRINCIPLES = [
  {
    number: "01",
    title: "Measured before modeled",
    body: "PQC Arena records cryptographic operations and composed protocol behavior on identified hardware. Coldproof models use that evidence as an input; they do not replace it with a vendor claim.",
  },
  {
    number: "02",
    title: "Every number keeps its provenance",
    body: "Published measurements carry their run date, software environment, host context and source commit. Missing measurements stay missing rather than being silently estimated or zero-filled.",
  },
  {
    number: "03",
    title: "Estate assumptions remain explicit",
    body: "A migration model combines measured evidence with estate scope, sequencing, labour, infrastructure and operating assumptions. Those assumptions are shown separately so security and finance can challenge them.",
  },
];

export function CurrentMethodology() {
  return (
    <PublicToolLayout>
      <PageShell variant="panel" width="narrow" className="cp-methodology-page space-y-14">
        <header className="cp-methodology-hero">
          <div className="eyebrow">Methodology</div>
          <h1 className="mt-4 max-w-[18ch] text-[clamp(42px,6vw,76px)] leading-[.96]">
            Evidence first. Assumptions in the open.
          </h1>
          <p className="mt-7 max-w-[64ch] text-[18px] leading-relaxed text-fg-muted">
            Coldproof connects public post-quantum measurements to the systems, migration work and
            financial assumptions that determine cost. The measurement layer and the commercial
            model have different jobs, and we keep that boundary visible.
          </p>
        </header>

        <section className="grid gap-5 md:grid-cols-3" aria-label="Methodology principles">
          {PRINCIPLES.map((principle) => (
            <article key={principle.number} className="cp-methodology-card rounded-2xl p-6">
              <div className="cp-mono text-fg-subtle">{principle.number}</div>
              <h2 className="mt-8 text-[27px] font-normal leading-[1.02] tracking-[-.04em]">{principle.title}</h2>
              <p className="mt-4 text-[14px] leading-relaxed text-fg-muted">{principle.body}</p>
            </article>
          ))}
        </section>

        <section className="border-t border-border pt-10">
          <div className="cp-mono text-fg-subtle">PQC Arena</div>
          <h2 className="mt-4 max-w-[22ch] text-[clamp(31px,4vw,48px)] font-normal leading-[1.02] tracking-[-.045em]">
            What the public measurement layer does.
          </h2>
          <div className="mt-7 grid gap-8 text-[15px] leading-relaxed text-fg-muted md:grid-cols-2">
            <p>
              The benchmark harness measures NIST-standardized algorithms and composed TLS and SSH
              behavior. Runs capture timing distributions, throughput, artifact sizes and the
              environment that produced them. Results and source code remain public.
            </p>
            <p>
              These measurements describe the observed environment. They do not claim to be a
              universal performance forecast, a vendor rating, or a customer cost estimate.
            </p>
          </div>
          <Link href="/pqc-arena" className="cpv2-text-link">Explore PQC Arena <span aria-hidden>→</span></Link>
        </section>

        <section className="border-t border-border pt-10">
          <div className="cp-mono text-fg-subtle">Migration economics</div>
          <h2 className="mt-4 max-w-[22ch] text-[clamp(31px,4vw,48px)] font-normal leading-[1.02] tracking-[-.045em]">
            What a Coldproof model adds.
          </h2>
          <p className="mt-7 max-w-[72ch] text-[15px] leading-relaxed text-fg-muted">
            Technical evidence becomes decision-useful only when it is mapped to an organization’s
            cryptographic estate and migration plan. The model separates one-time work, recurring
            infrastructure effects, migration phases, parallel operation and uncertainty into low,
            base and high cases. Illustrative website figures are never presented as customer estimates.
          </p>
        </section>

        <section className="rounded-2xl bg-[#263b61] p-7 text-white md:p-10">
          <div className="cp-mono text-white/60">Audit the evidence</div>
          <h2 className="mt-5 max-w-[20ch] text-[clamp(30px,4vw,48px)] font-normal leading-[1.02] tracking-[-.045em]">
            The measurements are public. The budget conversation starts with your estate.
          </h2>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/contact" className="rounded-xl bg-white px-5 py-3 text-[14px] font-medium text-black">Request a migration model</Link>
            <Link href="/pqc-arena" className="rounded-xl border border-white/45 px-5 py-3 text-[14px] text-white">Inspect PQC Arena</Link>
          </div>
        </section>
      </PageShell>
    </PublicToolLayout>
  );
}
