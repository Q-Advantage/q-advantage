import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/chrome/Header";
import { Footer } from "@/components/chrome/Footer";
import { SubscribeForm } from "@/components/chrome/SubscribeForm";
import { getAllPosts } from "@/lib/blog/posts";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Analysis behind the numbers: methodology decisions, field developments, and what the post-quantum migration actually costs. Written for the people who have to justify the decision to someone else.",
};

export default function BlogIndexPage() {
  const posts = getAllPosts();

  return (
    <div className="contour flex min-h-screen flex-col">
      <Header />

      <main className="flex-1 pt-6">
        <section className="panel">
          <div className="eyebrow">Blog</div>
          <h1 className="mt-2 max-w-[20ch] text-balance text-[clamp(28px,3.4vw,40px)] font-bold leading-[1.1] tracking-[-0.028em] text-fg">
            The analysis behind the numbers.
          </h1>
          <p className="mt-4 max-w-[58ch] text-[15.5px] leading-[1.62] text-fg-muted">
            Methodology decisions, field developments, and what the migration costs — written for
            the people who have to justify the decision to someone else. Every figure carries the
            run that produced it.
          </p>
        </section>

        <section className="panel">
          <div className="border-t border-border-subtle">
            {posts.map((p) => (
              <Link
                key={p.slug}
                href={`/blog/${p.slug}`}
                className="group grid grid-cols-1 gap-x-6 gap-y-1.5 border-b border-border-subtle px-1 py-6 transition-colors hover:bg-bg-surface md:grid-cols-[110px_1fr]"
              >
                <div className="flex flex-row gap-3 md:flex-col md:gap-1">
                  <span className="num text-[12px] font-semibold text-fg-subtle">{p.date}</span>
                  <span className="text-[11.5px] text-fg-muted">{p.category}</span>
                </div>
                <div className="min-w-0">
                  <h2 className="text-balance text-[19px] font-bold leading-snug tracking-[-0.028em] text-fg">
                    {p.title}
                  </h2>
                  <p className="mt-1.5 max-w-[70ch] text-[14px] leading-relaxed text-fg-muted">
                    {p.summary}
                  </p>
                  <span className="mt-2.5 inline-block text-[12.5px] font-bold text-link">
                    Read →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-2 lg:gap-11">
            <div>
              <div className="eyebrow">The briefing</div>
              <h2 className="mt-1.5 text-[clamp(22px,2.5vw,28px)] font-bold leading-[1.16] tracking-[-0.022em] text-fg">
                One email a week. Numbers first.
              </h2>
              <p className="mt-3 max-w-[48ch] text-[13px] text-fg-muted">
                What post-quantum is costing the systems you&rsquo;re responsible for, and what
                changed this week.
              </p>
            </div>
            <div>
              <SubscribeForm />
              <p className="mt-2.5 text-[11.5px] text-fg-subtle">Free. Unsubscribe anytime.</p>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
