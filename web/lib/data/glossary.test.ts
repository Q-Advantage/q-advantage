import { describe, expect, it } from "vitest";
import {
  CATEGORY_ORDER,
  GLOSSARY,
  byCategory,
  termAnchor,
  unsourced,
} from "./glossary";

describe("the sourcing standard applies to definitions too", () => {
  it("gives every entry either a primary source or an explicit null", () => {
    // The standard: "an uncited identity block is the same failure mode as a
    // fabricated benchmark". `undefined` would be an entry nobody decided
    // about; `null` is a decision that the page then surfaces.
    for (const t of GLOSSARY) {
      expect(t.source, `${t.term} has an undecided source`).not.toBeUndefined();
    }
  });

  it("never ships a source with an empty label", () => {
    for (const t of GLOSSARY) {
      if (t.source) expect(t.source.label.trim().length, `${t.term}`).toBeGreaterThan(0);
    }
  });

  it("keeps the uncited set small and surfaced", () => {
    // Not a cap for its own sake: the page prints this count, so an entry
    // quietly slipping into the uncited pile has to be a visible choice.
    const uncited = unsourced();
    expect(uncited.length).toBeLessThan(GLOSSARY.length / 2);
    expect(uncited.every((t) => t.source === null)).toBe(true);
  });

  it("cites a named document rather than a bare URL", () => {
    // A link can rot; the document name survives it.
    for (const t of GLOSSARY) {
      if (t.source) expect(t.source.label, `${t.term}`).not.toMatch(/^https?:/);
    }
  });
});

describe("entry hygiene", () => {
  it("has no duplicate terms", () => {
    const seen = new Set(GLOSSARY.map((t) => t.term.toLowerCase()));
    expect(seen.size).toBe(GLOSSARY.length);
  });

  it("produces a unique anchor for every term", () => {
    const anchors = GLOSSARY.map((t) => termAnchor(t.term));
    expect(new Set(anchors).size).toBe(anchors.length);
  });

  it("produces url-safe anchors", () => {
    for (const t of GLOSSARY) {
      expect(termAnchor(t.term)).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it("gives every entry a definition of real substance", () => {
    for (const t of GLOSSARY) {
      expect(t.definition.length, `${t.term} is too thin`).toBeGreaterThan(60);
    }
  });

  it("assigns every entry to a known category", () => {
    for (const t of GLOSSARY) {
      expect(CATEGORY_ORDER, `${t.term}`).toContain(t.category);
    }
  });

  it("puts every entry into exactly one rendered category", () => {
    const rendered = CATEGORY_ORDER.flatMap((c) => byCategory(c));
    expect(rendered).toHaveLength(GLOSSARY.length);
  });

  it("alphabetises within a category", () => {
    for (const c of CATEGORY_ORDER) {
      const names = byCategory(c).map((t) => t.term);
      expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    }
  });
});

describe("the corrections are the point", () => {
  it("states the correction for terms with a common misreading", () => {
    // These four are the ones where a plausible wrong definition is the usual
    // case rather than the exception, so a bare definition would underserve.
    for (const term of ["SLH-DSA", "LMS", "Composed handshake", "Confidence interval"]) {
      const t = GLOSSARY.find((g) => g.term === term)!;
      expect(t.commonlyConfusedWith, `${term} lost its correction`).toBeTruthy();
    }
  });

  it("keeps the stateless/stateful distinction explicit on the hash-based schemes", () => {
    const slh = GLOSSARY.find((t) => t.term === "SLH-DSA")!;
    const lms = GLOSSARY.find((t) => t.term === "LMS")!;
    expect(slh.definition.toLowerCase()).toContain("stateless");
    expect(lms.definition.toLowerCase()).toContain("stateful");
    // The hazard, not just the label: reusing an index breaks the guarantee.
    expect(lms.definition.toLowerCase()).toMatch(/once|reus/);
  });

  it("does not let the confidence-interval entry read as a standard deviation", () => {
    const ci = GLOSSARY.find((t) => t.term === "Confidence interval")!;
    expect(ci.commonlyConfusedWith).toContain("Standard deviation");
  });

  it("flags the hybrid code point as unconfirmed rather than asserting it", () => {
    const g = GLOSSARY.find((t) => t.term === "X25519MLKEM768")!;
    expect(g.source).toBeNull();
    expect(g.commonlyConfusedWith).toContain("IANA");
  });
});
