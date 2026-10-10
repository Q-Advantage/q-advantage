import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "@/components/chrome/Header";
import { Footer } from "@/components/chrome/Footer";
import { BrandClose } from "@/components/chrome/BrandClose";
import { ResearchSubscribe } from "@/components/blog/ResearchSubscribe";
import { getAllSlugs, getPostBySlug, getRecentPosts } from "@/lib/blog/posts";

export function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return { title: "Not found" };
  return {
    title: post.title, description: post.summary,
    alternates: { canonical: `https://www.coldproof.io/blog/${post.slug}` },
    openGraph: {
      type: "article", title: post.title, description: post.summary, publishedTime: post.date,
      modifiedTime: post.updated, authors: [post.author || "Coldproof"], url: `https://www.coldproof.io/blog/${post.slug}`,
    },
  };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();
  const { Body } = post;
  const more = getRecentPosts(4).filter(p => p.slug !== post.slug).slice(0, 3);
  return <div className="coldproof-site research-page flex min-h-screen flex-col">
    <Header /><main className="flex-1"><div className="cpv2-wrap">
      <article className="research-article">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          "@context": "https://schema.org", "@type": "Article", headline: post.title,
          description: post.summary, datePublished: post.date, ...(post.updated ? { dateModified: post.updated } : {}),
          author: { "@type": post.author ? "Person" : "Organization", name: post.author || "Coldproof" },
          publisher: { "@type": "Organization", name: "Coldproof" },
          mainEntityOfPage: `https://www.coldproof.io/blog/${post.slug}`, articleSection: post.category,
        }).replace(/</g, "\\u003c") }} />
        <nav className="research-back cp-mono" aria-label="Breadcrumb"><Link href="/blog">← Research</Link><span>{post.category}</span></nav>
        <header className="research-masthead"><h1>{post.title}</h1><p>{post.summary}</p>
          <div className="research-meta"><span>By {post.author || "Coldproof"}</span><time dateTime={post.date}>{post.date}</time>
            {post.updated && <span>Updated <time dateTime={post.updated}>{post.updated}</time></span>}{post.version && <span>Version {post.version}</span>}
          </div>
        </header>
        <div className="research-body">
          <p className="research-source"><span className="cp-mono">Sources & provenance</span>{post.sourceNote}</p>
          {!!post.evidence?.length && <p className="research-annotation">Evidence: {post.evidence.join(" · ")}</p>}
          {!!post.tags?.length && <p className="research-annotation">Topics: {post.tags.join(" · ")}</p>}
          {!!post.keyFindings?.length && <aside className="research-findings"><h2>Executive summary</h2><ul>{post.keyFindings.map((finding, i) => <li key={i}>{finding}</li>)}</ul></aside>}
          <Body />
          <p className="research-standard">Financial claims must be measured, independently sourced, or explicitly modelled with disclosed assumptions. <Link href="/blog/editorial-standards">Editorial standards →</Link></p>
        </div>
      </article>
      {more.length > 0 && <section className="research-library" aria-labelledby="related-title"><div className="research-library-heading"><h2 id="related-title">Related publications</h2><Link href="/blog">All research →</Link></div><div className="research-grid">{more.map(p => <article key={p.slug} className="research-card"><span className="cp-mono">{p.category}</span><h3><Link href={`/blog/${p.slug}`}>{p.title}</Link></h3><div className="research-meta"><time dateTime={p.date}>{p.date}</time></div><Link className="research-read" href={`/blog/${p.slug}`}>Read publication <span aria-hidden>→</span></Link></article>)}</div></section>}
      <ResearchSubscribe />
    </div></main><Footer /><BrandClose />
  </div>;
}
