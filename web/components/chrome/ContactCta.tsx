import Link from "next/link";

export function ContactCta({
  eyebrow = "Migration model",
  title = "Know what your migration could cost.",
  copy = "We’re working with a small number of organizations to model the economics of their post-quantum transition.",
}: {
  eyebrow?: string;
  title?: string;
  copy?: string;
}) {
  return (
    <section className="cp-contact-cta" aria-labelledby="contact-cta-title">
      <div>
        <div className="cp-mono">{eyebrow}</div>
        <h2 id="contact-cta-title">{title}</h2>
        <p>{copy}</p>
      </div>
      <Link href="/contact">Request a migration model <span aria-hidden>→</span></Link>
    </section>
  );
}
