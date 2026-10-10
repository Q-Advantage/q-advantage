import fs from "node:fs";
import path from "node:path";
import { readPublications } from "../lib/blog/files";
import { getAllPosts } from "../lib/blog/posts";
const publications = readPublications();
const slugs = new Set(["how-we-measure", "benchmark-didnt-lie", "cbom-vs-p-cbom"]);
for (const p of publications) {
  if (slugs.has(p.slug)) throw new Error(`Duplicate publication slug: ${p.slug}`);
  slugs.add(p.slug);
  if (p.slug === "editorial-standards") throw new Error("Reserved publication slug");
  for (const s of p.sections) if (s.figure && !fs.existsSync(path.join(process.cwd(), "public", s.figure.src))) throw new Error(`${p.slug}: missing figure ${s.figure.src}`);
  for (const d of p.downloads || []) if (d.url.startsWith("/") && !fs.existsSync(path.join(process.cwd(), "public", d.url))) throw new Error(`${p.slug}: missing download ${d.url}`);
}
console.log(`Validated ${publications.length} content files; ${getAllPosts().length} public publications. Drafts are excluded from public routes, RSS and sitemap.`);
