import { describe, it, expect } from "vitest";
import { renderCompanionIndex, renderRegistryIndex, renderRegistryIndexJs, renderClientIndex, slugToCamelCase } from "../../src/cli/codegen.js";

describe("codegen", () => {
  it("renderCompanionIndex emits exports binding manifest + tools", () => {
    const out = renderCompanionIndex({ slug: "my-thing", camelCase: "myThing" });
    expect(out).toContain('import { manifest } from "./manifest.js";');
    expect(out).toContain('import { tools } from "./server/tools.js";');
    expect(out).toContain('export const myThing: RegisteredCompanion = { manifest, tools };');
    expect(out).toContain("// AUTO-GENERATED");
  });

  it("renderRegistryIndex emits alphabetical-by-slug array", () => {
    const out = renderRegistryIndex([
      { slug: "zebra", camelCase: "zebra" },
      { slug: "alpha", camelCase: "alpha" },
    ]);
    expect(out.indexOf('"./alpha/index.js"')).toBeLessThan(out.indexOf('"./zebra/index.js"'));
    expect(out).toContain("export const companions: RegisteredCompanion[] = [alpha, zebra];");
  });

  it("renderRegistryIndexJs emits the tsc-equivalent compiled module (no type import/annotation)", () => {
    const out = renderRegistryIndexJs([
      { slug: "zebra", camelCase: "zebra" },
      { slug: "alpha", camelCase: "alpha" },
    ]);
    expect(out).toContain('import { alpha } from "./alpha/index.js";');
    expect(out).toContain('import { zebra } from "./zebra/index.js";');
    expect(out.indexOf('"./alpha/index.js"')).toBeLessThan(out.indexOf('"./zebra/index.js"'));
    // Compiled form: no `import type`, no `: RegisteredCompanion[]` annotation.
    expect(out).toContain("export const companions = [alpha, zebra];");
    expect(out).not.toContain("import type");
    expect(out).not.toContain("RegisteredCompanion");
  });

  it("slugToCamelCase handles digit-after-hyphen (regression: github-pr-reviewer-2)", () => {
    // Bug: /-([a-z])/ skipped digits, emitting the literal `githubPrReviewer-2`
    // which is invalid JS ("Missing initializer in const declaration").
    expect(slugToCamelCase("github-pr-reviewer-2")).toBe("githubPrReviewer2");
    expect(slugToCamelCase("a-2-b")).toBe("a2B");
    expect(slugToCamelCase("x-2y")).toBe("x2y");
    expect(slugToCamelCase("plain")).toBe("plain");
    // Output must be a valid JS identifier (no leftover hyphen).
    expect(slugToCamelCase("github-pr-reviewer-2")).not.toMatch(/-/);
  });

  it("renderRegistryIndex emits a valid identifier for a numeric-suffix slug", () => {
    const slug = "github-pr-reviewer-2";
    const out = renderRegistryIndex([{ slug, camelCase: slugToCamelCase(slug) }]);
    expect(out).toContain("export const companions: RegisteredCompanion[] = [githubPrReviewer2];");
    expect(out).not.toContain("githubPrReviewer-2");
  });

  it("renderRegistryIndexJs emits a valid identifier for a numeric-suffix slug", () => {
    const slug = "github-pr-reviewer-2";
    const out = renderRegistryIndexJs([{ slug, camelCase: slugToCamelCase(slug) }]);
    expect(out).toContain("export const companions = [githubPrReviewer2];");
    expect(out).not.toContain("githubPrReviewer-2");
  });

  it("renderClientIndex registers null for missing override files", () => {
    const out = renderClientIndex([
      { slug: "alpha", camelCase: "alpha", hasForm: true, hasDetail: false, hasList: false },
    ]);
    expect(out).toContain('import AlphaForm from "./alpha/form";');
    expect(out).not.toContain('import AlphaDetail');
    expect(out).toContain('"alpha": AlphaForm');
  });
});
