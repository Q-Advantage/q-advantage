import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/chrome/Header";
import { Footer } from "@/components/chrome/Footer";
import { BrandClose } from "@/components/chrome/BrandClose";
import { getAllPosts } from "@/lib/blog/posts";
import { CATEGORIES } from "@/lib/blog/publication";
import { ResearchSubscribe } from "@/components/blog/ResearchSubscribe";

export const metadata: Metadata = {
  title: "Research", description: "Independent, evidence-backed economic analysis to improve post-quantum cryptography investment decisions.",
  alternates: { canonical: "https://coldproof.io/blog", types: { "application/rss+xml": "https://coldproof.io/blog/feed.xml" } },
  openGraph: { title: "Coldproof Research", description: "Evidence for post-quantum investment decisions.", url: "https://coldproof.io/blog" },
};

export default function BlogIndexPage({ searchParams }: { searchParams: { category?: string } }) {
  const all = getAllPosts();
  const category = CATEGORIES.find(c => c === searchParams.category);
  const posts = category ? all.filter(p => p.category === category) : all;
  const featured = !category ? posts[0] : undefined;
  return <div className="coldproof-site cp-editorial-page research-page flex min-h-screen flex-col">
    <Header /><main className="flex-1">
      <section className="panel research-intro"><div className="eyebrow">Coldproof Research</div>
        <h1>Evidence for the decisions ahead.</h1><p>Independent, evidence-backed economic analysis to improve post-quantum cryptography investment decisions.</p>
        <div className="research-standard">Measured, independently sourced, or explicitly modelled with disclosed assumptions. <Link href="/blog/editorial-standards">Our editorial standard →</Link></div>
      </section>
      {featured && <section className="panel research-feature" aria-label="Featured publication"><div className="research-feature-label"><span className="eyebrow">Featured publication</span><span className="research-mark" aria-hidden="true">Evidence<br />before<br />estimates.</span></div>
        <div><span className="research-category">{featured.category}</span><h2><Link href={`/blog/${featured.slug}`}>{featured.title}</Link></h2><p>{featured.summary}</p><div className="research-meta"><time dateTime={featured.date}>{featured.date}</time><span>{featured.author || "Coldproof"}</span></div><Link className="research-read" href={`/blog/${featured.slug}`}>Read publication →</Link></div>
      </section>}
      <section className="panel research-library" aria-labelledby="library-title"><div className="research-library-heading"><h2 id="library-title">Publications</h2><a href="/blog/feed.xml">RSS feed ↗</a></div>
        <nav className="research-filters" aria-label="Publication categories">{["All", ...CATEGORIES].map(c => <Link key={c} href={c === "All" ? "/blog" : `/blog?category=${encodeURIComponent(c)}`} aria-current={(category || "All") === c ? "page" : undefined}>{c}</Link>)}</nav>
        {posts.length ? <div className="research-grid">{posts.map(p => <article key={p.slug} className="research-card"><span className="research-category">{p.category}</span><h3><Link href={`/blog/${p.slug}`}>{p.title}</Link></h3><p>{p.summary}</p><div className="research-meta"><time dateTime={p.date}>{p.date}</time><span>{p.author || "Coldproof"}</span></div><Link className="research-read" href={`/blog/${p.slug}`}>Read publication →</Link></article>)}</div> : <div className="research-empty"><h3>No publications in this category yet.</h3><p>Research reports will appear here after evidence review and editorial approval.</p><Link href="/blog">Browse all publications →</Link></div>}
      </section><section className="panel"><ResearchSubscribe /></section>
    </main><Footer /><BrandClose />
  </div>;
}
