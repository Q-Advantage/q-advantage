import type { Metadata } from "next";
import Image from "next/image";
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
  const remaining = featured ? posts.filter(p => p.slug !== featured.slug) : posts;
  return <div className="coldproof-site research-page flex min-h-screen flex-col">
    <Header /><main className="flex-1">
      <div className="cpv2-wrap">
        <header className="research-intro"><div className="cp-mono">Coldproof Research</div>
          <h1>The economics of the<br className="research-desktop-break" /> post-quantum transition.</h1>
          <p>Independent, evidence-backed analysis to improve post-quantum cryptography investment decisions.</p>
        </header>
        <nav className="research-filters" aria-label="Publication categories">{["All", ...CATEGORIES].map(c => <Link key={c} href={c === "All" ? "/blog" : `/blog?category=${encodeURIComponent(c)}`} aria-current={(category || "All") === c ? "page" : undefined}>{c}</Link>)}</nav>
        {featured && <section className="research-feature" aria-label="Featured publication">
          <Link className="research-feature-image" href={`/blog/${featured.slug}`} aria-label={`Read ${featured.title}`}><Image src="/images/coldproof/hero-fiber.jpg" alt="" fill priority sizes="(max-width: 800px) 100vw, 55vw" /></Link>
          <div className="research-feature-copy"><span className="cp-mono">Featured / {featured.category}</span><h2><Link href={`/blog/${featured.slug}`}>{featured.title}</Link></h2><p>{featured.summary}</p><div className="research-meta"><time dateTime={featured.date}>{featured.date}</time><span>{featured.author || "Coldproof"}</span></div><Link className="research-read" href={`/blog/${featured.slug}`}>Read publication <span aria-hidden>→</span></Link></div>
        </section>}
        <section className="research-library" aria-labelledby="library-title"><div className="research-library-heading"><h2 id="library-title">{featured ? "More research" : category || "Publications"}</h2><a href="/blog/feed.xml">RSS feed ↗</a></div>
          {remaining.length ? <div className="research-grid">{remaining.map(p => <article key={p.slug} className="research-card"><span className="cp-mono">{p.category}</span><h3><Link href={`/blog/${p.slug}`}>{p.title}</Link></h3><p>{p.summary}</p><div className="research-meta"><time dateTime={p.date}>{p.date}</time><span>{p.author || "Coldproof"}</span></div><Link className="research-read" href={`/blog/${p.slug}`}>Read publication <span aria-hidden>→</span></Link></article>)}</div> : <div className="research-empty"><h3>No publications in this category yet.</h3><p>Research reports will appear here after evidence review and editorial approval.</p><Link href="/blog">Browse all publications →</Link></div>}
        </section>
        <p className="research-standard">Measured, independently sourced, or explicitly modelled with disclosed assumptions. <Link href="/blog/editorial-standards">Our editorial standard →</Link></p>
        <ResearchSubscribe />
      </div>
    </main><Footer /><BrandClose />
  </div>;
}
