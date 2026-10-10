import { getAllPosts } from "@/lib/blog/posts";
export const dynamic = "force-static";
const escape = (s: string) => s.replace(/[<>&"']/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" }[c]!));
export function GET() {
  const items = getAllPosts().map(p => `<item><title>${escape(p.title)}</title><link>https://coldproof.io/blog/${p.slug}</link><guid isPermaLink="true">https://coldproof.io/blog/${p.slug}</guid><description>${escape(p.summary)}</description><category>${escape(p.category)}</category><pubDate>${new Date(p.date).toUTCString()}</pubDate></item>`).join("");
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Coldproof Research</title><link>https://coldproof.io/blog</link><description>Evidence for post-quantum investment decisions.</description><language>en</language>${items}</channel></rss>`, { headers: { "Content-Type": "application/rss+xml; charset=utf-8" } });
}
