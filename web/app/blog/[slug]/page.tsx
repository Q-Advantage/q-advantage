import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "@/components/chrome/Header";
import { Footer } from "@/components/chrome/Footer";
import { BrandClose } from "@/components/chrome/BrandClose";
import { ResearchSubscribe } from "@/components/blog/ResearchSubscribe";
import { Breadcrumb } from "@/components/chrome/Breadcrumb";
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
    alternates: { canonical: `https://coldproof.io/blog/${post.slug}` },
    openGraph: {
      type: "article",
      title: post.title,
      description: post.summary,
      publishedTime: post.date,
      modifiedTime: post.updated,
      authors: [post.author || "Coldproof"],
      url: `https://coldproof.io/blog/${post.slug}`,
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
    <div className="coldproof-site cp-editorial-page research-page flex min-h-screen flex-col">
      <Header />

      <main className="flex-1 pt-6">
        <article className="panel">
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
            "@context": "https://schema.org", "@type": "Article", headline: post.title,
            description: post.summary, datePublished: post.date, ...(post.updated ? { dateModified: post.updated } : {}),
            author: { "@type": post.author ? "Person" : "Organization", name: post.author || "Coldproof" },
            publisher: { "@type": "Organization", name: "Coldproof" },
            mainEntityOfPage: `https://coldproof.io/blog/${post.slug}`, articleSection: post.category,
          }).replace(/</g, "\\u003c") }} />
          <Breadcrumb back={{ label: "Research", href: "/blog" }} current={post.category} />

          {/*
            The masthead is centred and the body column below it is centred to
            the same axis, so the article reads as one aligned block rather
            than as a headline with copy hanging off its left edge.
          */}
          <header className="mx-auto mb-10 mt-8 max-w-[68ch] text-center">
            <div className="eyebrow">{post.category}</div>
            <h1 className="mx-auto mt-3 max-w-[26ch] text-balance text-[clamp(28px,3.6vw,42px)] font-bold leading-[1.1] tracking-[-0.03em] text-fg">
              {post.title}
            </h1>
            <p className="mx-auto mt-4 max-w-[58ch] text-pretty text-[16px] leading-relaxed text-fg-muted">
              {post.summary}
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5 text-[12.5px] text-fg-subtle">
              <time dateTime={post.date} className="num font-semibold">{post.date}</time>
              <span className="text-fg-faint">·</span>
              <span>{post.author || "Coldproof"}</span>
              {post.updated && <span>Updated <time dateTime={post.updated}>{post.updated}</time></span>}
              {post.version && <span>Version {post.version}</span>}
            </div>
          </header>

          <div className="mx-auto max-w-[68ch]">
            <hr className="border-t border-border-subtle" />
          </div>

          {/*
            Provenance sits above the article, not in a footnote. A reader
            should know which run produced the numbers before they read them —
            that ordering is the whole posture.
          */}
          <p className="mx-auto my-8 max-w-[68ch] rounded-r border-l-[3px] border-l-accent bg-bg-card py-3 pl-4 pr-3 text-[13.5px] leading-relaxed text-fg-muted">
            <span className="eyebrow mb-1 block">Sources</span>
            {post.sourceNote}
          </p>

          {!!post.evidence?.length && <p className="mx-auto mb-6 max-w-[68ch] text-sm text-fg-muted">Evidence: {post.evidence.join(" · ")}</p>}
          {!!post.tags?.length && <p className="mx-auto mb-6 max-w-[68ch] text-sm text-fg-muted">Topics: {post.tags.join(" · ")}</p>}
          {!!post.keyFindings?.length && <aside className="research-findings mx-auto mb-8 max-w-[68ch]"><h2>Executive summary</h2><ul>{post.keyFindings.map((finding, i) => <li key={i}>{finding}</li>)}</ul></aside>}
          <Body />
          <p className="research-standard mx-auto mt-12 max-w-[68ch]">Financial claims must be measured, independently sourced, or explicitly modelled with disclosed assumptions. <Link href="/blog/editorial-standards">Editorial standards →</Link></p>
        </article>

        {more.length > 0 && (
          <section className="panel">
            <div className="eyebrow mb-4">Related publications</div>
            <div className="grid grid-cols-1 gap-2.5 md:grid-cols-3">
              {more.map((p) => (
                <Link
                  key={p.slug}
                  href={`/blog/${p.slug}`}
                  className="flex flex-col gap-1.5 rounded-lg border border-border bg-bg-card px-4 py-4 transition-colors hover:border-border-strong"
                >
                  <span className="num text-[11.5px] font-semibold text-fg-subtle">{p.date}</span>
                  <span className="text-[14px] font-bold leading-snug tracking-[-0.022em] text-fg">
                    {p.title}
                  </span>
                  <span className="text-[11.5px] text-fg-muted">{p.category}</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="panel"><ResearchSubscribe /></section>
      </main>

      <Footer />
      <BrandClose />
    </div>
  );
}
