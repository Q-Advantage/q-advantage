import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "@/components/chrome/Header";
import { Footer } from "@/components/chrome/Footer";
import { Breadcrumb } from "@/components/chrome/Breadcrumb";
import { SubscribeForm } from "@/components/chrome/SubscribeForm";
import { getAllSlugs, getPostBySlug, getRecentPosts } from "@/lib/blog/posts";

export function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return { title: "Not found" };

  return {
    title: post.title,
    description: post.summary,
    openGraph: {
      type: "article",
      title: post.title,
      description: post.summary,
      publishedTime: post.date,
    },
  };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  const { Body } = post;
  const more = getRecentPosts(4).filter((p) => p.slug !== post.slug).slice(0, 3);

  return (
    <div className="contour flex min-h-screen flex-col">
      <Header />

      <main className="flex-1 pt-6">
        <article className="panel">
          <Breadcrumb back={{ label: "Blog", href: "/blog" }} current={post.category} />

          <header className="mb-8 mt-6">
            <h1 className="max-w-[24ch] text-balance text-[clamp(28px,3.6vw,42px)] font-bold leading-[1.08] tracking-[-0.03em] text-fg">
              {post.title}
            </h1>
            <div className="mt-4 flex flex-wrap items-center gap-3 text-[12.5px] text-fg-muted">
              <span className="num font-semibold">{post.date}</span>
              <span className="text-fg-faint">·</span>
              <span>{post.category}</span>
            </div>

            {/*
              Provenance sits above the article, not in a footnote. A reader
              should know which run produced the numbers before they read them
              — that ordering is the whole posture.
            */}
            <p className="mt-5 max-w-[68ch] border-l-[3px] border-l-accent bg-bg-card py-3 pl-4 pr-3 text-[13px] leading-relaxed text-fg-muted">
              <span className="eyebrow mb-1 block">Sources</span>
              {post.sourceNote}
            </p>
          </header>

          <Body />
        </article>

        {more.length > 0 && (
          <section className="panel">
            <div className="eyebrow mb-4">More from the blog</div>
            <div className="grid grid-cols-1 gap-2.5 md:grid-cols-3">
              {more.map((p) => (
                <Link
                  key={p.slug}
                  href={`/blog/${p.slug}`}
                  className="flex flex-col gap-1.5 rounded-lg border border-border bg-bg-card px-4 py-4 transition-colors hover:border-border-strong"
                >
                  <span className="num text-[11.5px] font-semibold text-fg-subtle">{p.date}</span>
                  <span className="text-[14px] font-bold leading-snug tracking-[-0.015em] text-fg">
                    {p.title}
                  </span>
                  <span className="text-[11.5px] text-fg-muted">{p.category}</span>
                </Link>
              ))}
            </div>
          </section>
        )}

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
