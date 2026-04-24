import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildExamples, type BuildExample } from "../../companions/build/examples";

const SLUG_RE = /^[a-z][a-z0-9-]*$/;
const SKILL_EXAMPLES_DIR = resolve(__dirname, "../../companions/build/templates/skill-examples");

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

  it.each(buildExamples.map((e) => [e.slug] as const))(
    "%s has a matching skill template file",
    (slug) => {
      const path = resolve(SKILL_EXAMPLES_DIR, `${slug}.md`);
      expect(existsSync(path)).toBe(true);
      const content = readFileSync(path, "utf-8");
      // Sanity: template should substitute __NAME__ into the skill name and use MCP tools
      expect(content).toContain("__NAME__");
      expect(content).toContain("mcp__claudepanion__");
      // Must have YAML frontmatter with a name field
      expect(content).toMatch(/^---\s*\nname:\s*__NAME__-companion/m);
    }
  );
});
