import { describe, it, expect } from "vitest";
import { buildExamples, type BuildExample } from "../../companions/build/examples";

const SLUG_RE = /^[a-z][a-z0-9-]*$/;

describe("buildExamples", () => {
  it("exports exactly 5 entries", () => {
    expect(buildExamples).toHaveLength(5);
  });

  it.each(buildExamples.map((e) => [e.slug, e] as const))(
    "%s has a valid shape",
    (_slug, ex: BuildExample) => {
      expect(ex.slug).toMatch(SLUG_RE);
      expect(["entity", "tool"]).toContain(ex.kind);
      expect(ex.displayName.trim()).not.toBe("");
      expect(ex.icon.trim()).not.toBe("");
      expect(ex.description.trim()).not.toBe("");
    }
  );

  it("has unique slugs", () => {
    const slugs = buildExamples.map((e) => e.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});
