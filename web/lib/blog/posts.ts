import type { ComponentType } from "react";
import BenchmarkDidntLie, { meta as benchmarkDidntLie } from "@/content/blog/benchmark-didnt-lie";
import HowWeMeasure, { meta as howWeMeasure } from "@/content/blog/how-we-measure";
import CbomVsPcbom, { meta as cbomVsPcbom } from "@/content/blog/cbom-vs-p-cbom";
import { getFilePosts } from "./files";
import type { Category, Evidence } from "./publication";

/**
 * The blog registry.
 *
 * Existing publications retain their TypeScript bodies and stable URLs.
 * New publications are discovered from validated structured content files.
 *
 * Every post declares where its figures came from. `70-marketing/CLAUDE.md`
 * makes "no stat without a source/run" a hard rule, and a blog post is the
 * easiest place on the site to quietly break it — so `sourceNote` is required,
 * not optional.
 */

export interface PostMeta {
  author?: string;
  updated?: string;
  version?: string;
  tags?: string[];
  evidence?: Evidence[];
  keyFindings?: string[];
  slug: string;
  title: string;
  /** ISO date, YYYY-MM-DD. Displayed and used for ordering. */
  date: string;
  category: Category;
  /** One-line summary — used for the index, and as the page description. */
  summary: string;
  /**
   * Provenance for the figures in the piece. Rendered under the headline, so a
   * reader knows which run produced the numbers before reading them.
   */
  sourceNote: string;
}

export interface Post extends PostMeta {
  Body: ComponentType;
}

const REGISTRY: Post[] = [
  { ...benchmarkDidntLie, Body: BenchmarkDidntLie },
  { ...howWeMeasure, Body: HowWeMeasure },
  { ...cbomVsPcbom, Body: CbomVsPcbom },
];

/** Newest first. */
function byDateDesc(a: Post, b: Post) {
  return b.date.localeCompare(a.date);
}

export function getAllPosts(): Post[] {
  const posts = [...REGISTRY, ...getFilePosts()];
  const slugs = new Set<string>();
  for (const post of posts) {
    if (slugs.has(post.slug)) throw new Error(`Duplicate publication slug: ${post.slug}`);
    slugs.add(post.slug);
  }
  return posts.sort(byDateDesc);
}

export function getRecentPosts(limit: number): Post[] {
  return getAllPosts().slice(0, limit);
}

export function getPostBySlug(slug: string): Post | null {
  return getAllPosts().find((p) => p.slug === slug) ?? null;
}

export function getAllSlugs(): string[] {
  return getAllPosts().map((p) => p.slug);
}
