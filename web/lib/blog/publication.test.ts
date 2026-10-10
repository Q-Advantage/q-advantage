import { describe, expect, it } from "vitest";
import template from "../../content/research/_template.json";
import { isPublic, validatePublication } from "./publication";
describe("Editorial publication gate", () => {
  it("excludes drafts even with approval", () => {
    expect(isPublic({ status: "draft", date: "2026-01-01", approvedBy: "Human editor", approvedAt: "2026-01-01" }, "2026-10-10")).toBe(false);
  });
  it("rejects published content without recorded human approval", () => {
    expect(() => validatePublication({ ...template, status: "published" })).toThrow("Human approval");
  });
  it("withholds future publications and includes approved due publications", () => {
    const p = validatePublication({ ...template, status: "published", approvedBy: "Human editor", approvedAt: "2026-10-09" });
    expect(isPublic(p, "2026-10-09")).toBe(false);
    expect(isPublic(p, "2026-10-10")).toBe(true);
  });
  it("rejects unsafe source URLs and impossible dates", () => {
    expect(() => validatePublication({ ...template, sources: [{ title: "Unsafe", url: "javascript:alert(1)" }] })).toThrow("sources");
    expect(() => validatePublication({ ...template, date: "2026-02-30" })).toThrow("dates");
  });
  it("rejects duplicate section anchors and unlabelled figures", () => {
    expect(() => validatePublication({ ...template, sections: [template.sections[0], template.sections[0]] })).toThrow("section");
    expect(() => validatePublication({ ...template, sections: [{ id: "chart", title: "Chart", figure: { src: "/research/chart.png", alt: "", caption: "Source" } }] })).toThrow("Figure");
  });
});
