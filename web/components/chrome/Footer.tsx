import Link from "next/link";
import { PRODUCTS, TOOLS, COMPANY_LINKS } from "@/lib/nav";
import { getLatestRun } from "@/lib/data/load";
import { formatRunDate, shortSha } from "@/lib/format";

/**
 * Site footer — expanded in work-order 005 to carry the full menu, the
 * "repeat everything in the footer" pattern confirmed on both InferenceX and
 * SemiAnalysis proper, and called for in `website-ia-spec.md §7`.
 *
 * It also carries the run stamp. That is deliberate: the last line of every
 * page on the site says which measurement produced its numbers, on what
 * hardware. Receipts as furniture, not as a claim.
 */
export function Footer() {
  const year = new Date().getUTCFullYear();
  const run = getLatestRun();
  const env = run.environment;

  return (
    <footer className="mt-8 border-t border-border bg-bg-card py-10">
      <div className="mx-auto max-w-[1200px] px-6 md:px-8">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 md:grid-cols-[1.5fr_repeat(3,1fr)]">
          <div>
            <div className="flex items-center gap-2.5">
              <span
                className="relative inline-block h-[19px] w-[19px] rounded-[5px] bg-fg"
                aria-hidden
              >
                <span className="absolute inset-[5px] rounded-[1px] bg-accent" />
              </span>
              <span className="text-[15.5px] font-bold tracking-tight text-fg">Q-Advantage</span>
            </div>
            <p className="mt-3 max-w-[34ch] text-[12.5px] leading-relaxed text-fg-muted">
              Independent measurement of the post-quantum migration. We do not sell migration
              tools, and we never will.
            </p>
          </div>

          <FooterColumn title="Products">
            {PRODUCTS.map((s) =>
              s.href ? (
                <FooterLink key={s.name} href={s.href}>
                  {s.name}
                </FooterLink>
              ) : (
                <FooterSoon key={s.name}>{s.name}</FooterSoon>
              )
            )}
            <FooterLink href="/q-shield/compare">Compare algorithms</FooterLink>
            <FooterLink href="/q-shield/protocols">Protocol tracks</FooterLink>
          </FooterColumn>

          <FooterColumn title="Tools">
            {TOOLS.map((s) =>
              s.href ? (
                <FooterLink key={s.name} href={s.href}>
                  {s.name}
                </FooterLink>
              ) : (
                <FooterSoon key={s.name}>{s.name}</FooterSoon>
              )
            )}
          </FooterColumn>

          <FooterColumn title="Company">
            <FooterLink href="/blog">Blog</FooterLink>
            {COMPANY_LINKS.map((l) => (
              <FooterLink key={l.name} href={l.href}>
                {l.name}
              </FooterLink>
            ))}
          </FooterColumn>
        </div>

        <div className="mt-8 flex flex-wrap justify-between gap-3 border-t border-border-subtle pt-5 text-[11.5px] text-fg-subtle">
          <span>© {year} Q-Advantage</span>
          <span className="num">
            Last run {formatRunDate(env.iso_timestamp)} · {shortSha(env.git_commit)} · liboqs{" "}
            {env.liboqs_version} · {env.ec2_instance_type}
          </span>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="eyebrow mb-3">{title}</h4>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  const external = href.startsWith("http");
  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[13px] text-fg-muted transition-colors hover:text-fg"
      >
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className="text-[13px] text-fg-muted transition-colors hover:text-fg">
      {children}
    </Link>
  );
}

/** An unpublished surface — named honestly, never linked. */
function FooterSoon({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[12.5px] text-fg-subtle">
      {children} <span className="text-fg-faint">— coming</span>
    </span>
  );
}
