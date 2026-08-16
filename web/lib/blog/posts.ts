import type { ComponentType } from "react";
import BenchmarkDidntLie, { meta as benchmarkDidntLie } from "@/content/blog/benchmark-didnt-lie";
import LatticeWeakness, { meta as latticeWeakness } from "@/content/blog/lattice-weakness-in-60-hours";
import CbomVsPcbom, { meta as cbomVsPcbom } from "@/content/blog/cbom-vs-p-cbom";

/**
 * The blog registry.
 *
 * Posts are TypeScript modules rather than markdown files on purpose: it keeps
 * the site free of a markdown pipeline it would otherwise need for three
 * articles, and it means a broken post fails `type-check` instead of rendering
 * blank in production.
 *
 * Every post declares where its figures came from. `70-marketing/CLAUDE.md`
 * makes "no stat without a source/run" a hard rule, and a blog post is the
 * easiest place on the site to quietly break it — so `sourceNote` is required,
 * not optional.
 */

export interface PostMeta {
  slug: string;
  title: string;
  /** ISO date, YYYY-MM-DD. Displayed and used for ordering. */
  date: string;
  category: string;
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
  { ...latticeWeakness, Body: LatticeWeakness },
  { ...cbomVsPcbom, Body: CbomVsPcbom },
];

/** Newest first. */
function byDateDesc(a: Post, b: Post) {
  return b.date.localeCompare(a.date);
}

export function getAllPosts(): Post[] {
  return [...REGISTRY].sort(byDateDesc);
}

export function getRecentPosts(limit: number): Post[] {
  return getAllPosts().slice(0, limit);
}

export function getPostBySlug(slug: string): Post | null {
  return REGISTRY.find((p) => p.slug === slug) ?? null;
}

export function getAllSlugs(): string[] {
  return REGISTRY.map((p) => p.slug);
}
