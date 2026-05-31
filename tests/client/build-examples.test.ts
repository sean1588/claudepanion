import { describe, it, expect } from "vitest";
import { buildExamples, serializeBuildPrompt, type BuildExample } from "../../companions/build/examples";

const SLUG_RE = /^[a-z][a-z0-9-]*$/;

describe("buildExamples", () => {
  it("exports exactly 3 entries", () => {
    expect(buildExamples).toHaveLength(3);
  });

  it.each(buildExamples.map((e) => [e.slug, e] as const))(
    "%s has a valid shape",
    (_slug, ex: BuildExample) => {
      expect(ex.slug).toMatch(SLUG_RE);
      expect(["ui", "tool"]).toContain(ex.kind);
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

describe("serializeBuildPrompt execution mode", () => {
  const uiParts = {
    kind: "ui" as const,
    goal: "Do a thing",
    formFields: [],
    artifactTemplate: "",
    behavior: "Read-only.",
  };

  it("emits a HEADLESS instruction when execution is headless", () => {
    const out = serializeBuildPrompt({ ...uiParts, execution: "headless" });
    expect(out).toContain('execution: "headless"');
    expect(out).toMatch(/WITHOUT a slash command/);
    expect(out).toMatch(/never pause for confirmation/);
  });

  it("says nothing about execution for interactive (manifest omits the field)", () => {
    const out = serializeBuildPrompt({ ...uiParts, execution: "interactive" });
    expect(out).not.toMatch(/execution:/);
    expect(out).not.toMatch(/HEADLESS/);
  });
});
