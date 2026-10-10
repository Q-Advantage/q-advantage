export const CATEGORIES = ["Research Reports", "Analysis", "Data & Methods"] as const;
export type Category = typeof CATEGORIES[number];
export const EVIDENCE = ["measured", "independently sourced", "modelled", "assumption", "unverified"] as const;
export type Evidence = typeof EVIDENCE[number];
export interface Publication {
  slug: string; title: string; summary: string; date: string; category: Category;
  author: string; sourceNote: string; status: "draft" | "published";
  approvedBy?: string; approvedAt?: string; updated?: string; version?: string;
  tags?: string[]; evidence: Evidence[]; keyFindings?: string[];
  sections: Array<{ id: string; title: string; paragraphs?: string[];
    bullets?: string[]; equation?: string;
    table?: { headers: string[]; rows: string[][] };
    figure?: { src: string; alt: string; caption: string } }>;
  sources: Array<{ title: string; url: string }>;
  downloads?: Array<{ title: string; url: string }>;
}

function validDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
function safeUrl(value: unknown): value is string {
  return typeof value === "string" && (/^https:\/\//.test(value) || /^\/(?!\/)/.test(value));
}
/** Validate all files, including drafts. Fail closed rather than silently publishing malformed content. */
export function validatePublication(input: unknown): Publication {
  if (!input || typeof input !== "object") throw new Error("Publication must be an object");
  const p = input as Publication;
  for (const key of ["slug", "title", "summary", "author", "sourceNote"] as const) {
    if (typeof p[key] !== "string" || !p[key].trim()) throw new Error(`Missing ${key}`);
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(p.slug)) throw new Error("Invalid slug");
  if (p.slug === "editorial-standards") throw new Error("Reserved slug");
  if (!validDate(p.date) || (p.updated !== undefined && (!validDate(p.updated) || p.updated < p.date))) throw new Error("Invalid publication dates");
  if (!CATEGORIES.includes(p.category)) throw new Error("Invalid category");
  if (!["draft", "published"].includes(p.status)) throw new Error("Invalid status");
  if (!Array.isArray(p.evidence) || !p.evidence.length || p.evidence.some(e => !EVIDENCE.includes(e))) throw new Error("Invalid evidence classification");
  if (p.status === "published" && (typeof p.approvedBy !== "string" || !p.approvedBy.trim() || !validDate(p.approvedAt) || p.approvedAt > p.date)) throw new Error("Human approval required before publication");
  if (!Array.isArray(p.sections) || !p.sections.length) throw new Error("Sections required");
  const ids = new Set<string>();
  for (const s of p.sections) {
    if (!s || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s.id) || ids.has(s.id) || typeof s.title !== "string" || !s.title.trim()) throw new Error("Invalid or duplicate section");
    ids.add(s.id);
    for (const list of [s.paragraphs, s.bullets]) if (list !== undefined && (!Array.isArray(list) || list.some(x => typeof x !== "string"))) throw new Error("Invalid section text");
    if (s.equation !== undefined && typeof s.equation !== "string") throw new Error("Invalid equation");
    if (s.table && (!Array.isArray(s.table.headers) || !s.table.headers.length || s.table.headers.some(x => typeof x !== "string") || !Array.isArray(s.table.rows) || s.table.rows.some(r => !Array.isArray(r) || r.length !== s.table!.headers.length || r.some(x => typeof x !== "string")))) throw new Error("Invalid table");
    if (s.figure && (!/^\/research\/(?!.*\.\.)/.test(s.figure.src) || !s.figure.alt?.trim() || !s.figure.caption?.trim())) throw new Error("Figure requires approved local asset, alt text and caption");
  }
  if (!Array.isArray(p.sources) || !p.sources.length || p.sources.some(s => !s || typeof s.title !== "string" || !s.title.trim() || !safeUrl(s.url))) throw new Error("Traceable sources required");
  if (p.downloads !== undefined && (!Array.isArray(p.downloads) || p.downloads.some(s => !s || typeof s.title !== "string" || !s.title.trim() || !safeUrl(s.url)))) throw new Error("Invalid downloads");
  for (const list of [p.tags, p.keyFindings]) if (list !== undefined && (!Array.isArray(list) || list.some(x => typeof x !== "string"))) throw new Error("Invalid metadata list");
  if (p.version !== undefined && typeof p.version !== "string") throw new Error("Invalid version");
  return p;
}

export function isPublic(p: Pick<Publication, "status" | "date" | "approvedBy" | "approvedAt">, today = new Date().toISOString().slice(0, 10)): boolean {
  return p.status === "published" && !!p.approvedBy?.trim() && !!p.approvedAt && p.approvedAt <= p.date && p.date <= today;
}
