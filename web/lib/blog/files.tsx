import fs from "node:fs";
import path from "node:path";
import { Prose, P, H2, UL } from "@/components/blog/Prose";
import { validatePublication, isPublic, type Publication } from "./publication";

export function readPublications(): Publication[] {
  const directory = path.join(process.cwd(), "content/research");
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory).filter(f => f.endsWith(".json")).map(file => {
    try { return validatePublication(JSON.parse(fs.readFileSync(path.join(directory, file), "utf8"))); }
    catch (error) { throw new Error(`${file}: ${String(error)}`); }
  });
}

export function getFilePosts() {
  return readPublications().filter(p => isPublic(p)).map(p => ({ ...p, Body: () => <PublicationBody publication={p} /> }));
}

function PublicationBody({ publication: p }: { publication: Publication }) {
  return <Prose>
    <nav aria-label="Article contents" className="research-contents"><strong>In this publication</strong><ul>{p.sections.map(s => <li key={s.id}><a href={`#${s.id}`}>{s.title}</a></li>)}</ul></nav>
    {p.sections.map(s => <section key={s.id} id={s.id} className="scroll-mt-28">
      <H2>{s.title}</H2>{s.paragraphs?.map((text, i) => <P key={i}>{text}</P>)}
      {s.bullets && <UL>{s.bullets.map((text, i) => <li key={i}>{text}</li>)}</UL>}
      {s.equation && <pre className="research-equation"><code>{s.equation}</code></pre>}
      {s.table && <div className="research-table" role="region" aria-label={s.title} tabIndex={0}><table><thead><tr>{s.table.headers.map((h, i) => <th scope="col" key={i}>{h}</th>)}</tr></thead><tbody>{s.table.rows.map((r, i) => <tr key={i}>{r.map((cell, j) => <td key={j}>{cell}</td>)}</tr>)}</tbody></table></div>}
      {s.figure && <figure className="my-8">{/* Approved diagrams keep their original dimensions. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={s.figure.src} alt={s.figure.alt} loading="lazy" className="h-auto w-full" /><figcaption className="mt-3 text-sm">{s.figure.caption}</figcaption></figure>}
    </section>)}
    <section id="references"><H2>Sources & references</H2><ol className="list-decimal space-y-3 pl-5">{p.sources.map((s, i) => <li key={i}><a className="text-link underline" href={s.url}>{s.title}</a></li>)}</ol></section>
    {!!p.downloads?.length && <section><H2>Supporting material</H2><UL>{p.downloads.map(d => <li key={d.url}><a href={d.url} className="text-link underline">{d.title}</a></li>)}</UL></section>}
  </Prose>;
}
