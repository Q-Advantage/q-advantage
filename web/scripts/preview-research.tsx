import React from "react";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { validatePublication } from "../lib/blog/publication";
const file = process.argv[2];
if (!file) throw new Error("Usage: npm run preview:research -- content/research/article.json");
const p = validatePublication(JSON.parse(fs.readFileSync(file, "utf8")));
const output = path.join(os.tmpdir(), `coldproof-preview-${p.slug}.html`);
const html = renderToStaticMarkup(<html lang="en"><head><meta charSet="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>{`${p.title} — private preview`}</title><style>{`body{font-family:system-ui,sans-serif;color:#172130;max-width:760px;margin:48px auto;padding:24px;line-height:1.75}h1{font-size:42px;line-height:1.1}h2{margin-top:48px;line-height:1.2}aside{padding:20px;background:#eff5ff;border-left:3px solid #2563eb}table{border-collapse:collapse;width:100%}td,th{padding:12px;border-bottom:1px solid #ccc;text-align:left}pre{overflow:auto}img{max-width:100%}a{color:#174896}.table{overflow:auto}`}</style></head><body>
  <aside>Private local preview · {p.status} · This file does not publish an article or record approval.</aside><p>{p.category} · {p.author} · {p.date}</p><h1>{p.title}</h1><p>{p.summary}</p><p>Sources: {p.sourceNote}</p>
  {!!p.keyFindings?.length && <aside><h2>Executive summary</h2><ul>{p.keyFindings.map((f, i) => <li key={i}>{f}</li>)}</ul></aside>}
  {p.sections.map(s => <section key={s.id}><h2>{s.title}</h2>{s.paragraphs?.map((t, i) => <p key={i}>{t}</p>)}{s.bullets && <ul>{s.bullets.map((t, i) => <li key={i}>{t}</li>)}</ul>}{s.equation && <pre>{s.equation}</pre>}{s.table && <div className="table"><table><thead><tr>{s.table.headers.map((h, i) => <th key={i}>{h}</th>)}</tr></thead><tbody>{s.table.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody></table></div>}{s.figure && <figure><img src={`file:///${path.join(process.cwd(), "public", s.figure.src).replace(/\\/g, "/")}`} alt={s.figure.alt} /><figcaption>{s.figure.caption}</figcaption></figure>}</section>)}
  <h2>References</h2><ol>{p.sources.map((s, i) => <li key={i}><a href={s.url}>{s.title}</a></li>)}</ol>
</body></html>);
fs.writeFileSync(output, `<!doctype html>${html}`);
console.log(`Private draft preview: ${output}`);
