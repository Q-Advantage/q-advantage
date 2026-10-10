import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import fs from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import template from "../content/research/_template.json";
import { getFilePosts } from "../lib/blog/files";
import { getAllPosts, getPostBySlug } from "../lib/blog/posts";
import { GET } from "../app/blog/feed.xml/route";
afterEach(() => vi.restoreAllMocks());
function mockFile(content: unknown) {
  vi.spyOn(fs, "existsSync").mockReturnValue(true);
  vi.spyOn(fs, "readdirSync").mockReturnValue(["test-only.json"] as never);
  vi.spyOn(fs, "readFileSync").mockReturnValue(JSON.stringify(content));
}
describe("File-to-publication pipeline, using test fixtures only", () => {
  it("keeps a draft out of lookup, archive and RSS", async () => {
    mockFile(template);
    expect(getPostBySlug(template.slug)).toBeNull();
    expect(getAllPosts().some(p => p.slug === template.slug)).toBe(false);
    expect(await GET().text()).not.toContain(template.slug);
  });
  it("discovers and renders structured content without React registry edits", async () => {
    mockFile({ ...template, slug: "test-only-fixture", title: "TEST ONLY — not a research publication", date: "2000-01-01", status: "published", approvedBy: "TEST FIXTURE — not a human approval", approvedAt: "2000-01-01", sections: [{ id: "test-section", title: "Test section", paragraphs: ["<script>TEST_ONLY</script>"], equation: "TEST_ONLY = -1", table: { headers: ["Test header"], rows: [["9999 — TEST ONLY"]] } }], downloads: [{ title: "Test supporting material", url: "/research/test-only.txt" }] });
    const [post] = getFilePosts();
    const html = renderToStaticMarkup(React.createElement(post.Body));
    expect(html).toContain('id="test-section"'); expect(html).toContain("<table>");
    expect(html).toContain("&lt;script&gt;"); expect(html).not.toContain("<script>");
    expect(html).toContain("Test supporting material");
    expect(getPostBySlug("test-only-fixture")?.title).toContain("TEST ONLY");
    expect(await GET().text()).toContain("test-only-fixture");
  });
});
